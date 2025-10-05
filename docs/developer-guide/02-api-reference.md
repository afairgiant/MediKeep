# MediKeep API Reference (v1.0)

**Last Updated:** October 4, 2025
**API Version:** 1.0
**Base URL:** `http://localhost:8000/api/v1`

---

## Table of Contents

1. [API Overview & Standards](#1-api-overview--standards)
2. [Authentication](#2-authentication)
3. [SSO Authentication](#3-sso-authentication)
4. [User Management](#4-user-management)
5. [Patient Management](#5-patient-management)
6. [Medical Records](#6-medical-records)
7. [Related Information](#7-related-information)
8. [Files & Attachments](#8-files--attachments)
9. [Sharing & Collaboration](#9-sharing--collaboration)
10. [Search & Tags](#10-search--tags)
11. [Reports & Export](#11-reports--export)
12. [Integrations](#12-integrations)
13. [System & Admin](#13-system--admin)

---

## 1. API Overview & Standards

### Base Information
- **Protocol**: HTTPS (recommended), HTTP (development only)
- **Authentication**: JWT Bearer Token
- **Content-Type**: `application/json`
- **Character Encoding**: UTF-8

### Pagination Standards
- **Default**: 20 items per page
- **Maximum**: 100 items per page
- **Query Parameters**:
  - `skip`: Number of items to skip (default: 0)
  - `limit`: Maximum items to return (default: 20, max: 100)

### Response Formats

#### Success Response
```json
{
  "status": "success",
  "data": { },
  "message": "Optional success message"
}
```

#### Error Response
```json
{
  "status": "error",
  "error": "User-friendly error message",
  "detail": "Technical details (development only)"
}
```

### HTTP Status Codes
- `200`: Successful GET/PUT/PATCH request
- `201`: Resource created successfully
- `204`: Successful DELETE (no content)
- `400`: Bad request (validation error)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `409`: Conflict (duplicate resource)
- `422`: Unprocessable entity
- `429`: Too many requests (rate limit)
- `500`: Internal server error

### Rate Limiting
- Standard endpoints: 100 requests/minute
- Authentication endpoints: 10 requests/minute
- File upload endpoints: 50 requests/hour
- Search endpoints: 30 requests/minute

---

## 2. Authentication

Base path: `/api/v1/auth`

### Check Registration Status
`GET /auth/registration-status`
- **Purpose**: Check if new user registration is enabled
- **Authentication**: No
- **Success Response** (200):
```json
{
  "registration_enabled": true,
  "message": null
}
```

### User Registration
`POST /auth/register`
- **Purpose**: Create a new user account
- **Authentication**: No
- **Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}
```
- **Success Response** (201):
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "full_name": "John Doe",
  "role": "user",
  "created_at": "2025-10-04T10:30:00Z"
}
```
- **Error Responses**:
  - `400`: Validation failed (weak password, invalid email)
  - `403`: Registration disabled
  - `409`: Username or email already exists

### User Login
`POST /auth/login`
- **Purpose**: Authenticate and receive JWT token
- **Authentication**: No
- **Request Body**:
```json
{
  "username": "johndoe",
  "password": "SecurePass123!"
}
```
- **Success Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```
- **Error Responses**:
  - `401`: Invalid credentials
  - `429`: Too many login attempts (rate limited)

### Change Password
`POST /auth/change-password`
- **Purpose**: Update current user's password
- **Authentication**: Yes
- **Request Body**:
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!"
}
```
- **Success Response** (200):
```json
{
  "message": "Password changed successfully"
}
```
- **Error Responses**:
  - `400`: Password validation failed (too weak, same as old)
  - `401`: Current password incorrect

---

## 3. SSO Authentication

Base path: `/api/v1/auth/sso`

**Supported Providers**: Google, GitHub, OIDC, Authentik, Authelia, Keycloak

### Get SSO Configuration
`GET /auth/sso/config`
- **Purpose**: Check SSO availability and configuration
- **Authentication**: No
- **Success Response** (200):
```json
{
  "enabled": true,
  "provider_type": "google",
  "registration_enabled": true
}
```

### Initiate SSO Login
`POST /auth/sso/initiate`
- **Purpose**: Start SSO authentication flow
- **Authentication**: No
- **Query Parameters**:
  - `return_url` (string, optional): URL to redirect after authentication
- **Success Response** (200):
```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "random_state_token"
}
```

### SSO Callback
`POST /auth/sso/callback`
- **Purpose**: Complete SSO authentication
- **Authentication**: No
- **Request Body**:
```json
{
  "code": "authorization_code_from_provider",
  "state": "state_token_from_initiate"
}
```
- **Success Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "john.doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "user",
    "auth_method": "google_sso"
  },
  "is_new_user": false
}
```
- **Conflict Response** (200):
```json
{
  "conflict": true,
  "temp_token": "temporary_token_for_resolution",
  "existing_email": "john@example.com",
  "sso_provider": "google"
}
```

### Resolve Account Conflict
`POST /auth/sso/resolve-conflict`
- **Purpose**: Handle SSO email conflicts with existing accounts
- **Authentication**: No
- **Request Body**:
```json
{
  "temp_token": "temporary_token",
  "action": "link",
  "preference": "auto_link"
}
```
- **Actions**:
  - `link`: Link SSO to existing account
  - `create_separate`: Create new account with different email
- **Preferences**:
  - `auto_link`: Automatically link in future
  - `create_separate`: Always create separate accounts
  - `always_ask`: Prompt user each time

### GitHub Manual Linking
`POST /auth/sso/resolve-github-link`
- **Purpose**: Link GitHub account by verifying password
- **Authentication**: No
- **Request Body**:
```json
{
  "temp_token": "temporary_token",
  "username": "johndoe",
  "password": "password"
}
```

### Test SSO Connection
`POST /auth/sso/test-connection`
- **Purpose**: Test SSO provider connectivity (admin)
- **Authentication**: No (but intended for admin use)
- **Success Response** (200):
```json
{
  "success": true,
  "message": "Successfully connected to provider"
}
```

---

## 4. User Management

Base path: `/api/v1/users`

### Get Current User
`GET /users/me`
- **Purpose**: Retrieve authenticated user's profile
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "full_name": "John Doe",
  "role": "user",
  "auth_method": "local",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Update Current User
`PUT /users/me`
- **Purpose**: Update user profile information
- **Authentication**: Yes
- **Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "newemail@example.com"
}
```
- **Success Response** (200): Updated user object

### Delete User Account
`DELETE /users/me`
- **Purpose**: Permanently delete user account and ALL associated data
- **Authentication**: Yes
- **Warning**: Deletes user, patient record, and all medical data (medications, lab results, etc.)
- **Success Response** (200):
```json
{
  "message": "Account and all associated data deleted successfully",
  "deleted_user_id": 1,
  "deleted_patient_id": 1,
  "deletion_summary": {
    "medications": 10,
    "lab_results": 5,
    "allergies": 2,
    "conditions": 3
  }
}
```
- **Error Responses**:
  - `400`: Cannot delete last admin user
  - `404`: User not found

### Get User Preferences
`GET /users/me/preferences`
- **Purpose**: Retrieve user preferences/settings
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "user_id": 1,
  "theme": "light",
  "notifications_enabled": true,
  "language": "en"
}
```

### Update User Preferences
`PUT /users/me/preferences`
- **Purpose**: Update user preferences
- **Authentication**: Yes
- **Request Body**:
```json
{
  "theme": "dark",
  "notifications_enabled": false
}
```

---

## 5. Patient Management

Base path: `/api/v1/patients`

### Get My Patient Record
`GET /patients/me`
- **Purpose**: Retrieve current user's patient record
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "id": 1,
  "owner_user_id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "birth_date": "1990-01-15",
  "gender": "male",
  "address": "123 Main St, City, State 12345",
  "phone_number": "+1234567890",
  "created_at": "2025-01-01T00:00:00Z"
}
```
- **Error Responses**:
  - `404`: Patient record not found

### Create My Patient Record
`POST /patients/me`
- **Purpose**: Create patient record for current user
- **Authentication**: Yes
- **Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "birth_date": "1990-01-15",
  "gender": "male",
  "address": "123 Main St, City, State 12345",
  "blood_type": "O+",
  "height": 70,
  "weight": 165,
  "physician_id": 5
}
```
- **Note**: Height in inches, weight in pounds
- **Success Response** (201): Created patient object
- **Error Responses**:
  - `400`: Patient record already exists
  - `400`: Validation failed (invalid date, missing required fields)

### Update My Patient Record
`PUT /patients/me`
- **Purpose**: Update current user's patient record
- **Authentication**: Yes
- **Request Body**: All fields optional
```json
{
  "first_name": "Jonathan",
  "address": "456 New Address"
}
```
- **Success Response** (200): Updated patient object

### Delete My Patient Record
`DELETE /patients/me`
- **Purpose**: Delete patient record and ALL medical data
- **Authentication**: Yes
- **Warning**: Cascades to medications, lab results, allergies, conditions, procedures, treatments, encounters, vitals, immunizations
- **Success Response** (200):
```json
{
  "message": "Patient record and all associated medical records deleted successfully"
}
```

### Get Patient Medications
`GET /patients/{patient_id}/medications`
- **Purpose**: Get all medications for a specific patient
- **Authentication**: Yes (must have access to patient)
- **Path Parameters**:
  - `patient_id` (integer): Patient ID
- **Query Parameters**:
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 100, max: 100): Items per page
  - `active_only` (boolean, default: false): Only active medications
- **Success Response** (200): Array of medication objects with practitioner and pharmacy details

### Create Patient Medication
`POST /patients/{patient_id}/medications`
- **Purpose**: Create new medication for a patient
- **Authentication**: Yes (must have write access to patient)
- **Request Body**: See Medications section below

### Get Patient Conditions
`GET /patients/{patient_id}/conditions`
- **Purpose**: Get all medical conditions for a patient
- **Authentication**: Yes

### Get Patient Allergies
`GET /patients/{patient_id}/allergies`
- **Purpose**: Get all allergies for a patient
- **Authentication**: Yes

### Get Patient Immunizations
`GET /patients/{patient_id}/immunizations`
- **Purpose**: Get all immunizations for a patient
- **Authentication**: Yes

### Get Patient Procedures
`GET /patients/{patient_id}/procedures`
- **Purpose**: Get all procedures for a patient
- **Authentication**: Yes

### Get Patient Treatments
`GET /patients/{patient_id}/treatments`
- **Purpose**: Get all treatments for a patient
- **Authentication**: Yes

### Get Patient Lab Results
`GET /patients/{patient_id}/lab-results`
- **Purpose**: Get all lab results for a patient
- **Authentication**: Yes

### Get Patient Encounters
`GET /patients/{patient_id}/encounters`
- **Purpose**: Get all encounters (visits) for a patient
- **Authentication**: Yes

### Get Recent Activity
`GET /patients/me/recent-activity`
- **Purpose**: Get recent medical-related activities
- **Authentication**: Yes
- **Query Parameters**:
  - `limit` (integer, default: 10, max: 100): Number of activities
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "model_name": "Medication",
    "action": "created",
    "description": "Created Medication: Aspirin 100mg",
    "timestamp": "2025-10-04T10:30:00Z"
  }
]
```

### Get Dashboard Statistics
`GET /patients/me/dashboard-stats`
- **Purpose**: Get comprehensive medical record statistics
- **Authentication**: Yes
- **Query Parameters**:
  - `patient_id` (integer, optional): Specific patient for Phase 1 patient switching
- **Success Response** (200):
```json
{
  "patient_id": 1,
  "total_records": 45,
  "active_medications": 3,
  "total_lab_results": 10,
  "total_procedures": 5,
  "total_treatments": 2,
  "total_conditions": 4,
  "total_allergies": 3,
  "total_immunizations": 8,
  "total_encounters": 12,
  "total_vitals": 20
}
```

### Upload Patient Photo
`POST /patients/{patient_id}/photo`
- **Purpose**: Upload patient profile photo
- **Authentication**: Yes (must have write access)
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `file`: Image file (JPEG, PNG, GIF, BMP)
- **File Restrictions**:
  - Max size: 15MB
  - Accepted types: image/jpeg, image/png, image/gif, image/bmp
- **Success Response** (201):
```json
{
  "id": 1,
  "patient_id": 1,
  "filename": "patient_1_photo.jpg",
  "file_size": 245678,
  "uploaded_at": "2025-10-04T10:30:00Z"
}
```

### Get Patient Photo
`GET /patients/{patient_id}/photo`
- **Purpose**: Get patient photo file
- **Authentication**: Yes
- **Success Response** (200): Image file (image/jpeg)
- **Headers**:
  - `Cache-Control: max-age=3600`

### Get Patient Photo Info
`GET /patients/{patient_id}/photo/info`
- **Purpose**: Get photo metadata without downloading file
- **Authentication**: Yes
- **Success Response** (200): Photo metadata object

### Delete Patient Photo
`DELETE /patients/{patient_id}/photo`
- **Purpose**: Delete patient photo
- **Authentication**: Yes (must be owner)
- **Success Response** (204): No content

---

## 6. Medical Records

### 6.1 Medications

Base path: `/api/v1/medications`

#### Create Medication
`POST /medications/`
- **Authentication**: Yes
- **Request Body**:
```json
{
  "patient_id": 1,
  "medication_name": "Aspirin",
  "dosage": "100mg",
  "frequency": "Once daily",
  "route": "oral",
  "indication": "Pain relief",
  "effective_period_start": "2025-01-01",
  "effective_period_end": "2025-12-31",
  "status": "active",
  "practitioner_id": 5,
  "pharmacy_id": 3
}
```
- **Route values**: `oral`, `injection`, `topical`, `intravenous`, `intramuscular`, `subcutaneous`, `inhalation`, `nasal`, `rectal`, `sublingual`
- **Status values**: `active`, `stopped`, `on-hold`, `completed`, `cancelled`
- **Success Response** (201): Medication object with relations

#### List Medications
`GET /medications/`
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, default: 0)
  - `limit` (integer, default: 100, max: 100)
  - `name` (string, optional): Filter by medication name
  - `tags` (array, optional): Filter by tags
  - `tag_match_all` (boolean, default: false): Match ALL tags vs ANY tag
- **Success Response** (200): Array of medications with practitioner, pharmacy, condition details

#### Get Medication
`GET /medications/{medication_id}`
- **Authentication**: Yes
- **Success Response** (200): Single medication with relations

#### Update Medication
`PUT /medications/{medication_id}`
- **Authentication**: Yes
- **Request Body**: Same as create, all fields optional

#### Delete Medication
`DELETE /medications/{medication_id}`
- **Authentication**: Yes
- **Success Response** (204): No content

#### Get Patient Medications (Active Only)
`GET /medications/patient/{patient_id}?active_only=true`
- **Query Parameters**:
  - `active_only` (boolean): Filter only active medications

### 6.2 Allergies

Base path: `/api/v1/allergies`

#### Create Allergy
`POST /allergies/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "allergen": "Penicillin",
  "severity": "severe",
  "reaction": "Anaphylaxis",
  "diagnosed_date": "2020-05-15",
  "notes": "Confirmed by allergist"
}
```
- **Severity values**: `mild`, `moderate`, `severe`, `life-threatening`

#### List Allergies
`GET /allergies/`
- **Query Parameters**:
  - `severity` (string, optional): Filter by severity
  - `allergen` (string, optional): Search allergen name
  - `tags` (array, optional): Filter by tags

#### Get Active Allergies
`GET /allergies/patient/{patient_id}/active`
- **Purpose**: Get only active allergies for a patient

#### Get Critical Allergies
`GET /allergies/patient/{patient_id}/critical`
- **Purpose**: Get severe and life-threatening allergies

#### Check Allergen Conflict
`GET /allergies/patient/{patient_id}/check/{allergen}`
- **Purpose**: Check if patient has allergy to specific allergen
- **Success Response** (200):
```json
{
  "patient_id": 1,
  "allergen": "Penicillin",
  "has_allergy": true
}
```

### 6.3 Conditions

Base path: `/api/v1/conditions`

#### Create Condition
`POST /conditions/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "condition_name": "Hypertension",
  "status": "active",
  "diagnosed_date": "2023-03-10",
  "practitioner_id": 5,
  "severity": "moderate",
  "notes": "Controlled with medication"
}
```
- **Status values**: `active`, `resolved`, `chronic`
- **Severity values**: `mild`, `moderate`, `severe`

#### List Conditions
`GET /conditions/`
- **Query Parameters**:
  - `status` (string, optional): Filter by status
  - `tags` (array, optional): Filter by tags

#### Get Chronic Conditions
`GET /conditions/patient/{patient_id}/chronic`

#### Get Active Conditions
`GET /conditions/patient/{patient_id}/active`

### 6.4 Immunizations

Base path: `/api/v1/immunizations`

#### Create Immunization
`POST /immunizations/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "vaccine_name": "COVID-19 Vaccine",
  "vaccine_type": "mRNA",
  "dose_number": 1,
  "administration_date": "2025-01-15",
  "practitioner_id": 5,
  "lot_number": "LOT12345",
  "expiration_date": "2026-01-15",
  "site": "Left arm",
  "route": "Intramuscular",
  "notes": "No adverse reactions"
}
```

#### List Immunizations
`GET /immunizations/`

#### Get Upcoming Immunizations
`GET /immunizations/patient/{patient_id}/upcoming`
- **Purpose**: Get immunizations scheduled for the future

### 6.5 Vitals

Base path: `/api/v1/vitals`

#### Create Vitals Record
`POST /vitals/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "recorded_date": "2025-10-04T10:30:00Z",
  "systolic_bp": 120,
  "diastolic_bp": 80,
  "heart_rate": 72,
  "temperature": 98.6,
  "weight": 165,
  "height": 70,
  "oxygen_saturation": 98,
  "respiratory_rate": 16,
  "blood_glucose": 95,
  "bmi": 24.5,
  "pain_scale": 0,
  "notes": "Routine checkup",
  "location": "Doctor's office",
  "device_used": "Digital thermometer",
  "practitioner_id": 5
}
```
- **Note**: Temperature stored in Fahrenheit, weight in pounds, height in inches
- **Validation**:
  - Systolic BP: 60-250 mmHg
  - Diastolic BP: 30-150 mmHg
  - Heart Rate: 30-250 bpm
  - Temperature: 80-115°F
  - Pain Scale: 0-10

#### List Vitals
`GET /vitals/`
- **Query Parameters**:
  - `start_date` (string, optional): Filter from date
  - `end_date` (string, optional): Filter to date

#### Get Latest Vitals
`GET /vitals/patient/{patient_id}/latest`
- **Purpose**: Get most recent vital signs

### 6.6 Lab Results

Base path: `/api/v1/lab-results`

#### Create Lab Result
`POST /lab-results/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "test_name": "Complete Blood Count",
  "test_date": "2025-10-01",
  "result_date": "2025-10-02",
  "practitioner_id": 5,
  "lab_name": "LabCorp",
  "status": "final",
  "notes": "All values within normal range"
}
```
- **Status values**: `pending`, `preliminary`, `final`, `corrected`

#### List Lab Results
`GET /lab-results/`

#### Get Lab Result with Components
`GET /lab-results/{lab_result_id}`
- **Success Response**: Lab result with all test components

#### Lab Result File Upload
`POST /lab-results/{lab_result_id}/files`
- **Content-Type**: `multipart/form-data`
- **Request**: File upload (PDF, images)

#### Get Lab Result Files
`GET /lab-results/{lab_result_id}/files`

### Lab Test Components

Base path: `/api/v1/lab-test-components`

#### Create Test Component
`POST /lab-test-components/`
- **Request Body**:
```json
{
  "lab_result_id": 1,
  "component_name": "White Blood Cell Count",
  "value": "7.5",
  "unit": "K/uL",
  "reference_range": "4.5-11.0",
  "status": "normal"
}
```
- **Status values**: `normal`, `abnormal`, `critical`

### 6.7 Encounters

Base path: `/api/v1/encounters`

#### Create Encounter
`POST /encounters/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "encounter_type": "Office Visit",
  "encounter_date": "2025-10-04",
  "practitioner_id": 5,
  "chief_complaint": "Annual checkup",
  "diagnosis": "Healthy",
  "treatment_plan": "Continue current medications",
  "notes": "Patient doing well"
}
```

### 6.8 Procedures

Base path: `/api/v1/procedures`

#### Create Procedure
`POST /procedures/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "procedure_name": "Blood Draw",
  "procedure_date": "2025-10-04",
  "practitioner_id": 5,
  "status": "completed",
  "notes": "Routine lab work"
}
```

### 6.9 Treatments

Base path: `/api/v1/treatments`

#### Create Treatment
`POST /treatments/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "treatment_name": "Physical Therapy",
  "condition_id": 2,
  "start_date": "2025-10-01",
  "end_date": "2025-12-31",
  "practitioner_id": 5,
  "frequency": "3 times per week",
  "status": "active",
  "notes": "For lower back pain"
}
```

---

## 7. Related Information

### 7.1 Insurance

Base path: `/api/v1/insurances`

#### Create Insurance Record
`POST /insurances/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "provider_name": "Blue Cross Blue Shield",
  "policy_number": "ABC123456",
  "group_number": "GRP789",
  "insurance_type": "primary",
  "effective_date": "2025-01-01",
  "expiration_date": "2025-12-31",
  "notes": "PPO plan"
}
```

### 7.2 Emergency Contacts

Base path: `/api/v1/emergency-contacts`

#### Create Emergency Contact
`POST /emergency-contacts/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "name": "Jane Doe",
  "relationship": "Spouse",
  "phone_number": "+1234567890",
  "email": "jane@example.com",
  "address": "123 Main St",
  "is_primary": true
}
```

### 7.3 Family Members

Base path: `/api/v1/family-members`

#### Create Family Member
`POST /family-members/`
- **Request Body**:
```json
{
  "patient_id": 1,
  "name": "John Doe Sr.",
  "relationship": "Father",
  "birth_date": "1960-05-20",
  "is_deceased": false,
  "medical_history": "Diabetes, Hypertension"
}
```

### 7.4 Pharmacies

Base path: `/api/v1/pharmacies`

#### Create Pharmacy
`POST /pharmacies/`
- **Request Body**:
```json
{
  "name": "CVS Pharmacy",
  "phone_number": "+1234567890",
  "address": "456 Oak St, City, State 12345",
  "hours": "Mon-Fri 9AM-9PM",
  "notes": "24-hour location"
}
```

#### List Pharmacies
`GET /pharmacies/`
- **Query Parameters**:
  - `search` (string, optional): Search by name or address

### 7.5 Practitioners

Base path: `/api/v1/practitioners`

#### Create Practitioner
`POST /practitioners/`
- **Request Body**:
```json
{
  "first_name": "Dr. Sarah",
  "last_name": "Smith",
  "specialty": "Cardiology",
  "phone_number": "+1234567890",
  "email": "dr.smith@clinic.com",
  "address": "789 Medical Plaza",
  "npi_number": "1234567890",
  "notes": "Accepts new patients"
}
```

#### List Practitioners
`GET /practitioners/`
- **Query Parameters**:
  - `specialty` (string, optional): Filter by specialty
  - `search` (string, optional): Search by name

---

## 8. Files & Attachments

Base path: `/api/v1/entity-files`

### Upload File
`POST /entity-files/`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `file`: File to upload
  - `entity_type`: Type (medication, condition, etc.)
  - `entity_id`: ID of related record
  - `description`: File description
- **Max Size**: 15MB
- **Allowed Types**: PDF, JPEG, PNG, GIF

### List Files for Entity
`GET /entity-files/{entity_type}/{entity_id}`

### Download File
`GET /entity-files/{file_id}/download`

### Delete File
`DELETE /entity-files/{file_id}`

---

## 9. Sharing & Collaboration

### 9.1 Patient Sharing

Base path: `/api/v1/patient-sharing`

#### Share Patient Record
`POST /patient-sharing/share`
- **Request Body**:
```json
{
  "patient_id": 1,
  "recipient_email": "doctor@example.com",
  "access_level": "view",
  "expiration_date": "2025-12-31",
  "message": "Sharing medical records for consultation"
}
```
- **Access levels**: `view`, `edit`, `full`

#### Revoke Access
`DELETE /patient-sharing/{share_id}`

#### List Shared Patients
`GET /patient-sharing/shared-with-me`

### 9.2 Invitations

Base path: `/api/v1/invitations`

#### List Invitations
`GET /invitations/`
- **Query Parameters**:
  - `status` (string, optional): `pending`, `accepted`, `rejected`

#### Accept Invitation
`POST /invitations/{invitation_id}/accept`

#### Reject Invitation
`POST /invitations/{invitation_id}/reject`

#### Revoke Invitation
`DELETE /invitations/{invitation_id}`

---

## 10. Search & Tags

### 10.1 Search

Base path: `/api/v1/search`

#### Global Search
`GET /search/`
- **Query Parameters**:
  - `q` (string, required): Search query
  - `type` (string, optional): Filter by record type
  - `patient_id` (integer, optional): Filter by patient
- **Success Response** (200):
```json
{
  "results": [
    {
      "type": "medication",
      "id": 1,
      "name": "Aspirin 100mg",
      "patient_id": 1
    }
  ],
  "total": 1
}
```

### 10.2 Tags

Base path: `/api/v1/tags`

#### Create Tag
`POST /tags/`
- **Request Body**:
```json
{
  "name": "Cardiology",
  "color": "#FF5733"
}
```

#### List Tags
`GET /tags/`

#### Apply Tag to Entity
`POST /tags/{tag_id}/apply`
- **Request Body**:
```json
{
  "entity_type": "medication",
  "entity_id": 1
}
```

#### Remove Tag from Entity
`DELETE /tags/{tag_id}/remove/{entity_type}/{entity_id}`

---

## 11. Reports & Export

### 11.1 Custom Reports

Base path: `/api/v1/custom-reports`

#### Generate Report
`POST /custom-reports/generate`
- **Request Body**:
```json
{
  "patient_id": 1,
  "report_type": "medical_summary",
  "date_range": {
    "start": "2025-01-01",
    "end": "2025-12-31"
  },
  "include_sections": ["medications", "lab_results", "conditions"]
}
```

#### List Reports
`GET /custom-reports/`

#### Download Report
`GET /custom-reports/{report_id}/download`

### 11.2 Export

Base path: `/api/v1/export`

#### Export Data
`GET /export/{record_type}`
- **Path Parameters**:
  - `record_type`: `medications`, `lab-results`, `allergies`, etc.
- **Query Parameters**:
  - `patient_id` (integer, required): Patient to export
  - `format` (string, optional): `csv` or `pdf` (default: csv)
- **Success Response**: File download

---

## 12. Integrations

### 12.1 Paperless-ngx

Base path: `/api/v1/paperless`

#### Upload to Paperless
`POST /paperless/upload`
- **Request Body**:
```json
{
  "document_id": 123,
  "tags": ["medical", "lab-results"],
  "correspondent": "LabCorp"
}
```

#### Sync from Paperless
`POST /paperless/sync`

#### List Paperless Documents
`GET /paperless/documents`

---

## 13. System & Admin

### 13.1 System

Base path: `/api/v1/system`

#### Health Check
`GET /system/health`
- **Authentication**: No
- **Success Response** (200):
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "0.33.1"
}
```

#### System Backup
`POST /system/backup`
- **Authentication**: Yes (Admin only)

#### System Restore
`POST /system/restore`
- **Authentication**: Yes (Admin only)

### 13.2 Frontend Logs

Base path: `/api/v1/frontend-logs`

#### Submit Frontend Log
`POST /frontend-logs/`
- **Request Body**:
```json
{
  "level": "error",
  "message": "JavaScript error occurred",
  "context": {
    "url": "/dashboard",
    "user_agent": "Mozilla/5.0..."
  }
}
```

---

## Appendices

### A. Error Codes Reference

| Code | Meaning | Common Causes |
|------|---------|---------------|
| AUTH_001 | Invalid credentials | Wrong username/password |
| AUTH_002 | Token expired | Session timeout |
| AUTH_003 | Insufficient permissions | Accessing restricted resource |
| VAL_001 | Validation failed | Invalid input data |
| RES_001 | Resource not found | Invalid ID or deleted resource |
| RES_002 | Resource conflict | Duplicate entry |
| RATE_001 | Rate limit exceeded | Too many requests |

### B. Data Types

**Date Format**: ISO 8601 (`YYYY-MM-DD`)
**DateTime Format**: ISO 8601 with timezone (`YYYY-MM-DDTHH:MM:SSZ`)
**Phone Format**: E.164 (`+1234567890`)
**Email Format**: RFC 5322

### C. Security Best Practices

1. Always use HTTPS in production
2. Store tokens securely (never in localStorage for sensitive apps)
3. Implement token refresh mechanism
4. Handle 401 responses by redirecting to login
5. Validate all user inputs on client side
6. Never log sensitive patient data
7. Implement CSRF protection for state-changing operations

### D. Versioning Policy

- Current version: v1
- Breaking changes require new version
- Deprecated endpoints supported for 6 months
- Version specified in URL path (`/api/v1/`)

---

**For Support:**
- GitHub Issues: [github.com/afairgiant/MediKeep/issues](https://github.com/afairgiant/MediKeep/issues)
- API Documentation: http://localhost:8005/docs (Swagger UI)
- Developer Guide: [docs/developer-guide/](../developer-guide/)
