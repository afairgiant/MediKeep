# MediKeep Database Schema Documentation

## Table of Contents
- [Database Overview](#database-overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Core Tables](#core-tables)
- [Medical Record Tables](#medical-record-tables)
- [Symptom System Tables](#symptom-system-tables)
- [Injury System Tables](#injury-system-tables)
- [Reference Tables](#reference-tables)
- [Family History Tables](#family-history-tables)
- [File Management Tables](#file-management-tables)
- [Sharing & Collaboration Tables](#sharing--collaboration-tables)
- [Notification System Tables](#notification-system-tables)
- [Reporting Tables](#reporting-tables)
- [Admin Tables](#admin-tables)
- [System Tables](#system-tables)
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
- `notification_channels`: One-to-many with NotificationChannel (cascade delete)

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
| relationship_to_self | String | | Use RelationshipToSelf enum (see Enum Reference) |
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
- `symptoms`: One-to-many with Symptom (cascade delete)
- `injuries`: One-to-many with Injury (cascade delete)
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
| medication_type | String(20) | NOT NULL, DEFAULT 'prescription' | Use MedicationType enum |
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

**Type Values** (MedicationType enum):
- prescription
- otc
- supplement
- herbal

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `pharmacy`: Many-to-one with Pharmacy
- `allergies`: One-to-many with Allergy
- `condition_relationships`: One-to-many with ConditionMedication
- `symptom_relationships`: One-to-many with SymptomMedication
- `injury_relationships`: One-to-many with InjuryMedication

**Indexes**:
- `idx_medications_patient_id` on patient_id
- `idx_medications_patient_status` on (patient_id, status)
- `idx_medications_patient_type` on (patient_id, medication_type)

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
- `symptom_relationships`: One-to-many with SymptomCondition
- `injury_relationships`: One-to-many with InjuryCondition

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
| canonical_test_name | String | | Standardized test name for trending |
| notes | Text | | Component-specific notes |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `lab_result`: Many-to-one with LabResult

**Indexes**:
- `idx_lab_test_components_lab_result_id` on lab_result_id
- `idx_lab_test_components_status` on status
- `idx_lab_test_components_category` on category
- `ix_lab_test_components_canonical_test_name` on canonical_test_name
- `idx_lab_test_components_lab_result_status` on (lab_result_id, status)
- `idx_lab_test_components_lab_result_category` on (lab_result_id, category)
- `idx_lab_test_components_test_name_text` on test_name
- `idx_lab_test_components_abbreviation_text` on abbreviation

**Business Rules**:
- Cascade deletes with parent lab_result
- Status auto-calculated from value vs. reference range
- display_order used for consistent UI presentation
- canonical_test_name links to standardized_tests for consistent trending across lab results

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
| a1c | Float | | Hemoglobin A1C (%) |
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
| outcome | String | | ProcedureOutcome enum value |
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
- postponed

**Outcome Values** (ProcedureOutcome enum):
- successful
- abnormal
- complications
- inconclusive
- pending

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `condition`: Many-to-one with Condition
- `injury_relationships`: One-to-many with InjuryProcedure

**Indexes**:
- `idx_procedures_patient_id` on patient_id

**Business Rules**:
- Procedure name and date required
- condition_id links procedure to diagnosis
- Status workflow: scheduled -> in_progress -> completed (or postponed/cancelled)

### treatments
**Purpose**: Patient treatment plans and therapies

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique treatment ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| practitioner_id | Integer | FK(practitioners.id) | Prescribing practitioner |
| condition_id | Integer | FK(conditions.id) | Related condition |
| treatment_name | String | NOT NULL | Treatment name |
| treatment_type | String | | Type of treatment (optional) |
| start_date | Date | | Treatment start date (optional) |
| end_date | Date | | Treatment end date |
| status | String | | TreatmentStatus enum value |
| treatment_category | String | | inpatient, outpatient |
| notes | String | | Additional notes |
| frequency | String | | Treatment frequency |
| outcome | String | | Expected/actual outcome |
| description | String | | Treatment description |
| location | String | | Where administered |
| dosage | String | | Treatment dosage |
| mode | String | NOT NULL, DEFAULT 'simple' | Treatment mode: 'simple' or 'advanced' |
| tags | JSONB | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Mode Values**:
- `simple` (default) - Basic treatment tracking with schedule and dosage on the treatment itself
- `advanced` - Medication-centric treatment plan where dosage/schedule lives on per-medication overrides

**Status Values** (TreatmentStatus enum):
- planned
- active
- in_progress
- completed
- cancelled
- on_hold

**Relationships**:
- `patient`: Many-to-one with Patient
- `practitioner`: Many-to-one with Practitioner
- `condition`: Many-to-one with Condition
- `medication_relationships`: One-to-many with TreatmentMedication
- `encounter_relationships`: One-to-many with TreatmentEncounter
- `lab_result_relationships`: One-to-many with TreatmentLabResult
- `equipment_relationships`: One-to-many with TreatmentEquipment
- `symptom_relationships`: One-to-many with SymptomTreatment
- `injury_relationships`: One-to-many with InjuryTreatment

**Business Rules**:
- Treatment name is required; type and start date are optional
- end_date set when status changes to completed
- condition_id links treatment to diagnosis
- Mode defaults to 'simple' for backwards compatibility; existing treatments are unaffected

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

## Symptom System Tables

### symptoms
**Purpose**: Parent symptom definitions/types (e.g., "Migraine", "Back Pain")

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique symptom ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| symptom_name | String(200) | NOT NULL | Name of the symptom |
| category | String(100) | | Category (e.g., "Neurological", "Gastrointestinal") |
| status | String(50) | NOT NULL, DEFAULT 'active' | SymptomStatus enum value |
| is_chronic | Boolean | NOT NULL, DEFAULT FALSE | Whether symptom is chronic |
| first_occurrence_date | Date | NOT NULL | Date of first occurrence |
| last_occurrence_date | Date | | Date of most recent occurrence |
| typical_triggers | JSON | DEFAULT [] | Common triggers for this symptom |
| general_notes | Text | | General notes about the symptom |
| tags | JSON | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Status Values** (SymptomStatus enum):
- active
- resolved
- recurring

**Relationships**:
- `patient`: Many-to-one with Patient
- `occurrences`: One-to-many with SymptomOccurrence (cascade delete)
- `condition_relationships`: One-to-many with SymptomCondition (cascade delete)
- `medication_relationships`: One-to-many with SymptomMedication (cascade delete)
- `treatment_relationships`: One-to-many with SymptomTreatment (cascade delete)

**Indexes**:
- `idx_symptoms_patient_id` on patient_id
- `idx_symptoms_patient_name` on (patient_id, symptom_name)
- `idx_symptoms_status` on status
- `idx_symptoms_is_chronic` on is_chronic

**Business Rules**:
- Symptom name and first occurrence date are required
- Individual episodes tracked in SymptomOccurrence table
- Chronic symptoms flagged with is_chronic
- Cascade deletes all related occurrences and junction table entries

### symptom_occurrences
**Purpose**: Individual episodes/occurrences of a symptom

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique occurrence ID |
| symptom_id | Integer | FK(symptoms.id), NOT NULL | Parent symptom |
| occurrence_date | Date | NOT NULL | Date of this episode |
| severity | String(50) | NOT NULL | SymptomSeverity enum value |
| pain_scale | Integer | | Pain scale 0-10 |
| duration | String(100) | | Duration description (e.g., "30 minutes", "2 hours") |
| time_of_day | String(50) | | morning, afternoon, evening, night (legacy) |
| occurrence_time | Time | | Precise time when episode started |
| location | String(200) | | Body part/area affected |
| triggers | JSON | DEFAULT [] | Specific triggers for this occurrence |
| relief_methods | JSON | DEFAULT [] | What helped relieve symptoms |
| associated_symptoms | JSON | DEFAULT [] | Other symptoms present during episode |
| impact_level | String(50) | | no_impact, mild, moderate, severe, debilitating |
| resolved_date | Date | | When episode resolved |
| resolved_time | Time | | Time when episode resolved |
| resolution_notes | Text | | Notes about resolution |
| notes | Text | | Notes specific to this occurrence |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Severity Values** (SymptomSeverity enum):
- mild
- moderate
- severe
- critical

**Relationships**:
- `symptom`: Many-to-one with Symptom

**Indexes**:
- `idx_symptom_occ_symptom_id` on symptom_id
- `idx_symptom_occ_date` on occurrence_date
- `idx_symptom_occ_severity` on severity
- `idx_symptom_occ_symptom_date` on (symptom_id, occurrence_date)

**Business Rules**:
- Each occurrence is linked to a parent symptom
- Cascade deletes with parent symptom
- Tracks detailed episode information including triggers, relief methods, and impact

## Injury System Tables

### injury_types
**Purpose**: Reusable injury type definitions for dropdown selection

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique injury type ID |
| name | String(100) | NOT NULL, UNIQUE | Injury type name |
| description | String(300) | | Description of injury type |
| is_system | Boolean | NOT NULL, DEFAULT FALSE | System-defined (cannot be deleted) |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `injuries`: One-to-many with Injury

**Indexes**:
- `idx_injury_types_name` on name
- `idx_injury_types_is_system` on is_system

**Business Rules**:
- Injury type names must be unique
- System types (is_system=True) are seeded defaults and cannot be deleted
- Users can create custom injury types

### injuries
**Purpose**: Patient injury records (sprains, fractures, burns, etc.)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique injury ID |
| patient_id | Integer | FK(patients.id), NOT NULL | Associated patient |
| injury_name | String(300) | NOT NULL | Name/description of injury |
| injury_type_id | Integer | FK(injury_types.id) | Injury type reference |
| body_part | String(100) | NOT NULL | Affected body part |
| laterality | String(20) | | Laterality enum value |
| date_of_injury | Date | | Date injury occurred |
| mechanism | String(500) | | How the injury occurred |
| severity | String(50) | | SeverityLevel enum value |
| status | String(50) | NOT NULL, DEFAULT 'active' | InjuryStatus enum value |
| treatment_received | Text | | Treatment description |
| recovery_notes | Text | | Recovery progress notes |
| practitioner_id | Integer | FK(practitioners.id) | Treating practitioner |
| notes | Text | | Additional notes |
| tags | JSON | DEFAULT [] | User tags |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Status Values** (InjuryStatus enum):
- active - Currently being treated
- healing - In recovery
- resolved - Fully healed
- chronic - Long-term/permanent effects

**Laterality Values** (Laterality enum):
- left
- right
- bilateral
- not_applicable

**Relationships**:
- `patient`: Many-to-one with Patient
- `injury_type`: Many-to-one with InjuryType
- `practitioner`: Many-to-one with Practitioner
- `medication_relationships`: One-to-many with InjuryMedication (cascade delete)
- `condition_relationships`: One-to-many with InjuryCondition (cascade delete)
- `treatment_relationships`: One-to-many with InjuryTreatment (cascade delete)
- `procedure_relationships`: One-to-many with InjuryProcedure (cascade delete)

**Indexes**:
- `idx_injuries_patient_id` on patient_id
- `idx_injuries_patient_status` on (patient_id, status)
- `idx_injuries_injury_type` on injury_type_id
- `idx_injuries_date` on date_of_injury

**Business Rules**:
- Injury name and body part are required
- Date of injury is optional (user may not remember exact date)
- Laterality specifies which side of body (left, right, bilateral, or not applicable)
- Can be linked to medications, conditions, treatments, and procedures through junction tables

## Reference Tables

### practitioners
**Purpose**: Healthcare provider directory

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique practitioner ID |
| name | String | NOT NULL | Practitioner's name |
| specialty | String | NOT NULL | Medical specialty |
| practice | String | | Practice/clinic name (optional) |
| phone_number | String | | Contact phone |
| email | String | | Email address |
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
- `injuries`: One-to-many with Injury

**Business Rules**:
- Name and specialty are required
- Practice is optional (not all practitioners are linked to a practice)
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
| state | String | | State / Province |
| zip_code | String | | Postal / ZIP code (international) |
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

## Notification System Tables

### notification_channels
**Purpose**: User notification channels (Discord, Email, Gotify, Webhook)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique channel ID |
| user_id | Integer | FK(users.id), NOT NULL | Channel owner |
| name | String(100) | NOT NULL | Channel display name |
| channel_type | String(20) | NOT NULL | discord, email, gotify, webhook |
| config_encrypted | Text | NOT NULL | Encrypted JSON configuration |
| is_enabled | Boolean | NOT NULL, DEFAULT TRUE | Channel enabled status |
| is_verified | Boolean | NOT NULL, DEFAULT FALSE | Verification status |
| last_test_at | DateTime | | Last test notification timestamp |
| last_test_status | String(20) | | Last test result status |
| last_used_at | DateTime | | Last successful notification |
| total_notifications_sent | Integer | NOT NULL, DEFAULT 0 | Total notifications sent |
| created_at | DateTime | NOT NULL | Channel creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Channel Types**:
- discord - Discord webhook integration
- email - Email notification
- gotify - Gotify push notification
- webhook - Generic HTTP webhook

**Relationships**:
- `user`: Many-to-one with User
- `preferences`: One-to-many with NotificationPreference (cascade delete)
- `history`: One-to-many with NotificationHistory

**Indexes**:
- `idx_notification_channels_user_id` on user_id

**Constraints**:
- `uq_user_channel_name` UNIQUE on (user_id, name)

**Business Rules**:
- Configuration stored encrypted for security
- Channel must be verified before sending notifications
- Cascade deletes with user account
- Channel name unique per user

### notification_preferences
**Purpose**: Event-channel preferences (which events go to which channels)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique preference ID |
| user_id | Integer | FK(users.id), NOT NULL | Preference owner |
| channel_id | Integer | FK(notification_channels.id), NOT NULL | Target channel |
| event_type | String(50) | NOT NULL | Event type identifier |
| is_enabled | Boolean | NOT NULL, DEFAULT TRUE | Preference enabled status |
| remind_before_minutes | Integer | | Reminder lead time in minutes |
| created_at | DateTime | NOT NULL | Preference creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Event Types** (examples):
- backup_completed
- backup_failed
- medication_reminder
- appointment_reminder
- lab_result_ready

**Relationships**:
- `user`: Many-to-one with User
- `channel`: Many-to-one with NotificationChannel

**Indexes**:
- `idx_notification_prefs_user_id` on user_id
- `idx_notification_prefs_channel_id` on channel_id
- `idx_notification_prefs_event_type` on event_type

**Constraints**:
- `uq_user_channel_event` UNIQUE on (user_id, channel_id, event_type)

**Business Rules**:
- Each event can be sent to multiple channels
- Cascade deletes with channel
- remind_before_minutes for advance notifications

### notification_history
**Purpose**: Sent notification audit trail

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique history ID |
| user_id | Integer | FK(users.id) | Target user (SET NULL on delete) |
| channel_id | Integer | FK(notification_channels.id) | Delivery channel (SET NULL on delete) |
| event_type | String(50) | NOT NULL | Event type that triggered notification |
| event_data | JSON | | Event-specific data |
| title | String(255) | NOT NULL | Notification title |
| message_preview | String(500) | | Message preview text |
| status | String(20) | NOT NULL | pending, sent, failed |
| attempt_count | Integer | NOT NULL, DEFAULT 1 | Delivery attempts |
| error_message | Text | | Error details if failed |
| created_at | DateTime | NOT NULL | Notification creation timestamp |
| sent_at | DateTime | | Successful delivery timestamp |

**Status Values**:
- pending - Awaiting delivery
- sent - Successfully delivered
- failed - Delivery failed

**Relationships**:
- `user`: Many-to-one with User (SET NULL on delete)
- `channel`: Many-to-one with NotificationChannel (SET NULL on delete)

**Indexes**:
- `idx_notification_history_user_id` on user_id
- `idx_notification_history_status` on status
- `idx_notification_history_created_at` on created_at
- `idx_notification_history_event_type` on event_type

**Business Rules**:
- Preserves audit trail even if user/channel deleted (SET NULL)
- Tracks delivery attempts and errors for troubleshooting
- sent_at populated only on successful delivery

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

### activity_logs
**Purpose**: Centralized activity logging for audit trails

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique log entry ID |
| user_id | Integer | FK(users.id) | User who performed action |
| patient_id | Integer | FK(patients.id) | Affected patient (if applicable) |
| action | String | NOT NULL | Action type (created, updated, deleted, viewed, etc.) |
| entity_type | String | NOT NULL | Type of entity affected |
| entity_id | Integer | | ID of affected record |
| description | Text | NOT NULL | Human-readable description |
| event_metadata | JSON | | Additional context (changes, etc.) |
| timestamp | DateTime | NOT NULL | When action occurred |
| ip_address | String | | Client IP address |
| user_agent | String | | Client user agent |

**Action Types**:
- created, updated, deleted, viewed
- uploaded, downloaded
- login, logout
- activated, deactivated, completed, cancelled
- backup_created, maintenance_started, maintenance_completed

**Entity Types**:
- user, patient, practitioner
- medication, lab_result, lab_result_file, lab_test_component
- condition, treatment, immunization, allergy, procedure, encounter
- emergency_contact, pharmacy, family_member, insurance, family_condition
- vitals, symptom, injury, injury_type
- entity_file, system, backup

**Relationships**:
- `user`: Many-to-one with User
- `patient`: Many-to-one with Patient

**Indexes**:
- `idx_activity_user_timestamp` on (user_id, timestamp)
- `idx_activity_patient_timestamp` on (patient_id, timestamp)
- `idx_activity_entity` on (entity_type, entity_id)
- `idx_activity_timestamp` on timestamp
- `idx_activity_action` on action

**Business Rules**:
- Logs all critical user actions
- Maintains audit trail for compliance
- event_metadata stores additional context as JSON
- Preserves logs even if user/patient deleted

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

## System Tables

### system_settings
**Purpose**: System-wide key-value configuration store

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| key | String(100) | PRIMARY KEY | Setting key name |
| value | Text | | Setting value |
| created_at | DateTime | NOT NULL | Setting creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Example Keys**:
- `test_library_version` - Version of standardized test library
- `canonical_name_migration_complete` - Migration status flag
- `last_sync_timestamp` - Last synchronization time
- Feature flags and configuration values

**Business Rules**:
- Key is the primary key (no auto-increment ID)
- Value stored as text, application interprets type
- Used for feature flags, migration status, library versions

### standardized_tests
**Purpose**: LOINC test definitions for autocomplete and validation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique test definition ID |
| loinc_code | String(20) | UNIQUE | LOINC code identifier |
| test_name | String(255) | NOT NULL | Full test name |
| short_name | String(100) | | Abbreviated name |
| default_unit | String(50) | | Default unit of measurement |
| category | String(50) | | Test category |
| common_names | JSON | | Alternative test names |
| is_common | Boolean | NOT NULL, DEFAULT FALSE | Commonly used test flag |
| system | String(100) | | Body system/specimen |
| loinc_class | String(100) | | LOINC classification |
| display_order | Integer | | Sort order for display |
| created_at | DateTime | NOT NULL | Record creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- Referenced by LabTestComponent.canonical_test_name for trending

**Indexes**:
- `idx_standardized_tests_loinc_code` on loinc_code (UNIQUE)
- `idx_standardized_tests_test_name` on test_name
- `idx_standardized_tests_category` on category
- `idx_standardized_tests_is_common` on is_common
- `idx_standardized_tests_short_name` on short_name

**Business Rules**:
- LOINC codes provide standardized test identification
- Used for autocomplete in lab test component entry
- is_common flag prioritizes frequently used tests
- Enables consistent trending across different lab results

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

### treatment_medications
**Purpose**: Many-to-many relationship between treatments and medications, with optional treatment-specific overrides

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| treatment_id | Integer | FK(treatments.id), NOT NULL | Associated treatment |
| medication_id | Integer | FK(medications.id), NOT NULL | Associated medication |
| specific_dosage | String | | Treatment-specific dosage override |
| specific_frequency | String | | Treatment-specific frequency override |
| specific_duration | String | | Treatment-specific duration |
| timing_instructions | String | | When/how to take medication |
| relevance_note | String | | Clinical context for this relationship |
| specific_prescriber_id | Integer | FK(practitioners.id), ON DELETE SET NULL | Treatment-specific prescriber override |
| specific_pharmacy_id | Integer | FK(pharmacies.id), ON DELETE SET NULL | Treatment-specific pharmacy override |
| specific_start_date | Date | | Treatment-specific start date override |
| specific_end_date | Date | | Treatment-specific end date override |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `treatment`: Many-to-one with Treatment
- `medication`: Many-to-one with Medication
- `specific_prescriber`: Many-to-one with Practitioner
- `specific_pharmacy`: Many-to-one with Pharmacy

**Indexes**:
- `idx_treatment_medication_treatment_id` on treatment_id
- `idx_treatment_medication_medication_id` on medication_id
- `idx_treatment_medication_prescriber_id` on specific_prescriber_id
- `idx_treatment_medication_pharmacy_id` on specific_pharmacy_id

**Constraints**:
- `uq_treatment_medication` UNIQUE on (treatment_id, medication_id)

**Business Rules**:
- Links medications to treatment plans
- Override fields (`specific_*`) are optional; when null, the API computes effective values by falling back to the base medication's corresponding field
- `specific_end_date` must be on or after `specific_start_date` if both are set
- Smart end date logic: if `specific_start_date` is set but `specific_end_date` is not, and the medication's `effective_period_end` is before the overridden start, the effective end date is returned as null (ongoing)
- Cascade deletes with either parent
- Only one relationship per treatment/medication pair

### treatment_encounters
**Purpose**: Many-to-many relationship between treatments and encounters

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| treatment_id | Integer | FK(treatments.id), NOT NULL | Associated treatment |
| encounter_id | Integer | FK(encounters.id), NOT NULL | Associated encounter |
| relevance_note | String | | Clinical context for this relationship |
| visit_label | String | | Visit type: initial, follow_up, review, final |
| visit_sequence | Integer | | Order of visits: 1, 2, 3... |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `treatment`: Many-to-one with Treatment
- `encounter`: Many-to-one with Encounter

**Indexes**:
- `idx_treatment_encounter_treatment_id` on treatment_id
- `idx_treatment_encounter_encounter_id` on encounter_id

**Constraints**:
- `uq_treatment_encounter` UNIQUE on (treatment_id, encounter_id)

### treatment_lab_results
**Purpose**: Many-to-many relationship between treatments and lab results

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| treatment_id | Integer | FK(treatments.id), NOT NULL | Associated treatment |
| lab_result_id | Integer | FK(lab_results.id), NOT NULL | Associated lab result |
| relevance_note | String | | Clinical context for this relationship |
| purpose | String | | baseline, monitoring, outcome, safety |
| expected_frequency | String | | e.g., "Monthly", "Every 3 months" |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `treatment`: Many-to-one with Treatment
- `lab_result`: Many-to-one with LabResult

**Indexes**:
- `idx_treatment_lab_result_treatment_id` on treatment_id
- `idx_treatment_lab_result_lab_result_id` on lab_result_id

**Constraints**:
- `uq_treatment_lab_result` UNIQUE on (treatment_id, lab_result_id)

### treatment_equipment
**Purpose**: Many-to-many relationship between treatments and medical equipment

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| treatment_id | Integer | FK(treatments.id), NOT NULL | Associated treatment |
| equipment_id | Integer | FK(medical_equipment.id), NOT NULL | Associated equipment |
| relevance_note | String | | Clinical context for this relationship |
| usage_frequency | String | | e.g., "Nightly", "As needed" |
| specific_settings | String | | e.g., "Pressure: 10 cmH2O" |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `treatment`: Many-to-one with Treatment
- `equipment`: Many-to-one with MedicalEquipment

**Indexes**:
- `idx_treatment_equipment_treatment_id` on treatment_id
- `idx_treatment_equipment_equipment_id` on equipment_id

**Constraints**:
- `uq_treatment_equipment` UNIQUE on (treatment_id, equipment_id)

### symptom_conditions
**Purpose**: Many-to-many relationship between symptoms and conditions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| symptom_id | Integer | FK(symptoms.id), NOT NULL | Associated symptom |
| condition_id | Integer | FK(conditions.id), NOT NULL | Associated condition |
| relevance_note | String | | How symptom relates to condition |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `symptom`: Many-to-one with Symptom
- `condition`: Many-to-one with Condition

**Indexes**:
- `idx_symptom_condition_symptom_id` on symptom_id
- `idx_symptom_condition_condition_id` on condition_id

**Constraints**:
- `uq_symptom_condition` UNIQUE on (symptom_id, condition_id)

**Business Rules**:
- Links symptoms to related conditions
- Cascade deletes with either parent
- Only one relationship per symptom/condition pair

### symptom_medications
**Purpose**: Many-to-many relationship between symptoms and medications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| symptom_id | Integer | FK(symptoms.id), NOT NULL | Associated symptom |
| medication_id | Integer | FK(medications.id), NOT NULL | Associated medication |
| relationship_type | String | NOT NULL, DEFAULT 'related_to' | side_effect, helped_by, related_to |
| relevance_note | String | | How medication relates to symptom |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationship Types**:
- side_effect - Medication may cause this symptom
- helped_by - Medication helps relieve this symptom
- related_to - General relationship

**Relationships**:
- `symptom`: Many-to-one with Symptom
- `medication`: Many-to-one with Medication

**Indexes**:
- `idx_symptom_medication_symptom_id` on symptom_id
- `idx_symptom_medication_medication_id` on medication_id

**Constraints**:
- `uq_symptom_medication` UNIQUE on (symptom_id, medication_id)

**Business Rules**:
- Tracks whether medication causes, helps, or is related to symptom
- Cascade deletes with either parent
- Only one relationship per symptom/medication pair

### symptom_treatments
**Purpose**: Many-to-many relationship between symptoms and treatments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| symptom_id | Integer | FK(symptoms.id), NOT NULL | Associated symptom |
| treatment_id | Integer | FK(treatments.id), NOT NULL | Associated treatment |
| relevance_note | String | | How treatment relates to symptom |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `symptom`: Many-to-one with Symptom
- `treatment`: Many-to-one with Treatment

**Indexes**:
- `idx_symptom_treatment_symptom_id` on symptom_id
- `idx_symptom_treatment_treatment_id` on treatment_id

**Constraints**:
- `uq_symptom_treatment` UNIQUE on (symptom_id, treatment_id)

**Business Rules**:
- Links symptoms to treatments addressing them
- Cascade deletes with either parent
- Only one relationship per symptom/treatment pair

### injury_medications
**Purpose**: Many-to-many relationship between injuries and medications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| injury_id | Integer | FK(injuries.id), NOT NULL | Associated injury |
| medication_id | Integer | FK(medications.id), NOT NULL | Associated medication |
| relevance_note | String | | How medication relates to injury |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `injury`: Many-to-one with Injury
- `medication`: Many-to-one with Medication

**Indexes**:
- `idx_injury_medication_injury_id` on injury_id
- `idx_injury_medication_medication_id` on medication_id

**Constraints**:
- `uq_injury_medication` UNIQUE on (injury_id, medication_id)

**Business Rules**:
- Links medications used to treat injuries
- Cascade deletes with either parent
- Only one relationship per injury/medication pair

### injury_conditions
**Purpose**: Many-to-many relationship between injuries and conditions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| injury_id | Integer | FK(injuries.id), NOT NULL | Associated injury |
| condition_id | Integer | FK(conditions.id), NOT NULL | Associated condition |
| relevance_note | String | | How condition relates to injury |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `injury`: Many-to-one with Injury
- `condition`: Many-to-one with Condition

**Indexes**:
- `idx_injury_condition_injury_id` on injury_id
- `idx_injury_condition_condition_id` on condition_id

**Constraints**:
- `uq_injury_condition` UNIQUE on (injury_id, condition_id)

**Business Rules**:
- Links conditions that resulted from or are related to injuries
- Cascade deletes with either parent
- Only one relationship per injury/condition pair

### injury_treatments
**Purpose**: Many-to-many relationship between injuries and treatments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| injury_id | Integer | FK(injuries.id), NOT NULL | Associated injury |
| treatment_id | Integer | FK(treatments.id), NOT NULL | Associated treatment |
| relevance_note | String | | How treatment relates to injury |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `injury`: Many-to-one with Injury
- `treatment`: Many-to-one with Treatment

**Indexes**:
- `idx_injury_treatment_injury_id` on injury_id
- `idx_injury_treatment_treatment_id` on treatment_id

**Constraints**:
- `uq_injury_treatment` UNIQUE on (injury_id, treatment_id)

**Business Rules**:
- Links treatments used for injury recovery
- Cascade deletes with either parent
- Only one relationship per injury/treatment pair

### injury_procedures
**Purpose**: Many-to-many relationship between injuries and procedures

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | Integer | PRIMARY KEY | Unique relationship ID |
| injury_id | Integer | FK(injuries.id), NOT NULL | Associated injury |
| procedure_id | Integer | FK(procedures.id), NOT NULL | Associated procedure |
| relevance_note | String | | How procedure relates to injury |
| created_at | DateTime | NOT NULL | Relationship creation timestamp |
| updated_at | DateTime | NOT NULL | Last modification timestamp |

**Relationships**:
- `injury`: Many-to-one with Injury
- `procedure`: Many-to-one with Procedure

**Indexes**:
- `idx_injury_procedure_injury_id` on injury_id
- `idx_injury_procedure_procedure_id` on procedure_id

**Constraints**:
- `uq_injury_procedure` UNIQUE on (injury_id, procedure_id)

**Business Rules**:
- Links procedures performed to treat injuries
- Cascade deletes with either parent
- Only one relationship per injury/procedure pair

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
- `ix_lab_test_components_canonical_test_name` on canonical_test_name
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

**Symptoms**:
- `idx_symptoms_patient_id` on patient_id
- `idx_symptoms_patient_name` on (patient_id, symptom_name)
- `idx_symptoms_status` on status
- `idx_symptoms_is_chronic` on is_chronic

**Symptom Occurrences**:
- `idx_symptom_occ_symptom_id` on symptom_id
- `idx_symptom_occ_date` on occurrence_date
- `idx_symptom_occ_severity` on severity
- `idx_symptom_occ_symptom_date` on (symptom_id, occurrence_date)

**Injury Types**:
- `idx_injury_types_name` on name
- `idx_injury_types_is_system` on is_system

**Injuries**:
- `idx_injuries_patient_id` on patient_id
- `idx_injuries_patient_status` on (patient_id, status)
- `idx_injuries_injury_type` on injury_type_id
- `idx_injuries_date` on date_of_injury

**Notification Channels**:
- `idx_notification_channels_user_id` on user_id

**Notification Preferences**:
- `idx_notification_prefs_user_id` on user_id
- `idx_notification_prefs_channel_id` on channel_id
- `idx_notification_prefs_event_type` on event_type

**Notification History**:
- `idx_notification_history_user_id` on user_id
- `idx_notification_history_status` on status
- `idx_notification_history_created_at` on created_at
- `idx_notification_history_event_type` on event_type

**Activity Logs**:
- `idx_activity_user_timestamp` on (user_id, timestamp)
- `idx_activity_patient_timestamp` on (patient_id, timestamp)
- `idx_activity_entity` on (entity_type, entity_id)
- `idx_activity_timestamp` on timestamp
- `idx_activity_action` on action

**Standardized Tests**:
- `idx_standardized_tests_loinc_code` on loinc_code (UNIQUE)
- `idx_standardized_tests_test_name` on test_name
- `idx_standardized_tests_category` on category
- `idx_standardized_tests_is_common` on is_common
- `idx_standardized_tests_short_name` on short_name

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
- Patient → All medical records (medications, conditions, lab_results, symptoms, injuries, etc.)
- User → UserPreferences, NotificationChannels
- LabResult → LabResultFile, LabTestComponent, LabResultCondition
- Condition → ConditionMedication, LabResultCondition, SymptomCondition, InjuryCondition
- Medication → SymptomMedication, InjuryMedication
- Treatment → SymptomTreatment, InjuryTreatment
- Procedure → InjuryProcedure
- Symptom → SymptomOccurrence, SymptomCondition, SymptomMedication, SymptomTreatment
- Injury → InjuryMedication, InjuryCondition, InjuryTreatment, InjuryProcedure
- FamilyMember → FamilyCondition, FamilyHistoryShare
- PatientPhoto → Patient (ON DELETE CASCADE)
- NotificationChannel → NotificationPreference

**SET NULL**:
- ReportGenerationAudit.user_id (preserve audit if user deleted)
- NotificationHistory.user_id (preserve history if user deleted)
- NotificationHistory.channel_id (preserve history if channel deleted)

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
| injury_types | name | Built-in UNIQUE |
| notification_channels | (user_id, name) | uq_user_channel_name |
| notification_preferences | (user_id, channel_id, event_type) | uq_user_channel_event |
| symptom_conditions | (symptom_id, condition_id) | uq_symptom_condition |
| symptom_medications | (symptom_id, medication_id) | uq_symptom_medication |
| symptom_treatments | (symptom_id, treatment_id) | uq_symptom_treatment |
| injury_medications | (injury_id, medication_id) | uq_injury_medication |
| injury_conditions | (injury_id, condition_id) | uq_injury_condition |
| injury_treatments | (injury_id, treatment_id) | uq_injury_treatment |
| injury_procedures | (injury_id, procedure_id) | uq_injury_procedure |
| standardized_tests | loinc_code | Built-in UNIQUE |

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
- symptoms, injuries
- emergency_contacts, family_members
- insurances, shares, photo

**Partial Cascade**:
- LabResult → files, test_components, condition_relationships
- Condition → medication_relationships, lab_result_relationships, symptom_relationships, injury_relationships
- Medication → symptom_relationships, injury_relationships
- Treatment → symptom_relationships, injury_relationships
- Procedure → injury_relationships
- Symptom → occurrences, condition_relationships, medication_relationships, treatment_relationships
- Injury → medication_relationships, condition_relationships, treatment_relationships, procedure_relationships
- FamilyMember → family_conditions, shares
- User → notification_channels, preferences
- NotificationChannel → preferences

**Preserve Audit**:
- ReportGenerationAudit.user_id SET NULL on user delete
- NotificationHistory.user_id SET NULL on user delete
- NotificationHistory.channel_id SET NULL on channel delete
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

**MedicationType**:
- prescription, otc, supplement, herbal

**AllergyStatus**:
- active, inactive, resolved, unconfirmed

**LabResultStatus**:
- ordered, in_progress, completed, cancelled

**ProcedureStatus**:
- scheduled, in_progress, completed, cancelled, postponed

**ProcedureOutcome**:
- successful, abnormal, complications, inconclusive, pending

**TreatmentStatus**:
- planned, active, in_progress, completed, cancelled, on_hold

**EncounterPriority**:
- routine, urgent, emergency

**SeverityLevel**:
- mild, moderate, severe, life-threatening

**SymptomStatus**:
- active, resolved, recurring

**SymptomSeverity**:
- mild, moderate, severe, critical

**InjuryStatus**:
- active (currently being treated)
- healing (in recovery)
- resolved (fully healed)
- chronic (long-term/permanent effects)

**Laterality**:
- left, right, bilateral, not_applicable

**RelationshipToSelf** (patient relationship to account owner):
- self, spouse, partner
- child, son, daughter
- parent, father, mother
- sibling, brother, sister
- grandparent, grandchild
- other_family, friend, other

**FamilyRelationship** (for family history):
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

**Document Version**: 2.0
**Last Updated**: 2026-02-02
**Maintained By**: Development Team
**Related Documentation**:
- [01-architecture.md](01-architecture.md)
- [02-api-reference.md](02-api-reference.md)
