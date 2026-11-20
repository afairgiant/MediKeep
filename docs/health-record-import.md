# Health Record Import

MediKeep can import the clinical summary your patient portal lets you download, so records that already exist at your hospital do not have to be typed in again.

---

## What Can Be Imported

The importer reads three kinds of file:

- A **C-CDA XML document** (Continuity of Care Document), the HL7 format most US portals use for "Download my record"
- The **zip file Epic MyChart saves** for that download. Upload it as is.
- A **FHIR R4 Bundle** in JSON, for records that come from another tool

Records are added to a patient that already exists in MediKeep. The import never creates a patient and never changes the patient's own details.

C-CDA and zip support needs the `healthrecord-bridge` package. The Docker image includes it. On a bare install, run `pip install -r requirements-import.txt`; without it only FHIR bundles are accepted.

The test suite includes a synthetic export in Epic's real layout, generated from a real MyChart download: names and identifiers are replaced, the clinical sections are made up and dates are shifted, so the importer is exercised against the sections and nesting Epic actually produces.

---

## Downloading Your Record from MyChart

1. Sign in to MyChart in a browser.
2. Open the menu, then **Sharing Hub** (some organizations call it **Share My Record** or **Request Medical Records**).
3. Choose **Yourself**, then **Download**. Not "Request formal copy of health record", which goes to the records department and comes back as a PDF.
4. Choose **All visits** for a first import.
5. Save the zip. It holds a `MachineReadable_XDMFormat` folder with the C-CDA inside. Leave it zipped.

Each hospital system has its own MyChart. Download from each one separately.

---

## How to Import

The import runs in two steps through the API (`/api/v1/health-records`, see the developer guide): a **preview** that reads the file and reports what would happen, then an **execute** that writes the rows. A file can be up to 50 MB. A zip can hold up to 500 entries, and its documents up to 50 MB each and 250 MB together once unpacked. The preview shows:

| Section | What it tells you |
|---------|-------------------|
| **Counts** | Per record type, how many rows are new, duplicates of an earlier import, or changed |
| **Patient in file** | The name and birth date of the patient the file describes, with a warning when they differ from the selected patient. A patient record without a usable name or birth date gets a warning that it could not be checked, and one with a matching name but no birth date a warning that only the name could be checked. See [Files with more than one person](#files-with-more-than-one-person) |
| **Unsupported** | Resource types in the file that MediKeep does not import yet |
| **Warnings** | Sections the converter does not map, entries it skipped, values that were shortened to fit, and a count of records that two documents in a zip describe differently (the newest document's version is kept; when one of the documents has no date, the version from the latest dated document is kept, and when the documents have the same date or no date, the version from the one later in the zip is kept; the warning says which) |

### Files with more than one person

A portal download is for one person, but a zip put together by hand can hold documents for several. MediKeep goes by the birth date, since a name can change or be shortened and a birth date cannot. Nobody is left out unless the file holds someone with the selected patient's birth date: without that, nothing in the file says which records are the selected patient's.

A birth date given only as a year, or a year and month, is compared as far as it goes. A different year or month is a different birth date. The same year or month is not: it neither confirms the person nor counts against them.

When the file does hold someone with the selected patient's birth date:

| Person in the file | What happens |
|--------------------|--------------|
| Same birth date as the selected patient, same name | Imported |
| Same birth date, different name | Imported, with a warning that names them. Check the preview before you execute |
| No birth date in the file | Imported and compared by name only: a warning if the name differs, and if it is the same a warning that only the name could be checked. With neither a usable name nor a birth date, a warning that the person could not be checked |
| Only a year or month, which fits the selected patient's | Imported and compared by name only: a warning if the name differs, none if it is the same |
| Different birth date | Left out. The preview and the result say who was left out, with the birth date as the file gives it, and how many records. A person who has no records in the file is left out without a line |

When someone is left out, MediKeep imports a problem, allergy or medication only when it names a person who is kept. A record that names a patient who cannot be found in the file is left out too, and so is a problem, allergy or medication that names no patient at all; one warning counts them. Other records that name no patient, such as an organization or a medication definition, are kept: they are about nobody in particular and are not stored as records of their own. When nobody is left out, the file is taken to be about one person and a record that names no patient is imported with the rest.

The patient warnings come in this order: the count of records whose patient could not be found, one line per person who had records left out, then the warnings about the people kept. At most 20 are listed and one more line counts the rest.

When nobody in the file has the selected patient's birth date, what counts is the birth dates in it that differ from the selected patient's. A person with no birth date, or with only a year or month that fits the selected patient's, is not counted here:

| The birth dates that differ from the selected patient's | What happens |
|----------|--------------|
| They can all be one person's: the same date, or a year or month and a date within it | Treated as a file about one person and imported whole with name and birth date warnings, so a birth date entered wrongly in MediKeep does not block an import. The people who are not counted are imported with it |
| Two of them cannot be one person's | Refused. Import each person's file into their own patient instead |

For example, with a selected patient born 1980-04-12, a file with one person given as 1980 and another as 1975-01-01 is imported whole with warnings: only 1975-01-01 differs.

Four kinds of file are refused because the people in them cannot be told apart:

- A file in which a person who would be left out and a person who would be kept have the same patient id, so a record could belong to either.
- A zip in which documents use the same ids for records under different patient ids, unless both patients have the same full birth date (year, month and day). Without that, nothing shows that the records are one person's, and one person's records could replace the other's when the documents are combined. Import each document separately.
- A zip in which documents give different birth dates for the same patient id, so two people would become one. Import each document separately.
- A zip in which documents under different patient ids describe a medication definition with the same id differently, unless both patients have the same full birth date. A medication takes its drug from that definition, so one person's medication could be given another person's drug. Definitions that are the same in both documents are combined. A document with a medication that points, other than with a `#id` reference, to a definition it does not hold counts as describing that definition differently. Import each document separately.

A FHIR bundle is not refused for this. A medication that points to its medication definition with a `#id` reference uses only a definition it holds itself under exactly that id, never one elsewhere in the file. A medication with any other reference uses only the file's definitions, even when it holds one itself: the definition whose entry address (`fullUrl`) is the reference, else the one with the id in the reference. No definition is used when two different ones fit (two at that address, or, when none is at that address, two with that id), when the one found was left out with another person, or when the reference names a version and the one found is marked as a different version. A medication left without a definition is imported under the drug name it carries itself. When it carries none it is left out, with a warning only when two different definitions fit.

Documents with the same patient id are combined unless the birth dates they give for it cannot be one person's: a document that gives no birth date for it, or only a year or month that fits, is combined with the rest, records with the same ids included. Documents that give one person different patient ids are combined when they have no record ids in common, or when both patient ids have the same full birth date. A year or month only, or no birth date, for either patient id is not enough: with record ids in common the zip is refused, even when the documents are in fact one person's. When documents give the same patient id a birth date in full and as a year or month only, or not at all, the full one is used, also to tell whose a record is.

Two people who share a birth date, such as twins, are not told apart automatically. A warning names the other person only when their name differs from the selected patient's. In a zip, documents with the same patient id and birth date are also combined into one patient, under the name in the copy that is kept, so there may be no warning at all, and records of theirs with the same ids are combined as if they were one person's. Import such documents one at a time.

---

## What Gets Imported

| Section in the file | MediKeep records |
|---------------------|------------------|
| **Problems** | Conditions, with ICD-10 and SNOMED codes, onset and resolution dates and status |
| **Allergies** | Allergies, with reaction, severity, onset date and status. An allergy with no reaction listed is stored as "Not specified" |
| **Medications** | Medications, with dose, frequency, route, start and end dates and status. The full sig text is kept in the notes whenever the dose field does not hold it as written |

Immunizations, procedures, encounters, vital signs and lab results are converted but not written yet. The preview lists them under **Unsupported**.

---

## Re-importing

Rows are matched on the identifier in the file, then on their content. When you import a newer download:

- Rows that are new in the file are created
- Rows already imported and unchanged are skipped
- Rows you edited in MediKeep are left alone unless you turn off **skip edited**
- Rows the file changed are updated; notes and tags you added are kept

Each import writes one entry to the activity log with the counts.
