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
| **Patient in file** | The name and birth date of the patient the file describes, with a warning when they differ from the selected patient. A zip whose documents describe more than one person gets a warning for each |
| **Unsupported** | Resource types in the file that MediKeep does not import yet |
| **Warnings** | Sections the converter does not map, entries it skipped, values that were shortened to fit, and a count of records that two documents in a zip describe differently (the newest document's version is kept) |

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
