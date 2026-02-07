from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    column,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import backref, declarative_base
from sqlalchemy.orm import relationship as orm_relationship

# Import status enums for consistent status management
from .enums import (
    AllergyStatus,
    ConditionStatus,
    ConditionType,
    EncounterPriority,
    FamilyRelationship,
    InjuryStatus,
    InsuranceStatus,
    InsuranceType,
    LabResultStatus,
    Laterality,
    MedicationStatus,
    MedicationType,
    ProcedureStatus,
    RelationshipToSelf,
    SeverityLevel,
    TreatmentStatus,
    get_all_allergy_statuses,
    get_all_condition_statuses,
    get_all_condition_types,
    get_all_encounter_priorities,
    get_all_family_relationships,
    get_all_injury_statuses,
    get_all_insurance_statuses,
    get_all_insurance_types,
    get_all_lab_result_statuses,
    get_all_laterality_values,
    get_all_medication_statuses,
    get_all_medication_types,
    get_all_procedure_statuses,
    get_all_relationship_to_self,
    get_all_severity_levels,
    get_all_treatment_statuses,
)


# Timezone-aware datetime function to replace deprecated datetime.utcnow()
def get_utc_now():
    """Get the current UTC datetime with timezone awareness."""
    return datetime.now(timezone.utc)


Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)  # Role-based access control
    role = Column(String, nullable=False)  # e.g., 'admin', 'user', 'guest'

    # SSO fields
    auth_method = Column(
        String(20), nullable=False, default="local"
    )  # 'local', 'sso', 'hybrid'
    external_id = Column(
        String(255), nullable=True, unique=True
    )  # SSO provider user ID
    sso_provider = Column(String(50), nullable=True)  # 'google', 'github', 'oidc', etc.
    sso_metadata = Column(JSON, nullable=True)  # Additional SSO data
    last_sso_login = Column(DateTime, nullable=True)  # Last SSO login timestamp
    account_linked_at = Column(
        DateTime, nullable=True
    )  # When account was linked to SSO
    sso_linking_preference = Column(
        String(20), nullable=True
    )  # 'auto_link', 'create_separate', 'always_ask'

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # V1: Current patient context - which patient they're managing
    active_patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)

    # Original relationship (specify foreign key to avoid ambiguity)
    patient = orm_relationship(
        "Patient", foreign_keys="Patient.user_id", back_populates="user", uselist=False
    )

    # V1: New relationships
    owned_patients = orm_relationship(
        "Patient", foreign_keys="Patient.owner_user_id", overlaps="owner"
    )
    current_patient_context = orm_relationship(
        "Patient", foreign_keys=[active_patient_id]
    )

    # V1: Patient sharing relationships
    shared_patients_by_me = orm_relationship(
        "PatientShare",
        foreign_keys="PatientShare.shared_by_user_id",
        overlaps="shared_by",
    )
    shared_patients_with_me = orm_relationship(
        "PatientShare",
        foreign_keys="PatientShare.shared_with_user_id",
        overlaps="shared_with",
    )

    # User preferences relationship with cascade delete
    preferences = orm_relationship(
        "UserPreferences",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )

    # Notification channels relationship with cascade delete
    notification_channels = orm_relationship(
        "NotificationChannel",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (Index("idx_users_email", "email"),)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # V1: Individual ownership
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_self_record = Column(Boolean, default=False, nullable=False)

    # V2+: Family context (nullable for V1)
    family_id = Column(Integer, nullable=True)  # Will add FK constraint in V2
    relationship_to_self = Column(
        String, nullable=True
    )  # Use RelationshipToSelf enum: self, spouse, child, parent, etc.

    # V3+: Advanced permissions (nullable for V1/V2)
    privacy_level = Column(String, default="owner", nullable=False)

    # V4+: External linking (nullable for V1/V2/V3)
    external_account_id = Column(Integer, nullable=True)  # Will add FK constraint in V4
    is_externally_accessible = Column(Boolean, default=False, nullable=False)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    birth_date = Column(Date, nullable=False)

    physician_id = Column(
        Integer, ForeignKey("practitioners.id"), nullable=True
    )  # Primary care physician

    blood_type = Column(String, nullable=True)  # e.g., 'A+', 'O-', etc.
    height = Column(Float, nullable=True)  # in inches
    weight = Column(Float, nullable=True)  # in lbs
    gender = Column(String, nullable=True)
    address = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    owner = orm_relationship(
        "User", foreign_keys=[owner_user_id], overlaps="owned_patients"
    )
    user = orm_relationship("User", foreign_keys=[user_id], back_populates="patient")
    practitioner = orm_relationship("Practitioner", back_populates="patients")
    medications = orm_relationship(
        "Medication", back_populates="patient", cascade="all, delete-orphan"
    )
    encounters = orm_relationship(
        "Encounter", back_populates="patient", cascade="all, delete-orphan"
    )
    lab_results = orm_relationship(
        "LabResult", back_populates="patient", cascade="all, delete-orphan"
    )
    immunizations = orm_relationship(
        "Immunization", back_populates="patient", cascade="all, delete-orphan"
    )
    conditions = orm_relationship(
        "Condition", back_populates="patient", cascade="all, delete-orphan"
    )
    procedures = orm_relationship(
        "Procedure", back_populates="patient", cascade="all, delete-orphan"
    )
    treatments = orm_relationship(
        "Treatment", back_populates="patient", cascade="all, delete-orphan"
    )
    allergies = orm_relationship(
        "Allergy", back_populates="patient", cascade="all, delete-orphan"
    )
    vitals = orm_relationship(
        "Vitals", back_populates="patient", cascade="all, delete-orphan"
    )
    symptoms = orm_relationship(
        "Symptom", back_populates="patient", cascade="all, delete-orphan"
    )
    emergency_contacts = orm_relationship(
        "EmergencyContact", back_populates="patient", cascade="all, delete-orphan"
    )
    family_members = orm_relationship(
        "FamilyMember", back_populates="patient", cascade="all, delete-orphan"
    )
    insurances = orm_relationship(
        "Insurance", back_populates="patient", cascade="all, delete-orphan"
    )
    injuries = orm_relationship(
        "Injury", back_populates="patient", cascade="all, delete-orphan"
    )
    medical_equipment = orm_relationship(
        "MedicalEquipment", back_populates="patient", cascade="all, delete-orphan"
    )

    # V1: Patient sharing relationships
    shares = orm_relationship(
        "PatientShare",
        foreign_keys="PatientShare.patient_id",
        cascade="all, delete-orphan",
        overlaps="patient",
    )

    # Patient photo relationship (one-to-one)
    photo = orm_relationship(
        "PatientPhoto",
        back_populates="patient",
        cascade="all, delete-orphan",
        uselist=False
    )

    # Indexes for performance
    __table_args__ = (Index("idx_patients_owner_user_id", "owner_user_id"),)


class Practitioner(Base):
    __tablename__ = "practitioners"
    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)
    specialty = Column(String, nullable=False)
    practice = Column(String, nullable=True)  # Optional - not all practitioners are linked to a practice
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    rating = Column(Float, nullable=True)  # Rating from 0.0 to 5.0

    # Table Relationships
    patients = orm_relationship("Patient", back_populates="practitioner")
    medications = orm_relationship("Medication", back_populates="practitioner")
    encounters = orm_relationship("Encounter", back_populates="practitioner")
    lab_results = orm_relationship("LabResult", back_populates="practitioner")
    immunizations = orm_relationship("Immunization", back_populates="practitioner")
    procedures = orm_relationship("Procedure", back_populates="practitioner")
    treatments = orm_relationship("Treatment", back_populates="practitioner")
    conditions = orm_relationship("Condition", back_populates="practitioner")
    vitals = orm_relationship("Vitals", back_populates="practitioner")
    injuries = orm_relationship("Injury", back_populates="practitioner")
    medical_equipment = orm_relationship("MedicalEquipment", back_populates="practitioner")


class Medication(Base):
    """
    Represents a medication
    """

    __tablename__ = "medications"
    id = Column(Integer, primary_key=True)

    medication_name = Column(String, nullable=False)
    medication_type = Column(
        String(20), nullable=False, default='prescription'
    )  # Use MedicationType enum: prescription, otc, supplement, herbal
    dosage = Column(String, nullable=True)
    frequency = Column(String, nullable=True)
    route = Column(
        String, nullable=True
    )  # How it is administered (e.g., oral, injection, etc.)
    indication = Column(String, nullable=True)  # What the medication is prescribed for
    effective_period_start = Column(Date, nullable=True)  # Start date of the medication
    effective_period_end = Column(Date, nullable=True)  # End date of the medication
    status = Column(
        String, nullable=True
    )  # Use MedicationStatus enum: active, inactive, on_hold, completed, cancelled
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="medications")
    practitioner = orm_relationship("Practitioner", back_populates="medications")
    pharmacy = orm_relationship("Pharmacy", back_populates="medications")
    allergies = orm_relationship("Allergy", back_populates="medication")

    # Many-to-Many relationship with conditions through junction table
    condition_relationships = orm_relationship(
        "ConditionMedication", back_populates="medication", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with symptoms through junction table
    symptom_relationships = orm_relationship(
        "SymptomMedication", back_populates="medication", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with injuries through junction table
    injury_relationships = orm_relationship(
        "InjuryMedication", back_populates="medication", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with treatments through junction table
    treatment_relationships = orm_relationship(
        "TreatmentMedication", back_populates="medication", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_medications_patient_id", "patient_id"),
        Index("idx_medications_patient_status", "patient_id", "status"),
        Index("idx_medications_patient_type", "patient_id", "medication_type"),
    )


class Encounter(Base):
    """
    Represents a medical encounter between a patient and a practitioner.
    """

    __tablename__ = "encounters"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"))
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=True)

    # Basic encounter information
    reason = Column(String, nullable=False)  # Reason for the encounter
    date = Column(Date, nullable=False)  # Date of the encounter
    notes = Column(String, nullable=True)  # Additional notes from the encounter

    # Enhanced encounter details (all optional)
    visit_type = Column(
        String, nullable=True
    )  # e.g., 'annual checkup', 'follow-up', 'consultation', 'emergency'
    chief_complaint = Column(
        String, nullable=True
    )  # Primary concern or symptom reported by patient
    diagnosis = Column(
        String, nullable=True
    )  # Clinical assessment or diagnosis from the visit
    treatment_plan = Column(
        String, nullable=True
    )  # Recommended treatment or next steps
    follow_up_instructions = Column(
        String, nullable=True
    )  # Follow-up care instructions
    duration_minutes = Column(
        Integer, nullable=True
    )  # Duration of the visit in minutes
    location = Column(
        String, nullable=True
    )  # Where visit occurred (office, hospital, telehealth, etc.)
    priority = Column(
        String, nullable=True
    )  # Use EncounterPriority enum: routine, urgent, emergency

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="encounters")
    practitioner = orm_relationship("Practitioner", back_populates="encounters")
    condition = orm_relationship("Condition")

    # Many-to-Many relationship with treatments through junction table
    treatment_relationships = orm_relationship(
        "TreatmentEncounter", back_populates="encounter", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (Index("idx_encounters_patient_id", "patient_id"),)


class LabResult(Base):
    __tablename__ = "lab_results"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(
        Integer, ForeignKey("practitioners.id"), nullable=True
    )  # Ordering practitioner

    # Basic test information
    test_name = Column(String, nullable=False)  # Name/description of the test
    test_code = Column(String, nullable=True)  # Optional code (LOINC, CPT, etc.)
    test_category = Column(
        String, nullable=True
    )  # e.g., 'blood work', 'imaging', 'pathology'
    test_type = Column(String, nullable=True)  # e.g., 'routine', 'emergency', etc.
    facility = Column(String, nullable=True)  # Facility where the test was ordered
    status = Column(
        String, nullable=False, default="ordered"
    )  # Use LabResultStatus enum: ordered, in_progress, completed, cancelled
    labs_result = Column(
        String, nullable=True
    )  # Lab result interpretation: 'normal', 'abnormal', etc.
    ordered_date = Column(Date, nullable=True)  # When the test was ordered
    completed_date = Column(Date, nullable=True)  # When results were received

    # Optional notes
    notes = Column(Text, nullable=True)  # Any additional notes about the test

    # Audit fields
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="lab_results")
    practitioner = orm_relationship("Practitioner", back_populates="lab_results")

    # One-to-Many relationship with LabResultFile (actual test results: PDFs, images, etc.)
    files = orm_relationship(
        "LabResultFile", back_populates="lab_result", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with conditions through junction table
    condition_relationships = orm_relationship(
        "LabResultCondition", back_populates="lab_result", cascade="all, delete-orphan"
    )

    # One-to-Many relationship with individual test components
    test_components = orm_relationship(
        "LabTestComponent", back_populates="lab_result", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with treatments through junction table
    treatment_relationships = orm_relationship(
        "TreatmentLabResult", back_populates="lab_result", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_lab_results_patient_id", "patient_id"),
        Index("idx_lab_results_patient_date", "patient_id", "completed_date"),
    )


class LabResultFile(Base):
    __tablename__ = "lab_result_files"
    id = Column(Integer, primary_key=True)

    lab_result_id = Column(Integer, ForeignKey("lab_results.id"))
    file_name = Column(String, nullable=False)  # Name of the file
    file_path = Column(String, nullable=False)  # Path to the file on the server
    file_type = Column(String, nullable=False)  # e.g., 'pdf', 'image/png', etc.
    file_size = Column(Integer, nullable=True)  # Size of the file in bytes
    description = Column(String, nullable=True)  # Optional description of the file
    uploaded_at = Column(
        DateTime, nullable=False
    )  # Timestamp of when the file was uploaded

    # Table Relationships
    lab_result = orm_relationship("LabResult", back_populates="files")


class EntityFile(Base):
    """
    Generic file management for all entity types.
    Supports lab-results, insurance, visits, procedures, and future entity types.
    """

    __tablename__ = "entity_files"

    id = Column(Integer, primary_key=True)
    entity_type = Column(
        String(50), nullable=False
    )  # 'lab-result', 'insurance', 'visit', 'procedure'
    entity_id = Column(Integer, nullable=False)  # Foreign key to the entity
    file_name = Column(String(255), nullable=False)  # Original filename
    file_path = Column(String(500), nullable=False)  # Path to file on server
    file_type = Column(String(100), nullable=False)  # MIME type or extension
    file_size = Column(Integer, nullable=True)  # Size in bytes
    description = Column(Text, nullable=True)  # Optional description
    category = Column(
        String(100), nullable=True
    )  # File category (result, report, card, etc.)
    uploaded_at = Column(DateTime, nullable=False)  # Upload timestamp

    # Storage backend tracking
    storage_backend = Column(
        String(20), default="local", nullable=False
    )  # 'local' or 'paperless'
    paperless_document_id = Column(
        String(255), nullable=True
    )  # ID in paperless-ngx system
    paperless_task_uuid = Column(
        String(255), nullable=True
    )  # UUID of the task in paperless-ngx system
    sync_status = Column(
        String(20), default="synced", nullable=False
    )  # 'synced', 'pending', 'processing', 'failed', 'missing'
    last_sync_at = Column(DateTime, nullable=True)  # Last successful sync timestamp

    created_at = Column(DateTime, nullable=False, default=get_utc_now)
    updated_at = Column(
        DateTime, nullable=False, default=get_utc_now, onupdate=get_utc_now
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_entity_type_id", "entity_type", "entity_id"),
        Index("idx_category", "category"),
        Index("idx_uploaded_at", "uploaded_at"),
        Index("idx_created_at", "created_at"),
        Index("idx_storage_backend", "storage_backend"),
        Index("idx_paperless_document_id", "paperless_document_id"),
        Index("idx_sync_status", "sync_status"),
    )


class LabResultCondition(Base):
    """
    Junction table for many-to-many relationship between lab results and conditions.
    Allows one lab result to be related to multiple conditions with optional context.
    """

    __tablename__ = "lab_result_conditions"

    id = Column(Integer, primary_key=True)
    lab_result_id = Column(Integer, ForeignKey("lab_results.id"), nullable=False)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=False)

    # Optional context about how this lab result relates to this condition
    relevance_note = Column(
        String, nullable=True
    )  # e.g., "Elevated glucose indicates poor control"

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    lab_result = orm_relationship("LabResult", back_populates="condition_relationships")
    condition = orm_relationship("Condition", back_populates="lab_result_relationships")


class LabTestComponent(Base):
    """
    Individual test components/values within a lab result.
    Each LabResult can have multiple test components (WBC, RBC, Glucose, etc.).
    Follows existing MediKeep model patterns exactly.
    """
    __tablename__ = "lab_test_components"

    id = Column(Integer, primary_key=True)
    lab_result_id = Column(Integer, ForeignKey("lab_results.id"), nullable=False)

    # Test identification - following existing string patterns
    test_name = Column(String, nullable=False)  # e.g., "White Blood Cell Count"
    abbreviation = Column(String, nullable=True)  # e.g., "WBC"
    test_code = Column(String, nullable=True)  # LOINC codes like existing models

    # Test values - using Float like Vitals model
    value = Column(Float, nullable=False)  # Numeric result
    unit = Column(String, nullable=False)  # e.g., "K/uL", "mg/dL"

    # Reference ranges - following Vitals pattern with min/max
    ref_range_min = Column(Float, nullable=True)
    ref_range_max = Column(Float, nullable=True)
    ref_range_text = Column(String, nullable=True)  # For non-numeric ranges

    # Status and organization - following existing status patterns
    status = Column(String, nullable=True)  # normal, high, low, critical
    category = Column(String, nullable=True)  # hematology, chemistry, etc.
    display_order = Column(Integer, nullable=True)  # For consistent ordering

    # Canonical test name for trend matching - links to standardized test name
    # Note: Index is created explicitly in migration and __table_args__
    canonical_test_name = Column(String, nullable=True)

    # Notes - using Text like other models
    notes = Column(Text, nullable=True)

    # Timestamps - EXACT pattern from all other models
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Relationships - following exact pattern from LabResultFile
    lab_result = orm_relationship("LabResult", back_populates="test_components")

    # Indexes - following exact naming pattern from other models
    __table_args__ = (
        Index("idx_lab_test_components_lab_result_id", "lab_result_id"),
        Index("idx_lab_test_components_status", "status"),
        Index("idx_lab_test_components_category", "category"),
        Index("ix_lab_test_components_canonical_test_name", "canonical_test_name"),
        # Compound indexes for common query patterns
        Index("idx_lab_test_components_lab_result_status", "lab_result_id", "status"),
        Index("idx_lab_test_components_lab_result_category", "lab_result_id", "category"),
        Index("idx_lab_test_components_test_name_text", "test_name"),
        Index("idx_lab_test_components_abbreviation_text", "abbreviation"),
    )


class ConditionMedication(Base):
    """
    Junction table for many-to-many relationship between conditions and medications.
    Allows one condition to be related to multiple medications with optional context.
    """

    __tablename__ = "condition_medications"

    id = Column(Integer, primary_key=True)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=False)

    # Optional context about how this medication relates to this condition
    relevance_note = Column(
        String, nullable=True
    )  # e.g., "Primary treatment for hypertension"

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    condition = orm_relationship("Condition", back_populates="medication_relationships")
    medication = orm_relationship(
        "Medication", back_populates="condition_relationships"
    )


class Condition(Base):
    __tablename__ = "conditions"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)
    # Note: medication_id removed - use medication_relationships (ConditionMedication) instead

    # Condition details
    condition_name = Column(String, nullable=True)  # Name of the condition
    diagnosis = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    onset_date = Column(
        Date, nullable=True
    )  # Date when the condition was first diagnosed
    status = Column(
        String, nullable=False
    )  # Use ConditionStatus enum: active, inactive, resolved, chronic, recurrence, relapse
    end_date = Column(Date, nullable=True)  # Date when the condition was resolved

    # Severity and medical codes
    severity = Column(
        String, nullable=True
    )  # Use SeverityLevel enum: mild, moderate, severe, critical
    icd10_code = Column(String, nullable=True)  # ICD-10 diagnosis code
    snomed_code = Column(String, nullable=True)  # SNOMED CT code
    code_description = Column(String, nullable=True)  # Description of the medical code

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="conditions")
    practitioner = orm_relationship("Practitioner", back_populates="conditions")
    # Note: medication relationship removed - use medication_relationships instead
    treatments = orm_relationship("Treatment", back_populates="condition")
    # encounters relationship removed - use queries instead due to potential high volume
    procedures = orm_relationship("Procedure", back_populates="condition")

    # Many-to-Many relationship with lab results through junction table
    lab_result_relationships = orm_relationship(
        "LabResultCondition", back_populates="condition", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with medications through junction table
    medication_relationships = orm_relationship(
        "ConditionMedication", back_populates="condition", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with symptoms through junction table
    symptom_relationships = orm_relationship(
        "SymptomCondition", back_populates="condition", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with injuries through junction table
    injury_relationships = orm_relationship(
        "InjuryCondition", back_populates="condition", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_conditions_patient_id", "patient_id"),
        Index("idx_conditions_patient_status", "patient_id", "status"),
    )


class Immunization(Base):
    __tablename__ = "immunizations"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    # Primary vaccine information
    vaccine_name = Column(String, nullable=False)  # Name of the vaccine
    vaccine_trade_name = Column(String, nullable=True)  # Formal/trade name (e.g., "Flublok TRIV 2025-2026 PFS")
    date_administered = Column(Date, nullable=False)  # Date when administered
    dose_number = Column(Integer, nullable=True)  # Dose number in series
    ndc_number = Column(String, nullable=True)  # NDC number of the vaccine

    # Vaccine details
    lot_number = Column(String, nullable=True)  # Vaccine lot number
    manufacturer = Column(String, nullable=True)  # Vaccine manufacturer
    site = Column(String, nullable=True)  # Injection site
    route = Column(String, nullable=True)  # Route of administration
    expiration_date = Column(Date, nullable=True)  # Vaccine expiration date
    location = Column(
        String, nullable=True
    )  # Where vaccine was administered (clinic, hospital, pharmacy, etc.)
    notes = Column(Text, nullable=True)  # Additional notes

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="immunizations")
    practitioner = orm_relationship("Practitioner", back_populates="immunizations")

    # Indexes for performance
    __table_args__ = (Index("idx_immunizations_patient_id", "patient_id"),)


class Procedure(Base):
    __tablename__ = "procedures"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=True)

    procedure_name = Column(String, nullable=False)  # Name of the procedure
    procedure_type = Column(
        String, nullable=True
    )  # Type of procedure (e.g., surgical, diagnostic, etc.)
    procedure_code = Column(
        String, nullable=True
    )  # Code for the procedure (e.g., CPT code)
    date = Column(Date, nullable=False)  # Date when the procedure was performed
    description = Column(String, nullable=True)  # Description of the procedure
    status = Column(
        String, nullable=True
    )  # Use ProcedureStatus enum: scheduled, in_progress, completed, cancelled
    notes = Column(String, nullable=True)  # Additional notes about the procedure
    facility = Column(
        String, nullable=True
    )  # Facility where the procedure was performed
    procedure_setting = Column(
        String, nullable=True
    )  # Setting of procedure (e.g., outpatient, inpatient, office, etc)
    procedure_complications = Column(
        String, nullable=True
    )  # Any complications that occured during the procedure
    procedure_duration = Column(
        Integer, nullable=True
    )  # Duration of the procedure in minutes

    anesthesia_type = Column(
        String, nullable=True
    )  # Type of anesthesia used (e.g., local, regional, general)
    anesthesia_notes = Column(
        String, nullable=True
    )  # Additional notes about the anesthesia

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="procedures")
    practitioner = orm_relationship("Practitioner", back_populates="procedures")
    condition = orm_relationship("Condition", back_populates="procedures")

    # Many-to-Many relationship with injuries through junction table
    injury_relationships = orm_relationship(
        "InjuryProcedure", back_populates="procedure", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (Index("idx_procedures_patient_id", "patient_id"),)


class Treatment(Base):
    __tablename__ = "treatments"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=True)

    treatment_name = Column(String, nullable=False)  # Name of the treatment
    treatment_type = Column(
        String, nullable=True
    )  # Type of treatment (e.g., 'physical therapy', 'surgery') - optional
    start_date = Column(Date, nullable=True)  # Start date of the treatment (optional)
    end_date = Column(Date, nullable=True)  # End date of the treatment (if applicable)
    status = Column(
        String, nullable=True
    )  # Use TreatmentStatus enum: active, in_progress, completed, cancelled, on_hold
    treatment_category = Column(
        String, nullable=True
    )  # Category of treatment (e.g., 'inpatient', 'outpatient')
    notes = Column(String, nullable=True)  # Additional notes about the treatment
    frequency = Column(
        String, nullable=True
    )  # Frequency of the treatment (e.g., 'daily', 'weekly')
    outcome = Column(String, nullable=True)  # Expected outcome of the treatment
    description = Column(String, nullable=True)  # Description of the treatment
    location = Column(
        String, nullable=True
    )  # Location where the treatment is administered
    dosage = Column(String, nullable=True)  # Dosage of the treatment

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="treatments")
    practitioner = orm_relationship("Practitioner", back_populates="treatments")
    condition = orm_relationship("Condition", back_populates="treatments")

    # Many-to-Many relationship with symptoms through junction table
    symptom_relationships = orm_relationship(
        "SymptomTreatment", back_populates="treatment", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with injuries through junction table
    injury_relationships = orm_relationship(
        "InjuryTreatment", back_populates="treatment", cascade="all, delete-orphan"
    )

    # Treatment Plan relationships (Phase: Treatment Plans Expansion)
    medication_relationships = orm_relationship(
        "TreatmentMedication", back_populates="treatment", cascade="all, delete-orphan"
    )
    encounter_relationships = orm_relationship(
        "TreatmentEncounter", back_populates="treatment", cascade="all, delete-orphan"
    )
    lab_result_relationships = orm_relationship(
        "TreatmentLabResult", back_populates="treatment", cascade="all, delete-orphan"
    )
    equipment_relationships = orm_relationship(
        "TreatmentEquipment", back_populates="treatment", cascade="all, delete-orphan"
    )


class Allergy(Base):
    __tablename__ = "allergies"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=True)

    allergen = Column(String, nullable=False)  # Allergen name
    reaction = Column(String, nullable=False)  # Reaction to the allergen
    severity = Column(
        String, nullable=True
    )  # Use SeverityLevel enum: mild, moderate, severe, critical
    onset_date = Column(Date, nullable=True)  # Date when the allergy was first noted
    status = Column(
        String, nullable=True
    )  # Use AllergyStatus enum: active, inactive, resolved
    notes = Column(String, nullable=True)  # Additional notes about the allergy

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="allergies")
    medication = orm_relationship("Medication", back_populates="allergies")

    # Indexes for performance
    __table_args__ = (Index("idx_allergies_patient_id", "patient_id"),)


class Vitals(Base):
    __tablename__ = "vitals"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    # Date and time when vitals were recorded
    recorded_date = Column(DateTime, nullable=False)

    # Vital sign measurements
    systolic_bp = Column(Integer, nullable=True)  # Systolic blood pressure (mmHg)
    diastolic_bp = Column(Integer, nullable=True)  # Diastolic blood pressure (mmHg)
    heart_rate = Column(Integer, nullable=True)  # Heart rate (bpm)
    temperature = Column(Float, nullable=True)  # Body temperature (Fahrenheit)
    weight = Column(Float, nullable=True)  # Weight (lbs)
    height = Column(Float, nullable=True)  # Height (inches)
    oxygen_saturation = Column(Float, nullable=True)  # SpO2 percentage
    respiratory_rate = Column(Integer, nullable=True)  # Breaths per minute
    blood_glucose = Column(Float, nullable=True)  # Blood glucose (mg/dL)
    a1c = Column(Float, nullable=True)  # Hemoglobin A1C (%)

    # Additional measurements
    bmi = Column(Float, nullable=True)  # Body Mass Index (calculated)
    pain_scale = Column(Integer, nullable=True)  # Pain scale 0-10

    # Optional notes and metadata
    notes = Column(Text, nullable=True)  # Additional notes about the readings
    location = Column(
        String, nullable=True
    )  # Where readings were taken (home, clinic, etc.)
    device_used = Column(
        String, nullable=True
    )  # Device used for measurement    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="vitals")
    practitioner = orm_relationship("Practitioner", back_populates="vitals")

    # Indexes for performance
    __table_args__ = (Index("idx_vitals_patient_id", "patient_id"),)


class Symptom(Base):
    """
    Parent symptom definition/type (e.g., "Migraine", "Back Pain").
    Stores general information about the symptom.
    Individual episodes are tracked in SymptomOccurrence table.
    """
    __tablename__ = "symptoms"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Core symptom definition
    symptom_name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=True)  # e.g., "Neurological", "Gastrointestinal"

    # Overall status
    status = Column(String(50), nullable=False, default="active")  # active, resolved, chronic
    is_chronic = Column(Boolean, default=False, nullable=False)

    # Occurrence tracking
    first_occurrence_date = Column(Date, nullable=False)
    last_occurrence_date = Column(Date, nullable=True)
    resolved_date = Column(Date, nullable=True)  # Date when symptom was resolved

    # General information
    typical_triggers = Column(JSON, nullable=True, default=list)  # Common triggers
    general_notes = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True, default=list)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="symptoms")

    # One-to-Many relationship with occurrences
    occurrences = orm_relationship(
        "SymptomOccurrence",
        back_populates="symptom",
        cascade="all, delete-orphan",
        order_by="SymptomOccurrence.occurrence_date.desc()"
    )

    # Many-to-Many relationships through junction tables
    condition_relationships = orm_relationship(
        "SymptomCondition",
        back_populates="symptom",
        cascade="all, delete-orphan"
    )
    medication_relationships = orm_relationship(
        "SymptomMedication",
        back_populates="symptom",
        cascade="all, delete-orphan"
    )
    treatment_relationships = orm_relationship(
        "SymptomTreatment",
        back_populates="symptom",
        cascade="all, delete-orphan"
    )

    @hybrid_property
    def occurrence_count(self):
        """Calculate the count of occurrences for this symptom"""
        return len(self.occurrences)

    # Indexes for performance
    __table_args__ = (
        Index("idx_symptoms_patient_id", "patient_id"),
        Index("idx_symptoms_patient_name", "patient_id", "symptom_name"),
        Index("idx_symptoms_status", "status"),
        Index("idx_symptoms_is_chronic", "is_chronic"),
    )


class SymptomOccurrence(Base):
    """
    Individual episode/occurrence of a symptom.
    Tracks when the symptom happened and specific details about that episode.
    """
    __tablename__ = "symptom_occurrences"

    id = Column(Integer, primary_key=True)
    symptom_id = Column(Integer, ForeignKey("symptoms.id"), nullable=False)

    # Occurrence details
    occurrence_date = Column(Date, nullable=False)
    severity = Column(String(50), nullable=False)  # mild, moderate, severe, critical
    pain_scale = Column(Integer, nullable=True)  # 0-10 scale

    # Duration and timing
    duration = Column(String(100), nullable=True)  # "30 minutes", "2 hours", "all day"
    time_of_day = Column(String(50), nullable=True)  # morning, afternoon, evening, night (legacy)
    occurrence_time = Column(Time, nullable=True)  # Precise time when episode started

    # Context
    location = Column(String(200), nullable=True)  # Body part/area affected
    triggers = Column(JSON, nullable=True, default=list)  # Specific triggers for this occurrence
    relief_methods = Column(JSON, nullable=True, default=list)  # What helped
    associated_symptoms = Column(JSON, nullable=True, default=list)  # Other symptoms present

    # Impact
    impact_level = Column(String(50), nullable=True)  # no_impact, mild, moderate, severe, debilitating

    # Resolution
    resolved_date = Column(Date, nullable=True)
    resolved_time = Column(Time, nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Notes for this specific occurrence
    notes = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    symptom = orm_relationship("Symptom", back_populates="occurrences")

    # Indexes for performance
    __table_args__ = (
        Index("idx_symptom_occ_symptom_id", "symptom_id"),
        Index("idx_symptom_occ_date", "occurrence_date"),
        Index("idx_symptom_occ_severity", "severity"),
        Index("idx_symptom_occ_symptom_date", "symptom_id", "occurrence_date"),
    )


class SymptomCondition(Base):
    """
    Junction table for many-to-many relationship between symptoms and conditions.
    Allows one symptom to be related to multiple conditions with optional context.
    Links to parent Symptom (not individual occurrences).
    """

    __tablename__ = "symptom_conditions"

    id = Column(Integer, primary_key=True)
    symptom_id = Column(Integer, ForeignKey("symptoms.id"), nullable=False)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=False)

    # Optional context about how this symptom relates to this condition
    relevance_note = Column(
        String, nullable=True
    )  # e.g., "Symptom of diabetes complications"

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    symptom = orm_relationship("Symptom", back_populates="condition_relationships")
    condition = orm_relationship("Condition", back_populates="symptom_relationships")

    # Indexes for performance
    __table_args__ = (
        Index("idx_symptom_condition_symptom_id", "symptom_id"),
        Index("idx_symptom_condition_condition_id", "condition_id"),
        UniqueConstraint("symptom_id", "condition_id", name="uq_symptom_condition"),
    )


class SymptomMedication(Base):
    """
    Junction table for many-to-many relationship between symptoms and medications.
    Allows tracking whether medication helps, causes, or is related to a symptom.
    Links to parent Symptom (not individual occurrences).
    """

    __tablename__ = "symptom_medications"

    id = Column(Integer, primary_key=True)
    symptom_id = Column(Integer, ForeignKey("symptoms.id"), nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=False)

    # Relationship type: how medication relates to symptom
    relationship_type = Column(
        String, nullable=False, default="related_to"
    )  # side_effect, helped_by, related_to

    # Optional context about the relationship
    relevance_note = Column(
        String, nullable=True
    )  # e.g., "Headache started after beginning this medication"

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    symptom = orm_relationship("Symptom", back_populates="medication_relationships")
    medication = orm_relationship("Medication", back_populates="symptom_relationships")

    # Indexes for performance
    __table_args__ = (
        Index("idx_symptom_medication_symptom_id", "symptom_id"),
        Index("idx_symptom_medication_medication_id", "medication_id"),
        UniqueConstraint("symptom_id", "medication_id", name="uq_symptom_medication"),
    )


class SymptomTreatment(Base):
    """
    Junction table for many-to-many relationship between symptoms and treatments.
    Allows tracking which symptoms are addressed by which treatments.
    Links to parent Symptom (not individual occurrences).
    """

    __tablename__ = "symptom_treatments"

    id = Column(Integer, primary_key=True)
    symptom_id = Column(Integer, ForeignKey("symptoms.id"), nullable=False)
    treatment_id = Column(Integer, ForeignKey("treatments.id"), nullable=False)

    # Optional context about how this treatment relates to this symptom
    relevance_note = Column(
        String, nullable=True
    )  # e.g., "Physical therapy helps reduce back pain"

    # Indexes for performance
    __table_args__ = (
        Index("idx_symptom_treatment_symptom_id", "symptom_id"),
        Index("idx_symptom_treatment_treatment_id", "treatment_id"),
        UniqueConstraint("symptom_id", "treatment_id", name="uq_symptom_treatment"),
    )

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    symptom = orm_relationship("Symptom", back_populates="treatment_relationships")
    treatment = orm_relationship("Treatment", back_populates="symptom_relationships")


class Pharmacy(Base):
    __tablename__ = "pharmacies"
    id = Column(Integer, primary_key=True)

    # Descriptive name that includes location context
    name = Column(
        String, nullable=False
    )  # e.g., "CVS Pharmacy - Main Street", "Walgreens - Downtown"
    brand = Column(String, nullable=True)  # e.g., 'CVS', 'Walgreens', 'Independent'

    # Detailed address components for better identification
    street_address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    country = Column(String, nullable=True)  # e.g., 'USA', 'Canada'

    # Optional store identifier from the pharmacy chain
    store_number = Column(String, nullable=True)  # CVS store #1234, Walgreens #5678

    # Contact information
    phone_number = Column(String, nullable=True)
    fax_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)

    # Operating hours (could be JSON or separate table if more complex)
    hours = Column(String, nullable=True)  # e.g., "Mon-Fri: 8AM-10PM, Sat-Sun: 9AM-9PM"

    # Pharmacy-specific features
    drive_through = Column(
        Boolean, nullable=True, default=False
    )  # Boolean for drive-through availability
    twenty_four_hour = Column(
        Boolean, nullable=True, default=False
    )  # Boolean for 24-hour service
    specialty_services = Column(
        String, nullable=True
    )  # e.g., "Vaccinations, Medication Therapy Management"

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    medications = orm_relationship("Medication", back_populates="pharmacy")


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Contact Information
    name = Column(String, nullable=False)  # Full name of emergency contact
    relationship = Column(
        String, nullable=False
    )  # e.g., 'spouse', 'parent', 'child', 'friend', 'sibling'
    phone_number = Column(String, nullable=False)  # Primary phone number
    secondary_phone = Column(String, nullable=True)  # Optional secondary phone
    email = Column(String, nullable=True)  # Optional email address

    # Priority and Status
    is_primary = Column(
        Boolean, default=False, nullable=False
    )  # Primary emergency contact
    is_active = Column(Boolean, default=True, nullable=False)  # Active/inactive status

    # Additional Details
    address = Column(String, nullable=True)  # Contact's address
    notes = Column(
        String, nullable=True
    )  # Additional notes (e.g., "Available weekdays only")

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="emergency_contacts")


class BackupRecord(Base):
    """
    Represents a backup record for tracking backup operations.
    """

    __tablename__ = "backup_records"

    id = Column(Integer, primary_key=True)
    backup_type = Column(String, nullable=False)  # 'full', 'database', 'files'
    status = Column(String, nullable=False)  # 'created', 'failed', 'verified'
    file_path = Column(String, nullable=False)  # Path to the backup file
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    size_bytes = Column(Integer, nullable=True)  # Size of backup file in bytes
    description = Column(Text, nullable=True)  # Optional description

    # Optional metadata
    compression_used = Column(Boolean, default=False, nullable=False)
    checksum = Column(String, nullable=True)  # File checksum for integrity verification


class FamilyMember(Base):
    """
    Represents a family member for tracking family medical history.
    """

    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Basic Information
    name = Column(String, nullable=False)
    relationship = Column(String, nullable=False)  # Use FamilyRelationship enum
    gender = Column(String, nullable=True)
    birth_year = Column(Integer, nullable=True)
    death_year = Column(Integer, nullable=True)
    is_deceased = Column(Boolean, default=False, nullable=False)

    # Additional information
    notes = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    patient = orm_relationship("Patient", back_populates="family_members")
    family_conditions = orm_relationship(
        "FamilyCondition", back_populates="family_member", cascade="all, delete-orphan"
    )
    shares = orm_relationship(
        "FamilyHistoryShare",
        back_populates="family_member",
        cascade="all, delete-orphan",
    )


class FamilyCondition(Base):
    """
    Represents a medical condition for a family member.
    """

    __tablename__ = "family_conditions"

    id = Column(Integer, primary_key=True)
    family_member_id = Column(Integer, ForeignKey("family_members.id"), nullable=False)

    # Condition Information
    condition_name = Column(String, nullable=False)
    diagnosis_age = Column(Integer, nullable=True)  # Age when diagnosed
    severity = Column(String, nullable=True)  # Use SeverityLevel enum
    status = Column(String, nullable=True)  # active, resolved, chronic
    condition_type = Column(String, nullable=True)  # Use ConditionType enum
    notes = Column(Text, nullable=True)

    # Medical Codes (optional)
    icd10_code = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    family_member = orm_relationship("FamilyMember", back_populates="family_conditions")


class PatientShare(Base):
    """_summary_

    Args:
        Base (_type_): _description_
    """

    __tablename__ = "patient_shares"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    shared_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_with_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Permission control
    permission_level = Column(String, nullable=False)  # view, edit, full
    custom_permissions = Column(JSON, nullable=True)

    # Status and lifecycle
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    # Link to invitation (nullable for backward compatibility with existing shares)
    invitation_id = Column(Integer, ForeignKey("invitations.id"), nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    patient = orm_relationship("Patient", foreign_keys=[patient_id], overlaps="shares")
    shared_by = orm_relationship(
        "User", foreign_keys=[shared_by_user_id], overlaps="shared_patients_by_me"
    )
    shared_with = orm_relationship(
        "User", foreign_keys=[shared_with_user_id], overlaps="shared_patients_with_me"
    )
    invitation = orm_relationship("Invitation", foreign_keys=[invitation_id])

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "patient_id", "shared_with_user_id", name="unique_patient_share"
        ),
    )


class Invitation(Base):
    """Reusable invitation system for various sharing/collaboration features"""

    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True)

    # Who's sending and receiving
    sent_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sent_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # What type of invitation
    invitation_type = Column(
        String, nullable=False
    )  # 'family_history_share', 'patient_share', 'family_join', etc.

    # Status tracking
    status = Column(
        String, default="pending", nullable=False
    )  # pending, accepted, rejected, expired, cancelled

    # Invitation details
    title = Column(String, nullable=False)  # "Family History Share Request"
    message = Column(Text, nullable=True)  # Custom message from sender

    # Context data (JSON for flexibility)
    context_data = Column(JSON, nullable=False)  # Stores type-specific data

    # Expiration
    expires_at = Column(DateTime, nullable=True)

    # Response tracking
    responded_at = Column(DateTime, nullable=True)
    response_note = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    sent_by = orm_relationship("User", foreign_keys=[sent_by_user_id])
    sent_to = orm_relationship("User", foreign_keys=[sent_to_user_id])

    # No unique constraints - let application logic handle business rules
    # Each invitation has a unique ID which is sufficient for database integrity


class FamilyHistoryShare(Base):
    """Share family history records independently from personal medical data"""

    __tablename__ = "family_history_shares"

    id = Column(Integer, primary_key=True)

    # Link to the invitation that created this share
    invitation_id = Column(Integer, ForeignKey("invitations.id"), nullable=False)

    # What's being shared - specific family member's history record
    family_member_id = Column(Integer, ForeignKey("family_members.id"), nullable=False)

    # Who's sharing and receiving
    shared_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_with_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Simple permissions
    permission_level = Column(
        String, default="view", nullable=False
    )  # view only for Phase 1.5
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    # Optional sharing note
    sharing_note = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    invitation = orm_relationship("Invitation")
    family_member = orm_relationship("FamilyMember", back_populates="shares")
    shared_by = orm_relationship("User", foreign_keys=[shared_by_user_id])
    shared_with = orm_relationship("User", foreign_keys=[shared_with_user_id])

    # Constraints - allow multiple shares but only one active share per family member/user pair
    __table_args__ = (
        # Partial unique constraint: only one active share per (family_member_id, shared_with_user_id)
        # Multiple inactive shares are allowed to maintain history
        Index(
            "unique_active_family_history_share_partial",
            "family_member_id",
            "shared_with_user_id",
            unique=True,
            postgresql_where=(column("is_active") == True),
        ),
    )


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # Unit system preference: 'imperial' or 'metric'
    unit_system = Column(String, default="imperial", nullable=False)

    # Session timeout in minutes (default 30 minutes)
    session_timeout_minutes = Column(Integer, default=30, nullable=False)

    # Language preference (ISO 639-1 code, e.g., 'en', 'es', 'fr')
    language = Column(String(10), default="en", nullable=False)

    # Date format preference: 'mdy' (US), 'dmy' (European), 'ymd' (ISO)
    date_format = Column(String(10), default="mdy", nullable=False)

    # Paperless-ngx integration fields
    paperless_enabled = Column(Boolean, default=False, nullable=False)
    paperless_url = Column(String(500), nullable=True)
    paperless_api_token_encrypted = Column(Text, nullable=True)  # Encrypted API token
    paperless_username_encrypted = Column(Text, nullable=True)  # Encrypted username
    paperless_password_encrypted = Column(Text, nullable=True)  # Encrypted password
    default_storage_backend = Column(
        String(20), default="local", nullable=False
    )  # 'local' or 'paperless'
    paperless_auto_sync = Column(Boolean, default=False, nullable=False)
    paperless_sync_tags = Column(Boolean, default=True, nullable=False)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    user = orm_relationship("User", back_populates="preferences")


class Insurance(Base):
    """
    Represents insurance information for a patient.
    Supports multiple insurance types: medical, dental, vision, prescription.
    """

    __tablename__ = "insurances"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Insurance type and basic info
    insurance_type = Column(
        String, nullable=False
    )  # Use InsuranceType enum: medical, dental, vision, prescription
    company_name = Column(String, nullable=False)
    employer_group = Column(
        String, nullable=True
    )  # Company or organization providing the insurance
    member_name = Column(String, nullable=False)
    member_id = Column(String, nullable=False)
    group_number = Column(String, nullable=True)
    plan_name = Column(String, nullable=True)

    # Policy holder information (may differ from member)
    policy_holder_name = Column(String, nullable=True)
    relationship_to_holder = Column(
        String, nullable=True
    )  # self, spouse, child, dependent

    # Coverage period
    effective_date = Column(Date, nullable=False)
    expiration_date = Column(Date, nullable=True)

    # Status management
    status = Column(
        String, nullable=False, default="active"
    )  # Use InsuranceStatus enum: active, inactive, expired, pending
    is_primary = Column(
        Boolean, default=False, nullable=False
    )  # For medical insurance hierarchy

    # Type-specific data stored as JSON for flexibility
    coverage_details = Column(
        JSON, nullable=True
    )  # Copays, deductibles, percentages, BIN/PCN, etc.
    contact_info = Column(JSON, nullable=True)  # Phone numbers, addresses, websites

    # General notes
    notes = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="insurances")


class ReportTemplate(Base):
    """
    Represents a custom report template for generating medical reports.
    Allows users to save report configurations for reuse and sharing.
    """

    __tablename__ = "report_templates"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Template information
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Report configuration stored as JSON
    selected_records = Column(JSON, nullable=False)  # Record selections and filters
    report_settings = Column(
        JSON, nullable=False, default={}
    )  # UI preferences, sorting, grouping

    # Sharing and visibility
    is_public = Column(Boolean, nullable=False, default=False)
    shared_with_family = Column(Boolean, nullable=False, default=False)

    # Soft delete
    is_active = Column(Boolean, nullable=False, default=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    user = orm_relationship("User")

    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="unique_user_template_name"),
        Index("idx_report_template_user_id", "user_id"),
        Index(
            "idx_report_template_is_active",
            "is_active",
            postgresql_where=(column("is_active") == True),
        ),
        Index(
            "idx_report_template_shared_family",
            "shared_with_family",
            postgresql_where=(column("shared_with_family") == True),
        ),
        Index(
            "idx_report_template_selected_records",
            "selected_records",
            postgresql_using="gin",
        ),
    )


class ReportGenerationAudit(Base):
    """
    Audit table for tracking report generation activities.
    Helps monitor system usage and performance.
    """

    __tablename__ = "report_generation_audit"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Report details
    report_type = Column(
        String(50), nullable=False
    )  # 'custom_report', 'full_export', etc.
    categories_included = Column(JSON, nullable=True)  # Array of category names (stored as JSON for SQLite compatibility)
    total_records = Column(Integer, nullable=True)

    # Performance metrics
    generation_time_ms = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)

    # Status tracking
    status = Column(
        String(20), nullable=False, default="success"
    )  # success, failed, timeout
    error_details = Column(Text, nullable=True)

    # Audit timestamp
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    # Table Relationships
    user = orm_relationship("User")

    # Indexes for performance
    __table_args__ = (
        Index("idx_report_audit_user_created", "user_id", "created_at"),
        Index("idx_report_audit_status", "status"),
        Index("idx_report_audit_created_at", "created_at"),
    )


class UserTag(Base):
    """Model for user-created tags"""
    
    __tablename__ = "user_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tag = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    
    # Relationships
    user = orm_relationship("User")
    
    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint("user_id", "tag", name="uq_user_tag"),
        Index("idx_user_tags_user_id", "user_id"),
        Index("idx_user_tags_tag", "tag"),
    )


class PatientPhoto(Base):
    """
    Standalone table for patient profile photos.
    One photo per patient with automatic cleanup on replacement.
    """
    __tablename__ = "patient_photos"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, unique=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    original_name = Column(String(255), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Relationships
    patient = orm_relationship("Patient", back_populates="photo")
    uploader = orm_relationship("User", foreign_keys=[uploaded_by])

    # Indexes for performance
    __table_args__ = (
        UniqueConstraint("patient_id", name="uq_patient_photo"),
        Index("idx_patient_photos_patient_id", "patient_id"),
    )


class StandardizedTest(Base):
    """
    Standardized test definitions from LOINC database.
    Used for autocomplete, validation, and ensuring consistent test naming.
    """
    __tablename__ = "standardized_tests"

    id = Column(Integer, primary_key=True, index=True)
    loinc_code = Column(String(20), unique=True, index=True, nullable=True)
    test_name = Column(String(255), nullable=False, index=True)
    short_name = Column(String(100), nullable=True, index=True)
    default_unit = Column(String(50), nullable=True)
    category = Column(String(50), nullable=True, index=True)
    common_names = Column(JSON, nullable=True)  # Alternative test names (stored as JSON for SQLite compatibility)
    is_common = Column(Boolean, default=False, nullable=False, index=True)
    system = Column(String(100), nullable=True)
    loinc_class = Column(String(100), nullable=True)
    display_order = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Full-text search is created via migration
    __table_args__ = (
        Index("idx_standardized_tests_loinc_code", "loinc_code", unique=True),
        Index("idx_standardized_tests_test_name", "test_name"),
        Index("idx_standardized_tests_category", "category"),
        Index("idx_standardized_tests_is_common", "is_common"),
        Index("idx_standardized_tests_short_name", "short_name"),
    )


class InjuryType(Base):
    """
    Reusable injury types that populate the dropdown.
    Users can select existing types or create new ones.
    System types (is_system=True) are seeded defaults and cannot be deleted.
    """
    __tablename__ = "injury_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(300), nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    injuries = orm_relationship("Injury", back_populates="injury_type")

    # Indexes for performance
    __table_args__ = (
        Index("idx_injury_types_name", "name"),
        Index("idx_injury_types_is_system", "is_system"),
    )


class Injury(Base):
    """
    Represents a physical injury record for a patient.
    Tracks injuries like sprains, fractures, burns, etc.
    """
    __tablename__ = "injuries"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Core injury information
    injury_name = Column(String(300), nullable=False)
    injury_type_id = Column(Integer, ForeignKey("injury_types.id"), nullable=True)
    body_part = Column(String(100), nullable=False)
    laterality = Column(String(20), nullable=True)  # Use Laterality enum: left, right, bilateral, not_applicable
    date_of_injury = Column(Date, nullable=True)  # Optional - user may not remember exact date

    # How the injury occurred
    mechanism = Column(String(500), nullable=True)

    # Severity and status
    severity = Column(String(50), nullable=True)  # Use SeverityLevel enum
    status = Column(String(50), nullable=False, default="active")  # Use InjuryStatus enum

    # Treatment and recovery
    treatment_received = Column(Text, nullable=True)
    recovery_notes = Column(Text, nullable=True)

    # Related practitioner
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    # Additional notes and tags
    notes = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True, default=list)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="injuries")
    injury_type = orm_relationship("InjuryType", back_populates="injuries")
    practitioner = orm_relationship("Practitioner", back_populates="injuries")

    # Many-to-Many relationships through junction tables
    medication_relationships = orm_relationship(
        "InjuryMedication", back_populates="injury", cascade="all, delete-orphan"
    )
    condition_relationships = orm_relationship(
        "InjuryCondition", back_populates="injury", cascade="all, delete-orphan"
    )
    treatment_relationships = orm_relationship(
        "InjuryTreatment", back_populates="injury", cascade="all, delete-orphan"
    )
    procedure_relationships = orm_relationship(
        "InjuryProcedure", back_populates="injury", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_injuries_patient_id", "patient_id"),
        Index("idx_injuries_patient_status", "patient_id", "status"),
        Index("idx_injuries_injury_type", "injury_type_id"),
        Index("idx_injuries_date", "date_of_injury"),
    )


class InjuryMedication(Base):
    """
    Junction table for many-to-many relationship between injuries and medications.
    Allows linking medications used to treat injuries.
    """
    __tablename__ = "injury_medications"

    id = Column(Integer, primary_key=True)
    injury_id = Column(Integer, ForeignKey("injuries.id"), nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=False)

    # Optional context about how this medication relates to this injury
    relevance_note = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    injury = orm_relationship("Injury", back_populates="medication_relationships")
    medication = orm_relationship("Medication", back_populates="injury_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_injury_medication_injury_id", "injury_id"),
        Index("idx_injury_medication_medication_id", "medication_id"),
        UniqueConstraint("injury_id", "medication_id", name="uq_injury_medication"),
    )


class InjuryCondition(Base):
    """
    Junction table for many-to-many relationship between injuries and conditions.
    Allows linking conditions that resulted from or are related to injuries.
    """
    __tablename__ = "injury_conditions"

    id = Column(Integer, primary_key=True)
    injury_id = Column(Integer, ForeignKey("injuries.id"), nullable=False)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=False)

    # Optional context about how this condition relates to this injury
    relevance_note = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    injury = orm_relationship("Injury", back_populates="condition_relationships")
    condition = orm_relationship("Condition", back_populates="injury_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_injury_condition_injury_id", "injury_id"),
        Index("idx_injury_condition_condition_id", "condition_id"),
        UniqueConstraint("injury_id", "condition_id", name="uq_injury_condition"),
    )


class InjuryTreatment(Base):
    """
    Junction table for many-to-many relationship between injuries and treatments.
    Allows linking treatments used for injury recovery.
    """
    __tablename__ = "injury_treatments"

    id = Column(Integer, primary_key=True)
    injury_id = Column(Integer, ForeignKey("injuries.id"), nullable=False)
    treatment_id = Column(Integer, ForeignKey("treatments.id"), nullable=False)

    # Optional context about how this treatment relates to this injury
    relevance_note = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    injury = orm_relationship("Injury", back_populates="treatment_relationships")
    treatment = orm_relationship("Treatment", back_populates="injury_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_injury_treatment_injury_id", "injury_id"),
        Index("idx_injury_treatment_treatment_id", "treatment_id"),
        UniqueConstraint("injury_id", "treatment_id", name="uq_injury_treatment"),
    )


class InjuryProcedure(Base):
    """
    Junction table for many-to-many relationship between injuries and procedures.
    Allows linking procedures performed to treat injuries.
    """
    __tablename__ = "injury_procedures"

    id = Column(Integer, primary_key=True)
    injury_id = Column(Integer, ForeignKey("injuries.id"), nullable=False)
    procedure_id = Column(Integer, ForeignKey("procedures.id"), nullable=False)

    # Optional context about how this procedure relates to this injury
    relevance_note = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    injury = orm_relationship("Injury", back_populates="procedure_relationships")
    procedure = orm_relationship("Procedure", back_populates="injury_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_injury_procedure_injury_id", "injury_id"),
        Index("idx_injury_procedure_procedure_id", "procedure_id"),
        UniqueConstraint("injury_id", "procedure_id", name="uq_injury_procedure"),
    )


# =============================================================================
# Treatment Plan Relationship Tables (Phase: Treatment Plans Expansion)
# =============================================================================


class MedicalEquipment(Base):
    """
    Represents medical equipment prescribed to or used by a patient.
    Examples: CPAP machines, nebulizers, inhalers, blood pressure monitors, etc.
    """
    __tablename__ = "medical_equipment"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id", ondelete="SET NULL"), nullable=True)

    # Equipment identification
    equipment_name = Column(String, nullable=False)
    equipment_type = Column(String, nullable=False)  # CPAP, Nebulizer, Inhaler, Monitor, etc.
    manufacturer = Column(String, nullable=True)
    model_number = Column(String, nullable=True)
    serial_number = Column(String, nullable=True)

    # Dates
    prescribed_date = Column(Date, nullable=True)
    last_service_date = Column(Date, nullable=True)
    next_service_date = Column(Date, nullable=True)

    # Usage information
    usage_instructions = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")  # active, inactive, replaced

    # Additional info
    supplier = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    tags = Column(JSON, nullable=True, default=list)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="medical_equipment")
    practitioner = orm_relationship("Practitioner", back_populates="medical_equipment")

    # Many-to-Many relationship with treatments through junction table
    treatment_relationships = orm_relationship(
        "TreatmentEquipment", back_populates="equipment", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_medical_equipment_patient_id", "patient_id"),
        Index("idx_medical_equipment_status", "status"),
    )


class TreatmentMedication(Base):
    """
    Junction table for many-to-many relationship between treatments and medications.
    Allows linking medications to treatment plans with specific dosing instructions.
    """
    __tablename__ = "treatment_medications"

    id = Column(Integer, primary_key=True)
    treatment_id = Column(Integer, ForeignKey("treatments.id", ondelete="CASCADE"), nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id", ondelete="CASCADE"), nullable=False)

    # Treatment-specific medication details (overrides)
    specific_dosage = Column(String, nullable=True)
    specific_frequency = Column(String, nullable=True)
    specific_duration = Column(String, nullable=True)
    timing_instructions = Column(String, nullable=True)
    relevance_note = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    treatment = orm_relationship("Treatment", back_populates="medication_relationships")
    medication = orm_relationship("Medication", back_populates="treatment_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_treatment_medication_treatment_id", "treatment_id"),
        Index("idx_treatment_medication_medication_id", "medication_id"),
        UniqueConstraint("treatment_id", "medication_id", name="uq_treatment_medication"),
    )


class TreatmentEncounter(Base):
    """
    Junction table for many-to-many relationship between treatments and encounters.
    Allows linking visits to treatment plans with labels (initial, follow-up, etc.).
    """
    __tablename__ = "treatment_encounters"

    id = Column(Integer, primary_key=True)
    treatment_id = Column(Integer, ForeignKey("treatments.id", ondelete="CASCADE"), nullable=False)
    encounter_id = Column(Integer, ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False)

    # Encounter context within treatment
    visit_label = Column(String, nullable=True)  # initial, follow_up, review, final
    visit_sequence = Column(Integer, nullable=True)  # Order of visits: 1, 2, 3...
    relevance_note = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    treatment = orm_relationship("Treatment", back_populates="encounter_relationships")
    encounter = orm_relationship("Encounter", back_populates="treatment_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_treatment_encounter_treatment_id", "treatment_id"),
        Index("idx_treatment_encounter_encounter_id", "encounter_id"),
        UniqueConstraint("treatment_id", "encounter_id", name="uq_treatment_encounter"),
    )


class TreatmentLabResult(Base):
    """
    Junction table for many-to-many relationship between treatments and lab results.
    Allows linking lab results to treatment plans with purpose labels.
    """
    __tablename__ = "treatment_lab_results"

    id = Column(Integer, primary_key=True)
    treatment_id = Column(Integer, ForeignKey("treatments.id", ondelete="CASCADE"), nullable=False)
    lab_result_id = Column(Integer, ForeignKey("lab_results.id", ondelete="CASCADE"), nullable=False)

    # Lab result context within treatment
    purpose = Column(String, nullable=True)  # baseline, monitoring, outcome, safety
    expected_frequency = Column(String, nullable=True)  # e.g., "Monthly", "Every 3 months"
    relevance_note = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    treatment = orm_relationship("Treatment", back_populates="lab_result_relationships")
    lab_result = orm_relationship("LabResult", back_populates="treatment_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_treatment_lab_result_treatment_id", "treatment_id"),
        Index("idx_treatment_lab_result_lab_result_id", "lab_result_id"),
        UniqueConstraint("treatment_id", "lab_result_id", name="uq_treatment_lab_result"),
    )


class TreatmentEquipment(Base):
    """
    Junction table for many-to-many relationship between treatments and medical equipment.
    Allows linking equipment to treatment plans with usage details.
    """
    __tablename__ = "treatment_equipment"

    id = Column(Integer, primary_key=True)
    treatment_id = Column(Integer, ForeignKey("treatments.id", ondelete="CASCADE"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("medical_equipment.id", ondelete="CASCADE"), nullable=False)

    # Equipment usage context within treatment
    usage_frequency = Column(String, nullable=True)  # e.g., "Nightly", "As needed"
    specific_settings = Column(String, nullable=True)  # e.g., "Pressure: 10 cmH2O"
    relevance_note = Column(String, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    treatment = orm_relationship("Treatment", back_populates="equipment_relationships")
    equipment = orm_relationship("MedicalEquipment", back_populates="treatment_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_treatment_equipment_treatment_id", "treatment_id"),
        Index("idx_treatment_equipment_equipment_id", "equipment_id"),
        UniqueConstraint("treatment_id", "equipment_id", name="uq_treatment_equipment"),
    )


class NotificationChannel(Base):
    """
    Represents a notification channel for a user (Discord, Email, Gotify, Webhook).
    Stores encrypted configuration for each channel type.
    """
    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(100), nullable=False)
    channel_type = Column(String(20), nullable=False)  # discord, email, gotify, webhook
    config_encrypted = Column(Text, nullable=False)  # Encrypted JSON config

    is_enabled = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    last_test_at = Column(DateTime, nullable=True)
    last_test_status = Column(String(20), nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    total_notifications_sent = Column(Integer, default=0, nullable=False)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    user = orm_relationship("User", back_populates="notification_channels")
    preferences = orm_relationship(
        "NotificationPreference",
        back_populates="channel",
        cascade="all, delete-orphan"
    )
    history = orm_relationship(
        "NotificationHistory",
        back_populates="channel"
    )

    # Indexes and constraints
    __table_args__ = (
        Index("idx_notification_channels_user_id", "user_id"),
        UniqueConstraint("user_id", "name", name="uq_user_channel_name"),
    )


class NotificationPreference(Base):
    """
    Links event types to channels. Users can configure which events
    trigger notifications on which channels.
    Many-to-Many: Each event can go to multiple channels.
    """
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    channel_id = Column(Integer, ForeignKey("notification_channels.id", ondelete="CASCADE"), nullable=False)

    event_type = Column(String(50), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    remind_before_minutes = Column(Integer, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    user = orm_relationship("User")
    channel = orm_relationship("NotificationChannel", back_populates="preferences")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_notification_prefs_user_id", "user_id"),
        Index("idx_notification_prefs_channel_id", "channel_id"),
        Index("idx_notification_prefs_event_type", "event_type"),
        UniqueConstraint("user_id", "channel_id", "event_type", name="uq_user_channel_event"),
    )


class NotificationHistory(Base):
    """
    Records sent notifications for audit and troubleshooting.
    Tracks delivery status, errors, and retry attempts.
    """
    __tablename__ = "notification_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    channel_id = Column(Integer, ForeignKey("notification_channels.id", ondelete="SET NULL"), nullable=True)

    event_type = Column(String(50), nullable=False)
    event_data = Column(JSON, nullable=True)
    title = Column(String(255), nullable=False)
    message_preview = Column(String(500), nullable=True)

    status = Column(String(20), nullable=False)  # pending, sent, failed
    attempt_count = Column(Integer, default=1, nullable=False)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    sent_at = Column(DateTime, nullable=True)

    # Table Relationships
    user = orm_relationship("User")
    channel = orm_relationship("NotificationChannel", back_populates="history")

    # Indexes for performance
    __table_args__ = (
        Index("idx_notification_history_user_id", "user_id"),
        Index("idx_notification_history_status", "status"),
        Index("idx_notification_history_created_at", "created_at"),
        Index("idx_notification_history_event_type", "event_type"),
    )


class SystemSetting(Base):
    """
    System-wide settings stored as key-value pairs.

    Used for storing configuration values, feature flags, migration status,
    library versions, and other system-level metadata.

    Examples:
    - test_library_version: "1.2.3"
    - canonical_name_migration_complete: "true"
    - last_sync_timestamp: "2026-01-31T12:00:00Z"
    """
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)
