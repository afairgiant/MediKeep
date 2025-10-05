# MediKeep Database Schema Documentation

## Table of Contents
- [Database Overview](#database-overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Core Tables](#core-tables)
- [Medical Record Tables](#medical-record-tables)
- [Reference Tables](#reference-tables)
- [Family History Tables](#family-history-tables)
- [File Management Tables](#file-management-tables)
- [Sharing & Collaboration Tables](#sharing--collaboration-tables)
- [Reporting Tables](#reporting-tables)
- [Admin Tables](#admin-tables)
- [Junction Tables](#junction-tables)
- [Data Types Reference](#data-types-reference)
- [Indexes & Performance](#indexes--performance)
- [Constraints](#constraints)
- [Migration Strategy](#migration-strategy)
- [Data Integrity](#data-integrity)

## Database Overview

### Technology Stack
- **Database**: PostgreSQL 15+
- **ORM**: SQLAlchemy 2.0+
- **Migration Tool**: Alembic
- **Schema Location**: `app/models/models.py`

### Design Principles
1. **Normalized Schema**: Third normal form (3NF) with strategic denormalization
2. **Soft Deletes**: Where appropriate using `is_active` flags
3. **Audit Trails**: All tables include `created_at` and `updated_at` timestamps
4. **Referential Integrity**: Foreign key constraints with appropriate cascade rules
5. **Performance Indexing**: Strategic indexes on foreign keys and frequently queried fields
6. **JSONB Usage**: For flexible, semi-structured data (tags, metadata)

### Database Configuration
- **Migration Location**: `alembic/migrations/versions/`
- **Alembic Config**: `alembic.ini`
- **Connection**: PostgreSQL via SQLAlchemy async engine

## Entity Relationship Diagram

```
CORE ENTITIES
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│    Users    │────────>│   Patients   │<────────│ UserPreferences │
│             │         │              │         │                 │
│ - id        │         │ - id         │         │ - user_id (FK)  │
│ - username  │         │ - user_id    │         │ - unit_system   │
│ - email     │         │ - owner_user │         │ - paperless_*   │
│ - role      │         │ - first_name │         └─────────────────┘
│ - auth_*    │         │ - last_name  │
└─────────────┘         └──────────────┘
       │                       │
       │                       │
       ├───────────────────────┼──────────────────────┐
       │                       │                      │
       v                       v                      v
┌─────────────┐         ┌──────────────┐      ┌─────────────────┐
│ActivityLog  │         │PatientPhoto  │      │ PatientShares   │
│             │         │              │      │                 │
│ - user_id   │         │ - patient_id │      │ - patient_id    │
│ - action    │         │ - file_path  │      │ - shared_by     │
└─────────────┘         └──────────────┘      │ - shared_with   │
                                               └─────────────────┘

MEDICAL RECORDS HIERARCHY
                        ┌──────────────┐
                        │   Patients   │
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              v                v                v
       ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
       │  Medications │  │  Conditions  │  │  Lab Results │
       │              │  │              │  │              │
       │  - dosage    │  │  - diagnosis │  │  - test_name │
       │  - frequency │  │  - severity  │  │  - status    │
       └──────────────┘  └──────┬───────┘  └──────┬───────┘
                                │                  │
                                │                  v
                         ┌──────┴───────┐   ┌──────────────────┐
                         │  Treatments  │   │LabTestComponents │
                         │  Procedures  │   │                  │
                         │  Encounters  │   │ - value          │
                         └──────────────┘   │ - unit           │
                                            │ - ref_range      │
                                            └──────────────────┘

FAMILY HISTORY
┌──────────────┐         ┌─────────────────┐         ┌──────────────────────┐
│   Patients   │────────>│ FamilyMembers   │────────>│  FamilyConditions    │
│              │         │                 │         │                      │
│              │         │ - relationship  │         │ - condition_name     │
│              │         │ - is_deceased   │         │ - severity           │
└──────────────┘         └─────────────────┘         └──────────────────────┘
                                 │
                                 v
                         ┌─────────────────────┐
                         │FamilyHistoryShares  │
                         │                     │
                         │ - invitation_id     │
                         │ - shared_by/with    │
                         └─────────────────────┘

REFERENCE DATA
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│Practitioners │         │  Pharmacies  │         │  User Tags   │
│              │         │              │         │              │
│ - specialty  │         │ - brand      │         │ - user_id    │
│ - practice   │         │ - address    │         │ - tag        │
└──────────────┘         └──────────────┘         └──────────────┘

JUNCTION TABLES (Many-to-Many)
┌────────────────────────┐         ┌──────────────────────────┐
│  LabResultConditions   │         │  ConditionMedications    │
│                        │         │                          │
│ - lab_result_id (FK)   │         │ - condition_id (FK)      │
│ - condition_id (FK)    │         │ - medication_id (FK)     │
│ - relevance_note       │         │ - relevance_note         │
└────────────────────────┘         └──────────────────────────┘
```

## Core Tables

### users
**Purpose**: Central user authentication and account management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique user identifier |
| username | String | UNIQUE, NOT NULL | User's login name |
| email | String | UNIQUE, NOT NULL | User's email address |
| password_hash | String | NOT NULL | Hashed password |
| full_name | String | NOT NULL | User's full display name |
| role | String | NOT NULL | User role (admin, user, guest) |
| auth_method | String(20) | NOT NULL, DEFAULT 'local' | Auth method: local, sso, hybrid |
| external_id | String(255) | UNIQUE | SSO provider user ID |
| sso_provider | String(50) | | SSO provider name (google, github, oidc) |
| sso_metadata | JSON | | Additional SSO data |
| last_sso_login | DateTime | | Last SSO login timestamp |
| account_linked_at | DateTime | | When account linked to SSO |
| sso_linking_preference | String(20) | | auto_link, create_separate, always_ask |
| active_patient_id | Integer | FK(patients.id) | Current patient context |
| created_at | DateTime | NOT NULL | Account creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `patient`: One-to-one with Patient (legacy relationship via user_id)
- `owned_patients`: One-to-many with Patient (via owner_user_id)
- `current_patient_context`: Many-to-one with Patient (via active_patient_id)
- `shared_patients_by_me`: One-to-many with PatientShare
- `shared_patients_with_me`: One-to-many with PatientShare
- `preferences`: One-to-one with UserPreferences (cascade delete)

**Indexes**:
- `idx_users_email` on email

**Business Rules**:
- Username and email must be unique across the system
- SSO users may have external_id instead of password_hash
- active_patient_id determines which patient's records are currently active

### patients
**Purpose**: Core patient demographic and profile information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique patient identifier |
| user_id | Integer | FK(users.id), NOT NULL | Associated user account |
| owner_user_id | Integer | FK(users.id), NOT NULL | Patient record owner |
| is_self_record | Boolean | NOT NULL, DEFAULT FALSE | Is this the user's own record |
| family_id | Integer | | Family group ID (future use) |
| relationship_to_family | String | | self, spouse, child, parent |
| privacy_level | String | NOT NULL, DEFAULT 'owner' | Privacy access level |
| external_account_id | Integer | | External account link (future) |
| is_externally_accessible | Boolean | NOT NULL, DEFAULT FALSE | Allow external access |
| first_name | String | NOT NULL | Patient's first name |
| last_name | String | NOT NULL | Patient's last name |
| birth_date | Date | NOT NULL | Date of birth |
| physician_id | Integer | FK(practitioners.id) | Primary care physician |
| blood_type | String | | Blood type (A+, O-, etc.) |
| height | Float | | Height in inches |
| weight | Float | | Weight in lbs |
| gender | String | | Patient's gender |
| address | String | | Patient's address |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `owner`: Many-to-one with User (via owner_user_id)
- `user`: Many-to-one with User (via user_id)
- `practitioner`: Many-to-one with Practitioner
- `medications`: One-to-many with Medication (cascade delete)
- `encounters`: One-to-many with Encounter (cascade delete)
- `lab_results`: One-to-many with LabResult (cascade delete)
- `immunizations`: One-to-many with Immunization (cascade delete)
- `conditions`: One-to-many with Condition (cascade delete)
- `procedures`: One-to-many with Procedure (cascade delete)
- `treatments`: One-to-many with Treatment (cascade delete)
- `allergies`: One-to-many with Allergy (cascade delete)
- `vitals`: One-to-many with Vitals (cascade delete)
- `emergency_contacts`: One-to-many with EmergencyContact (cascade delete)
- `family_members`: One-to-many with FamilyMember (cascade delete)
- `insurances`: One-to-many with Insurance (cascade delete)
- `shares`: One-to-many with PatientShare (cascade delete)
- `photo`: One-to-one with PatientPhoto (cascade delete)

**Indexes**:
- `idx_patients_owner_user_id` on owner_user_id

**Business Rules**:
- Patient records must have an owner (owner_user_id)
- is_self_record is TRUE when user_id equals owner_user_id
- All related medical records cascade delete when patient is deleted

### user_preferences
**Purpose**: User-specific preferences and settings including Paperless-ngx integration

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique preference record ID |
| user_id | Integer | FK(users.id), NOT NULL, UNIQUE | Associated user |
| unit_system | String | NOT NULL, DEFAULT 'imperial' | imperial or metric |
| session_timeout_minutes | Integer | NOT NULL, DEFAULT 30 | Session timeout duration |
| paperless_enabled | Boolean | NOT NULL, DEFAULT FALSE | Enable Paperless integration |
| paperless_url | String(500) | | Paperless-ngx instance URL |
| paperless_api_token_encrypted | Text | | Encrypted API token |
| paperless_username_encrypted | Text | | Encrypted username |
| paperless_password_encrypted | Text | | Encrypted password |
| default_storage_backend | String(20) | NOT NULL, DEFAULT 'local' | local or paperless |
| paperless_auto_sync | Boolean | NOT NULL, DEFAULT FALSE | Auto-sync to Paperless |
| paperless_sync_tags | Boolean | NOT NULL, DEFAULT TRUE | Sync tags to Paperless |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `user`: One-to-one with User (back_populates)

**Business Rules**:
- One preference record per user (UNIQUE constraint on user_id)
- Paperless credentials stored encrypted
- Cascade delete with user account

### activity_log
**Purpose**: Audit trail for user and system activities (referenced in code, table definition in separate migration)

**Business Rules**:
- Logs all critical user actions
- Includes user_id, action type, entity type, entity ID
- Maintains audit trail for compliance

## Medical Record Tables

### medications
**Purpose**: Patient medication records including prescriptions and OTC

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique medication ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Prescribing practitioner |
| pharmacy_id | Integer | FK(pharmacies.id) | Dispensing pharmacy |
| medication_name | String | NOT NULL | Name of medication |
| dosage | String | | Dosage amount (e.g., "10mg") |
| frequency | String | | Frequency (e.g., "twice daily") |
| route | String | | Administration route (oral, injection) |
| indication | String | | What medication treats |
| effective_period_start | Date | | Start date |
| effective_period_end | Date | | End date |
| status | String | | MedicationStatus enum value |
| tags | JSONB | DEFAULT [] | User tags for organization |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Status Values** (MedicationStatus enum):
- active
- stopped
- on-hold
- completed
- cancelled

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `pharmacy`: Many-to-one with Pharmacy
- `allergies`: One-to-many with Allergy
- `condition_relationships`: One-to-many with ConditionMedication

**Indexes**:
- `idx_medications_patient_id` on patient_id
- `idx_medications_patient_status` on (patient_id, status)

**Business Rules**:
- Patient is required, practitioner is optional (OTC medications)
- Status transitions follow medical workflow
- Tags stored as JSONB array for flexible categorization

### conditions
**Purpose**: Patient medical conditions and diagnoses

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique condition ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Diagnosing practitioner |
| medication_id | Integer | FK(medications.id) | Related medication (legacy) |
| condition_name | String | | Common name of condition |
| diagnosis | String | NOT NULL | Formal diagnosis |
| notes | String | | Additional notes |
| onset_date | Date | | When first diagnosed |
| status | String | NOT NULL | ConditionStatus enum value |
| end_date | Date | | Resolution date |
| severity | String | | SeverityLevel enum value |
| icd10_code | String | | ICD-10 diagnosis code |
| snomed_code | String | | SNOMED CT code |
| code_description | String | | Medical code description |
| tags | JSONB | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Status Values** (ConditionStatus enum):
- active
- inactive
- resolved
- chronic
- recurrence
- relapse

**Severity Values** (SeverityLevel enum):
- mild
- moderate
- severe
- life-threatening

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `medication`: Many-to-one with Medication (legacy FK)
- `treatments`: One-to-many with Treatment
- `procedures`: One-to-many with Procedure
- `lab_result_relationships`: One-to-many with LabResultCondition
- `medication_relationships`: One-to-many with ConditionMedication

**Indexes**:
- `idx_conditions_patient_id` on patient_id
- `idx_conditions_patient_status` on (patient_id, status)

**Business Rules**:
- Diagnosis is required field
- end_date only set when status is 'resolved'
- Medical codes (ICD-10, SNOMED) optional but recommended

### lab_results
**Purpose**: Laboratory test orders and results

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique lab result ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Ordering practitioner |
| test_name | String | NOT NULL | Name/description of test |
| test_code | String | | Test code (LOINC, CPT) |
| test_category | String | | blood work, imaging, pathology |
| test_type | String | | routine, emergency, etc. |
| facility | String | | Testing facility name |
| status | String | NOT NULL, DEFAULT 'ordered' | LabResultStatus enum value |
| labs_result | String | | Result interpretation (normal, abnormal) |
| ordered_date | Date | | When test was ordered |
| completed_date | Date | | When results received |
| notes | Text | | Additional notes |
| tags | JSONB | DEFAULT [] | User tags |
| created_at | DateTime | | Record creation timestamp |
| updated_at | DateTime | | Last modification timestamp |

**Status Values** (LabResultStatus enum):
- ordered
- in_progress
- completed
- cancelled

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `files`: One-to-many with LabResultFile (cascade delete)
- `condition_relationships`: One-to-many with LabResultCondition (cascade delete)
- `test_components`: One-to-many with LabTestComponent (cascade delete)

**Indexes**:
- `idx_lab_results_patient_id` on patient_id
- `idx_lab_results_patient_date` on (patient_id, completed_date)

**Business Rules**:
- Status workflow: ordered -> in_progress -> completed
- completed_date set when status changes to 'completed'
- Test components track individual values within result

### lab_test_components
**Purpose**: Individual test values within a lab result

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique component ID |
| lab_result_id | Integer | FK(lab_results.id), NOT NULL | Parent lab result |
| test_name | String | NOT NULL | Component name (e.g., "WBC") |
| abbreviation | String | | Short form (e.g., "WBC") |
| test_code | String | | LOINC or other code |
| value | Float | NOT NULL | Numeric test value |
| unit | String | NOT NULL | Unit of measurement |
| ref_range_min | Float | | Reference range minimum |
| ref_range_max | Float | | Reference range maximum |
| ref_range_text | String | | Text range for non-numeric |
| status | String | | normal, high, low, critical |
| category | String | | hematology, chemistry, etc. |
| display_order | Integer | | Sort order for display |
| notes | Text | | Component-specific notes |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `lab_result`: Many-to-one with LabResult

**Indexes**:
- `idx_lab_test_components_lab_result_id` on lab_result_id
- `idx_lab_test_components_status` on status
- `idx_lab_test_components_category` on category
- `idx_lab_test_components_lab_result_status` on (lab_result_id, status)
- `idx_lab_test_components_lab_result_category` on (lab_result_id, category)
- `idx_lab_test_components_test_name_text` on test_name
- `idx_lab_test_components_abbreviation_text` on abbreviation

**Business Rules**:
- Cascade deletes with parent lab_result
- Status auto-calculated from value vs. reference range
- display_order used for consistent UI presentation

### lab_result_files
**Purpose**: File attachments for lab results (PDFs, images)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique file ID |
| lab_result_id | Integer | FK(lab_results.id) | Associated lab result |
| file_name | String | NOT NULL | Original filename |
| file_path | String | NOT NULL | Server file path |
| file_type | String | NOT NULL | MIME type |
| file_size | Integer | | Size in bytes |
| description | String | | Optional file description |
| uploaded_at | DateTime | NOT NULL | Upload timestamp |

**Relationships**:
- `lab_result`: Many-to-one with LabResult

**Business Rules**:
- Cascade deletes with parent lab_result
- File type validated on upload
- File size limits enforced (15MB max)

### allergies
**Purpose**: Patient allergy information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique allergy ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| medication_id | Integer | FK(medications.id) | Related medication if applicable |
| allergen | String | NOT NULL | Allergen name |
| reaction | String | NOT NULL | Reaction description |
| severity | String | | SeverityLevel enum value |
| onset_date | Date | | When first noted |
| status | String | | AllergyStatus enum value |
| notes | String | | Additional notes |
| tags | JSONB | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Status Values** (AllergyStatus enum):
- active
- inactive
- resolved
- unconfirmed

**Relationships**:
- `patient`: Many-to-one with Patient
- `medication`: Many-to-one with Medication

**Indexes**:
- `idx_allergies_patient_id` on patient_id

**Business Rules**:
- Allergen and reaction are required
- medication_id set when allergy is to a specific medication
- Critical allergies should be flagged with severe/life-threatening severity

### vitals
**Purpose**: Patient vital signs and measurements

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique vitals record ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Recording practitioner |
| recorded_date | DateTime | NOT NULL | When vitals recorded |
| systolic_bp | Integer | | Systolic blood pressure (mmHg) |
| diastolic_bp | Integer | | Diastolic blood pressure (mmHg) |
| heart_rate | Integer | | Heart rate (bpm) |
| temperature | Float | | Body temperature (Fahrenheit) |
| weight | Float | | Weight (lbs) |
| height | Float | | Height (inches) |
| oxygen_saturation | Float | | SpO2 percentage |
| respiratory_rate | Integer | | Breaths per minute |
| blood_glucose | Float | | Blood glucose (mg/dL) |
| bmi | Float | | Body Mass Index (calculated) |
| pain_scale | Integer | | Pain scale 0-10 |
| notes | Text | | Additional notes |
| location | String | | Where recorded (home, clinic) |
| device_used | String | | Measurement device |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner

**Indexes**:
- `idx_vitals_patient_id` on patient_id

**Business Rules**:
- At least one vital measurement required
- BMI auto-calculated from height and weight when available
- recorded_date tracks when measurement was taken

### immunizations
**Purpose**: Patient vaccination records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique immunization ID |
| patient_id | Integer | FK(patients.id) | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Administering practitioner |
| vaccine_name | String | NOT NULL | Vaccine name |
| vaccine_trade_name | String | | Formal/trade name |
| date_administered | Date | NOT NULL | Administration date |
| dose_number | Integer | | Dose in series |
| ndc_number | String | | NDC number |
| lot_number | String | | Vaccine lot number |
| manufacturer | String | | Vaccine manufacturer |
| site | String | | Injection site |
| route | String | | Route of administration |
| expiration_date | Date | | Vaccine expiration |
| location | String | | Where administered |
| notes | Text | | Additional notes |
| tags | JSONB | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner

**Indexes**:
- `idx_immunizations_patient_id` on patient_id

**Business Rules**:
- Vaccine name and administration date required
- Lot number and expiration important for recall tracking

### procedures
**Purpose**: Medical procedures performed on patient

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique procedure ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Performing practitioner |
| condition_id | Integer | FK(conditions.id) | Related condition |
| procedure_name | String | NOT NULL | Procedure name |
| procedure_type | String | | surgical, diagnostic, etc. |
| procedure_code | String | | CPT code |
| date | Date | NOT NULL | Procedure date |
| description | String | | Procedure description |
| status | String | | ProcedureStatus enum value |
| notes | String | | Additional notes |
| facility | String | | Facility where performed |
| procedure_setting | String | | outpatient, inpatient, office |
| procedure_complications | String | | Complications that occurred |
| procedure_duration | Integer | | Duration in minutes |
| anesthesia_type | String | | local, regional, general |
| anesthesia_notes | String | | Anesthesia notes |
| tags | JSONB | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Status Values** (ProcedureStatus enum):
- scheduled
- in_progress
- completed
- cancelled

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `condition`: Many-to-one with Condition

**Indexes**:
- `idx_procedures_patient_id` on patient_id

**Business Rules**:
- Procedure name and date required
- condition_id links procedure to diagnosis
- Status workflow: scheduled -> in_progress -> completed

### treatments
**Purpose**: Patient treatment plans and therapies

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique treatment ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Prescribing practitioner |
| condition_id | Integer | FK(conditions.id) | Related condition |
| treatment_name | String | NOT NULL | Treatment name |
| treatment_type | String | NOT NULL | Type of treatment |
| start_date | Date | NOT NULL | Treatment start date |
| end_date | Date | | Treatment end date |
| status | String | | TreatmentStatus enum value |
| treatment_category | String | | inpatient, outpatient |
| notes | String | | Additional notes |
| frequency | String | | Treatment frequency |
| outcome | String | | Expected/actual outcome |
| description | String | | Treatment description |
| location | String | | Where administered |
| dosage | String | | Treatment dosage |
| tags | JSONB | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Status Values** (TreatmentStatus enum):
- active
- in_progress
- completed
- cancelled
- on_hold

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `condition`: Many-to-one with Condition

**Business Rules**:
- Treatment name, type, and start date required
- end_date set when status changes to completed
- condition_id links treatment to diagnosis

### encounters
**Purpose**: Medical encounters/visits between patient and practitioner

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique encounter ID |
| patient_id | Integer | FK(patients.id) | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Attending practitioner |
| condition_id | Integer | FK(conditions.id) | Related condition |
| reason | String | NOT NULL | Reason for encounter |
| date | Date | NOT NULL | Encounter date |
| notes | String | | Additional notes |
| visit_type | String | | annual checkup, follow-up, etc. |
| chief_complaint | String | | Primary patient concern |
| diagnosis | String | | Clinical assessment |
| treatment_plan | String | | Recommended treatment |
| follow_up_instructions | String | | Follow-up care |
| duration_minutes | Integer | | Visit duration |
| location | String | | office, hospital, telehealth |
| priority | String | | EncounterPriority enum value |
| tags | JSONB | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Priority Values** (EncounterPriority enum):
- routine
- urgent
- emergency

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `condition`: Many-to-one with Condition

**Indexes**:
- `idx_encounters_patient_id` on patient_id

**Business Rules**:
- Reason and date are required
- Priority determines scheduling urgency
- chief_complaint is patient's primary concern

### emergency_contacts
**Purpose**: Patient emergency contact information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique contact ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| name | String | NOT NULL | Contact's full name |
| relationship | String | NOT NULL | spouse, parent, child, friend |
| phone_number | String | NOT NULL | Primary phone |
| secondary_phone | String | | Secondary phone |
| email | String | | Email address |
| is_primary | Boolean | NOT NULL, DEFAULT FALSE | Primary emergency contact |
| is_active | Boolean | NOT NULL, DEFAULT TRUE | Active status |
| address | String | | Contact's address |
| notes | String | | Additional notes |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `patient`: Many-to-one with Patient

**Business Rules**:
- Name, relationship, and phone required
- Only one is_primary contact per patient
- is_active allows soft delete of outdated contacts

### insurance
**Purpose**: Patient insurance policy information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique insurance ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| insurance_type | String | NOT NULL | InsuranceType enum value |
| company_name | String | NOT NULL | Insurance company name |
| employer_group | String | | Employer/group name |
| member_name | String | NOT NULL | Member name on policy |
| member_id | String | NOT NULL | Member ID number |
| group_number | String | | Group number |
| plan_name | String | | Plan name |
| policy_holder_name | String | | Policy holder if different |
| relationship_to_holder | String | | self, spouse, child, dependent |
| effective_date | Date | NOT NULL | Coverage start date |
| expiration_date | Date | | Coverage end date |
| status | String | NOT NULL, DEFAULT 'active' | InsuranceStatus enum value |
| is_primary | Boolean | NOT NULL, DEFAULT FALSE | Primary insurance flag |
| coverage_details | JSON | | Copays, deductibles, etc. |
| contact_info | JSON | | Phone, address, website |
| notes | Text | | Additional notes |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Insurance Type Values** (InsuranceType enum):
- medical
- dental
- vision
- prescription

**Status Values** (InsuranceStatus enum):
- active
- inactive
- expired
- pending

**Relationships**:
- `patient`: Many-to-one with Patient

**Business Rules**:
- Insurance type, company, member name/ID, and effective date required
- Only one is_primary insurance per insurance_type per patient
- coverage_details stores type-specific data (BIN/PCN for prescription)

## Reference Tables

### practitioners
**Purpose**: Healthcare provider directory

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique practitioner ID |
| name | String | NOT NULL | Practitioner's name |
| specialty | String | NOT NULL | Medical specialty |
| practice | String | NOT NULL | Practice/clinic name |
| phone_number | String | | Contact phone |
| website | String | | Website URL |
| rating | Float | | Rating 0.0-5.0 |

**Relationships**:
- `patients`: One-to-many with Patient (as PCP)
- `medications`: One-to-many with Medication
- `encounters`: One-to-many with Encounter
- `lab_results`: One-to-many with LabResult
- `immunizations`: One-to-many with Immunization
- `procedures`: One-to-many with Procedure
- `treatments`: One-to-many with Treatment
- `conditions`: One-to-many with Condition
- `vitals`: One-to-many with Vitals

**Business Rules**:
- Name, specialty, and practice required
- Shared across all users (global reference data)
- Rating optional for user feedback

### pharmacies
**Purpose**: Pharmacy directory for medication dispensing

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique pharmacy ID |
| name | String | NOT NULL | Pharmacy name with location |
| brand | String | | Brand name (CVS, Walgreens) |
| street_address | String | | Street address |
| city | String | | City |
| state | String | | State |
| zip_code | String | | ZIP code |
| country | String | | Country |
| store_number | String | | Chain store number |
| phone_number | String | | Contact phone |
| fax_number | String | | Fax number |
| email | String | | Email address |
| website | String | | Website URL |
| hours | String | | Operating hours |
| drive_through | Boolean | DEFAULT FALSE | Has drive-through |
| twenty_four_hour | Boolean | DEFAULT FALSE | 24-hour service |
| specialty_services | String | | Vaccinations, MTM, etc. |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `medications`: One-to-many with Medication

**Business Rules**:
- Name required, descriptive with location
- Address components for location identification
- Shared across all users (global reference data)

### user_tags
**Purpose**: User-created tags for organization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique tag ID |
| user_id | Integer | FK(users.id), NOT NULL | Tag owner |
| tag | String(100) | NOT NULL | Tag name |
| created_at | DateTime | NOT NULL | Tag creation timestamp |

**Relationships**:
- `user`: Many-to-one with User

**Indexes**:
- `idx_user_tags_user_id` on user_id
- `idx_user_tags_tag` on tag

**Constraints**:
- `uq_user_tag` UNIQUE on (user_id, tag)

**Business Rules**:
- Tags are user-specific (not shared)
- Tag names unique per user
- Used in JSONB tags fields across medical records

## Family History Tables

### family_members
**Purpose**: Family member records for medical history tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique family member ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| name | String | NOT NULL | Family member's name |
| relationship | String | NOT NULL | FamilyRelationship enum value |
| gender | String | | Gender |
| birth_year | Integer | | Year of birth |
| death_year | Integer | | Year of death if deceased |
| is_deceased | Boolean | NOT NULL, DEFAULT FALSE | Deceased status |
| notes | Text | | Additional notes |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationship Values** (FamilyRelationship enum):
- father, mother
- brother, sister
- paternal_grandfather, paternal_grandmother
- maternal_grandfather, maternal_grandmother
- uncle, aunt, cousin
- other

**Relationships**:
- `patient`: Many-to-one with Patient
- `family_conditions`: One-to-many with FamilyCondition (cascade delete)
- `shares`: One-to-many with FamilyHistoryShare (cascade delete)

**Business Rules**:
- Name and relationship required
- is_deceased flag set when death_year provided
- Cascade deletes conditions and shares when deleted

### family_conditions
**Purpose**: Medical conditions for family members

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique condition ID |
| family_member_id | Integer | FK(family_members.id), NOT NULL | Associated family member |
| condition_name | String | NOT NULL | Condition name |
| diagnosis_age | Integer | | Age when diagnosed |
| severity | String | | SeverityLevel enum value |
| status | String | | active, resolved, chronic |
| condition_type | String | | ConditionType enum value |
| notes | Text | | Additional notes |
| icd10_code | String | | ICD-10 code |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Condition Type Values** (ConditionType enum):
- cardiovascular, diabetes, cancer
- mental_health, neurological
- autoimmune, genetic
- respiratory, endocrine
- other

**Relationships**:
- `family_member`: Many-to-one with FamilyMember

**Business Rules**:
- Condition name required
- diagnosis_age helps track genetic patterns
- Cascade deletes with family member

### family_history_shares
**Purpose**: Sharing family history records between users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique share ID |
| invitation_id | Integer | FK(invitations.id), NOT NULL | Creating invitation |
| family_member_id | Integer | FK(family_members.id), NOT NULL | Shared family member |
| shared_by_user_id | Integer | FK(users.id), NOT NULL | Sharing user |
| shared_with_user_id | Integer | FK(users.id), NOT NULL | Receiving user |
| permission_level | String | NOT NULL, DEFAULT 'view' | view (Phase 1.5) |
| is_active | Boolean | NOT NULL, DEFAULT TRUE | Active status |
| expires_at | DateTime | | Expiration timestamp |
| sharing_note | Text | | Optional sharing note |
| created_at | DateTime | NOT NULL | Share creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `invitation`: Many-to-one with Invitation
- `family_member`: Many-to-one with FamilyMember
- `shared_by`: Many-to-one with User
- `shared_with`: Many-to-one with User

**Indexes**:
- `unique_active_family_history_share_partial` UNIQUE on (family_member_id, shared_with_user_id) WHERE is_active = TRUE

**Business Rules**:
- Created from accepted invitation
- Only one active share per family_member/user pair
- Multiple inactive shares allowed (history)
- Partial unique index enforces active constraint

## File Management Tables

### entity_files
**Purpose**: Generic file management for all entity types

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique file ID |
| entity_type | String(50) | NOT NULL | Entity type identifier |
| entity_id | Integer | NOT NULL | Entity foreign key |
| file_name | String(255) | NOT NULL | Original filename |
| file_path | String(500) | NOT NULL | Server file path |
| file_type | String(100) | NOT NULL | MIME type or extension |
| file_size | Integer | | Size in bytes |
| description | Text | | Optional description |
| category | String(100) | | File category (result, report, card) |
| uploaded_at | DateTime | NOT NULL | Upload timestamp |
| storage_backend | String(20) | NOT NULL, DEFAULT 'local' | local or paperless |
| paperless_document_id | String(255) | | Paperless-ngx document ID |
| paperless_task_uuid | String(255) | | Paperless-ngx task UUID |
| sync_status | String(20) | NOT NULL, DEFAULT 'synced' | Sync status |
| last_sync_at | DateTime | | Last sync timestamp |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Entity Types**:
- lab-result
- insurance
- visit
- procedure
- (extensible for future types)

**Sync Status Values**:
- synced
- pending
- processing
- failed
- missing

**Indexes**:
- `idx_entity_type_id` on (entity_type, entity_id)
- `idx_category` on category
- `idx_uploaded_at` on uploaded_at
- `idx_created_at` on created_at
- `idx_storage_backend` on storage_backend
- `idx_paperless_document_id` on paperless_document_id
- `idx_sync_status` on sync_status

**Business Rules**:
- Supports multiple files per entity
- Paperless-ngx integration for DMS sync
- Composite index on (entity_type, entity_id) for efficient queries

### patient_photos
**Purpose**: Patient profile photos (one per patient)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique photo ID |
| patient_id | Integer | FK(patients.id), NOT NULL, UNIQUE | Associated patient |
| file_name | String(255) | NOT NULL | Stored filename |
| file_path | String(500) | NOT NULL | Server file path |
| file_size | Integer | | Size in bytes |
| mime_type | String(100) | | MIME type |
| original_name | String(255) | | Original filename |
| width | Integer | | Image width in pixels |
| height | Integer | | Image height in pixels |
| uploaded_by | Integer | FK(users.id) | Uploading user |
| uploaded_at | DateTime | NOT NULL | Upload timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `patient`: One-to-one with Patient (CASCADE DELETE)
- `uploader`: Many-to-one with User

**Indexes**:
- `idx_patient_photos_patient_id` on patient_id

**Constraints**:
- `uq_patient_photo` UNIQUE on patient_id

**Business Rules**:
- One photo per patient (UNIQUE constraint)
- Cascade deletes with patient
- Automatic cleanup on replacement
- Image resized to max 1000px dimension

## Sharing & Collaboration Tables

### invitations
**Purpose**: Reusable invitation system for sharing and collaboration

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique invitation ID |
| sent_by_user_id | Integer | FK(users.id), NOT NULL | Sending user |
| sent_to_user_id | Integer | FK(users.id), NOT NULL | Receiving user |
| invitation_type | String | NOT NULL | Type of invitation |
| status | String | NOT NULL, DEFAULT 'pending' | Invitation status |
| title | String | NOT NULL | Invitation title |
| message | Text | | Custom message from sender |
| context_data | JSON | NOT NULL | Type-specific data |
| expires_at | DateTime | | Expiration timestamp |
| responded_at | DateTime | | Response timestamp |
| response_note | Text | | Response note |
| created_at | DateTime | NOT NULL | Invitation creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Invitation Types**:
- family_history_share
- patient_share
- family_join
- (extensible for future types)

**Status Values**:
- pending
- accepted
- rejected
- expired
- cancelled

**Relationships**:
- `sent_by`: Many-to-one with User
- `sent_to`: Many-to-one with User

**Business Rules**:
- No unique constraints - application logic handles duplicates
- context_data contains type-specific information (JSON)
- Flexible design supports multiple invitation types
- Status workflow: pending -> (accepted/rejected/expired/cancelled)

### patient_shares
**Purpose**: Patient record sharing between users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique share ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Shared patient |
| shared_by_user_id | Integer | FK(users.id), NOT NULL | Sharing user |
| shared_with_user_id | Integer | FK(users.id), NOT NULL | Receiving user |
| permission_level | String | NOT NULL | view, edit, full |
| custom_permissions | JSON | | Custom permission object |
| is_active | Boolean | NOT NULL, DEFAULT TRUE | Active status |
| expires_at | DateTime | | Expiration timestamp |
| invitation_id | Integer | FK(invitations.id) | Creating invitation (nullable) |
| created_at | DateTime | NOT NULL | Share creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Permission Levels**:
- view: Read-only access
- edit: Can modify records
- full: Can share and manage

**Relationships**:
- `patient`: Many-to-one with Patient
- `shared_by`: Many-to-one with User
- `shared_with`: Many-to-one with User
- `invitation`: Many-to-one with Invitation

**Constraints**:
- `unique_patient_share` UNIQUE on (patient_id, shared_with_user_id)

**Business Rules**:
- One share per patient/user pair
- invitation_id nullable for backward compatibility
- custom_permissions for granular control (future)
- is_active allows soft delete

## Reporting Tables

### report_templates
**Purpose**: Custom report templates for reuse

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique template ID |
| user_id | Integer | FK(users.id), NOT NULL | Template owner |
| name | String(255) | NOT NULL | Template name |
| description | Text | | Template description |
| selected_records | JSONB | NOT NULL | Record selections and filters |
| report_settings | JSONB | NOT NULL, DEFAULT {} | UI preferences, sorting |
| is_public | Boolean | NOT NULL, DEFAULT FALSE | Public visibility |
| shared_with_family | Boolean | NOT NULL, DEFAULT FALSE | Family sharing |
| is_active | Boolean | NOT NULL, DEFAULT TRUE | Active status (soft delete) |
| created_at | DateTime | NOT NULL | Template creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `user`: Many-to-one with User

**Indexes**:
- `idx_report_template_user_id` on user_id
- `idx_report_template_is_active` on is_active WHERE is_active = TRUE
- `idx_report_template_shared_family` on shared_with_family WHERE shared_with_family = TRUE
- `idx_report_template_selected_records` on selected_records (GIN index)

**Constraints**:
- `unique_user_template_name` UNIQUE on (user_id, name)

**Business Rules**:
- Template names unique per user
- selected_records JSONB stores flexible configuration
- GIN index on JSONB for efficient queries
- is_active allows soft delete

### report_generation_audit
**Purpose**: Audit trail for report generation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique audit ID |
| user_id | Integer | FK(users.id) | Generating user |
| report_type | String(50) | NOT NULL | custom_report, full_export, etc. |
| categories_included | ARRAY(Text) | | Array of category names |
| total_records | Integer | | Total records in report |
| generation_time_ms | Integer | | Generation time in ms |
| file_size_bytes | Integer | | Generated file size |
| status | String(20) | NOT NULL, DEFAULT 'success' | success, failed, timeout |
| error_details | Text | | Error details if failed |
| created_at | DateTime | NOT NULL | Audit timestamp |

**Relationships**:
- `user`: Many-to-one with User (SET NULL on delete)

**Indexes**:
- `idx_report_audit_user_created` on (user_id, created_at)
- `idx_report_audit_status` on status
- `idx_report_audit_created_at` on created_at

**Business Rules**:
- Tracks all report generation activities
- Performance metrics for monitoring
- user_id SET NULL if user deleted (preserve audit)

## Admin Tables

### backup_records
**Purpose**: Backup operation tracking and management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique backup ID |
| backup_type | String | NOT NULL | full, database, files |
| status | String | NOT NULL | created, failed, verified |
| file_path | String | NOT NULL | Backup file path |
| created_at | DateTime | NOT NULL | Backup creation timestamp |
| size_bytes | Integer | | Backup file size |
| description | Text | | Optional description |
| compression_used | Boolean | NOT NULL, DEFAULT FALSE | Compression flag |
| checksum | String | | File checksum for integrity |

**Business Rules**:
- Tracks all backup operations
- checksum for integrity verification
- Retention policy managed by admin scripts

## Junction Tables

### lab_result_conditions
**Purpose**: Many-to-many relationship between lab results and conditions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| lab_result_id | Integer | FK(lab_results.id), NOT NULL | Associated lab result |
| condition_id | Integer | FK(conditions.id), NOT NULL | Associated condition |
| relevance_note | String | | How lab relates to condition |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `lab_result`: Many-to-one with LabResult
- `condition`: Many-to-one with Condition

**Business Rules**:
- Links lab results to related conditions
- relevance_note provides clinical context
- Cascade deletes with either parent

### condition_medications
**Purpose**: Many-to-many relationship between conditions and medications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| condition_id | Integer | FK(conditions.id), NOT NULL | Associated condition |
| medication_id | Integer | FK(medications.id), NOT NULL | Associated medication |
| relevance_note | String | | How medication relates to condition |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `condition`: Many-to-one with Condition
- `medication`: Many-to-one with Medication

**Business Rules**:
- Links medications to conditions they treat
- relevance_note provides clinical context (e.g., "Primary treatment")
- Cascade deletes with either parent

## Data Types Reference

### SQLAlchemy Types Used

| SQLAlchemy Type | PostgreSQL Type | Description | Example Usage |
|-----------------|-----------------|-------------|---------------|
| Integer | INTEGER | 32-bit integer | Primary keys, counts |
| String | VARCHAR | Variable-length string | Names, codes |
| String(N) | VARCHAR(N) | String with max length | String(255) for long text |
| Text | TEXT | Unlimited text | Notes, descriptions |
| Float | DOUBLE PRECISION | Floating-point number | Height, weight, ratings |
| Boolean | BOOLEAN | True/false value | Flags, status indicators |
| Date | DATE | Date without time | Birth dates, event dates |
| DateTime | TIMESTAMP | Date and time | Timestamps, audit fields |
| JSON | JSON | JSON data | Metadata, simple objects |
| JSONB | JSONB | Binary JSON (indexed) | Tags, complex config |
| ARRAY(Text) | TEXT[] | Array of text | Categories list |

### Custom Types

**JSONB for Tags**:
- Stored as PostgreSQL JSONB (binary JSON)
- Allows indexing and efficient querying
- Used in: medications, conditions, lab_results, encounters, immunizations, procedures, treatments, allergies
- Default value: `[]` (empty array)

**Enum Values**:
- Stored as String in database
- Validated by Python enums in `app/models/enums.py`
- Ensures consistency across application

### Timezone Handling

- All DateTime fields use timezone-aware timestamps
- Helper function: `get_utc_now()` returns current UTC time
- Replaces deprecated `datetime.utcnow()`

```python
def get_utc_now():
    """Get the current UTC datetime with timezone awareness."""
    return datetime.now(timezone.utc)
```

## Indexes & Performance

### Index Strategy

1. **Foreign Key Indexes**: All foreign keys indexed for join performance
2. **Composite Indexes**: For common query patterns (patient_id + status)
3. **JSONB Indexes**: GIN indexes on JSONB columns for containment queries
4. **Partial Indexes**: For conditional uniqueness (active shares only)
5. **Text Indexes**: On searchable text fields (test_name, abbreviation)

### Primary Indexes by Table

**Users**:
- `idx_users_email` on email

**Patients**:
- `idx_patients_owner_user_id` on owner_user_id

**Medications**:
- `idx_medications_patient_id` on patient_id
- `idx_medications_patient_status` on (patient_id, status)

**Conditions**:
- `idx_conditions_patient_id` on patient_id
- `idx_conditions_patient_status` on (patient_id, status)

**Lab Results**:
- `idx_lab_results_patient_id` on patient_id
- `idx_lab_results_patient_date` on (patient_id, completed_date)

**Lab Test Components**:
- `idx_lab_test_components_lab_result_id` on lab_result_id
- `idx_lab_test_components_status` on status
- `idx_lab_test_components_category` on category
- `idx_lab_test_components_lab_result_status` on (lab_result_id, status)
- `idx_lab_test_components_lab_result_category` on (lab_result_id, category)
- `idx_lab_test_components_test_name_text` on test_name
- `idx_lab_test_components_abbreviation_text` on abbreviation

**Encounters**:
- `idx_encounters_patient_id` on patient_id

**Immunizations**:
- `idx_immunizations_patient_id` on patient_id

**Procedures**:
- `idx_procedures_patient_id` on patient_id

**Allergies**:
- `idx_allergies_patient_id` on patient_id

**Vitals**:
- `idx_vitals_patient_id` on patient_id

**Entity Files**:
- `idx_entity_type_id` on (entity_type, entity_id)
- `idx_category` on category
- `idx_uploaded_at` on uploaded_at
- `idx_created_at` on created_at
- `idx_storage_backend` on storage_backend
- `idx_paperless_document_id` on paperless_document_id
- `idx_sync_status` on sync_status

**Patient Photos**:
- `idx_patient_photos_patient_id` on patient_id

**User Tags**:
- `idx_user_tags_user_id` on user_id
- `idx_user_tags_tag` on tag

**Report Templates**:
- `idx_report_template_user_id` on user_id
- `idx_report_template_is_active` on is_active (partial)
- `idx_report_template_shared_family` on shared_with_family (partial)
- `idx_report_template_selected_records` on selected_records (GIN)

**Report Audit**:
- `idx_report_audit_user_created` on (user_id, created_at)
- `idx_report_audit_status` on status
- `idx_report_audit_created_at` on created_at

**Family History Shares**:
- `unique_active_family_history_share_partial` UNIQUE on (family_member_id, shared_with_user_id) WHERE is_active = TRUE

### Query Performance Recommendations

1. **Always filter by patient_id first** for patient-specific queries
2. **Use composite indexes** for status + patient_id queries
3. **Leverage JSONB operators** for tag searching with GIN indexes
4. **Use partial indexes** for soft-delete patterns (is_active = TRUE)
5. **Avoid N+1 queries** with proper eager loading (joinedload, selectinload)

### Example Optimized Queries

```python
# Good: Uses composite index
active_meds = session.query(Medication)\
    .filter(Medication.patient_id == patient_id)\
    .filter(Medication.status == 'active')\
    .all()

# Good: Uses JSONB GIN index
tagged_items = session.query(Medication)\
    .filter(Medication.tags.contains(['diabetes']))\
    .all()

# Good: Eager loading to avoid N+1
lab_results = session.query(LabResult)\
    .options(joinedload(LabResult.test_components))\
    .filter(LabResult.patient_id == patient_id)\
    .all()
```

## Constraints

### Primary Key Constraints
- All tables have auto-incrementing Integer primary key named `id`
- No composite primary keys in current schema

### Foreign Key Constraints

**CASCADE DELETE**:
- Patient → All medical records (medications, conditions, lab_results, etc.)
- User → UserPreferences
- LabResult → LabResultFile, LabTestComponent, LabResultCondition
- Condition → ConditionMedication, LabResultCondition
- FamilyMember → FamilyCondition, FamilyHistoryShare
- PatientPhoto → Patient (ON DELETE CASCADE)

**SET NULL**:
- ReportGenerationAudit.user_id (preserve audit if user deleted)

**RESTRICT** (default):
- Most FK constraints prevent deletion if referenced

### Unique Constraints

| Table | Columns | Constraint Name |
|-------|---------|-----------------|
| users | username | Built-in UNIQUE |
| users | email | Built-in UNIQUE |
| users | external_id | Built-in UNIQUE |
| user_preferences | user_id | Built-in UNIQUE |
| patient_shares | (patient_id, shared_with_user_id) | unique_patient_share |
| patient_photos | patient_id | uq_patient_photo |
| user_tags | (user_id, tag) | uq_user_tag |
| report_templates | (user_id, name) | unique_user_template_name |
| family_history_shares | (family_member_id, shared_with_user_id) WHERE is_active | unique_active_family_history_share_partial |

### Check Constraints

- **Implicit**: NOT NULL constraints on required fields
- **Future**: Could add check constraints for:
  - Valid email format
  - Positive numeric values (height, weight)
  - Date range validations (end_date >= start_date)

## Migration Strategy

### Alembic Configuration

**Location**: `alembic/migrations/`
**Config**: `alembic.ini`
**Environment**: `alembic/migrations/env.py`

### Migration File Template

```python
"""Description of migration

Revision ID: xxxxx
Revises: yyyyy
Create Date: 2024-01-01 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'xxxxx'
down_revision = 'yyyyy'
branch_labels = None
depends_on = None

def upgrade():
    # Forward migration
    op.create_table(
        'table_name',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_table_name_field', 'table_name', ['field'])

def downgrade():
    # Rollback migration
    op.drop_index('idx_table_name_field', 'table_name')
    op.drop_table('table_name')
```

### Creating Migrations

```bash
# Auto-generate migration from model changes
.venv/Scripts/python.exe -m alembic revision --autogenerate -m "description"

# Create blank migration for data changes
.venv/Scripts/python.exe -m alembic revision -m "description"
```

### Applying Migrations

```bash
# Upgrade to latest version
.venv/Scripts/python.exe -m alembic upgrade head

# Upgrade one version
.venv/Scripts/python.exe -m alembic upgrade +1

# Downgrade one version
.venv/Scripts/python.exe -m alembic downgrade -1

# View current version
.venv/Scripts/python.exe -m alembic current

# View migration history
.venv/Scripts/python.exe -m alembic history
```

### Migration Best Practices

1. **Always Reversible**: Every upgrade() must have corresponding downgrade()
2. **Test Rollback**: Test downgrade before deploying to production
3. **Data Migrations**: Use separate migrations for schema vs. data changes
4. **No Direct Model Changes**: Migrations should be self-contained
5. **Batch Operations**: Use batch_alter_table for SQLite compatibility
6. **Index Creation**: Create indexes in same migration as table
7. **Foreign Keys**: Add FKs after both tables exist

### Example: Adding Column Migration

```python
def upgrade():
    op.add_column('patients',
        sa.Column('new_field', sa.String(100), nullable=True)
    )
    op.create_index('idx_patients_new_field', 'patients', ['new_field'])

def downgrade():
    op.drop_index('idx_patients_new_field', 'patients')
    op.drop_column('patients', 'new_field')
```

### Example: Data Migration

```python
def upgrade():
    # Schema change
    op.add_column('medications', sa.Column('status_new', sa.String(20)))

    # Data migration
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE medications
        SET status_new = CASE
            WHEN status = 'stopped' THEN 'inactive'
            WHEN status = 'on-hold' THEN 'on_hold'
            ELSE status
        END
    """))

    # Complete schema change
    op.drop_column('medications', 'status')
    op.alter_column('medications', 'status_new', new_column_name='status')
```

## Data Integrity

### Referential Integrity Rules

**Patient-Centric Design**:
- All medical records require valid patient_id
- Patient deletion cascades to all related records
- Orphaned records prevented by FK constraints

**User Ownership**:
- Patients must have owner_user_id
- User deletion restricted if owns patients
- Soft delete recommended for users

**Junction Table Integrity**:
- LabResultCondition: Both lab_result_id and condition_id required
- ConditionMedication: Both condition_id and medication_id required
- Cascade deletes when parent entities removed

### Cascade Delete Behaviors

**Full Cascade** (patient deletion removes all):
- medications, conditions, lab_results
- encounters, immunizations, procedures
- treatments, allergies, vitals
- emergency_contacts, family_members
- insurances, shares, photo

**Partial Cascade**:
- LabResult → files, test_components, condition_relationships
- Condition → medication_relationships, lab_result_relationships
- FamilyMember → family_conditions, shares

**Preserve Audit**:
- ReportGenerationAudit.user_id SET NULL on user delete
- ActivityLog preserves user actions after user deletion

### Soft Delete Patterns

**Boolean Flags**:
- `is_active` in: patient_shares, family_history_shares, report_templates
- `is_active` in emergency_contacts
- Allows historical record preservation

**Status-Based**:
- Medication.status = 'cancelled'
- Condition.status = 'inactive'
- Invitation.status = 'cancelled'

### Audit Fields

**Standard Audit Trail**:
- `created_at`: Record creation timestamp (NOT NULL)
- `updated_at`: Last modification timestamp (NOT NULL, auto-update)

**Present in All Tables Except**:
- Junction tables (have own created_at/updated_at)
- Reference tables without updates

**Timezone Awareness**:
- All timestamps use `get_utc_now()` for UTC consistency
- Frontend responsible for timezone conversion

### Data Validation Rules

**Application Level** (via Pydantic schemas):
- Email format validation
- Date range validation (end >= start)
- Enum value validation
- Required field enforcement

**Database Level**:
- NOT NULL constraints
- UNIQUE constraints
- Foreign key constraints
- Check constraints (future enhancement)

### Backup and Recovery Recommendations

**Database Backups**:
1. Daily full backups with pg_dump
2. Continuous WAL archiving for point-in-time recovery
3. Test restore procedures monthly
4. Store backups in geographically distributed locations

**File Backups**:
1. Backup uploads/ directory separately
2. Sync with Paperless-ngx for DMS backup
3. Verify file integrity with checksums

**Backup Verification**:
- Use backup_records table to track backups
- Store checksums for integrity verification
- Regular restore testing to non-production environment

### Data Privacy and Security

**PHI Protection**:
- Never log patient names with medical data
- Encrypt data at rest (database-level encryption)
- Encrypt data in transit (SSL/TLS)
- Access control via user permissions

**Audit Requirements**:
- activity_log tracks all data access
- report_generation_audit tracks exports
- User actions logged with timestamps

**Retention Policies**:
- Medical records: 7-10 years (configurable)
- Audit logs: 3 years minimum
- Backups: 30 days minimum

---

## Query Examples

### Common Query Patterns

**Get Active Medications for Patient**:
```python
from sqlalchemy import select

stmt = select(Medication)\
    .where(Medication.patient_id == patient_id)\
    .where(Medication.status == 'active')\
    .order_by(Medication.medication_name)
```

**Get Lab Results with Components**:
```python
from sqlalchemy.orm import selectinload

stmt = select(LabResult)\
    .options(selectinload(LabResult.test_components))\
    .where(LabResult.patient_id == patient_id)\
    .where(LabResult.status == 'completed')\
    .order_by(LabResult.completed_date.desc())
```

**Get Conditions with Related Medications**:
```python
from sqlalchemy.orm import joinedload

stmt = select(Condition)\
    .options(
        joinedload(Condition.medication_relationships)
        .joinedload(ConditionMedication.medication)
    )\
    .where(Condition.patient_id == patient_id)\
    .where(Condition.status == 'active')
```

**Search by Tags (JSONB)**:
```python
from sqlalchemy.dialects.postgresql import JSONB

stmt = select(Medication)\
    .where(Medication.patient_id == patient_id)\
    .where(Medication.tags.contains(['diabetes']))
```

**Get Shared Patients for User**:
```python
stmt = select(Patient)\
    .join(PatientShare, Patient.id == PatientShare.patient_id)\
    .where(PatientShare.shared_with_user_id == user_id)\
    .where(PatientShare.is_active == True)
```

---

## Appendix: Enum Reference

### Complete Enum Definitions

**ConditionStatus**:
- active, inactive, resolved, chronic, recurrence, relapse

**MedicationStatus**:
- active, stopped, on-hold, completed, cancelled

**AllergyStatus**:
- active, inactive, resolved, unconfirmed

**LabResultStatus**:
- ordered, in_progress, completed, cancelled

**ProcedureStatus**:
- scheduled, in_progress, completed, cancelled

**TreatmentStatus**:
- active, in_progress, completed, cancelled, on_hold

**EncounterPriority**:
- routine, urgent, emergency

**SeverityLevel**:
- mild, moderate, severe, life-threatening

**FamilyRelationship**:
- father, mother, brother, sister
- paternal_grandfather, paternal_grandmother
- maternal_grandfather, maternal_grandmother
- uncle, aunt, cousin, other

**ConditionType**:
- cardiovascular, diabetes, cancer
- mental_health, neurological
- autoimmune, genetic
- respiratory, endocrine, other

**InsuranceType**:
- medical, dental, vision, prescription

**InsuranceStatus**:
- active, inactive, expired, pending

---

## Schema Diagram Legend

```
Symbols Used:
─────  Relationship line
──────> One-to-many relationship
<─────> Many-to-many relationship
FK()   Foreign key reference
PK     Primary key
UNIQUE Unique constraint
INDEX  Index exists
```

---

**Document Version**: 1.0
**Last Updated**: 2024-01-04
**Maintained By**: Development Team
**Related Documentation**:
- [01-architecture.md](01-architecture.md)
- [02-api-reference.md](02-api-reference.md)
