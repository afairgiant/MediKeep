# MediKeep User Guide

Your complete guide to using MediKeep - a personal health record management system.

## Table of Contents

1. [Getting Started](#1-getting-started)
   - [Login](#login)
   - [Creating an Account](#creating-an-account)
   - [Password Requirements](#password-requirements)
2. [Dashboard](#2-dashboard)
3. [Patient Information](#3-patient-information)
4. [Medications](#4-medications)
5. [Lab Results](#5-lab-results)
6. [Settings](#6-settings)
7. [Additional Features](#7-additional-features)

---

# 1. Getting Started

## Login

The login page is the entry point to MediKeep. You must have an account to access the application.

### Login Page Elements

| Element | Description |
|---------|-------------|
| **Username** | Your unique username (case-sensitive) |
| **Password** | Your account password (hidden as you type) |
| **Login Button** | Click to submit your credentials |
| **Create New User Account** | Link to registration page for new users |

### How to Log In

1. Open MediKeep in your web browser
2. You will see the login form with the MediKeep logo
3. Enter your **Username** in the first field
4. Enter your **Password** in the second field
5. Click the **Login** button

### After Successful Login

- You will be redirected to the **Dashboard**
- A green notification will appear: "Login successful!"
- Your session will remain active based on your session timeout setting (default: 24 hours)

### Login Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "HTTP 401: Login failed" | Incorrect username or password | Double-check your credentials and try again |
| "Please log in to access this page" | Session expired or not logged in | Enter your credentials to log in |

### Security Notes

- Your password is never displayed on screen
- After multiple failed attempts, you may need to wait before trying again
- Always log out when using a shared computer

---

## Creating an Account

If you don't have an account, you can create one from the login page.

### How to Access Registration

1. From the login page, click **Create New User Account**
2. You will be taken to the account creation page

### Registration Form Fields

All fields marked with an asterisk (*) are required.

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Username** | Yes | Your unique login name. Cannot be changed later. | johndoe |
| **Password** | Yes | Must meet password requirements (see below) | MyPass123 |
| **Email** | Yes | Your email address for account recovery | john@example.com |
| **First Name** | Yes | Your first/given name | John |
| **Last Name** | Yes | Your last/family name | Doe |

### Step-by-Step Account Creation

1. Click **Create New User Account** from the login page
2. Fill in your desired **Username**
   - Choose something memorable
   - This cannot be changed after account creation
3. Create a **Password** that meets the requirements
   - Watch the checkmarks below the password field turn green
4. Enter your **Email** address
5. Enter your **First Name**
6. Enter your **Last Name**
7. Click **Create Account**

### What Happens After Registration

When you successfully create an account:

- A patient record is automatically created for you
- You are logged in immediately (no need to log in again)
- You are redirected to the Dashboard
- You can start adding your medical information right away

### Registration Notes

- Your account is created with a default "user" role
- All your data is private and secure
- You can update your profile information later (except username)

---

## Password Requirements

When creating an account or changing your password, it must meet these requirements:

| Requirement | Description |
|-------------|-------------|
| **Minimum Length** | At least 6 characters |
| **Contains Letter** | Must include at least one letter (a-z or A-Z) |
| **Contains Number** | Must include at least one number (0-9) |

### Password Strength Indicators

When entering a password, you'll see real-time feedback:

- **Red X** = Requirement not met
- **Green checkmark** = Requirement met

All three indicators must show green checkmarks before you can submit the form.

### Good Password Examples

- `Health123` - Contains letters, numbers, 9 characters
- `MyMeds2024` - Contains letters, numbers, 10 characters
- `Record99` - Contains letters, numbers, 8 characters

### Bad Password Examples

- `12345` - Too short, no letters
- `password` - No numbers
- `abc` - Too short, no numbers

---

## Navigation: Back to Login

If you're on the registration page and want to return to login:

1. Click the **Back to Login** button in the top-left corner
2. You will be returned to the login form

---

## Logging Out

To securely end your session:

### Method 1: From Any Page
1. Click **Profile** in the top navigation menu
2. Click **Logout** from the dropdown menu

### Method 2: From Settings Page
1. Go to **Settings**
2. Click the **Logout** button in the top-right area

### After Logging Out

- You are redirected to the login page
- Your session is ended
- Cached data is cleared from your browser
- You must log in again to access your records

---

# 2. Dashboard

The Dashboard is your home base in MediKeep. It provides quick access to all your medical information and shows an overview of your health records.

## Dashboard Layout

The Dashboard is divided into several sections:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: MediKeep Logo + Navigation Menu + Profile          │
├─────────────────────────────────────────────────────────────┤
│  Welcome Banner: "MediKeep Dashboard" + Hello message       │
├───────────────────────────────────┬─────────────────────────┤
│  Patient Selector + Search Bar    │                         │
├───────────────────────────────────┤  Additional Resources   │
│  Core Medical Information         │  Invitations            │
│  Treatments and Procedures        │  Recent Activity        │
│  Health Monitoring                │                         │
│  Prevention & History             │                         │
├───────────────────────────────────┴─────────────────────────┤
│  Statistics Bar: Total Records | Medications | Labs | Proc  │
└─────────────────────────────────────────────────────────────┘
```

---

## Navigation Menu

The top navigation bar provides quick access to all sections of the application.

### Medical Records Menu

Click **Medical Records** to access:

| Menu Item | Description |
|-----------|-------------|
| **Patient Info** | View and edit patient profile information |
| **Medications** | Manage current and past medications |
| **Lab Results** | View laboratory test results and reports |
| **Conditions** | Track medical conditions and diagnoses |
| **Allergies** | Record allergies and sensitivities |
| **Vital Signs** | Log blood pressure, heart rate, temperature, etc. |
| **Symptoms** | Track symptoms and their progression |

### Care & Treatment Menu

Click **Care & Treatment** to access:

| Menu Item | Description |
|-----------|-------------|
| **Treatments** | Manage ongoing treatments and therapies |
| **Procedures** | Record medical procedures and surgeries |
| **Immunizations** | Track vaccinations and immunization records |
| **Visit History** | Log doctor visits and appointments |
| **Family History** | Record family medical history |

### Misc. Menu

Click **Misc.** to access:

| Menu Item | Description |
|-----------|-------------|
| **Practitioners** | Manage your healthcare providers |
| **Pharmacies** | Store pharmacy information |
| **Insurance** | Record insurance policy details |
| **Emergency Contacts** | Manage emergency contact information |

### Tools Menu

Click **Tools** to access:

| Menu Item | Description |
|-----------|-------------|
| **Tag Management** | Organize and manage tags for your records |
| **Custom Reports** | Generate custom health reports |
| **Export Records** | Export your medical data |
| **Settings** | Configure application preferences |

### Profile Menu

Click **Profile** to access:

| Menu Item | Description |
|-----------|-------------|
| **Settings** | Open the settings page |
| **Language** | Change the application language |
| **Theme** | Toggle between light and dark mode |
| **Logout** | Sign out of your account |

---

## Welcome Banner

The welcome banner at the top of the dashboard displays:

- **Title**: "MediKeep Dashboard"
- **Subtitle**: "Manage your health information securely"
- **Greeting**: "Hello, [Your Name]!"
- **Close Button**: Click the X to dismiss the banner

---

## Patient Selector

The Patient Selector allows you to switch between patient profiles if you manage multiple patients.

### Patient Selector Elements

| Element | Description |
|---------|-------------|
| **Current Patient** | Shows name, relationship, and photo |
| **Relationship Tag** | Shows your relationship to the patient (e.g., "Son", "Self") |
| **Dropdown Arrow** | Click to open the patient selector |
| **Switch Patient** | Dropdown to select a different patient |
| **Refresh Button** | Reload the patient list |
| **Add Patient Button** | Create a new patient profile |

### How to Switch Patients

1. Click the **dropdown arrow** next to the current patient name
2. The Patient Selector panel opens showing:
   - Currently viewing patient with photo and birth date
   - "Switch to another patient" dropdown
   - Statistics: Owned, Shared, and Total patients
3. Select a patient from the dropdown list
4. The dashboard updates to show that patient's information

### Patient Statistics

At the bottom of the Patient Selector:

| Stat | Description |
|------|-------------|
| **Owned** | Patients you created and own |
| **Shared** | Patients shared with you by others |
| **Total** | Total number of accessible patients |

---

## Global Search

The search box allows you to search across all your medical records.

### How to Use Search

1. Click the **Search medical records...** text box
2. Type your search query (minimum 2-3 characters)
3. Results appear as you type
4. Click a result to navigate to that record

### Search Tips

- Search by medication name, condition, or practitioner
- Use specific terms for better results
- Search works across all record types

---

## Quick Access Cards

The main dashboard area contains clickable cards organized into categories.

### Core Medical Information

| Card | Description | Click to... |
|------|-------------|-------------|
| **Patient Information** | Basic patient details | View/edit patient profile |
| **Medications** | Current medications | View medication list |
| **Lab Results** | Test results | View lab results |

### Treatments and Procedures

| Card | Description | Click to... |
|------|-------------|-------------|
| **Treatments** | Ongoing treatments | View treatment list |
| **Procedures** | Medical procedures | View procedure history |

### Health Monitoring

| Card | Description | Click to... |
|------|-------------|-------------|
| **Vital Signs** | BP, heart rate, etc. | Log or view vitals |
| **Symptoms** | Symptom tracking | View/add symptoms |
| **Conditions** | Medical conditions | View conditions |
| **Allergies** | Allergy records | View allergies |

### Prevention & History

| Card | Description | Click to... |
|------|-------------|-------------|
| **Immunizations** | Vaccination records | View immunizations |
| **Visit History** | Doctor visits | View visit log |
| **Family History** | Family medical history | View family history |

---

## Additional Resources Sidebar

The right sidebar provides quick access to additional features.

### Resource Links

| Link | Description |
|------|-------------|
| **Admin Dashboard** | Access admin features (admin users only) |
| **Insurance** | View insurance information |
| **Emergency Contacts** | View emergency contacts |
| **Export Records** | Export your medical data |
| **Practitioners** | View healthcare providers |
| **Pharmacies** | View pharmacy information |

### Invitations Panel

Shows pending patient sharing invitations.

| Element | Description |
|---------|-------------|
| **Refresh Button** | Reload invitations |
| **Last Updated** | When invitations were last checked |
| **Invitation List** | Pending invitations (if any) |
| **Share Patient** | Button to share a patient with another user |

### How to Share a Patient

1. Click the **Share Patient** button
2. Enter the email or username of the person to share with
3. Select the patient to share
4. Choose permission level
5. Click **Send Invitation**

### Recent Activity Panel

Shows your latest actions in the application.

| Element | Description |
|---------|-------------|
| **Last Updated** | When activity was last refreshed |
| **Activity List** | Recent creates, updates, and deletes |
| **Activity Type** | Badge showing Created/Updated/Deleted |
| **Description** | What was changed |
| **Timestamp** | When the action occurred |

Each activity item shows:
- **Icon**: Visual indicator of the record type
- **Action Badge**: Green "Created", Blue "Updated", or Red "Deleted"
- **Description**: e.g., "Updated Treatment: Physical Therapy"
- **Date/Time**: When the action occurred with timezone

---

## Statistics Bar

At the bottom of the dashboard, a statistics bar shows summary counts.

| Statistic | Description |
|-----------|-------------|
| **Total Records** | Total number of medical records |
| **Active Medications** | Number of currently active medications |
| **Lab Results** | Total number of lab result records |
| **Procedures** | Total number of procedure records |

These numbers update automatically when you add or modify records.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Alt + T** | Open notifications panel |
| **Escape** | Close open menus or dialogs |

---

## Tips for Using the Dashboard

1. **Start with Patient Info**: Make sure your patient profile is complete
2. **Use the Search**: Quickly find any record using global search
3. **Check Recent Activity**: See what you've recently added or modified
4. **Review Statistics**: Get a quick overview of your records count
5. **Explore Menus**: Use dropdown menus for organized navigation

---

# 3. Patient Information

The Patient Information page displays and manages the core profile data for a patient. This includes personal details, contact information, and basic medical information.

## Accessing Patient Information

There are multiple ways to access the Patient Information page:

1. **From Dashboard**: Click the **Patient Information** card
2. **From Menu**: Click **Medical Records** > **Patient Info**
3. **Direct URL**: Navigate to `/patients/me`

---

## Page Layout

The Patient Information page displays:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: ← Back to Dashboard | Patient Information          │
├─────────────────────────────────────────────────────────────┤
│  Navigation Menu                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Personal Information            [Edit Profile]      │    │
│  │                                                      │    │
│  │  [Photo]    Patient Name                            │    │
│  │             Patient ID: X                           │    │
│  │                                                      │    │
│  │  First Name: ____    Last Name: ____                │    │
│  │  Birth Date: ____    Gender: ____                   │    │
│  │  Relationship: ____                                 │    │
│  │  Address: ____                                      │    │
│  │  Blood Type: ____    Height: ____                   │    │
│  │  Weight: ____        Primary Physician: ____        │    │
│  │  Patient ID: ____                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Viewing Patient Information

### Information Fields Displayed

| Field | Description | Example |
|-------|-------------|---------|
| **Photo** | Patient's profile photo (or placeholder icon) | - |
| **Patient Name** | Full name displayed prominently | Admin User |
| **Patient ID** | Unique identifier in the system | 1 |
| **First Name** | Patient's first/given name | Admin |
| **Last Name** | Patient's last/family name | User |
| **Birth Date** | Date of birth (formatted) | Jan 01, 1990 |
| **Gender** | Patient's gender | Male, Female, Other |
| **Relationship to You** | How the patient relates to the account owner | Self, Son, Daughter, Parent, Spouse, Other |
| **Address** | Full mailing address | 123 Main St, City, State |
| **Blood Type** | Blood type for emergencies | A+, A-, B+, B-, AB+, AB-, O+, O- |
| **Height** | Patient's height | 5'8" (imperial) or cm (metric) |
| **Weight** | Patient's weight | 150 lbs (imperial) or kg (metric) |
| **Primary Care Physician** | Assigned primary doctor | Dr. Sarah Wilson |

### Field States

- **"Not provided"**: Optional field that hasn't been filled in
- **"Not assigned"**: No practitioner has been linked
- **"Please update your address"**: Address needs to be entered

---

## Editing Patient Information

### How to Edit

1. Navigate to the Patient Information page
2. Click the **Edit Profile** button (top-right of the card)
3. A modal dialog opens with the edit form
4. Make your changes
5. Click **Save Changes** to save, or **Cancel** to discard

### Edit Form Fields

The edit form contains the following fields:

#### Photo Section

| Element | Description |
|---------|-------------|
| **Photo Preview** | Shows current photo or placeholder |
| **Choose Photo** | Button to upload a new photo |
| **Remove Photo** | Button to delete the current photo |
| **Format Info** | "Accepts JPEG, PNG, GIF, or BMP images" |
| **Size Limit** | Maximum file size: 15MB |
| **Note** | "Photos are automatically resized and optimized" |

#### Personal Information Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| **First Name** | Yes (*) | Text | Patient's first name |
| **Last Name** | Yes (*) | Text | Patient's last name |
| **Birth Date** | Yes (*) | Date Picker | Patient's date of birth |
| **Gender** | No | Dropdown | Male, Female, Other, Prefer not to say |
| **Relationship to You** | No | Dropdown | How patient relates to you |
| **Address** | No | Text | Full address |

#### Medical Information Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| **Blood Type** | No | Dropdown | A+, A-, B+, B-, AB+, AB-, O+, O- |
| **Height** | No | Number | Height (unit based on settings) |
| **Weight** | No | Number | Weight (unit based on settings) |
| **Primary Care Physician** | No | Dropdown | Select from your practitioners list |

### Form Buttons

| Button | Action |
|--------|--------|
| **Cancel** | Close the form without saving changes |
| **Save Changes** | Save all changes and close the form |

---

## Uploading a Patient Photo

### Supported Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- BMP (.bmp)

### Photo Requirements

| Requirement | Value |
|-------------|-------|
| **Maximum File Size** | 15 MB |
| **Recommended Size** | Square images work best |
| **Auto-Processing** | Photos are automatically resized and optimized |

### How to Upload a Photo

1. Click **Edit Profile** on the Patient Information page
2. In the Photo section, click **Choose Photo**
3. Select an image file from your computer
4. The preview will update to show the new photo
5. Click **Save Changes** to keep the new photo

### How to Remove a Photo

1. Click **Edit Profile** on the Patient Information page
2. Click **Remove Photo** (red button)
3. The photo will be replaced with the default placeholder
4. Click **Save Changes** to confirm removal

---

## Understanding Unit Settings

Height and weight display depends on your unit system preference in Settings:

| Setting | Height Display | Weight Display |
|---------|---------------|----------------|
| **Imperial** | Feet and inches (e.g., 5'8") | Pounds (e.g., 150 lbs) |
| **Metric** | Centimeters (e.g., 173 cm) | Kilograms (e.g., 68 kg) |

To change unit settings:
1. Go to **Settings** (Profile > Settings or Tools > Settings)
2. Find **Unit System** under Application Preferences
3. Select Imperial or Metric
4. Click **Save All Changes**

---

## Assigning a Primary Care Physician

The Primary Care Physician field links to your Practitioners list.

### To Assign a Physician

1. First, ensure you have practitioners added (go to **Misc.** > **Practitioners**)
2. Open the Patient Information edit form
3. Click the **Primary Care Physician** dropdown
4. Select from your list of practitioners
5. Click **Save Changes**

### If No Practitioners Available

If the dropdown is empty:
1. Go to **Misc.** > **Practitioners**
2. Add your healthcare providers
3. Return to Patient Information to assign one

---

## Tips for Patient Information

1. **Keep information current**: Update address and contact info when they change
2. **Add a photo**: Makes it easier to identify patients in multi-patient accounts
3. **Enter blood type**: Critical information for emergencies
4. **Link a physician**: Helps track who manages the patient's primary care
5. **Complete all fields**: More complete profiles are more useful for medical records

---

## Common Issues

### "Photo upload failed"

- Check file size (must be under 15MB)
- Verify file format (JPEG, PNG, GIF, or BMP only)
- Try a different image file

### "Cannot save changes"

- Ensure required fields (marked with *) are filled
- Check for validation errors highlighted in red
- Verify you have a stable internet connection

### Height/Weight showing wrong units

- Go to Settings and check your Unit System preference
- Change to Imperial or Metric as desired
- Save changes and return to Patient Information

---

# 4. Medications

The Medications page allows you to track all medications, supplements, and over-the-counter drugs. You can view, add, edit, and organize medications with powerful filtering and search capabilities.

## Accessing Medications

There are multiple ways to access the Medications page:

1. **From Dashboard**: Click the **Medications** card
2. **From Menu**: Click **Medical Records** > **Medications**
3. **Direct URL**: Navigate to `/medications`

---

## Page Layout

The Medications page provides two view modes and extensive filtering options:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: ← Back to Dashboard | Medications                   │
├─────────────────────────────────────────────────────────────┤
│  Navigation Menu                                             │
├─────────────────────────────────────────────────────────────┤
│  [+ Add New Medication]              [Cards] [Table] [Print] │
├─────────────────────────────────────────────────────────────┤
│  Quick Filter: All Types | Prescription | Supplement | OTC   │
├─────────────────────────────────────────────────────────────┤
│  Filters & Search: [Search box...]                           │
│  Advanced Filters: Status | Type | Route | Date | Sort       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Medication Cards or Table View                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## View Modes

### Cards View

The default view displays medications as individual cards showing detailed information at a glance.

Each card displays:

| Element | Description |
|---------|-------------|
| **Medication Name** | Name of the medication (e.g., "Lisinopril") |
| **Dosage** | Strength/amount (e.g., "10mg", "2 puffs") |
| **Type Badge** | Category label (e.g., "Prescription", "Supplement/Vitamin") |
| **Tags** | Organizational tags with tag icon |
| **Status Badge** | Current status (Active, Stopped, Completed, On Hold) |
| **Frequency** | How often taken (e.g., "Once daily", "As needed") |
| **Route** | Administration method (e.g., "oral", "inhalation") |
| **Indication** | What the medication is for |
| **Prescribing Provider** | Doctor who prescribed it (clickable) |
| **Pharmacy** | Where medication is filled (clickable) |
| **Start Date** | When medication was started |
| **End Date** | When medication ended (if applicable) |
| **Action Buttons** | View, Edit, Delete |

### Table View

Click **Table** to switch to a compact tabular view ideal for reviewing many medications.

Table columns:

| Column | Description |
|--------|-------------|
| **Medication Name** | Name of the medication |
| **Type** | Prescription, OTC, Supplement, etc. |
| **Dosage** | Strength and amount |
| **Frequency** | How often taken |
| **Route** | How administered |
| **Purpose** | Indication/reason |
| **Prescriber** | Prescribing provider |
| **Pharmacy** | Filling pharmacy |
| **Start Date** | When started |
| **End Date** | When ended |
| **Status** | Current status |

Each column header is sortable by clicking on it.

### Print View

In Table view, a **Print** button appears allowing you to print or save the medication list as a PDF.

---

## Quick Filters

Quick filter buttons allow fast filtering by medication type:

| Filter | Description |
|--------|-------------|
| **All Types** | Shows all medications (default) |
| **Prescription** | Only prescription medications |
| **Supplement/Vitamin** | Supplements and vitamins |
| **Over-the-Counter** | OTC medications |
| **Herbal/Natural** | Herbal and natural remedies |

Each button shows the count of medications in that category.

---

## Search and Advanced Filters

### Search Box

The search box searches across:
- Medication names
- Indications/purposes
- Dosages
- Tags

Type at least 2-3 characters to start searching.

### Advanced Filters Panel

Click the expand arrow next to "Filters & Search" to reveal advanced options:

| Filter | Options |
|--------|---------|
| **Status** | All Statuses, Active, Completed, Stopped, On Hold |
| **Medication Type** | All Types, Prescription, Supplement, OTC, Herbal |
| **Route (Category)** | All Routes, Oral, Inhalation, Injection, Topical, etc. |
| **Date Range** | All Time Periods, Last 30 days, Last 6 months, Last year, Custom |
| **Sort By** | Status (Active First), Name, Start Date, End Date |
| **Sort Direction** | A-Z or Z-A toggle button |

The filter indicator shows how many items match: "8 of 8 items"

---

## Adding a New Medication

### How to Add

1. Click **+ Add New Medication** button
2. A dialog opens with three tabs: **Basic Info**, **Details**, **Notes**
3. Fill in the required fields (marked with *)
4. Click **Add Medication** to save

### Basic Info Tab

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Medication Name** | Yes (*) | Generic or brand name (min. 2 characters) | Lisinopril, Metformin |
| **Medication Type** | Yes (*) | Category of medication | Prescription (default) |
| **Dosage** | No | Strength and amount per dose | 10mg, 1 tablet |
| **Frequency** | No | How often taken | Once daily, Twice daily |
| **Route** | No | How administered | oral, inhalation |
| **Indication** | No | What the medication treats | High blood pressure |

### Medication Type Options

| Type | Description |
|------|-------------|
| **Prescription** | Requires a doctor's prescription |
| **Supplement/Vitamin** | Nutritional supplements |
| **Over-the-Counter** | Available without prescription |
| **Herbal/Natural** | Natural or herbal remedies |

### Route Options

Common administration routes include:
- **oral** - Taken by mouth
- **inhalation** - Breathed in
- **injection** - Injected
- **topical** - Applied to skin
- **sublingual** - Under the tongue
- **rectal** - Rectal administration
- **ophthalmic** - Eye drops

### Details Tab

| Field | Description |
|-------|-------------|
| **Status** | Current status (default: Active) |
| **Start Date** | When the medication was started |
| **End Date** | When the medication ended (if applicable) |
| **Prescribing Provider** | Select from your practitioners list |
| **Pharmacy** | Select from your pharmacies list |
| **Tags** | Add tags for organization (up to 15 tags) |

### Status Options

| Status | Description | When to Use |
|--------|-------------|-------------|
| **Active** | Currently taking | Medications you're currently on |
| **Stopped** | Discontinued | Medications you stopped taking |
| **Completed** | Finished course | Completed medication courses (e.g., antibiotics) |
| **On Hold** | Temporarily paused | Medications temporarily suspended |

### Notes Tab

The Notes tab is reserved for future functionality to add detailed notes about the medication.

---

## Viewing Medication Details

To view full details of a medication:

1. Find the medication card
2. Click the **View** button
3. A read-only view opens showing all information

---

## Editing a Medication

### How to Edit

1. Find the medication you want to edit
2. Click the **Edit** button on the card
3. The edit dialog opens with current values filled in
4. Make your changes
5. Click **Save Changes**

### Editable Fields

All fields that were available when adding the medication can be edited:
- Name, Type, Dosage, Frequency, Route
- Indication, Status, Dates
- Provider, Pharmacy, Tags

---

## Deleting a Medication

### How to Delete

1. Find the medication to delete
2. Click the **Delete** button
3. Confirm the deletion when prompted
4. The medication is removed from your records

**Note**: Deletion is permanent. Consider changing the status to "Stopped" or "Completed" instead to keep historical records.

---

## Working with Providers and Pharmacies

### Linking a Prescribing Provider

Medications can be linked to practitioners (doctors) in your system:

1. Ensure you have practitioners added (**Misc.** > **Practitioners**)
2. When adding/editing a medication, select from the **Prescribing Provider** dropdown
3. Clicking a provider name in the medication card opens their details

### Linking a Pharmacy

Medications can be linked to pharmacies in your system:

1. Ensure you have pharmacies added (**Misc.** > **Pharmacies**)
2. When adding/editing a medication, select from the **Pharmacy** dropdown
3. Clicking a pharmacy name in the medication card opens their details

---

## Using Tags

Tags help organize and quickly find medications:

### Adding Tags

1. In the edit form, go to the **Details** tab
2. Type a tag name in the Tags field
3. Press **Enter** to add the tag
4. You can add up to 15 tags per medication

### Tag Examples

- `blood-pressure` - Blood pressure medications
- `cholesterol` - Cholesterol management
- `pain` - Pain medications
- `daily` - Daily medications
- `as-needed` - PRN medications

### Searching by Tag

Type a tag name in the search box to find all medications with that tag.

---

## Tips for Managing Medications

1. **Keep records current**: Update status when you start or stop medications
2. **Use descriptive indications**: Helps remember why each medication was prescribed
3. **Link providers**: Easily see which doctor prescribed each medication
4. **Link pharmacies**: Track where each medication is filled
5. **Use tags**: Create a tagging system that works for you
6. **Add start dates**: Track medication history over time
7. **Update end dates**: Mark when you stop a medication
8. **Use Table view**: For reviewing multiple medications at once
9. **Print for appointments**: Print your medication list for doctor visits

---

## Common Issues

### "Cannot add medication"

- Ensure the medication name is at least 2 characters
- Check that required fields (marked with *) are filled
- Verify you have a stable internet connection

### "Provider/Pharmacy dropdown is empty"

- Add practitioners first: **Misc.** > **Practitioners**
- Add pharmacies first: **Misc.** > **Pharmacies**
- Then return to add/edit the medication

### "Can't find a medication"

- Clear all filters by clicking "All Types" in Quick Filters
- Check the Status filter (may be filtering out stopped/completed)
- Try searching by part of the medication name
- Ensure you're viewing the correct patient

### "Status stuck on Active"

- Click **Edit** on the medication
- Go to the **Details** tab
- Change the Status dropdown to the appropriate value
- Click **Save Changes**

---

# 5. Lab Results

The Lab Results page allows you to track laboratory tests, diagnostic imaging, and other medical tests. You can store test results, attach documents (including PDF reports), and organize everything with tags and notes.

## Accessing Lab Results

There are multiple ways to access the Lab Results page:

1. **From Dashboard**: Click the **Lab Results** card
2. **From Menu**: Click **Medical Records** > **Lab Results**
3. **Direct URL**: Navigate to `/lab-results`

---

## Page Layout

The Lab Results page provides comprehensive test management with document attachment capabilities:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: ← Back to Dashboard | Lab Results                   │
├─────────────────────────────────────────────────────────────┤
│  Navigation Menu                                             │
├─────────────────────────────────────────────────────────────┤
│  [+ Add New Lab Result] [Quick PDF Import]    [Cards] [Table]│
├─────────────────────────────────────────────────────────────┤
│  Filters & Search: [Search box...]                           │
│  20 of 20 items • 6 more filters                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Lab Result Cards or Table View                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## View Modes

### Cards View

The default view displays lab results as individual cards showing detailed information.

Each card displays:

| Element | Description |
|---------|-------------|
| **Test Name** | Name of the lab test (e.g., "Complete Blood Count") |
| **File Indicator** | Shows attached files count or "No files" |
| **Status Badge** | Current status (Ordered, In Progress, Completed, Cancelled) |
| **Test Code** | Lab code or LOINC identifier |
| **Test Type** | Priority/urgency (routine, follow-up, screening, urgent) |
| **Testing Facility** | Where the test was performed |
| **Ordered Date** | When the test was requested |
| **Completed Date** | When results were finalized |
| **Lab Result** | Result classification (Normal, high, low, Pending) |
| **Ordering Practitioner** | Doctor who ordered the test (clickable) |
| **Category Badge** | Test category (blood work, imaging, etc.) |
| **Tags** | Organizational tags |
| **Notes** | Additional clinical notes (if any) |
| **Action Buttons** | View, Edit, Delete |

### Table View

Click **Table** to switch to a compact tabular view for reviewing multiple results.

---

## Search and Filters

### Search Box

The search box searches across:
- Test names
- Test codes
- Testing facilities
- Practitioners
- Tags

### Advanced Filters

Click the expand button next to "Filters & Search" to access additional filtering options including status, date range, and test type filters.

---

## Adding a New Lab Result

### How to Add

1. Click **+ Add New Lab Result** button
2. Fill in the test information
3. Optionally attach files
4. Click **Add New Lab Result** to save

### Form Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Test Name** | Yes (*) | Name or description of the test | Complete Blood Count (CBC) |
| **Test Code** | No | Lab code or LOINC identifier | CBC, 85025 |
| **Test Category** | No | Type of laboratory test | Blood work, Imaging |
| **Test Type** | No | Priority or urgency level | routine, follow-up, screening, urgent |
| **Testing Facility** | No | Where the test is performed | Main Hospital Laboratory |
| **Ordering Practitioner** | No | Doctor who ordered the test | Select from list |
| **Test Status** | No | Current status of the test | Default: Ordered |
| **Lab Result** | No | Result classification | Normal, high, low, critical |
| **Ordered Date** | No | When the test was requested | Date picker |
| **Completed Date** | No | When results were available | Date picker |
| **Additional Notes** | No | Clinical notes or observations | Free text |
| **Tags** | No | Organizational tags (up to 15) | diabetes, routine |

### Test Status Options

| Status | Description |
|--------|-------------|
| **Ordered** | Test has been requested (default) |
| **In Progress** | Sample is being processed |
| **Completed** | Results are available |
| **Cancelled** | Test was cancelled |

### Lab Result Options

| Result | Description |
|--------|-------------|
| **Pending** | Results not yet available |
| **Normal** | Within normal range |
| **high** | Above normal range |
| **low** | Below normal range |
| **critical** | Requires immediate attention |

---

## Quick PDF Import

The **Quick PDF Import** button provides a streamlined way to import lab result PDFs directly. This is useful when you have PDF reports from labs and want to quickly add them to your records.

---

## Attaching Files

Lab results support comprehensive document management with file attachments.

### Storage Options

| Storage | Description |
|---------|-------------|
| **Local Storage** | Files stored on the MediKeep server |
| **Paperless-ngx** | Integration with Paperless-ngx document management system |

### Supported File Types

The following file formats are accepted:

**Documents:**
- PDF (.pdf)
- Text (.txt)
- CSV (.csv)
- XML (.xml)
- JSON (.json)
- Word (.doc, .docx)
- Excel (.xls, .xlsx)

**Images:**
- JPEG (.jpg, .jpeg)
- PNG (.png)
- TIFF (.tiff)
- BMP (.bmp)
- GIF (.gif)
- DICOM (.dcm) - medical imaging

**Archives:**
- ZIP (.zip)
- ISO (.iso)
- 7-Zip (.7z)
- RAR (.rar)

**Media:**
- Video (.avi, .mp4, .mov, .webm)
- Audio (.mp3, .wav, .m4a)

**Medical/3D:**
- STL (.stl)
- NIfTI (.nii)
- NRRD (.nrrd)

### File Size Limit

Maximum file size: **1024 MB** (1 GB)

### How to Attach Files

1. In the Add/Edit form, scroll to the **Add Files** section
2. Select storage backend (Local Storage or Paperless-ngx)
3. Click **Choose Files** or drag and drop files
4. Files will be uploaded when you save the lab result

### Viewing Attached Files

- Cards show file attachment count (e.g., "5 attached")
- Click the file indicator to view attached files
- Files can be downloaded or viewed depending on type

---

## Working with Paperless-ngx Integration

If you have Paperless-ngx configured, you can:

1. Store documents in your Paperless-ngx instance
2. Enable auto-sync to automatically import new documents
3. Benefits include OCR, full-text search, and advanced document management

To configure Paperless-ngx:
1. Go to **Settings**
2. Find the Paperless-ngx section
3. Enter your Paperless-ngx URL and credentials
4. Test the connection

---

## Viewing Lab Result Details

To view full details of a lab result:

1. Find the lab result card
2. Click the **View** button
3. A detailed view opens showing all information and attached files

---

## Editing a Lab Result

### How to Edit

1. Find the lab result you want to edit
2. Click the **Edit** button
3. Make your changes
4. Click **Save Changes**

You can update any field and add or remove file attachments.

---

## Deleting a Lab Result

### How to Delete

1. Find the lab result to delete
2. Click the **Delete** button
3. Confirm the deletion when prompted

**Note**: Deleting a lab result also removes its attached files. This action is permanent.

---

## Tips for Managing Lab Results

1. **Use descriptive names**: Include the test type in the name (e.g., "CBC - Annual Physical 2024")
2. **Attach PDF reports**: Keep original lab reports attached for reference
3. **Add notes**: Record significant findings or doctor's comments
4. **Use tags consistently**: Create a tagging system (e.g., "routine", "follow-up", "abnormal")
5. **Track ordered tests**: Add tests when ordered, update when results arrive
6. **Link practitioners**: Associate tests with the ordering physician
7. **Note facilities**: Record which lab performed each test
8. **Update status**: Keep status current as tests progress

---

## Common Lab Result Examples

| Test Type | Category | Common Tags |
|-----------|----------|-------------|
| Complete Blood Count (CBC) | blood work | routine, annual |
| Lipid Panel | blood work | cholesterol, heart |
| Hemoglobin A1C | blood work | diabetes |
| Thyroid Panel (TSH, T3, T4) | blood work | thyroid |
| Metabolic Panel (BMP/CMP) | blood work | kidney, liver |
| Chest X-Ray | imaging | screening, respiratory |
| MRI | imaging | diagnostic |
| CT Scan | imaging | diagnostic |
| Urinalysis | lab | routine, UTI |
| ECG/EKG | diagnostic | heart, cardiac |

---

## Common Issues

### "Cannot add lab result"

- Ensure the test name is filled in (required field)
- Verify you have a stable internet connection

### "File upload failed"

- Check file size (must be under 1024 MB)
- Verify file type is in the supported formats list
- Try a different file or format

### "Paperless-ngx connection failed"

- Go to Settings and verify Paperless-ngx configuration
- Check that the URL and credentials are correct
- Ensure Paperless-ngx server is accessible

### "Can't find a lab result"

- Clear filters to show all results
- Check the status filter (may be filtering by status)
- Try searching by part of the test name
- Ensure you're viewing the correct patient

---

# 6. Settings

The Settings page allows you to customize your MediKeep experience, manage security settings, configure document storage, and control application preferences.

## Accessing Settings

There are multiple ways to access the Settings page:

1. **From Menu**: Click **Tools** > **Settings**
2. **From Profile Menu**: Click **Profile** > **Settings**
3. **Direct URL**: Navigate to `/settings`

---

## Page Layout

The Settings page is organized into logical sections:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Back to Dashboard | Settings | Theme | Logout       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Security                                                    │
│  ├─ Password                                                 │
│                                                              │
│  Account Management                                          │
│  ├─ Delete Account                                           │
│                                                              │
│  System Information                                          │
│  ├─ Application Version                                      │
│                                                              │
│  Application Preferences                                     │
│  ├─ Unit System                                              │
│  ├─ Session Timeout                                          │
│                                                              │
│  Document Storage                                            │
│  ├─ Paperless-ngx Connection                                 │
│  ├─ Storage Preferences                                      │
│  ├─ Sync Options                                             │
│  ├─ Storage Usage                                            │
│  ├─ File Cleanup                                             │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  [Reset Changes] [Save All Changes]                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Header Controls

The Settings header provides quick access to common actions:

| Control | Description |
|---------|-------------|
| **Back to Dashboard** | Return to the main dashboard |
| **Settings** | Reload settings page |
| **Theme Toggle** | Switch between light and dark mode |
| **Logout** | Sign out of your account |

---

## Security

### Password

Change your account password to maintain security.

| Element | Description |
|---------|-------------|
| **Change Password Button** | Opens dialog to change your password |

### How to Change Your Password

1. Click **Change Password**
2. Enter your current password
3. Enter your new password (must meet requirements)
4. Confirm your new password
5. Click **Save** or **Update Password**

Password requirements:
- Minimum 6 characters
- Must contain at least one letter
- Must contain at least one number

---

## Account Management

### Delete Account

Permanently delete your account and all associated medical data.

| Element | Description |
|---------|-------------|
| **Delete Account Button** | Initiates account deletion process |

**Warning**: This action is permanent and cannot be undone. All your medical records, patient data, and uploaded files will be permanently deleted.

### How to Delete Your Account

1. Click **Delete Account**
2. Read the warning message carefully
3. Type confirmation text if required
4. Click **Confirm Delete** or **Delete Permanently**

---

## System Information

### Application Version

Displays the current version of MediKeep.

| Information | Description |
|-------------|-------------|
| **MediKeep vX.X.X** | Current application version number |

This information is useful when:
- Reporting issues
- Checking for updates
- Verifying deployment

---

## Application Preferences

### Unit System

Choose how measurements are displayed throughout the application.

| Option | Description | Examples |
|--------|-------------|----------|
| **Imperial** | US customary units | pounds (lbs), feet/inches, Fahrenheit (°F) |
| **Metric** | International system | kilograms (kg), centimeters (cm), Celsius (°C) |

### How to Change Unit System

1. Select either **Imperial** or **Metric**
2. Click **Save All Changes**
3. All measurements will be displayed in your chosen unit system

This affects:
- Patient height and weight display
- Vital signs (temperature, etc.)
- Any measurement fields in forms

### Session Timeout

Set how long you can be inactive before being automatically logged out.

| Setting | Description |
|---------|-------------|
| **Session Timeout** | Duration in minutes (5-1440) |

**Default**: 1440 minutes (24 hours)

### How to Change Session Timeout

1. Enter a value between 5 and 1440 in the text field
2. Click **Save All Changes**
3. Your session will now expire after the specified period of inactivity

**Tips**:
- Use shorter timeouts (30-60 minutes) on shared computers
- Use longer timeouts (1440 minutes) on personal devices
- The session extends each time you interact with the application

---

## Document Storage

Configure how medical documents are stored and managed.

### Paperless-ngx Connection

Paperless-ngx is an open-source document management system that provides advanced features like OCR, full-text search, and automatic tagging.

#### Connection Settings

| Field | Required | Description |
|-------|----------|-------------|
| **Server URL** | Yes | URL of your Paperless-ngx instance |
| **Authentication Method** | Yes | API Token (recommended) or Username & Password |
| **API Token** | Depends | Your Paperless-ngx API token |

#### How to Connect Paperless-ngx

1. Enter your Paperless-ngx **Server URL**
   - Example: `https://paperless.example.com` or `http://192.168.0.175:8000`
   - HTTP is allowed for localhost/local network
   - HTTPS is required for external URLs
2. Select **Authentication Method**
   - API Token is recommended (more secure, doesn't expire)
3. Enter your **API Token**
   - Find it in Paperless-ngx: Profile > Tokens
   - Or generate a new one in the admin panel
4. Click **Test Connection**
5. If successful, click **Save All Changes**

#### Connection Status

| Status | Description |
|--------|-------------|
| **Connected** | Successfully connected to Paperless-ngx |
| **Not Connected** | No valid connection configured |
| **Connection Failed** | Unable to connect (check URL and credentials) |

### Storage Preferences

#### Default Storage Location

Choose where new documents are stored by default:

| Option | Description |
|--------|-------------|
| **Local Storage** | Built-in file storage - fast, reliable, always available |
| **Paperless-ngx** | Advanced document management with full-text search and tagging |

### Sync Options

| Option | Description |
|--------|-------------|
| **Enable automatic sync status checking** | Automatically verify documents exist in Paperless when pages load |
| **Sync document tags and categories** | Keep metadata synchronized (Coming Soon) |

### Storage Usage

Displays current storage utilization:

| Location | Information |
|----------|-------------|
| **Local Storage** | Number of files and total size |
| **Paperless-ngx** | Number of files and total size |

### File Cleanup

Clean up storage inconsistencies and resolve document issues.

| Element | Description |
|---------|-------------|
| **Cleanup Files Button** | Resets failed uploads, clears orphaned tasks, fixes sync issues |

Use File Cleanup when:
- Uploads have failed or are stuck
- Document counts seem incorrect
- Sync status is inconsistent

---

## Saving Changes

Settings changes are not saved automatically. You must explicitly save them.

### Save Actions

| Button | Action |
|--------|--------|
| **Reset Changes** | Discard all unsaved changes and revert to saved values |
| **Save All Changes** | Save all modifications to the server |

### Unsaved Changes Warning

When you have unsaved changes, a message appears: "You have unsaved changes"

**Important**: If you navigate away without saving, your changes will be lost.

---

## Theme Settings

Toggle between light and dark mode directly from the Settings header.

| Mode | Description |
|------|-------------|
| **Light Mode** | Bright theme with white backgrounds |
| **Dark Mode** | Dark theme that's easier on the eyes in low light |

### How to Change Theme

1. Click the **theme toggle button** (sun/moon icon) in the header
2. The theme changes immediately
3. Your preference is saved automatically

You can also change the theme from:
- **Profile** > **Theme** in the navigation menu

---

## Tips for Settings

1. **Save frequently**: Don't forget to save after making changes
2. **Test Paperless connection**: Always test before saving to ensure it works
3. **Choose appropriate timeout**: Balance security and convenience
4. **Use API tokens**: More secure than username/password for Paperless-ngx
5. **Check storage usage**: Monitor your storage periodically
6. **Run cleanup periodically**: If you experience upload issues

---

## Common Issues

### "Changes not saving"

- Ensure you click **Save All Changes** after making modifications
- Check for validation errors (red highlighted fields)
- Verify you have a stable internet connection

### "Paperless connection failed"

- Verify the Server URL is correct and accessible
- Check that your API token is valid and not expired
- Ensure Paperless-ngx server is running
- For HTTPS errors, verify SSL certificates

### "Session keeps timing out"

- Increase the Session Timeout value
- Click **Save All Changes** after changing
- Note: The minimum value is 5 minutes

### "Unit system not changing"

- Make sure you clicked **Save All Changes**
- Refresh the page after saving
- Changes apply to all pages after saving

### "Theme not persisting"

- Theme changes save automatically
- Clear browser cache if issues persist
- Check browser localStorage settings

---

*Next section: [Additional Features](#7-additional-features)*
