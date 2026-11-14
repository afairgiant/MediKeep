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

The import runs in two steps through the API (`/api/v1/health-records`, see the developer guide): a **preview** that reads the file and reports what would happen, then an **execute** that writes the rows. The preview shows:

| Section | What it tells you |
|---------|-------------------|
| **Counts** | Per record type, how many rows are new, duplicates of an earlier import, or changed |
| **Patient in file** | The name and birth date of the patient the file describes, with a warning when they differ from the selected patient. A patient record without a usable name or birth date gets a warning that it could not be checked. See [Files with more than one person](#files-with-more-than-one-person) |
| **Unsupported** | Resource types in the file that MediKeep does not import yet |
| **Warnings** | Sections the converter does not map, entries it skipped, values that were shortened to fit, and a count of records that two documents in a zip describe differently (the newest document's version is kept; when the documents have the same date or no date, the version from the one later in the zip is kept and the warning says so) |

### Files with more than one person

A portal download is for one person, but a zip put together by hand can hold documents for several. MediKeep goes by the birth date, since a name can change or be shortened and a birth date cannot. Nobody is left out unless the file holds someone with the selected patient's birth date: without that, nothing in the file says which records are the selected patient's.

A birth date given only as a year, or a year and month, is compared as far as it goes. A different year or month is a different birth date. The same year or month is not: it neither confirms the person nor counts against them.

When the file does hold someone with the selected patient's birth date:

| Person in the file | What happens |
|--------------------|--------------|
| Same birth date as the selected patient, same name | Imported |
| Same birth date, different name | Imported, with a warning that names them. Check the preview before you execute |
| No birth date in the file, or only a year or month that fits the selected patient's | Imported and compared by name only: a warning if the name differs, none if it is the same. With neither a usable name nor a birth date, a warning that the person could not be checked |
| Different birth date | Left out. The preview and the result say who was left out, with the birth date as the file gives it, and how many records |

When someone is left out, MediKeep imports only the records it can tie to a person who is kept. A record that names a patient who cannot be found in the file is left out too, and one warning counts them. Records that name no patient, such as an organization or a medication definition, are kept.

The patient warnings come in this order: the count of records whose patient could not be found, one line per person left out, then the warnings about the people kept. At most 20 are listed and one more line counts the rest.

When nobody in the file has the selected patient's birth date, what counts is the birth dates in it that differ from the selected patient's. A person with no birth date, or with only a year or month that fits the selected patient's, is not counted here:

| The birth dates that differ from the selected patient's | What happens |
|----------|--------------|
| They can all be one person's: the same date, or a year or month and a date within it | Treated as a file about one person and imported whole with name and birth date warnings, so a birth date entered wrongly in MediKeep does not block an import. The people who are not counted are imported with it |
| Two of them cannot be one person's | Refused. Import each person's file into their own patient instead |

For example, with a selected patient born 1980-04-12, a file with one person given as 1980 and another as 1975-01-01 is imported whole with warnings: only 1975-01-01 differs.

Three kinds of file are refused because the people in them cannot be told apart:

- A file in which a person who would be left out and a person who would be kept have the same patient id, so a record could belong to either.
- A zip in which documents use the same ids for records of people with different birth dates, so one person's records would replace the other's when the documents are combined. Import each document separately.
- A zip in which documents give different birth dates for the same patient id, so two people would become one. Import each document separately.

A zip is not refused for either reason when a document gives no birth date, or when the birth dates can be one person's. Documents that give one person different patient ids are combined as before. When documents give the same patient id a birth date in full and as a year or month only, the full one is used.

Two people who share a birth date, such as twins, are not told apart automatically. The warning names them, and the documents should be imported one at a time: in a zip, records of theirs with the same ids are combined as if they were one person's.

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
