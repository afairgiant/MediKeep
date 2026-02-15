# MediKeep API Reference (v1.0)

**Last Updated:** February 7, 2026
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
8. [Notifications](#8-notifications)
9. [Files & Attachments](#9-files--attachments)
10. [Sharing & Collaboration](#10-sharing--collaboration)
11. [Search & Tags](#11-search--tags)
12. [Reports & Export](#12-reports--export)
13. [Integrations](#13-integrations)
14. [System & Utilities](#14-system--utilities)
15. [Admin Dashboard](#15-admin-dashboard)

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
- System monitoring endpoints: 60 requests/minute per IP (`/system/log-level`, `/system/log-rotation-config`)

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
- **Content-Type**: `application/x-www-form-urlencoded`
- **Request Body** (form data):
```
username=johndoe&password=SecurePass123!
```
- **Success Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "session_timeout_minutes": 60
}
```
- **Note**: The response does NOT include a user object. Use `GET /users/me` to retrieve user details after login. The `session_timeout_minutes` reflects the user's session timeout preference (or system default if not set).
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
  "session_timeout_minutes": 60,
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

### 5.1 Multi-Patient Management (V1)

Base path: `/api/v1/patient-management`

**Purpose**: Netflix-style patient switching for managing multiple patient records

#### Create Patient
`POST /patient-management/`
- **Purpose**: Create a new patient record (for managing family members, dependents, etc.)
- **Request Body**:
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "birth_date": "2010-05-20",
  "gender": "female",
  "blood_type": "A+",
  "height": 60,
  "weight": 85,
  "address": "123 Main St",
  "physician_id": 3,
  "is_self_record": false
}
```
- **Success Response** (201): Created patient object

#### List All Patients
`GET /patient-management/`
- **Purpose**: Get all accessible patients (owned + shared with user)
- **Query Parameters**:
  - `skip`: Pagination offset
  - `limit`: Max items
  - `include_shared`: Include patients shared with user (default: true)
- **Success Response** (200):
```json
{
  "patients": [...],
  "total": 5,
  "owned_count": 3,
  "shared_count": 2
}
```

#### Get Patient by ID
`GET /patient-management/{patient_id}`
- **Purpose**: Get specific patient details
- **Success Response** (200): Patient object

#### Update Patient
`PUT /patient-management/{patient_id}`
- **Purpose**: Update patient information
- **Request Body**: Same as create (all fields optional)
- **Success Response** (200): Updated patient object

#### Delete Patient
`DELETE /patient-management/{patient_id}`
- **Purpose**: Delete a patient record
- **Note**: Cannot delete if it's the last remaining patient
- **Success Response** (200): `{"message": "Patient deleted successfully"}`

#### List Owned Patients
`GET /patient-management/owned/list`
- **Purpose**: Get only patients owned by current user
- **Success Response** (200): Array of owned patient objects

#### Get Self Record
`GET /patient-management/self-record`
- **Purpose**: Get the user's own patient record (is_self_record=true)
- **Success Response** (200): Patient object or null

#### Switch Active Patient
`POST /patient-management/switch`
- **Purpose**: Switch the currently active patient context
- **Request Body**:
```json
{
  "patient_id": 3
}
```
- **Success Response** (200): New active patient object
- **Use Case**: Switch between managing different family members

#### Get Current Active Patient
`GET /patient-management/active/current`
- **Purpose**: Get the currently active patient
- **Success Response** (200): Active patient object or null

#### Get Patient Statistics
`GET /patient-management/stats`
- **Purpose**: Get statistics about accessible patients
- **Success Response** (200):
```json
{
  "total_patients": 5,
  "owned_patients": 3,
  "shared_patients": 2,
  "self_record_exists": true
}
```

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

#### Get Medication Treatments
`GET /medications/{medication_id}/treatments`
- **Purpose**: Get all treatments that use a specific medication (medication profile / treatment history)
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "treatment_id": 5,
    "medication_id": 12,
    "specific_dosage": "20mg",
    "specific_frequency": null,
    "specific_duration": null,
    "timing_instructions": null,
    "relevance_note": "Primary medication",
    "specific_prescriber_id": null,
    "specific_pharmacy_id": null,
    "specific_start_date": "2026-01-09",
    "specific_end_date": null,
    "treatment": {
      "id": 5,
      "treatment_name": "Cardiac Rehabilitation",
      "treatment_type": "Rehabilitation",
      "status": "active",
      "mode": "advanced",
      "start_date": "2026-01-01",
      "end_date": null,
      "condition": { "id": 2, "condition_name": "Hypertension" }
    }
  }
]
```
- Includes treatment details with condition, plus any treatment-specific overrides for this medication

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
  - `tag_match_all` (boolean, default: false): Match all tags (AND) vs any tag (OR)

#### Get Conditions for Dropdown
`GET /conditions/dropdown`
- **Purpose**: Get conditions formatted for dropdown selection in forms
- **Authentication**: Yes
- **Query Parameters**:
  - `active_only` (boolean, default: false): Only return active conditions
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "condition_name": "Hypertension",
    "status": "active"
  }
]
```

#### Get Condition by ID
`GET /conditions/{condition_id}`
- **Purpose**: Get condition with related information (patient, practitioner, treatments)
- **Authentication**: Yes
- **Success Response** (200): Condition object with relations

#### Update Condition
`PUT /conditions/{condition_id}`
- **Request Body**: Same as create (all fields optional)
- **Success Response** (200): Updated condition object

#### Delete Condition
`DELETE /conditions/{condition_id}`
- **Success Response** (200): `{"message": "Condition deleted successfully"}`

#### Get Active Conditions
`GET /conditions/patient/{patient_id}/active`
- **Purpose**: Get all active conditions for a patient
- **Authentication**: Yes
- **Success Response** (200): Array of active condition objects

#### Get Patient Conditions
`GET /conditions/patients/{patient_id}/conditions/`
- **Purpose**: Get all conditions for a specific patient
- **Authentication**: Yes
- **Query Parameters**: `skip`, `limit`
- **Success Response** (200): Array of condition objects

#### Condition-Medication Linking

##### Get Condition Medications
`GET /conditions/condition-medications/{condition_id}`
- **Purpose**: Get all medications linked to a condition
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "medication_id": 5,
    "condition_id": 1,
    "relevance_note": "Primary treatment",
    "created_at": "2025-10-01T00:00:00Z",
    "updated_at": "2025-10-01T00:00:00Z"
  }
]
```

##### Link Medication to Condition
`POST /conditions/{condition_id}/medications`
- **Purpose**: Create a relationship between a condition and medication
- **Authentication**: Yes
- **Request Body**:
```json
{
  "medication_id": 5,
  "relevance_note": "Primary treatment for this condition"
}
```
- **Success Response** (201): Created relationship object
- **Error Responses**:
  - `400`: Relationship already exists or medication belongs to different patient
  - `404`: Condition or medication not found

##### Bulk Link Medications to Condition
`POST /conditions/{condition_id}/medications/bulk`
- **Purpose**: Create multiple condition-medication relationships at once
- **Authentication**: Yes
- **Request Body**:
```json
{
  "medication_ids": [5, 8, 12],
  "relevance_note": "Treatments for managing this condition"
}
```
- **Success Response** (200): Array of created relationship objects
```json
[
  {
    "id": 1,
    "condition_id": 1,
    "medication_id": 5,
    "relevance_note": "Treatments for managing this condition",
    "created_at": "2026-02-03T00:00:00Z",
    "updated_at": "2026-02-03T00:00:00Z"
  },
  {
    "id": 2,
    "condition_id": 1,
    "medication_id": 8,
    "relevance_note": "Treatments for managing this condition",
    "created_at": "2026-02-03T00:00:00Z",
    "updated_at": "2026-02-03T00:00:00Z"
  }
  // Note: medication_id 12 was already linked, so it was silently skipped
]
```
- **Notes**:
  - Medications that are already linked to the condition are silently skipped
  - All medications must belong to the same patient as the condition
  - `relevance_note` is optional and applies to all created relationships
- **Error Responses**:
  - `400`: Medication belongs to different patient
  - `404`: Condition or medication not found
  - `422`: Validation error (empty array, duplicate IDs, invalid IDs)

##### Update Condition-Medication Link
`PUT /conditions/{condition_id}/medications/{relationship_id}`
- **Purpose**: Update the relevance note for a condition-medication relationship
- **Authentication**: Yes
- **Request Body**:
```json
{
  "relevance_note": "Updated note about the relationship"
}
```
- **Success Response** (200): Updated relationship object

##### Remove Medication Link from Condition
`DELETE /conditions/{condition_id}/medications/{relationship_id}`
- **Purpose**: Remove the link between a condition and medication
- **Authentication**: Yes
- **Success Response** (200): `{"message": "Condition medication relationship deleted successfully"}`

##### Get Medication Conditions
`GET /conditions/medication/{medication_id}/conditions`
- **Purpose**: Get all conditions linked to a specific medication (reverse lookup)
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "condition_id": 3,
    "medication_id": 5,
    "relevance_note": "Treatment for this condition",
    "created_at": "2025-10-01T00:00:00Z",
    "updated_at": "2025-10-01T00:00:00Z",
    "condition": {
      "id": 3,
      "diagnosis": "Hypertension",
      "status": "active",
      "severity": "moderate"
    }
  }
]
```

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
- **Authentication**: Yes
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
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 10000, max: 10000): Items per page
  - `vital_type` (string, optional): Filter by vital type (blood_pressure, heart_rate, temperature, weight, oxygen_saturation, blood_glucose)
  - `start_date` (string, optional): Start date for date range filter (ISO format)
  - `end_date` (string, optional): End date for date range filter (ISO format)
  - `days` (integer, optional): Get readings from last N days
- **Success Response** (200): Array of vitals records

#### Get Vitals by ID
`GET /vitals/{vitals_id}`
- **Purpose**: Get vitals reading with related information
- **Authentication**: Yes
- **Success Response** (200): Vitals object with patient and practitioner details

#### Update Vitals
`PUT /vitals/{vitals_id}`
- **Authentication**: Yes
- **Request Body**: Same as create (all fields optional)
- **Success Response** (200): Updated vitals object

#### Delete Vitals
`DELETE /vitals/{vitals_id}`
- **Authentication**: Yes
- **Success Response** (200): `{"message": "Vitals deleted successfully"}`

#### Get Vitals Statistics
`GET /vitals/stats`
- **Purpose**: Get vitals statistics for the current user
- **Authentication**: Yes
- **Query Parameters**:
  - `patient_id` (integer, optional): Patient ID for patient switching
- **Success Response** (200):
```json
{
  "total_readings": 50,
  "latest_reading_date": "2025-10-04T10:30:00Z",
  "blood_pressure_avg": {
    "systolic": 120,
    "diastolic": 80
  },
  "heart_rate_avg": 72,
  "weight_trend": "stable"
}
```

#### Get Patient Vitals (Paginated)
`GET /vitals/patient/{patient_id}/paginated`
- **Purpose**: Get paginated vitals readings with total count
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 10, max: 100): Items per page
  - `vital_type` (string, optional): Filter by vital type
- **Success Response** (200):
```json
{
  "items": [...],
  "total": 100,
  "skip": 0,
  "limit": 10
}
```

#### Get Patient Vitals
`GET /vitals/patient/{patient_id}`
- **Purpose**: Get all vitals for a specific patient
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 10000, max: 10000): Items per page
  - `vital_type` (string, optional): Filter by vital type
  - `days` (integer, optional): Get readings from last N days
- **Success Response** (200): Array of vitals records

#### Get Latest Vitals
`GET /vitals/patient/{patient_id}/latest`
- **Purpose**: Get most recent vital signs for a patient
- **Authentication**: Yes
- **Success Response** (200): Single vitals object
- **Error Response** (404): No vitals readings found

#### Get Patient Vitals Statistics
`GET /vitals/patient/{patient_id}/stats`
- **Purpose**: Get vitals statistics for a specific patient
- **Authentication**: Yes
- **Success Response** (200): Statistics object with averages and trends

#### Get Vitals by Date Range
`GET /vitals/patient/{patient_id}/date-range`
- **Purpose**: Get vitals readings within a specific date range
- **Authentication**: Yes
- **Query Parameters**:
  - `start_date` (datetime, required): Start date for the range
  - `end_date` (datetime, required): End date for the range
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 10000, max: 10000): Items per page
  - `vital_type` (string, optional): Filter by vital type
- **Success Response** (200): Array of vitals records

#### Create Patient Vitals
`POST /vitals/patient/{patient_id}/vitals/`
- **Purpose**: Create a new vitals reading for a specific patient
- **Authentication**: Yes
- **Request Body**: Same as main create endpoint
- **Note**: Patient ID in URL must match patient_id in request body
- **Success Response** (201): Created vitals object

### 6.6 Lab Results

Base path: `/api/v1/lab-results`

#### Create Lab Result
`POST /lab-results/`
- **Authentication**: Yes
- **Request Body**:
```json
{
  "patient_id": 1,
  "test_name": "Complete Blood Count",
  "test_code": "CBC",
  "test_category": "Hematology",
  "test_type": "routine",
  "facility": "LabCorp",
  "ordered_date": "2025-10-01",
  "completed_date": "2025-10-02",
  "practitioner_id": 5,
  "status": "final",
  "labs_result": "All values within normal range",
  "notes": "Routine checkup",
  "tags": ["annual", "routine"]
}
```
- **Status values**: `pending`, `preliminary`, `final`, `corrected`
- **Success Response** (201): Lab result object

#### List Lab Results
`GET /lab-results/`
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 100, max: 1000): Items per page
  - `tags` (array, optional): Filter by tags
  - `tag_match_all` (boolean, default: false): Match all tags (AND) vs any tag (OR)
- **Success Response** (200): Array of lab results with practitioner and patient details

#### Get Lab Result by ID
`GET /lab-results/{lab_result_id}`
- **Purpose**: Get lab result with related data (patient, practitioner, files)
- **Authentication**: Yes
- **Success Response** (200): Lab result with relations

#### Update Lab Result
`PUT /lab-results/{lab_result_id}`
- **Authentication**: Yes
- **Request Body**: Same as create (all fields optional)
- **Success Response** (200): Updated lab result

#### Delete Lab Result
`DELETE /lab-results/{lab_result_id}`
- **Purpose**: Delete lab result and associated files
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "message": "Lab result and associated files deleted successfully",
  "files_deleted": 2,
  "files_preserved": 1
}
```

#### Get Patient Lab Results
`GET /lab-results/patient/{patient_id}`
- **Purpose**: Get all lab results for a specific patient
- **Authentication**: Yes
- **Query Parameters**: `skip`, `limit`, `tags`, `tag_match_all`
- **Success Response** (200): Array of lab results

#### Get Patient Lab Results by Code
`GET /lab-results/patient/{patient_id}/code/{code}`
- **Purpose**: Get lab results for a patient filtered by test code
- **Authentication**: Yes
- **Success Response** (200): Array of lab results

#### Get Practitioner Lab Results
`GET /lab-results/practitioner/{practitioner_id}`
- **Purpose**: Get lab results ordered by a specific practitioner (filtered to accessible patients)
- **Authentication**: Yes
- **Query Parameters**: `skip`, `limit`
- **Success Response** (200): Array of lab results

#### Search Lab Results by Code
`GET /lab-results/search/code/{code}`
- **Purpose**: Search lab results by exact test code
- **Authentication**: Yes
- **Query Parameters**: `skip`, `limit`
- **Success Response** (200): Array of matching lab results

#### Search Lab Results by Code Pattern
`GET /lab-results/search/code-pattern/{code_pattern}`
- **Purpose**: Search lab results by partial test code match
- **Authentication**: Yes
- **Query Parameters**: `skip`, `limit`
- **Success Response** (200): Array of matching lab results

#### Lab Result File Management

##### Get Lab Result Files
`GET /lab-results/{lab_result_id}/files`
- **Purpose**: Get all files attached to a lab result
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "lab_result_id": 1,
    "file_name": "cbc_results.pdf",
    "file_path": "/uploads/lab_result_files/abc123.pdf",
    "file_type": "application/pdf",
    "file_size": 245678,
    "description": "Original lab report",
    "uploaded_at": "2025-10-04T10:30:00Z"
  }
]
```

##### Upload Lab Result File
`POST /lab-results/{lab_result_id}/files`
- **Purpose**: Upload a file to a lab result
- **Authentication**: Yes
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `file`: File to upload
  - `description` (optional): File description
- **Max Size**: 1GB
- **Allowed Extensions**: PDF, images, documents, medical imaging (DICOM, NIfTI), video, audio, archives
- **Success Response** (201): Created file object

##### Delete Lab Result File
`DELETE /lab-results/{lab_result_id}/files/{file_id}`
- **Purpose**: Delete a specific file from a lab result
- **Authentication**: Yes
- **Success Response** (200): `{"message": "File deleted successfully"}`

#### Lab Result Statistics

##### Get Patient Lab Result Count
`GET /lab-results/stats/patient/{patient_id}/count`
- **Purpose**: Get count of lab results for a patient
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "patient_id": 1,
  "lab_result_count": 25
}
```

##### Get Practitioner Lab Result Count
`GET /lab-results/stats/practitioner/{practitioner_id}/count`
- **Purpose**: Get count of lab results ordered by a practitioner
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "practitioner_id": 5,
  "lab_result_count": 150
}
```

##### Get Code Usage Count
`GET /lab-results/stats/code/{code}/count`
- **Purpose**: Get count of how many times a specific test code has been used
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "code": "CBC",
  "usage_count": 50
}
```

#### Lab Result - Condition Relationships

##### Get Lab Result Conditions
`GET /lab-results/{lab_result_id}/conditions`
- **Purpose**: Get all conditions linked to a lab result
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "lab_result_id": 1,
    "condition_id": 3,
    "relevance_note": "Monitoring for diabetes",
    "created_at": "2025-10-01T00:00:00Z",
    "condition": {
      "id": 3,
      "diagnosis": "Type 2 Diabetes",
      "status": "active",
      "severity": "moderate"
    }
  }
]
```

##### Link Condition to Lab Result
`POST /lab-results/{lab_result_id}/conditions`
- **Purpose**: Create a relationship between a lab result and condition
- **Authentication**: Yes
- **Request Body**:
```json
{
  "condition_id": 3,
  "relevance_note": "Monitoring glucose levels for diabetes management"
}
```
- **Success Response** (201): Created relationship object

##### Update Lab Result-Condition Link
`PUT /lab-results/{lab_result_id}/conditions/{relationship_id}`
- **Request Body**:
```json
{
  "relevance_note": "Updated relevance note"
}
```
- **Success Response** (200): Updated relationship object

##### Remove Condition Link from Lab Result
`DELETE /lab-results/{lab_result_id}/conditions/{relationship_id}`
- **Success Response** (200): `{"message": "Lab result condition relationship deleted successfully"}`

#### PDF OCR Extraction
`POST /lab-results/{lab_result_id}/ocr-parse`
- **Purpose**: Extract text from lab PDF using hybrid OCR approach
- **Authentication**: Yes
- **Content-Type**: `multipart/form-data`
- **Request Body**: PDF file
- **Max Size**: 15MB
- **Success Response** (200):
```json
{
  "status": "success",
  "extracted_text": "Extracted text content...",
  "metadata": {
    "method": "hybrid",
    "confidence": 0.95,
    "page_count": 3,
    "char_count": 5000,
    "filename": "lab_report.pdf",
    "lab_name": "LabCorp",
    "test_count": 15,
    "test_date": "2025-10-01"
  },
  "error": null
}
```
- **Note**: Returns raw text for client-side parsing. Does NOT save to database.

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
  "outcome": "successful",
  "notes": "Routine lab work"
}
```

### 6.9 Treatments

Base path: `/api/v1/treatments`

Treatments support two modes:
- **Simple** (`"simple"`): Basic treatment tracking with schedule and dosage fields on the treatment itself.
- **Advanced** (`"advanced"`): Medication-centric treatment plans where dosage, schedule, prescriber, and pharmacy can be overridden per linked medication.

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
  "mode": "simple",
  "notes": "For lower back pain"
}
```
- **Mode values**: `simple` (default), `advanced`

#### List Treatments
`GET /treatments/`
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 100, max: 100): Items per page
  - `condition_id` (integer, optional): Filter by condition
  - `status` (string, optional): Filter by status
  - `tags` (array, optional): Filter by tags
  - `tag_match_all` (boolean, default: false): Match ALL tags vs ANY tag
- **Success Response** (200): Array of treatment objects

#### Get Treatment by ID
`GET /treatments/{treatment_id}`
- **Authentication**: Yes
- **Success Response** (200): Treatment object with patient, practitioner, and condition relations

#### Update Treatment
`PUT /treatments/{treatment_id}`
- **Authentication**: Yes
- **Request Body**: Same as create (all fields optional)

#### Delete Treatment
`DELETE /treatments/{treatment_id}`
- **Authentication**: Yes
- **Success Response** (200): `{"message": "Treatment deleted successfully"}`

#### Get Active Treatments for Patient
`GET /treatments/patient/{patient_id}/active`
- **Purpose**: Get only active treatments for a specific patient
- **Success Response** (200): Array of treatment objects

#### Get Ongoing Treatments
`GET /treatments/ongoing`
- **Purpose**: Get treatments with status active or in_progress
- **Query Parameters**:
  - `patient_id` (integer, optional): Filter by patient ID (defaults to current user's patient)
- **Success Response** (200): Array of treatment objects

#### Treatment-Medication Relationships

These endpoints manage the many-to-many relationship between treatments and medications. In **advanced mode**, each linked medication can have treatment-specific overrides for dosage, frequency, dates, prescriber, and pharmacy.

##### Get Treatment Medications (with Effective Values)
`GET /treatments/{treatment_id}/medications`
- **Purpose**: Get all medications linked to a treatment, with computed effective values
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "treatment_id": 5,
    "medication_id": 12,
    "specific_dosage": "20mg",
    "specific_frequency": null,
    "specific_duration": "6 weeks",
    "timing_instructions": "Take with food",
    "relevance_note": "Primary medication for this plan",
    "specific_prescriber_id": 3,
    "specific_pharmacy_id": null,
    "specific_start_date": "2026-01-09",
    "specific_end_date": null,
    "specific_prescriber": { "id": 3, "name": "Dr. Smith", "specialty": "Cardiology" },
    "specific_pharmacy": null,
    "medication": {
      "id": 12,
      "medication_name": "Lisinopril",
      "dosage": "10mg",
      "frequency": "Once daily",
      "route": "Oral",
      "status": "active",
      "effective_period_start": "2025-06-01",
      "effective_period_end": "2025-09-25",
      "practitioner": { "id": 2, "name": "Dr. Jones", "specialty": "Internal Medicine" },
      "pharmacy": { "id": 1, "name": "CVS", "brand": null }
    },
    "effective_dosage": "20mg",
    "effective_frequency": "Once daily",
    "effective_start_date": "2026-01-09",
    "effective_end_date": null,
    "effective_prescriber": { "id": 3, "name": "Dr. Smith", "specialty": "Cardiology" },
    "effective_pharmacy": { "id": 1, "name": "CVS", "brand": null },
    "created_at": "2026-02-07T10:00:00Z",
    "updated_at": "2026-02-07T10:00:00Z"
  }
]
```

**Effective value logic**:
- `effective_*` fields use the treatment-specific override (`specific_*`) if set, otherwise fall back to the base medication's value.
- **Smart end date**: If `specific_start_date` is set but `specific_end_date` is not, and the medication's `effective_period_end` is before the overridden start date, `effective_end_date` is set to `null` (treated as "Ongoing") to avoid displaying a stale end date.

##### Link Medication to Treatment
`POST /treatments/{treatment_id}/medications`
- **Request Body**:
```json
{
  "medication_id": 12,
  "specific_dosage": "20mg",
  "specific_frequency": "Twice daily",
  "specific_duration": "6 weeks",
  "timing_instructions": "Take with food",
  "relevance_note": "Primary medication for this plan",
  "specific_prescriber_id": 3,
  "specific_pharmacy_id": 1,
  "specific_start_date": "2026-01-09",
  "specific_end_date": "2026-03-01"
}
```
- All fields except `medication_id` are optional
- **Validation**: `specific_end_date` must be on or after `specific_start_date` if both are provided
- **Success Response** (200): Created relationship object

##### Bulk Link Medications
`POST /treatments/{treatment_id}/medications/bulk`
- **Purpose**: Link multiple medications to a treatment at once
- **Request Body**:
```json
{
  "medication_ids": [12, 15, 18],
  "relevance_note": "Medications for treatment plan"
}
```
- Skips medications that are already linked (no error)
- **Success Response** (200): Array of created relationship objects

##### Update Medication Link
`PUT /treatments/{treatment_id}/medications/{relationship_id}`
- **Request Body**: Same fields as create (all optional, except `medication_id` which is not updatable)
- **Success Response** (200): Updated relationship object

##### Remove Medication from Treatment
`DELETE /treatments/{treatment_id}/medications/{relationship_id}`
- **Success Response** (200): `{"status": "success", "message": "Medication link removed"}`

#### Treatment-Encounter, Lab Result, and Equipment Relationships

Treatments also support relationships with encounters, lab results, and equipment using the same CRUD pattern:

| Relationship | Base Path | Purpose |
|---|---|---|
| Encounters | `/{treatment_id}/encounters` | Link visits/encounters to treatment |
| Lab Results | `/{treatment_id}/lab-results` | Link lab results to treatment |
| Equipment | `/{treatment_id}/equipment` | Link medical equipment to treatment |

Each supports: `GET` (list), `POST` (link), `POST /bulk` (bulk link), `PUT /{id}` (update), `DELETE /{id}` (remove).

### 6.10 Symptoms

Base path: `/api/v1/symptoms`

#### Create Symptom
`POST /symptoms/`
- **Purpose**: Create a new symptom definition (reusable symptom type)
- **Request Body**:
```json
{
  "patient_id": 1,
  "symptom_name": "Headache",
  "body_part": "Head",
  "status": "active",
  "notes": "Recurring tension headaches"
}
```

#### List Symptoms
`GET /symptoms/`
- **Query Parameters**:
  - `skip`: Pagination offset (default: 0)
  - `limit`: Max items (default: 100, max: 100)
  - `status`: Filter by status (`active`, `inactive`, `resolved`)
  - `search`: Search by symptom name
- **Success Response** (200): Array of symptom objects

#### Get Symptom by ID
`GET /symptoms/{symptom_id}`
- **Success Response** (200): Symptom object with details

#### Update Symptom
`PUT /symptoms/{symptom_id}`
- **Request Body**: Same as create (all fields optional)

#### Delete Symptom
`DELETE /symptoms/{symptom_id}`
- **Note**: Deletes symptom and all occurrences via cascade
- **Success Response** (200): `{"message": "Symptom deleted successfully"}`

#### Get Symptom Statistics
`GET /symptoms/stats`
- **Query Parameters**:
  - `patient_id`: Optional patient ID for patient switching
- **Success Response** (200):
```json
{
  "total_symptoms": 5,
  "active_symptoms": 3,
  "resolved_symptoms": 2,
  "total_occurrences": 47,
  "recent_occurrences": 12
}
```

#### Get Symptom Timeline
`GET /symptoms/timeline`
- **Query Parameters**:
  - `patient_id`: Optional patient ID
  - `start_date`: Start date (YYYY-MM-DD)
  - `end_date`: End date (YYYY-MM-DD)
- **Purpose**: Get timeline data formatted for visualization
- **Success Response** (200): Array of timeline data points

#### Log Symptom Occurrence
`POST /symptoms/{symptom_id}/occurrences`
- **Purpose**: Log a new episode/occurrence of an existing symptom
- **Request Body**:
```json
{
  "occurred_at": "2025-10-15T14:30:00Z",
  "severity": "moderate",
  "duration_minutes": 120,
  "notes": "Started after lunch, took ibuprofen"
}
```

#### List Symptom Occurrences
`GET /symptoms/{symptom_id}/occurrences`
- **Query Parameters**: `skip`, `limit`
- **Success Response** (200): Array of occurrence objects

#### Get Specific Occurrence
`GET /symptoms/{symptom_id}/occurrences/{occurrence_id}`

#### Update Occurrence
`PUT /symptoms/{symptom_id}/occurrences/{occurrence_id}`

#### Delete Occurrence
`DELETE /symptoms/{symptom_id}/occurrences/{occurrence_id}`

#### Link Symptom to Condition
`POST /symptoms/{symptom_id}/link-condition`
- **Purpose**: Associate symptom with a diagnosed condition
- **Request Body**:
```json
{
  "condition_id": 3,
  "symptom_id": 1,
  "notes": "Primary symptom of this condition"
}
```

#### Get Linked Conditions
`GET /symptoms/{symptom_id}/conditions`
- **Success Response** (200): Array of condition relationships

#### Unlink Symptom from Condition
`DELETE /symptoms/{symptom_id}/unlink-condition/{condition_id}`

#### Link Symptom to Medication
`POST /symptoms/{symptom_id}/link-medication`
- **Purpose**: Associate symptom with medication (side effect or treatment)
- **Request Body**:
```json
{
  "medication_id": 5,
  "symptom_id": 1,
  "relationship_type": "side_effect",
  "notes": "Occurs 2 hours after taking medication"
}
```

#### Get Linked Medications
`GET /symptoms/{symptom_id}/medications`

#### Unlink Symptom from Medication
`DELETE /symptoms/{symptom_id}/unlink-medication/{medication_id}`

#### Link Symptom to Treatment
`POST /symptoms/{symptom_id}/link-treatment`
- **Request Body**:
```json
{
  "treatment_id": 2,
  "symptom_id": 1,
  "notes": "Treatment helps reduce symptom severity"
}
```

#### Get Linked Treatments
`GET /symptoms/{symptom_id}/treatments`

#### Unlink Symptom from Treatment
`DELETE /symptoms/{symptom_id}/unlink-treatment/{treatment_id}`

### 6.11 Injuries

Base path: `/api/v1/injuries`

**Purpose**: Track physical injuries like sprains, fractures, burns, etc. with links to related medications, conditions, treatments, and procedures.

#### Injury Types

Base path: `/api/v1/injury-types`

##### List All Injury Types
`GET /injury-types/`
- **Purpose**: Get all injury types for dropdown selection
- **Authentication**: Yes
- **Success Response** (200): Array of injury type objects
```json
[
  {
    "id": 1,
    "name": "Sprain",
    "description": "Ligament injury",
    "is_system": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

##### Get Injury Types Dropdown
`GET /injury-types/dropdown`
- **Purpose**: Get injury types formatted for dropdown (minimal response)
- **Authentication**: Yes
- **Success Response** (200): Array of dropdown options

##### Create Injury Type
`POST /injury-types/`
- **Purpose**: Create a user-defined injury type
- **Authentication**: Yes
- **Request Body**:
```json
{
  "name": "Custom Injury Type",
  "description": "Description of the injury type"
}
```
- **Note**: System types can only be created via database migration
- **Error Responses**:
  - `400`: Name already exists

##### Get Injury Type
`GET /injury-types/{injury_type_id}`
- **Purpose**: Get a specific injury type by ID
- **Success Response** (200): Injury type object

##### Delete Injury Type
`DELETE /injury-types/{injury_type_id}`
- **Purpose**: Delete a user-created injury type
- **Note**: Cannot delete system types or types referenced by injuries
- **Error Responses**:
  - `400`: Cannot delete system type or type in use
  - `404`: Injury type not found

#### Injuries CRUD

##### Create Injury
`POST /injuries/`
- **Purpose**: Create a new injury record
- **Authentication**: Yes
- **Request Body**:
```json
{
  "patient_id": 1,
  "injury_name": "Left Ankle Sprain",
  "injury_type_id": 1,
  "body_part": "Ankle",
  "laterality": "left",
  "date_of_injury": "2025-10-01",
  "mechanism": "Twisted while running",
  "severity": "moderate",
  "status": "active",
  "treatment_received": "Ice, compression, elevation",
  "recovery_notes": "Improving with physical therapy",
  "practitioner_id": 5,
  "notes": "Patient advised to avoid running for 2 weeks",
  "tags": ["sports", "acute"]
}
```
- **Laterality values**: `left`, `right`, `bilateral`, `not_applicable`
- **Severity values**: `mild`, `moderate`, `severe`, `life-threatening`
- **Status values**: `active`, `healing`, `resolved`, `chronic`
- **Success Response** (201): Injury with relations

##### List Injuries
`GET /injuries/`
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 100, max: 100): Items per page
  - `status` (string, optional): Filter by status
  - `injury_type_id` (integer, optional): Filter by injury type
  - `tags` (array, optional): Filter by tags
  - `tag_match_all` (boolean, default: false): Match ALL tags vs ANY
- **Success Response** (200): Array of injuries with relations

##### Get Injury
`GET /injuries/{injury_id}`
- **Purpose**: Get injury by ID with related information
- **Success Response** (200): Injury with relations

##### Update Injury
`PUT /injuries/{injury_id}`
- **Request Body**: Same fields as create (all optional)
- **Success Response** (200): Updated injury with relations

##### Delete Injury
`DELETE /injuries/{injury_id}`
- **Success Response** (200): `{"message": "Injury deleted successfully"}`

##### Get Active Injuries
`GET /injuries/patient/{patient_id}/active`
- **Purpose**: Get all active injuries for a patient
- **Success Response** (200): Array of active injuries with relations

#### Injury Relationships

##### Injury-Medication Links

**Get Linked Medications**
`GET /injuries/{injury_id}/medications`
- **Purpose**: Get all medications linked to an injury
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "injury_id": 1,
    "medication_id": 5,
    "relevance_note": "Pain management",
    "created_at": "2025-10-01T00:00:00Z",
    "medication": {
      "id": 5,
      "medication_name": "Ibuprofen",
      "dosage": "400mg",
      "status": "active"
    }
  }
]
```

**Link Medication to Injury**
`POST /injuries/{injury_id}/medications`
- **Request Body**:
```json
{
  "medication_id": 5,
  "relevance_note": "Pain management"
}
```
- **Error Responses**:
  - `400`: Already linked or different patient
  - `404`: Medication not found

**Unlink Medication from Injury**
`DELETE /injuries/{injury_id}/medications/{medication_id}`
- **Success Response** (200): `{"message": "Medication unlinked from injury"}`

##### Injury-Condition Links

**Get Linked Conditions**
`GET /injuries/{injury_id}/conditions`

**Link Condition to Injury**
`POST /injuries/{injury_id}/conditions`
- **Request Body**:
```json
{
  "condition_id": 3,
  "relevance_note": "Underlying condition"
}
```

**Unlink Condition from Injury**
`DELETE /injuries/{injury_id}/conditions/{condition_id}`

##### Injury-Treatment Links

**Get Linked Treatments**
`GET /injuries/{injury_id}/treatments`

**Link Treatment to Injury**
`POST /injuries/{injury_id}/treatments`
- **Request Body**:
```json
{
  "treatment_id": 2,
  "relevance_note": "Physical therapy for recovery"
}
```

**Unlink Treatment from Injury**
`DELETE /injuries/{injury_id}/treatments/{treatment_id}`

##### Injury-Procedure Links

**Get Linked Procedures**
`GET /injuries/{injury_id}/procedures`

**Link Procedure to Injury**
`POST /injuries/{injury_id}/procedures`
- **Request Body**:
```json
{
  "procedure_id": 4,
  "relevance_note": "Surgery to repair damage"
}
```

**Unlink Procedure from Injury**
`DELETE /injuries/{injury_id}/procedures/{procedure_id}`

---

### 6.12 Standardized Tests (LOINC)

Base path: `/api/v1/standardized-tests`

**Purpose**: Search and autocomplete for standardized lab tests using LOINC codes

#### Search Tests
`GET /standardized-tests/search`
- **Purpose**: Search for standardized tests
- **Query Parameters**:
  - `query`: Search term (test name, LOINC code, etc.)
  - `category`: Filter by category
  - `skip`: Pagination offset
  - `limit`: Max items
- **Success Response** (200):
```json
{
  "tests": [
    {
      "id": 1,
      "loinc_code": "2345-7",
      "test_name": "Glucose [Mass/volume] in Serum or Plasma",
      "short_name": "Glucose",
      "default_unit": "mg/dL",
      "category": "Chemistry",
      "common_names": ["Blood sugar", "Blood glucose"],
      "is_common": true
    }
  ],
  "total": 1
}
```

#### Autocomplete
`GET /standardized-tests/autocomplete`
- **Purpose**: Get autocomplete suggestions for test names
- **Query Parameters**:
  - `q`: Query string (min 2 characters)
  - `limit`: Max suggestions (default: 10)
- **Success Response** (200):
```json
[
  {
    "value": "Glucose [Mass/volume] in Serum or Plasma",
    "label": "Glucose - Blood sugar test",
    "loinc_code": "2345-7",
    "default_unit": "mg/dL",
    "category": "Chemistry"
  }
]
```

#### Get Common Tests
`GET /standardized-tests/common`
- **Purpose**: Get frequently ordered tests
- **Success Response** (200): Array of common test objects

#### Get Tests by Category
`GET /standardized-tests/by-category/{category}`
- **Purpose**: Get all tests in a specific category
- **Success Response** (200): Array of test objects

#### Get Test by LOINC Code
`GET /standardized-tests/by-loinc/{loinc_code}`
- **Purpose**: Get test details by LOINC code
- **Success Response** (200): Test object

#### Get Test by Name
`GET /standardized-tests/by-name/{test_name}`
- **Purpose**: Get test details by exact name match
- **Success Response** (200): Test object

#### Get Test Count
`GET /standardized-tests/count`
- **Purpose**: Get total number of standardized tests in database
- **Success Response** (200):
```json
{
  "total_tests": 45672,
  "common_tests": 150,
  "categories": 12
}
```

#### Batch Match Tests
`POST /standardized-tests/batch-match`
- **Purpose**: Match multiple test names to LOINC codes
- **Request Body**:
```json
{
  "test_names": ["Glucose", "Hemoglobin", "Cholesterol"]
}
```
- **Success Response** (200):
```json
{
  "matches": [
    {
      "input": "Glucose",
      "matched": true,
      "loinc_code": "2345-7",
      "test_name": "Glucose [Mass/volume] in Serum or Plasma"
    }
  ],
  "total_requested": 3,
  "total_matched": 2
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
- **Authentication**: Yes
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
- **Success Response** (201): Family member object

#### List Family Members
`GET /family-members/`
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 100, max: 100): Items per page
  - `relationship` (string, optional): Filter by relationship type
- **Success Response** (200): Array of family member objects with conditions

#### Get Family Members for Dropdown
`GET /family-members/dropdown`
- **Purpose**: Get family members formatted for dropdown selection in forms
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "name": "John Doe Sr.",
    "relationship": "Father"
  }
]
```

#### Get Family Member by ID
`GET /family-members/{family_member_id}`
- **Purpose**: Get family member with conditions
- **Authentication**: Yes
- **Success Response** (200): Family member object with conditions

#### Update Family Member
`PUT /family-members/{family_member_id}`
- **Authentication**: Yes
- **Request Body**: Same as create (all fields optional)
- **Success Response** (200): Updated family member object

#### Delete Family Member
`DELETE /family-members/{family_member_id}`
- **Authentication**: Yes
- **Success Response** (200): `{"message": "Family Member deleted successfully"}`

#### Search Family Members
`GET /family-members/search/`
- **Purpose**: Search family members by name
- **Authentication**: Yes
- **Query Parameters**:
  - `name` (string, required, min 2 chars): Name search term
- **Success Response** (200): Array of matching family member objects

#### Family Condition Management

##### Get Family Member Conditions
`GET /family-members/{family_member_id}/conditions`
- **Purpose**: Get all medical conditions for a specific family member
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "family_member_id": 1,
    "condition_name": "Diabetes Type 2",
    "diagnosis_age": 55,
    "notes": "Controlled with medication",
    "created_at": "2025-10-01T00:00:00Z"
  }
]
```

##### Create Family Condition
`POST /family-members/{family_member_id}/conditions`
- **Purpose**: Add a medical condition to a family member's history
- **Authentication**: Yes
- **Request Body**:
```json
{
  "condition_name": "Hypertension",
  "diagnosis_age": 45,
  "notes": "Started medication at 50"
}
```
- **Success Response** (201): Created condition object

##### Update Family Condition
`PUT /family-members/{family_member_id}/conditions/{condition_id}`
- **Authentication**: Yes
- **Request Body**: Same fields as create (all optional)
- **Success Response** (200): Updated condition object

##### Delete Family Condition
`DELETE /family-members/{family_member_id}/conditions/{condition_id}`
- **Authentication**: Yes
- **Success Response** (200): `{"message": "Family Condition deleted successfully"}`

### 7.4 Pharmacies

Base path: `/api/v1/pharmacies`

#### Create Pharmacy
`POST /pharmacies/`
- **Request Body**:
```json
{
  "name": "CVS Pharmacy - Main Street",
  "brand": "CVS",
  "street_address": "456 Oak St",
  "city": "Anytown",
  "state": "NC",
  "zip_code": "27514",
  "country": "United States",
  "store_number": "12345",
  "phone_number": "+1234567890",
  "fax_number": "+1234567891",
  "email": "pharmacy@example.com",
  "website": "https://www.cvs.com",
  "hours": "Mon-Fri 9AM-9PM",
  "drive_through": true,
  "twenty_four_hour": false,
  "specialty_services": "Vaccinations, Compounding, Medication Therapy Management"
}
```
- **Notes**: `zip_code` accepts international postal codes (US ZIP, Canadian, UK, etc.)

#### List Pharmacies
`GET /pharmacies/`
- **Query Parameters**:
  - `skip` (integer, optional, default: 0): Number of records to skip (for pagination)
  - `limit` (integer, optional, default: 100): Maximum number of records to return

### 7.5 Practitioners

Base path: `/api/v1/practitioners`

#### Create Practitioner
`POST /practitioners/`
- **Request Body**:
```json
{
  "name": "Dr. Sarah Smith",
  "specialty": "Cardiology",
  "practice_id": 1,
  "phone_number": "+1234567890",
  "email": "dr.smith@clinic.com",
  "website": "https://drsmith.com",
  "rating": 4.5
}
```
- **Notes**: `practice_id` links the practitioner to a Practice entity (optional). The legacy `practice` string field is still accepted for backward compatibility.

#### List Practitioners
`GET /practitioners/`
- **Query Parameters**:
  - `skip` (integer, optional, default: 0): Number of records to skip
  - `limit` (integer, optional, default: 100, max: 100): Maximum records to return
  - `specialty` (string, optional): Filter by specialty
  - `practice_id` (integer, optional): Filter by practice
- **Response** includes `practice_name` (resolved from the linked Practice entity) and timestamps (`created_at`, `updated_at`).

#### Get Practitioner
`GET /practitioners/{practitioner_id}`
- **Response**: Full practitioner details with `practice_name` from linked Practice.

#### Update Practitioner
`PUT /practitioners/{practitioner_id}`
- **Request Body**: Same fields as create, all optional.

#### Delete Practitioner
`DELETE /practitioners/{practitioner_id}`

#### Search Practitioners by Name
`GET /practitioners/search/by-name`
- **Query Parameters**:
  - `name` (string, required, min: 2): Search term

#### Get All Specialties
`GET /practitioners/specialties`
- **Response**: `{ "specialties": ["Cardiology", "Dermatology", ...] }`

### 7.6 Practices

Base path: `/api/v1/practices`

**Purpose**: Manage medical practices or clinics that practitioners belong to.

#### Create Practice
`POST /practices/`
- **Authentication**: Yes
- **Request Body**:
```json
{
  "name": "City General Hospital",
  "phone_number": "+1234567890",
  "fax_number": "+1234567891",
  "website": "https://www.citygeneral.com",
  "patient_portal_url": "https://portal.citygeneral.com",
  "notes": "Main campus location",
  "locations": [
    {
      "label": "Main Office",
      "address": "123 Medical Dr",
      "city": "Chapel Hill",
      "state": "NC",
      "zip": "27514",
      "phone": "+1234567890"
    }
  ]
}
```
- **Success Response** (200): Created practice object with `id`, `created_at`, `updated_at`
- **Notes**: Practice name must be unique (case-insensitive). Name must be 2-150 characters.

#### List Practices
`GET /practices/`
- **Authentication**: Yes
- **Query Parameters**:
  - `skip` (integer, optional, default: 0): Number of records to skip
  - `limit` (integer, optional, default: 100, max: 100): Maximum records to return
  - `search` (string, optional, min: 1): Search by practice name

#### Get Practice Summaries
`GET /practices/summary`
- **Authentication**: Yes
- **Purpose**: Lightweight list for dropdowns and selectors
- **Success Response** (200):
```json
[
  { "id": 1, "name": "City General Hospital" },
  { "id": 2, "name": "Downtown Medical Group" }
]
```

#### Search Practices by Name
`GET /practices/search/by-name`
- **Authentication**: Yes
- **Query Parameters**:
  - `name` (string, required, min: 1): Search term

#### Get Practice
`GET /practices/{practice_id}`
- **Authentication**: Yes
- **Response**: Practice details with `practitioner_count` indicating how many practitioners are linked.
```json
{
  "id": 1,
  "name": "City General Hospital",
  "phone_number": "+1234567890",
  "fax_number": "+1234567891",
  "website": "https://www.citygeneral.com",
  "patient_portal_url": "https://portal.citygeneral.com",
  "notes": "Main campus location",
  "locations": [...],
  "created_at": "2026-02-14T12:00:00Z",
  "updated_at": "2026-02-14T12:00:00Z",
  "practitioner_count": 5
}
```

#### Update Practice
`PUT /practices/{practice_id}`
- **Authentication**: Yes
- **Request Body**: Same fields as create, all optional.

#### Delete Practice
`DELETE /practices/{practice_id}`
- **Authentication**: Yes
- **Notes**: Deleting a practice sets `practice_id` to NULL on all linked practitioners (ON DELETE SET NULL).

---

## 8. Notifications

Base path: `/api/v1/notifications`

**Purpose**: Manage notification channels, preferences, and view notification history.

### 8.1 Event Types

#### Get Available Event Types
`GET /notifications/event-types`
- **Purpose**: Get list of available notification event types
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "event_types": [
    {
      "value": "medication_reminder",
      "label": "Medication Reminder",
      "description": "Reminders for taking medications",
      "category": "reminders",
      "is_implemented": true
    },
    {
      "value": "lab_result_available",
      "label": "Lab Result Available",
      "description": "Notification when lab results are ready",
      "category": "results",
      "is_implemented": true
    }
  ]
}
```

### 8.2 Channel Management

#### List Channels
`GET /notifications/channels`
- **Purpose**: List all notification channels for current user
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "name": "My Email",
    "channel_type": "email",
    "is_enabled": true,
    "is_verified": true,
    "last_test_at": "2025-10-01T10:00:00Z",
    "last_test_status": "success",
    "last_used_at": "2025-10-04T08:00:00Z",
    "total_notifications_sent": 25,
    "config_valid": true,
    "config_error": null,
    "created_at": "2025-09-01T00:00:00Z",
    "updated_at": "2025-10-01T00:00:00Z"
  }
]
```

#### Create Channel
`POST /notifications/channels`
- **Purpose**: Create a new notification channel
- **Authentication**: Yes
- **Request Body**:
```json
{
  "name": "My Telegram",
  "channel_type": "telegram",
  "config": {
    "chat_id": "123456789",
    "bot_token": "your_bot_token"
  },
  "is_enabled": true
}
```
- **Channel types**: `email`, `telegram`, `discord`, `slack`, `webhook`, `pushover`
- **Success Response** (201): Created channel object

#### Get Channel Details
`GET /notifications/channels/{channel_id}`
- **Purpose**: Get channel with masked configuration
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "id": 1,
  "name": "My Telegram",
  "channel_type": "telegram",
  "is_enabled": true,
  "is_verified": true,
  "last_test_at": "2025-10-01T10:00:00Z",
  "last_test_status": "success",
  "config_masked": {
    "chat_id": "123***789",
    "bot_token": "***masked***"
  }
}
```

#### Update Channel
`PUT /notifications/channels/{channel_id}`
- **Purpose**: Update notification channel
- **Authentication**: Yes
- **Request Body**:
```json
{
  "name": "Updated Name",
  "config": {
    "chat_id": "new_chat_id"
  },
  "is_enabled": false
}
```
- **Success Response** (200): Updated channel object

#### Delete Channel
`DELETE /notifications/channels/{channel_id}`
- **Purpose**: Delete a notification channel
- **Authentication**: Yes
- **Success Response** (204): No content

#### Test Channel
`POST /notifications/channels/{channel_id}/test`
- **Purpose**: Send a test notification to verify channel configuration
- **Authentication**: Yes
- **Request Body** (optional):
```json
{
  "message": "Custom test message"
}
```
- **Success Response** (200):
```json
{
  "success": true,
  "message": "Test notification sent successfully",
  "channel_name": "My Telegram",
  "sent_at": "2025-10-04T10:30:00Z"
}
```
- **Failure Response** (200):
```json
{
  "success": false,
  "message": "Channel configuration is invalid: missing bot_token",
  "channel_name": "My Telegram",
  "sent_at": null
}
```

### 8.3 Preference Management

#### List Preferences
`GET /notifications/preferences`
- **Purpose**: List all notification preferences for current user
- **Authentication**: Yes
- **Success Response** (200):
```json
[
  {
    "id": 1,
    "channel_id": 1,
    "channel_name": "My Email",
    "event_type": "medication_reminder",
    "is_enabled": true,
    "remind_before_minutes": 30,
    "created_at": "2025-09-01T00:00:00Z",
    "updated_at": "2025-10-01T00:00:00Z"
  }
]
```

#### Get Preference Matrix
`GET /notifications/preferences/matrix`
- **Purpose**: Get full preference matrix (events x channels)
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "channels": [
    {"id": 1, "name": "My Email", "channel_type": "email", ...},
    {"id": 2, "name": "My Telegram", "channel_type": "telegram", ...}
  ],
  "events": ["medication_reminder", "lab_result_available", "appointment_reminder"],
  "preferences": {
    "medication_reminder": {"1": true, "2": false},
    "lab_result_available": {"1": true, "2": true},
    "appointment_reminder": {"1": false, "2": true}
  }
}
```

#### Set Preference
`POST /notifications/preferences`
- **Purpose**: Set or update a notification preference
- **Authentication**: Yes
- **Request Body**:
```json
{
  "channel_id": 1,
  "event_type": "medication_reminder",
  "is_enabled": true,
  "remind_before_minutes": 30
}
```
- **Success Response** (200): Updated preference object

### 8.4 Notification History

#### Get History
`GET /notifications/history`
- **Purpose**: Get notification history for current user
- **Authentication**: Yes
- **Query Parameters**:
  - `page` (integer, default: 1): Page number
  - `page_size` (integer, default: 20, max: 100): Items per page
  - `status_filter` (string, optional): Filter by status
  - `event_type` (string, optional): Filter by event type
- **Success Response** (200):
```json
{
  "items": [
    {
      "id": 1,
      "event_type": "medication_reminder",
      "title": "Medication Reminder",
      "message_preview": "Time to take your Aspirin...",
      "channel_name": "My Email",
      "channel_type": "email",
      "status": "sent",
      "attempt_count": 1,
      "error_message": null,
      "created_at": "2025-10-04T08:00:00Z",
      "sent_at": "2025-10-04T08:00:05Z"
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 20
}
```

---

## 9. Files & Attachments

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

## 10. Sharing & Collaboration

### 10.1 Patient Sharing

Base path: `/api/v1/patient-sharing`

#### Share Patient Record
`POST /patient-sharing/`
- **Purpose**: Share a patient record with another user via email invitation
- **Authentication**: Yes
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
- **Success Response** (201): Share invitation object

#### Bulk Invite
`POST /patient-sharing/bulk-invite`
- **Purpose**: Send sharing invitations to multiple recipients at once
- **Authentication**: Yes
- **Request Body**:
```json
{
  "patient_id": 1,
  "recipient_emails": ["doctor1@example.com", "doctor2@example.com"],
  "access_level": "view",
  "expiration_date": "2025-12-31",
  "message": "Sharing medical records for consultation"
}
```
- **Success Response** (200):
```json
{
  "successful_invites": 2,
  "failed_invites": 0,
  "results": [...]
}
```

#### Revoke Access
`DELETE /patient-sharing/{share_id}`
- **Purpose**: Revoke a user's access to a shared patient record
- **Authentication**: Yes
- **Success Response** (200): `{"message": "Access revoked successfully"}`

#### Remove My Access
`DELETE /patient-sharing/remove-my-access/{patient_id}`
- **Purpose**: Remove your own access to a patient record shared with you
- **Authentication**: Yes
- **Success Response** (200): `{"message": "Access removed successfully"}`

#### List Patients Shared With Me
`GET /patient-sharing/shared-with-me`
- **Purpose**: Get all patient records that others have shared with you
- **Authentication**: Yes
- **Success Response** (200): Array of shared patient access objects

#### List Patients I've Shared
`GET /patient-sharing/shared-by-me`
- **Purpose**: Get all patient records you have shared with others
- **Authentication**: Yes
- **Success Response** (200): Array of patient sharing objects with recipient info

#### Get Sharing Statistics
`GET /patient-sharing/stats/user`
- **Purpose**: Get statistics about patient sharing for current user
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "total_shared_with_me": 3,
  "total_shared_by_me": 5,
  "active_shares": 4,
  "pending_invitations": 2
}
```

#### Cleanup Expired Shares
`POST /patient-sharing/cleanup-expired`
- **Purpose**: Remove expired sharing invitations (admin/scheduled task)
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "expired_shares_removed": 5,
  "cleanup_date": "2025-10-04T10:30:00Z"
}
```

### 10.2 Invitations

Base path: `/api/v1/invitations`

#### Get Pending Invitations
`GET /invitations/pending`
- **Purpose**: Get all pending invitations for the current user
- **Authentication**: Yes
- **Success Response** (200): Array of pending invitation objects

#### Get Sent Invitations
`GET /invitations/sent`
- **Purpose**: Get all invitations sent by the current user
- **Authentication**: Yes
- **Success Response** (200): Array of sent invitation objects

#### Respond to Invitation
`POST /invitations/{invitation_id}/respond`
- **Purpose**: Accept or reject an invitation
- **Authentication**: Yes
- **Request Body**:
```json
{
  "action": "accept"
}
```
- **Actions**: `accept`, `reject`
- **Success Response** (200): Updated invitation object

#### Revoke Invitation
`POST /invitations/{invitation_id}/revoke`
- **Purpose**: Revoke an invitation you sent (before it's accepted)
- **Authentication**: Yes
- **Success Response** (200): `{"message": "Invitation revoked successfully"}`

#### Cleanup Expired Invitations
`POST /invitations/cleanup`
- **Purpose**: Remove expired invitations (admin/scheduled task)
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "message": "Expired 10 old invitations",
  "expired_count": 10
}
```

#### Get Invitation Summary
`GET /invitations/summary`
- **Purpose**: Get summary counts of invitations by status
- **Authentication**: Yes
- **Success Response** (200):
```json
{
  "pending_received": 2,
  "pending_sent": 3,
  "accepted": 10,
  "rejected": 1,
  "expired": 5
}
```

### 10.3 Family History Sharing (V1.5)

Base path: `/api/v1/family-history-sharing`

**Purpose**: Share family medical history with relatives for better health tracking

#### Get My Family History
`GET /family-history-sharing/mine`
- **Purpose**: Get all family history accessible to current user (owned + shared)
- **Success Response** (200):
```json
{
  "owned_family_members": [...],
  "shared_family_members": [...],
  "total_owned": 5,
  "total_shared": 3
}
```

#### Get Family Member Shares
`GET /family-history-sharing/{family_member_id}/shares`
- **Purpose**: Get list of users who have access to this family member's history
- **Success Response** (200): Array of share objects with user info

#### Share Family Member
`POST /family-history-sharing/{family_member_id}/shares`
- **Purpose**: Share a family member's history with another user
- **Request Body**:
```json
{
  "shared_with_user_id": 5,
  "permission_level": "view",
  "notes": "Sharing father's medical history"
}
```
- **Permission levels**: `view`, `edit`
- **Success Response** (201): Created share object

#### Revoke Family History Access
`DELETE /family-history-sharing/{family_member_id}/shares/{user_id}`
- **Purpose**: Remove a user's access to family member history
- **Success Response** (200): `{"message": "Access revoked successfully"}`

#### Remove My Access
`DELETE /family-history-sharing/shared-with-me/{family_member_id}/remove-access`
- **Purpose**: Remove own access to shared family history
- **Success Response** (200): `{"message": "Access removed successfully"}`

#### Bulk Invite
`POST /family-history-sharing/bulk-invite`
- **Purpose**: Invite multiple family members at once
- **Request Body**:
```json
{
  "family_member_ids": [1, 2, 3],
  "recipient_emails": ["sibling1@example.com", "sibling2@example.com"],
  "permission_level": "view",
  "message": "Sharing our family medical history"
}
```
- **Success Response** (200):
```json
{
  "successful_invites": 5,
  "failed_invites": 1,
  "results": [...]
}
```

#### Get Family Member Details
`GET /family-history-sharing/{family_member_id}/details`
- **Purpose**: Get detailed family member information with medical history
- **Success Response** (200): Family member object with full medical history

#### Get Family History Shared With Me
`GET /family-history-sharing/shared-with-me`
- **Purpose**: Get all family history shared with current user by others
- **Success Response** (200): Array of shared family member objects

#### Get My Own Family Members
`GET /family-history-sharing/my-own`
- **Purpose**: Get only family members owned by current user
- **Success Response** (200): Array of owned family member objects

#### Get Family History I've Shared
`GET /family-history-sharing/shared-by-me`
- **Purpose**: Get family history records that current user has shared with others
- **Success Response** (200): Array of family members with share information

---

## 11. Search & Tags

### 11.1 Search

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

### 11.2 Tags

Base path: `/api/v1/tags`

**Note**: Tags are stored directly on entities (medications, lab results, conditions, etc.) as arrays. The tags API provides cross-entity tag management, search, and autocomplete functionality.

#### Get Popular Tags
`GET /tags/popular`
- **Purpose**: Get most popular tags across multiple entity types
- **Authentication**: Yes
- **Query Parameters**:
  - `entity_types` (array, default: all types): Entity types to search (lab_result, medication, condition, procedure, immunization, treatment, encounter, allergy, practice)
  - `limit` (integer, default: 20, max: 50): Maximum number of tags
- **Success Response** (200):
```json
[
  {
    "tag": "cardiology",
    "count": 25,
    "entity_types": ["medication", "condition"]
  },
  {
    "tag": "routine",
    "count": 18,
    "entity_types": ["lab_result", "immunization"]
  }
]
```

#### Search by Tags
`GET /tags/search`
- **Purpose**: Search across entity types by tags
- **Authentication**: Yes
- **Query Parameters**:
  - `tags` (array, required): Tags to search for
  - `entity_types` (array, default: all types): Entity types to search
  - `limit_per_entity` (integer, default: 10, max: 20): Max results per entity type
- **Success Response** (200):
```json
{
  "medication": [
    {"id": 1, "medication_name": "Aspirin", "tags": ["cardiology", "daily"]}
  ],
  "condition": [
    {"id": 3, "diagnosis": "Hypertension", "tags": ["cardiology", "chronic"]}
  ],
  "lab_result": []
}
```

#### Autocomplete Tags
`GET /tags/autocomplete`
- **Purpose**: Get tag suggestions for autocomplete as user types
- **Authentication**: Yes
- **Query Parameters**:
  - `q` (string, required, min: 1, max: 50): Query string
  - `limit` (integer, default: 10, max: 20): Maximum suggestions
- **Success Response** (200):
```json
["cardiology", "cardiac", "cardio-checkup"]
```

#### Get Tag Suggestions
`GET /tags/suggestions`
- **Purpose**: Get tag suggestions based on what users have actually created
- **Authentication**: Yes
- **Query Parameters**:
  - `entity_type` (string, optional): Suggest tags for specific entity type
  - `limit` (integer, default: 20, max: 50): Maximum suggestions
- **Success Response** (200):
```json
["routine", "annual", "follow-up", "urgent", "cardiology"]
```

#### Rename Tag
`PUT /tags/rename`
- **Purpose**: Rename a tag across all entities
- **Authentication**: Yes
- **Query Parameters**:
  - `old_tag` (string, required): Current tag name to rename
  - `new_tag` (string, required): New tag name
- **Success Response** (200):
```json
{
  "message": "Successfully renamed 'cardio' to 'cardiology'",
  "records_updated": 15
}
```

#### Delete Tag
`DELETE /tags/delete`
- **Purpose**: Delete a tag from all entities
- **Authentication**: Yes
- **Query Parameters**:
  - `tag` (string, required): Tag name to delete
- **Success Response** (200):
```json
{
  "message": "Successfully deleted tag 'old-tag'",
  "records_updated": 8
}
```

#### Replace Tag
`PUT /tags/replace`
- **Purpose**: Replace one tag with another across all entities
- **Authentication**: Yes
- **Query Parameters**:
  - `old_tag` (string, required): Tag to replace
  - `new_tag` (string, required): Replacement tag
- **Success Response** (200):
```json
{
  "message": "Successfully replaced 'cardio' with 'cardiology'",
  "records_updated": 15
}
```

#### Create Tag
`POST /tags/create`
- **Purpose**: Create a new tag in the user tags registry
- **Authentication**: Yes
- **Request Body**:
```json
{
  "tag": "new-category"
}
```
- **Success Response** (200):
```json
{
  "message": "Successfully created tag 'new-category'",
  "tag": "new-category"
}
```

---

## 12. Reports & Export

### 12.1 Custom Reports

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

### 12.2 Export

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

## 13. Integrations

### 13.1 Paperless-ngx

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

## 14. System & Utilities

### 14.1 System

Base path: `/api/v1/system`

#### Health Check
`GET /system/health`
- **Authentication**: No
- **Purpose**: Basic system health check
- **Success Response** (200):
```json
{
  "status": "healthy",
  "timestamp": "2025-10-19T12:00:00Z",
  "logging_system": {
    "current_level": "INFO",
    "level_valid": true,
    "categories_configured": 2
  }
}
```

#### Version Information
`GET /system/version`
- **Authentication**: No
- **Purpose**: Get application version information
- **Success Response** (200):
```json
{
  "app_name": "MediKeep",
  "version": "0.40.0",
  "timestamp": "2025-10-19T12:00:00Z"
}
```

#### Log Level Configuration
`GET /system/log-level`
- **Authentication**: No
- **Rate Limit**: 60 requests/minute per IP
- **Purpose**: Get current logging configuration for frontend integration
- **Success Response** (200):
```json
{
  "current_level": "INFO",
  "available_levels": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
  "default_level": "INFO",
  "categories": ["app", "security"],
  "file_mapping": {
    "app": "logs/app.log - Patient access, API calls, frontend errors, performance events",
    "security": "logs/security.log - Authentication failures, security threats, suspicious activity"
  },
  "configuration": {
    "log_level_numeric": 20,
    "simplified_structure": true,
    "file_count": 2,
    "max_file_size_mb": 50,
    "backup_count": 10
  },
  "timestamp": "2025-10-19T12:00:00Z",
  "rate_limit_info": {
    "requests_remaining": 59,
    "requests_limit": 60,
    "window_seconds": 60,
    "reset_time": "2025-10-19T12:01:00Z"
  }
}
```
- **Error Response** (429 - Rate Limit Exceeded):
```json
{
  "detail": "Rate limit exceeded. Maximum 60 requests per minute."
}
```
- **Headers** (on rate limit):
  - `X-RateLimit-Limit`: 60
  - `X-RateLimit-Remaining`: 0
  - `X-RateLimit-Reset`: Unix timestamp
  - `Retry-After`: Seconds until reset

#### Log Rotation Configuration
`GET /system/log-rotation-config`
- **Authentication**: No
- **Rate Limit**: 60 requests/minute per IP
- **Purpose**: Get current log rotation configuration and status
- **Success Response** (200):
```json
{
  "rotation_method": "python",
  "logrotate_available": false,
  "configuration": {
    "method": "auto",
    "size": "5M",
    "time": "daily",
    "backup_count": 30,
    "compression": true,
    "retention_days": 180
  },
  "log_directory": "E:\\path\\to\\logs",
  "log_files": {
    "app": {
      "path": "E:\\path\\to\\logs\\app.log",
      "size_bytes": 1048576,
      "size_mb": 1.0,
      "exists": true
    },
    "security": {
      "path": "E:\\path\\to\\logs\\security.log",
      "size_bytes": 524288,
      "size_mb": 0.5,
      "exists": true
    }
  },
  "features": {
    "size_based_rotation": true,
    "time_based_rotation": false,
    "compression": false,
    "hybrid_rotation": false
  },
  "notes": {
    "python_rotation": "Size-based only, fallback for development/Windows",
    "logrotate_rotation": "Full features including time-based and compression"
  },
  "timestamp": "2025-10-19T12:00:00Z"
}
```
- **Use Cases**:
  - Monitor log file sizes and rotation status
  - Verify which rotation method is active (logrotate vs Python)
  - Check if log rotation features are working correctly
  - Troubleshoot log management issues

#### System Backup
`POST /system/backup`
- **Authentication**: Yes (Admin only)

#### System Restore
`POST /system/restore`
- **Authentication**: Yes (Admin only)

### 14.2 Utils

Base path: `/api/v1/utils`

#### Get Timezone Information
`GET /utils/timezone-info`
- **Purpose**: Get facility timezone information for proper date/time handling
- **Authentication**: No
- **Success Response** (200):
```json
{
  "timezone": "America/New_York",
  "utc_offset": "-05:00",
  "current_time": "2025-10-19T14:30:00-05:00",
  "is_dst": false
}
```

### 14.3 Frontend Logs

Base path: `/api/v1/frontend-logs`

**Purpose**: Centralized logging for frontend events, errors, and user actions.

#### Log Frontend Event
`POST /frontend-logs/log`
- **Purpose**: Log frontend events and errors from the React frontend
- **Authentication**: Optional (user_id can be provided in request)
- **Request Body**:
```json
{
  "level": "error",
  "message": "JavaScript error occurred",
  "category": "error",
  "timestamp": "2025-10-19T14:30:00Z",
  "url": "/dashboard",
  "user_agent": "Mozilla/5.0...",
  "stack_trace": "Error: Something went wrong\n    at Component.render...",
  "user_id": 1,
  "session_id": "abc123",
  "component": "PatientList",
  "action": "load_data",
  "details": {
    "patient_id": 123,
    "attempt": 3
  }
}
```
- **Log levels**: `error`, `warn`, `info`, `debug`
- **Categories**: `error`, `user_action`, `performance`, `security`
- **Success Response** (200):
```json
{
  "status": "logged",
  "timestamp": "2025-10-19T14:30:00Z"
}
```

#### Log Frontend Error
`POST /frontend-logs/error`
- **Purpose**: Log frontend errors with detailed context (for React error boundaries)
- **Authentication**: Optional
- **Request Body**:
```json
{
  "error_message": "Cannot read property 'id' of undefined",
  "error_type": "TypeError",
  "stack_trace": "TypeError: Cannot read property 'id'...",
  "component_name": "MedicationList",
  "props": {
    "patientId": 123
  },
  "user_id": 1,
  "url": "/medications",
  "timestamp": "2025-10-19T14:30:00Z",
  "user_agent": "Mozilla/5.0...",
  "browser_info": {
    "name": "Chrome",
    "version": "118.0"
  }
}
```
- **Success Response** (200):
```json
{
  "status": "error_logged",
  "timestamp": "2025-10-19T14:30:00Z"
}
```

#### Log User Action
`POST /frontend-logs/user-action`
- **Purpose**: Log user actions for analytics and audit purposes
- **Authentication**: Yes
- **Request Body**:
```json
{
  "action": "medication_created",
  "component": "MedicationForm",
  "details": {
    "medication_name": "Aspirin",
    "dosage": "100mg"
  },
  "user_id": 1,
  "timestamp": "2025-10-19T14:30:00Z",
  "url": "/medications/new"
}
```
- **Success Response** (200):
```json
{
  "status": "action_logged",
  "timestamp": "2025-10-19T14:30:00Z"
}
```

#### Health Check
`GET /frontend-logs/health`
- **Purpose**: Health check endpoint for frontend logging service
- **Authentication**: No
- **Success Response** (200):
```json
{
  "status": "healthy",
  "service": "frontend_logging",
  "timestamp": "2025-10-19T14:30:00Z"
}
```

---

## 15. Admin Dashboard

Base path: `/api/v1/admin`

**Purpose**: Admin-only endpoints for system management, backups, restores, and maintenance operations. All endpoints in this section require admin role authentication.

### 15.1 Dashboard & Statistics

#### Get Dashboard Statistics
`GET /admin/dashboard/stats`
- **Purpose**: Get comprehensive dashboard statistics
- **Authentication**: Yes (Admin only)
- **Success Response** (200):
```json
{
  "total_users": 150,
  "total_patients": 145,
  "total_practitioners": 25,
  "total_medications": 450,
  "total_lab_results": 1200,
  "total_vitals": 800,
  "total_conditions": 350,
  "total_allergies": 180,
  "total_immunizations": 220,
  "total_procedures": 150,
  "total_treatments": 100,
  "total_encounters": 500,
  "recent_registrations": 12,
  "active_medications": 280,
  "pending_lab_results": 15
}
```

#### Get Recent Activity
`GET /admin/dashboard/recent-activity`
- **Purpose**: Get recent activity across all models
- **Authentication**: Yes (Admin only)
- **Query Parameters**:
  - `limit` (integer, default: 20): Number of items
  - `action_filter` (string, optional): Filter by action (`created`, `updated`, `deleted`)
  - `entity_filter` (string, optional): Filter by entity type (`medication`, `patient`, etc.)
- **Success Response** (200):
```json
[
  {
    "id": 123,
    "model_name": "Medication",
    "action": "created",
    "description": "Created Medication: Aspirin 100mg",
    "timestamp": "2025-10-04T10:30:00Z",
    "user_info": "johndoe"
  }
]
```

#### Get System Health
`GET /admin/dashboard/system-health`
- **Purpose**: Get comprehensive system health information
- **Authentication**: Yes (Admin only)
- **Success Response** (200):
```json
{
  "database_status": "healthy",
  "total_records": 5000,
  "last_backup": "2025-10-03T02:00:00Z",
  "system_uptime": "5 days, 3 hours",
  "database_connection_test": true,
  "memory_usage": "Normal",
  "disk_usage": "Database: 45.5 MB"
}
```

#### Get System Metrics
`GET /admin/dashboard/system-metrics`
- **Purpose**: Get detailed system performance metrics
- **Authentication**: Yes (Admin only)
- **Success Response** (200):
```json
{
  "timestamp": "2025-10-04T10:30:00Z",
  "services": {
    "api": {"status": "operational", "response_time_ms": 15.2},
    "authentication": {"status": "operational"},
    "frontend_logging": {"status": "operational"},
    "admin_interface": {"status": "operational"}
  },
  "database": {
    "connection_pool_size": "Available",
    "active_connections": 1,
    "query_performance": "fast"
  },
  "application": {
    "memory_usage": "normal",
    "cpu_usage": "low",
    "response_time": "< 100ms",
    "system_load": "normal"
  },
  "storage": {
    "database_size": "45.5 MB",
    "upload_directory_size": "120.3 MB",
    "available_space": "Available"
  },
  "security": {
    "ssl_enabled": true,
    "authentication_method": "JWT",
    "environment": "production",
    "authentication_status": "operational",
    "authorization_status": "operational",
    "session_status": "operational"
  }
}
```

#### Quick Health Check
`GET /admin/dashboard/health-check`
- **Purpose**: Quick health check for monitoring services
- **Authentication**: No
- **Success Response** (200):
```json
{
  "status": "healthy",
  "timestamp": "2025-10-04T10:30:00Z",
  "service": "medical_records_api",
  "version": "2.0",
  "uptime": "432000s",
  "startup_time": "2025-09-29T07:30:00Z"
}
```

#### Get Storage Health
`GET /admin/dashboard/storage-health`
- **Purpose**: Check storage system health
- **Authentication**: Yes (Admin only)
- **Success Response** (200):
```json
{
  "status": "healthy",
  "directories": {
    "uploads": {"path": "uploads/lab_result_files", "exists": true, "write_permission": true, "size_mb": 120.3, "file_count": 450},
    "backups": {"path": "backups", "exists": true, "write_permission": true, "size_mb": 250.0, "file_count": 10},
    "logs": {"path": "logs", "exists": true, "write_permission": true, "size_mb": 15.5, "file_count": 5}
  },
  "disk_space": {
    "total_gb": 500.0,
    "used_gb": 150.5,
    "free_gb": 349.5,
    "usage_percent": 30.1
  }
}
```

#### Get Analytics Data
`GET /admin/dashboard/analytics-data`
- **Purpose**: Get analytics data for dashboard charts
- **Authentication**: Yes (Admin only)
- **Query Parameters**:
  - `days` (integer, default: 7): Number of days to analyze
- **Success Response** (200):
```json
{
  "weekly_activity": {
    "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "data": [45, 52, 48, 55, 60, 30, 25],
    "total": 315
  },
  "model_activity": {
    "medication": 45,
    "lab_result": 60,
    "vitals": 80
  },
  "hourly_activity": {
    "labels": ["00:00", "01:00", ...],
    "data": [5, 2, 1, 0, 0, 3, ...]
  }
}
```

#### Test Admin Access
`GET /admin/dashboard/test-access`
- **Purpose**: Verify admin access and token validity
- **Authentication**: Yes (Admin only)
- **Success Response** (200):
```json
{
  "message": "Admin access verified",
  "user": "admin_user",
  "role": "admin",
  "timestamp": "2025-10-04T10:30:00Z"
}
```

### 15.2 Model Management

Base path: `/api/v1/admin/models`

**Purpose**: Django-style generic CRUD operations for all models

#### List Available Models
`GET /admin/models/`
- **Purpose**: Get list of all available models for management
- **Authentication**: Yes (Admin only)
- **Success Response** (200):
```json
["user", "patient", "medication", "lab_result", "condition", "allergy", ...]
```

#### Get Model Metadata
`GET /admin/models/{model_name}/metadata`
- **Purpose**: Get metadata for a specific model (fields, types, relationships)
- **Success Response** (200):
```json
{
  "name": "medication",
  "table_name": "medications",
  "fields": [
    {"name": "id", "type": "integer", "nullable": false, "primary_key": true},
    {"name": "medication_name", "type": "string", "nullable": false, "max_length": 255},
    {"name": "status", "type": "string", "choices": ["active", "stopped", "on-hold"]}
  ],
  "relationships": {"patient": "Patient", "practitioner": "Practitioner"},
  "display_name": "Medication",
  "verbose_name_plural": "Medications"
}
```

#### List Model Records
`GET /admin/models/{model_name}/`
- **Purpose**: Get paginated list of records
- **Query Parameters**:
  - `page` (integer, default: 1): Page number
  - `per_page` (integer, default: 25, max: 100): Items per page
  - `search` (string, optional): Search term
- **Success Response** (200):
```json
{
  "items": [...],
  "total": 450,
  "page": 1,
  "per_page": 25,
  "total_pages": 18
}
```

#### Get Model Record
`GET /admin/models/{model_name}/{record_id}`
- **Purpose**: Get a specific record by ID
- **Success Response** (200): Record object with all fields

#### Create Model Record
`POST /admin/models/{model_name}/`
- **Purpose**: Create a new record
- **Request Body**: Model-specific fields
- **Success Response** (201): Created record object

#### Update Model Record
`PUT /admin/models/{model_name}/{record_id}`
- **Purpose**: Update a record
- **Note**: Password fields cannot be updated through this endpoint
- **Request Body**: Fields to update
- **Success Response** (200): Updated record object

#### Delete Model Record
`DELETE /admin/models/{model_name}/{record_id}`
- **Purpose**: Delete a record
- **Note**: Protects against deleting last user or last admin
- **Success Response** (200):
```json
{
  "message": "medication record 123 deleted successfully",
  "deleted_id": 123
}
```

#### Admin Reset Password
`POST /admin/models/users/{user_id}/reset-password`
- **Purpose**: Admin reset of any user's password
- **Request Body**:
```json
{
  "new_password": "NewSecurePass123!"
}
```
- **Validation**: Min 6 chars, must contain letter and number
- **Success Response** (200): `{"message": "Password reset successfully"}`

### 15.3 Backup Operations

Base path: `/api/v1/admin/backup`

#### Create Database Backup
`POST /admin/backup/create-database`
- **Purpose**: Create a database-only backup
- **Request Body**:
```json
{
  "description": "Weekly backup"
}
```
- **Success Response** (200):
```json
{
  "id": 1,
  "backup_type": "database",
  "filename": "backup_db_2025-10-04_103000.sql",
  "size_bytes": 5242880,
  "status": "completed",
  "created_at": "2025-10-04T10:30:00Z",
  "description": "Weekly backup"
}
```

#### Create Files Backup
`POST /admin/backup/create-files`
- **Purpose**: Create a files-only backup (uploads directory)
- **Request Body**: Same as database backup
- **Success Response** (200): Backup response object

#### Create Full Backup
`POST /admin/backup/create-full`
- **Purpose**: Create a full system backup (database + files)
- **Request Body**: Same as database backup
- **Success Response** (200): Backup response object

#### List Backups
`GET /admin/backup/`
- **Purpose**: List all backup records
- **Success Response** (200):
```json
{
  "backups": [
    {
      "id": 1,
      "backup_type": "full",
      "filename": "backup_full_2025-10-04.zip",
      "size_bytes": 15728640,
      "status": "completed",
      "file_exists": true,
      "file_path": "/backups/backup_full_2025-10-04.zip",
      "created_at": "2025-10-04T02:00:00Z"
    }
  ],
  "total": 5
}
```

#### Download Backup
`GET /admin/backup/{backup_id}/download`
- **Purpose**: Download a backup file
- **Success Response**: File download (application/octet-stream)
- **Error Responses**:
  - `404`: Backup or file not found

#### Verify Backup
`POST /admin/backup/{backup_id}/verify`
- **Purpose**: Verify backup integrity
- **Success Response** (200):
```json
{
  "valid": true,
  "backup_id": 1,
  "verification_details": {...}
}
```

#### Delete Backup
`DELETE /admin/backup/{backup_id}`
- **Purpose**: Delete a backup record and file
- **Success Response** (200): Deletion confirmation

#### Cleanup Old Backups
`POST /admin/backup/cleanup`
- **Purpose**: Clean up old backups based on retention policy
- **Success Response** (200): Cleanup results

#### Cleanup Orphaned Files
`POST /admin/backup/cleanup-orphaned`
- **Purpose**: Clean up orphaned backup files
- **Success Response** (200): Cleanup results

#### Cleanup All Old Data
`POST /admin/backup/cleanup-all`
- **Purpose**: Clean up old backups, orphaned files, and old trash
- **Success Response** (200): Combined cleanup results

#### Get Retention Settings
`GET /admin/backup/settings/retention`
- **Purpose**: Get current retention settings
- **Success Response** (200):
```json
{
  "backup_retention_days": 30,
  "trash_retention_days": 7,
  "backup_min_count": 3,
  "backup_max_count": 10,
  "allow_user_registration": true
}
```

#### Update Retention Settings
`POST /admin/backup/settings/retention`
- **Purpose**: Update retention and admin settings
- **Request Body**:
```json
{
  "backup_retention_days": 45,
  "trash_retention_days": 14,
  "backup_min_count": 5,
  "backup_max_count": 20,
  "allow_user_registration": false
}
```
- **Success Response** (200): Updated settings

#### Get Retention Stats
`GET /admin/backup/retention/stats`
- **Purpose**: Get backup retention statistics
- **Success Response** (200): Statistics and cleanup preview

### 15.4 Restore Operations

Base path: `/api/v1/admin/restore`

#### Upload Backup File
`POST /admin/restore/upload`
- **Purpose**: Upload an external backup file for restore
- **Content-Type**: `multipart/form-data`
- **Supported Files**: `.sql` (database), `.zip` (files or full)
- **Success Response** (200):
```json
{
  "success": true,
  "message": "Backup file 'backup.zip' uploaded successfully",
  "backup_id": 5,
  "backup_type": "full",
  "backup_size": 15728640,
  "backup_description": "Uploaded backup"
}
```

#### Preview Restore
`POST /admin/restore/preview/{backup_id}`
- **Purpose**: Preview what will be affected by restore
- **Success Response** (200):
```json
{
  "backup_id": 5,
  "backup_type": "full",
  "backup_created": "2025-10-04T02:00:00Z",
  "backup_size": 15728640,
  "backup_description": "Full backup",
  "warnings": ["This will replace all current data"],
  "affected_data": {
    "users": 150,
    "patients": 145,
    "medications": 450
  }
}
```

#### Get Confirmation Token
`GET /admin/restore/confirmation-token/{backup_id}`
- **Purpose**: Generate confirmation token for restore
- **Success Response** (200):
```json
{
  "backup_id": 5,
  "confirmation_token": "abc123...",
  "expires_at": "End of day (UTC)",
  "warning": "This token allows irreversible restore operations. Use with caution."
}
```

#### Execute Restore
`POST /admin/restore/execute/{backup_id}`
- **Purpose**: Execute restore with confirmation token
- **Request Body**:
```json
{
  "confirmation_token": "abc123..."
}
```
- **Success Response** (200):
```json
{
  "success": true,
  "message": "Restore completed successfully",
  "backup_id": 5,
  "backup_type": "full",
  "safety_backup_id": 6,
  "restore_completed": "2025-10-04T10:30:00Z",
  "warnings": null
}
```

### 15.5 Bulk Operations

Base path: `/api/v1/admin/bulk`

#### Bulk Delete
`POST /admin/bulk/delete`
- **Purpose**: Delete multiple records at once
- **Request Body**:
```json
{
  "model_name": "medication",
  "record_ids": [1, 2, 3, 4, 5]
}
```
- **Success Response** (200):
```json
{
  "success": true,
  "affected_records": 5,
  "failed_records": [],
  "message": "Successfully deleted 5 medication records"
}
```

#### Bulk Update
`POST /admin/bulk/update`
- **Purpose**: Update multiple records with same data
- **Request Body**:
```json
{
  "model_name": "medication",
  "record_ids": [1, 2, 3],
  "update_data": {
    "status": "stopped"
  }
}
```
- **Success Response** (200):
```json
{
  "success": true,
  "affected_records": 3,
  "failed_records": [],
  "message": "Successfully updated 3 medication records"
}
```

### 15.6 Trash Management

Base path: `/api/v1/admin/trash`

#### List Trash Contents
`GET /admin/trash/`
- **Purpose**: List all files currently in trash
- **Success Response** (200): Array of trash file objects

#### Cleanup Old Trash
`POST /admin/trash/cleanup`
- **Purpose**: Clean up old files based on retention policy
- **Success Response** (200):
```json
{
  "deleted_count": 15,
  "freed_bytes": 52428800
}
```

#### Restore File from Trash
`POST /admin/trash/restore`
- **Purpose**: Restore a file from trash
- **Query Parameters**:
  - `trash_path` (string, required): Path to file in trash
  - `restore_path` (string, optional): Target restore path
- **Success Response** (200):
```json
{
  "status": "success",
  "message": "File restored to original location"
}
```

#### Permanently Delete from Trash
`DELETE /admin/trash/permanently-delete`
- **Purpose**: Permanently delete a file (cannot be recovered)
- **Query Parameters**:
  - `trash_path` (string, required): Path to file in trash
- **Success Response** (200):
```json
{
  "status": "success",
  "message": "File permanently deleted"
}
```

### 15.7 Maintenance

Base path: `/api/v1/admin/maintenance`

#### Get Test Library Info
`GET /admin/maintenance/test-library/info`
- **Purpose**: Get information about the current test library
- **Success Response** (200):
```json
{
  "version": "1.2.0",
  "test_count": 4500,
  "categories": {
    "chemistry": 1200,
    "hematology": 800,
    "urinalysis": 500
  }
}
```

#### Reload Test Library
`POST /admin/maintenance/test-library/reload`
- **Purpose**: Reload the test library from disk
- **Use Case**: After updating test library JSON file
- **Success Response** (200):
```json
{
  "success": true,
  "version": "1.2.1",
  "test_count": 4520,
  "message": "Test library reloaded successfully"
}
```

#### Sync Test Library
`POST /admin/maintenance/test-library/sync`
- **Purpose**: Sync lab test components with the test library
- **Request Body**:
```json
{
  "force_all": false
}
```
- **Note**: If `force_all` is true, re-processes all components. If false, only processes components without canonical names.
- **Success Response** (200):
```json
{
  "success": true,
  "components_processed": 1200,
  "canonical_names_updated": 350,
  "categories_updated": 120,
  "message": "Successfully synced 1200 components"
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
