# Lab Result PDF Parsing

MediKeep can automatically extract test results from PDF lab reports, saving you from manual data entry.

---

## Overview

When you upload a PDF lab report, MediKeep reads the document, identifies individual test results, and extracts the key data for each test. You can review the extracted results, make corrections, and save them to the patient's lab results.

---

## Supported Lab Formats

MediKeep automatically detects and parses reports from:

- **LabCorp** (Laboratory Corporation of America)
- **Quest Diagnostics**

The system identifies the lab provider by scanning for signature indicators in the PDF (e.g., company name, website, copyright notices) and applies the appropriate parser.

---

## How to Use

### Step 1: Navigate to Lab Results

Go to the patient's profile and open the **Lab Results** section.

### Step 2: Upload a PDF

Click **Upload PDF** (or **Parse Lab Results**) and select your PDF lab report.

### Step 3: Review Extracted Results

MediKeep processes the PDF and displays the extracted test results. For each test, the system extracts:

| Field | Description |
|-------|-------------|
| **Test Name** | Name of the lab test |
| **Value** | The test result value |
| **Unit** | Unit of measurement |
| **Reference Range** | Normal range for comparison |
| **Flag** | Abnormal indicators (High, Low, Critical) |
| **Test Date** | Date the sample was collected or reported |

### Step 4: Match to Standardized Tests

Extracted test names can be matched to MediKeep's standardized lab test definitions, which helps with consistent tracking and trend analysis over time.

### Step 5: Confirm and Save

Review the extracted data, make any necessary corrections, and save the results to the patient's record.

---

## Tips for Best Results

- **Use digital PDFs when possible.** PDFs generated directly by the lab (not scanned paper copies) produce the most accurate results.
- **Standard lab report formats work best.** Reports from LabCorp, Quest Diagnostics, and Epic MyChart are specifically supported.
- **Check for OCR artifacts.** If your PDF was created from a scanned image, some values may need manual correction. The system handles common OCR mistakes automatically (e.g., correcting misread characters in test names and units), but unusual formatting may require review.
- **One report at a time.** Upload individual lab reports rather than combined multi-visit documents for the most accurate date assignment.

---

## Manual Corrections

After extraction, you can correct any values before saving:

- **Edit test names** - Fix any misread or abbreviated test names
- **Adjust values and units** - Correct any OCR errors in numeric results
- **Update reference ranges** - Modify ranges if they don't match what's on your report
- **Change flags** - Update High/Low/Critical indicators as needed
- **Remove unwanted tests** - Delete any rows that were incorrectly extracted

All corrections are made in the review screen before the results are saved to the patient's record.

---

## Need Help?

- [User Guide](User-Guide) - General MediKeep usage
- [FAQ](FAQ) - Common questions
