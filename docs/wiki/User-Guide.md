# User Guide

Welcome to the MediKeep User Guide. This guide will help you get started with using MediKeep to manage your medical records.

---

## Getting Started

### First Login

1. Navigate to your MediKeep instance
2. Log in with your credentials or SSO provider
3. You'll be taken to the Dashboard

### Creating Your First Patient Profile

MediKeep organizes records by patient. Your first step is to create a patient profile:

1. Click **Patients** in the sidebar
2. Click **Add Patient**
3. Fill in the basic information:
   - Name
   - Date of Birth
   - Relationship (Self, Spouse, Child, etc.)
4. Click **Save**

---

## Managing Medical Records

### Medications

Track your current and past medications:

- **Name**: Medication name
- **Dosage**: Amount and frequency
- **Status**: Active, Stopped, or As Needed
- **Prescriber**: Doctor who prescribed it
- **Notes**: Any additional information

### Allergies

Document allergies and reactions:

- **Allergen**: What you're allergic to
- **Reaction**: What happens when exposed
- **Severity**: Mild, Moderate, Severe, or Life-Threatening

### Conditions

Track diagnosed conditions:

- **Condition Name**: Diagnosis
- **Status**: Active, Resolved, or Chronic
- **Diagnosed Date**: When it was diagnosed
- **Notes**: Treatment history, symptoms, etc.

### Vitals

Record vital signs over time:

- Blood Pressure
- Heart Rate
- Temperature
- Weight/Height
- Blood Glucose
- Oxygen Saturation

### Lab Results

Store and track lab test results:

- Upload lab reports
- Enter individual test values
- Track trends over time
- Link to LOINC standardized codes

### Treatments

Track treatment plans and therapies. Treatments support two modes:

#### Simple Mode (default)

Basic tracking for physical therapy, exercises, or any treatment that doesn't need per-medication detail:

- **Treatment Name**: What the treatment is
- **Type/Category**: Physical therapy, surgery, etc.
- **Schedule & Dosage**: Frequency, dosage, and timing set directly on the treatment
- **Status**: Planned, Active, In Progress, Completed, Cancelled, On Hold
- **Practitioner**: Doctor managing the treatment
- **Condition**: Related diagnosis

#### Treatment Plan Mode (Advanced)

Medication-centric treatment plans where each linked medication can have its own treatment-specific overrides:

- **Linked Medications**: Add medications from your existing medication records
- **Per-Medication Overrides**: Set treatment-specific dosage, frequency, duration, start/end dates, prescriber, and pharmacy for each medication
- **Fallback to Defaults**: When an override is not set, the base medication's value is used automatically
- **Linked Encounters**: Associate doctor visits with the treatment plan
- **Linked Lab Results**: Track lab tests related to the treatment
- **Linked Equipment**: Track medical devices or equipment used

**Switching Modes**: You can switch between Simple and Treatment Plan mode at any time using the toggle on the treatment form. Existing treatments default to Simple mode.

#### Medication Profile

Each medication's detail view includes a "Used in Treatments" section showing all treatment plans that use it. Click a treatment name to navigate directly to that treatment plan.

---

## Documents & Files

### Uploading Documents

1. Navigate to a patient's profile
2. Go to the **Documents** section
3. Click **Upload**
4. Select your file (PDF, images, etc.)
5. Add a description and tags

### Organizing with Tags

Use tags to organize your records:
- Create custom tags (e.g., "Annual Checkup", "Urgent")
- Filter records by tag
- Apply multiple tags to a single record

---

## Sharing Records

### Share with Family Members

1. Go to **Settings** → **Sharing**
2. Click **Invite**
3. Enter the email address
4. Select permission level (View or Edit)
5. Send invitation

### Managing Shared Access

- View who has access to your records
- Revoke access at any time
- See sharing activity history

---

## Generating Reports

### Health Summary PDF

Generate a comprehensive PDF report:

1. Go to the patient's profile
2. Click **Generate Report**
3. Select what to include:
   - Medications
   - Allergies
   - Conditions
   - Recent Vitals
   - Lab Results
4. Click **Generate**
5. Download or print the PDF

---

## Tips & Best Practices

1. **Keep records up to date** - Update medications when they change
2. **Upload documents promptly** - Add lab results as soon as you receive them
3. **Use tags consistently** - Develop a tagging system that works for you
4. **Review regularly** - Check your records before doctor visits
5. **Share wisely** - Only share with people who need access

---

## Need Help?

- [FAQ](FAQ) - Common questions
- [Troubleshooting](Troubleshooting) - Solving problems
- [GitHub Discussions](https://github.com/afairgiant/MediKeep/discussions) - Community support
