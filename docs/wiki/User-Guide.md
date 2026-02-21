# User Guide

Welcome to the MediKeep User Guide. This guide will help you get started with using MediKeep to manage your medical records.

---

## Getting Started

### First Login

1. Navigate to your MediKeep instance
2. Log in with your credentials or SSO provider (Google, GitHub, or Microsoft)
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

MediKeep supports 14 categories of medical data. Each category is accessible from a patient's profile page.

### Medications

Track your current and past medications:

- **Name** - Medication name
- **Dosage** - Amount and frequency
- **Status** - Active, Stopped, or As Needed
- **Prescriber** - Doctor who prescribed it
- **Notes** - Any additional information

### Allergies

Document allergies and reactions:

- **Allergen** - What you're allergic to
- **Reaction** - What happens when exposed
- **Severity** - Mild, Moderate, Severe, or Life-Threatening

### Conditions

Track diagnosed conditions:

- **Condition Name** - Diagnosis
- **Status** - Active, Resolved, or Chronic
- **Diagnosed Date** - When it was diagnosed
- **Notes** - Treatment history, symptoms, etc.

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

- Upload lab reports (see [Lab Result PDF Parsing](Lab-Result-Parsing) for automatic extraction)
- Enter individual test values
- Track trends over time
- Link to standardized test codes

### Treatments

Track treatment plans and therapies. Treatments support two modes:

#### Simple Mode (default)

Basic tracking for physical therapy, exercises, or any treatment that doesn't need per-medication detail:

- **Treatment Name** - What the treatment is
- **Type/Category** - Physical therapy, surgery, etc.
- **Schedule & Dosage** - Frequency, dosage, and timing set directly on the treatment
- **Status** - Planned, Active, In Progress, Completed, Cancelled, On Hold
- **Practitioner** - Doctor managing the treatment
- **Condition** - Related diagnosis

#### Treatment Plan Mode (Advanced)

Medication-centric treatment plans where each linked medication can have its own treatment-specific overrides:

- **Linked Medications** - Add medications from your existing medication records
- **Per-Medication Overrides** - Set treatment-specific dosage, frequency, duration, start/end dates, prescriber, and pharmacy for each medication
- **Fallback to Defaults** - When an override is not set, the base medication's value is used automatically
- **Linked Encounters** - Associate doctor visits with the treatment plan
- **Linked Lab Results** - Track lab tests related to the treatment
- **Linked Equipment** - Track medical devices or equipment used

**Switching Modes**: You can switch between Simple and Treatment Plan mode at any time using the toggle on the treatment form. Existing treatments default to Simple mode.

#### Medication Profile

Each medication's detail view includes a "Used in Treatments" section showing all treatment plans that use it. Click a treatment name to navigate directly to that treatment plan.

### Immunizations

Track vaccinations and immunization history:

- **Vaccine Name** (required) - Name of the vaccine
- **Vaccine Trade Name** - Formal/trade name (e.g., Flublok TRIV 2025-2026)
- **Date Administered** (required) - When the vaccine was given
- **Dose Number** - Dose number in a series (1-10)
- **Lot Number** - Vaccine lot number
- **NDC Number** - National Drug Code number
- **Manufacturer** - Pfizer-BioNTech, Moderna, J&J, AstraZeneca, Merck, GSK, Sanofi, or Other
- **Site** - Injection site (e.g., Left Arm, Right Deltoid, Left Thigh)
- **Route** - How it was administered: Intramuscular, Subcutaneous, Intradermal, Oral, or Nasal
- **Expiration Date** - Vaccine expiration date
- **Location** - Where it was administered (clinic, pharmacy, etc.)
- **Notes** - Any additional information

### Procedures

Record surgical and medical procedures:

- **Procedure Name** (required) - Name of the procedure
- **Type** - Surgical, Diagnostic, Therapeutic, Preventive, or Emergency
- **Procedure Code** - CPT or other medical code
- **Date** (required) - When the procedure was/will be performed
- **Status** (required) - Scheduled, In Progress, Completed, Cancelled, or Postponed
- **Outcome** - Successful, Abnormal, Complications, Inconclusive, or Pending
- **Facility** - Where the procedure was performed
- **Setting** - Outpatient, Inpatient, Office, Emergency, or Home
- **Anesthesia Type** - General, Local, Regional, Sedation, or None
- **Duration** - Length in minutes
- **Complications** - Any complications that occurred
- **Notes** - General notes

### Injuries

Track injuries, their treatment, and recovery:

- **Injury Name** (required) - User-friendly name for the injury
- **Injury Type** - Select from predefined injury types (managed by your administrator)
- **Body Part** (required) - Affected body part
- **Laterality** - Left, Right, Bilateral, or Not Applicable
- **Date of Injury** - When the injury occurred
- **Severity** - Mild, Moderate, Severe, or Life-Threatening
- **Status** (required) - Active, Healing, Resolved, or Chronic
- **Mechanism** - How the injury happened
- **Treatment Received** - Description of treatment
- **Recovery Notes** - Recovery progress notes

Injuries can also be linked to related medications, conditions, treatments, and procedures.

### Symptoms

Track symptoms with a two-level system: define a symptom once, then log individual occurrences over time.

#### Symptom Definition

- **Symptom Name** (required) - What the symptom is
- **Category** - Symptom category
- **First Occurrence Date** (required) - When the symptom first appeared
- **Status** (required) - Active, Resolved, or Recurring
- **Is Chronic** - Whether the symptom is chronic
- **Typical Triggers** - Common triggers for this symptom

#### Symptom Occurrences

Each time the symptom occurs, log an occurrence with:

- **Date** (required) and **Time** - When the episode happened
- **Severity** (required) - Mild, Moderate, Severe, or Critical
- **Pain Scale** - 0 to 10
- **Duration** - How long the episode lasted
- **Location** - Where on the body
- **Impact Level** - No Impact, Mild, Moderate, Severe, or Debilitating
- **Triggers** - What triggered this specific episode
- **Relief Methods** - What helped relieve the symptom
- **Associated Symptoms** - Other symptoms present at the time
- **Resolution Notes** - How the episode resolved

MediKeep automatically tracks the total occurrence count and the date of the last occurrence.

### Encounters

Document visits and interactions with healthcare providers:

- **Reason** (required) - Reason for the encounter
- **Date** (required) - Date of the encounter
- **Visit Type** - Free text (e.g., Annual Checkup, Follow-Up, Consultation, Emergency)
- **Chief Complaint** - Patient's main complaint
- **Diagnosis** - Diagnosis or assessment
- **Treatment Plan** - Plan for treatment
- **Follow-Up Instructions** - Follow-up instructions
- **Duration** - Length in minutes
- **Location** - Doctor's Office, Hospital, Clinic, Telehealth, Urgent Care, Emergency Room, or Home
- **Priority** - Routine or Urgent
- **Notes** - Additional notes

### Medical Equipment

Track medical devices and equipment:

- **Equipment Name** (required) - Name of the equipment
- **Equipment Type** (required) - CPAP, BiPAP, Nebulizer, Inhaler, Blood Pressure Monitor, Glucose Monitor, Pulse Oximeter, Wheelchair, Walker, Cane, Crutches, Oxygen Concentrator, Oxygen Tank, Hearing Aid, Insulin Pump, Continuous Glucose Monitor, TENS Unit, Brace, Prosthetic, or Other
- **Manufacturer** - Equipment manufacturer
- **Model Number** - Model number
- **Serial Number** - Serial number
- **Prescribed Date** - When equipment was prescribed
- **Last Service Date** - Last maintenance date
- **Next Service Date** - Next scheduled service
- **Usage Instructions** - How to use the equipment
- **Status** - Active, Inactive, Replaced, Returned, or Lost
- **Supplier** - Equipment supplier
- **Notes** - General notes

### Insurance

Store insurance policy details with type-specific coverage information:

- **Insurance Type** (required) - Medical, Dental, Vision, or Prescription
- **Company Name** (required) - Insurance company
- **Member Name** (required) - Name on insurance card
- **Member ID** (required) - Policy/member number
- **Group Number** - Group number for employer-based plans
- **Plan Name** - Plan name or description
- **Policy Holder Name** - Name of the policy holder
- **Relationship to Holder** - Self, Spouse, Child, Dependent, or Other
- **Employer Group** - Employer name
- **Effective Date** (required) - Coverage start date
- **Expiration Date** - Coverage end date
- **Status** (required) - Active, Inactive, Expired, or Pending
- **Is Primary** - Whether this is your primary insurance

Depending on the insurance type, additional fields are available:

- **Medical** - Primary care physician, deductibles (individual/family), copays (PCP, specialist, ER, urgent care), out-of-pocket max, coinsurance percentage
- **Dental** - Preventive, basic, and major coverage percentages
- **Prescription** - BIN number, PCN number, Group ID

Each policy also stores contact information such as customer service phone, provider services phone, website, and claims address.

### Emergency Contacts

Manage emergency contact information for each patient:

- **Name** (required) - Full name of the contact
- **Relationship** (required) - Relationship to the patient (25 options including Spouse, Parent, Child, Sibling, Friend, Caregiver, Guardian, and more)
- **Phone Number** (required) - Primary phone number
- **Secondary Phone** - Optional secondary phone
- **Email** - Email address
- **Address** - Contact's mailing address
- **Is Primary** - Mark as the primary emergency contact
- **Is Active** - Whether this contact is currently active
- **Notes** - Additional notes

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

### Sharing a Patient with Another User

You can share a patient's records with another MediKeep user:

1. Go to the patient's page
2. Open the **Sharing** tab
3. Search for an existing MediKeep user by their username or email
4. Choose a permission level:
   - **View** - Read-only access to the patient's records
   - **Edit** - Can modify the patient's data
   - **Full** - Complete access including management capabilities
5. Optionally set an expiration date
6. Send the invitation

The recipient will see the invitation in their account and can accept or decline it. Once accepted, the shared patient appears in their patient list.

### Managing Shared Access

- View who has access to your patients from the Sharing tab
- Update permission levels or expiration dates on existing shares
- Revoke access at any time
- Recipients can also remove their own access if they no longer need it
- Bulk sharing is supported - share multiple patients with one user at once (up to 50)

### Family History Sharing

Separate from patient sharing, you can share individual family members' medical history with other MediKeep users. This is useful for sharing hereditary health information (such as a parent's condition history) without sharing an entire patient record.

- Share individual family members with specific users
- Currently supports view-only access
- Recipients can see shared family member details and their conditions
- Revoke access at any time

---

## Notifications

MediKeep can send you notifications for important events through multiple channels.

### Supported Channels

- **Discord** - Receive notifications via Discord webhook
- **Email (SMTP)** - Receive notifications via email
- **Gotify** - Push notifications with configurable priority
- **Webhook** - Custom HTTP endpoint for integration with other services

### Setting Up Notifications

1. Go to **Settings** > **Notifications**
2. Add a notification channel (e.g., Discord webhook URL, SMTP email settings)
3. Test the channel to verify it works
4. Choose which events trigger notifications on each channel:
   - **Backup completed / failed** - Backup status alerts
   - **Invitation received / accepted** - Patient sharing activity
   - **Share revoked** - When access to shared records is removed
   - **Password changed** - Security alerts

### Notification History

MediKeep keeps a history of all sent notifications so you can review past alerts and check delivery status.

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
6. **Track symptoms over time** - Log individual occurrences to help identify patterns and triggers

---

## Need Help?

- [FAQ](FAQ) - Common questions
- [GitHub Discussions](https://github.com/afairgiant/MediKeep/discussions) - Community support
