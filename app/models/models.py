from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship as orm_relationship

# Import status enums for consistent status management
from .enums import (
    AllergyStatus,
    ConditionStatus,
    EncounterPriority,
    LabResultStatus,
    MedicationStatus,
    ProcedureStatus,
    SeverityLevel,
    TreatmentStatus,
    get_all_allergy_statuses,
    get_all_condition_statuses,
    get_all_encounter_priorities,
    get_all_lab_result_statuses,
    get_all_medication_statuses,
    get_all_procedure_statuses,
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
    role = Column(
        String, nullable=False
    )  # e.g., 'admin', 'user', 'guest'    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    patient = orm_relationship("Patient", back_populates="user", uselist=False)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    birth_date = Column(Date, nullable=False)

    physician_id = Column(
        Integer, ForeignKey("practitioners.id"), nullable=True
    )  # Primary care physician

    blood_type = Column(String, nullable=True)  # e.g., 'A+', 'O-', etc.
    height = Column(Integer, nullable=True)  # in inches
    weight = Column(Integer, nullable=True)  # in lbs
    gender = Column(String, nullable=True)
    address = Column(String, nullable=True)

    # Table Relationships
    user = orm_relationship("User", back_populates="patient")
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
    emergency_contacts = orm_relationship(
        "EmergencyContact", back_populates="patient", cascade="all, delete-orphan"
    )


class Practitioner(Base):
    __tablename__ = "practitioners"
    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)
    specialty = Column(String, nullable=False)
    practice = Column(String, nullable=False)
    phone_number = Column(String, nullable=True)
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


class Medication(Base):
    """
    Represents a medication
    """

    __tablename__ = "medications"
    id = Column(Integer, primary_key=True)

    medication_name = Column(String, nullable=False)
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

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="medications")
    practitioner = orm_relationship("Practitioner", back_populates="medications")
    pharmacy = orm_relationship("Pharmacy", back_populates="medications")


class Encounter(Base):
    """
    Represents a medical encounter between a patient and a practitioner.
    """

    __tablename__ = "encounters"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"))

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

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="encounters")
    practitioner = orm_relationship("Practitioner", back_populates="encounters")


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

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="lab_results")
    practitioner = orm_relationship("Practitioner", back_populates="lab_results")

    # One-to-Many relationship with LabResultFile (actual test results: PDFs, images, etc.)
    files = orm_relationship(
        "LabResultFile", back_populates="lab_result", cascade="all, delete-orphan"
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


class Condition(Base):
    __tablename__ = "conditions"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

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

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="conditions")
    practitioner = orm_relationship("Practitioner", back_populates="conditions")
    treatments = orm_relationship("Treatment", back_populates="condition")


class Immunization(Base):
    __tablename__ = "immunizations"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    # Primary vaccine information
    vaccine_name = Column(String, nullable=False)  # Name of the vaccine
    date_administered = Column(Date, nullable=False)  # Date when administered
    dose_number = Column(Integer, nullable=True)  # Dose number in series

    # Vaccine details
    lot_number = Column(String, nullable=True)  # Vaccine lot number
    manufacturer = Column(String, nullable=True)  # Vaccine manufacturer
    site = Column(String, nullable=True)  # Injection site
    route = Column(String, nullable=True)  # Route of administration
    expiration_date = Column(Date, nullable=True)  # Vaccine expiration date
    notes = Column(Text, nullable=True)  # Additional notes

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="immunizations")
    practitioner = orm_relationship("Practitioner", back_populates="immunizations")


class Procedure(Base):
    __tablename__ = "procedures"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    procedure_name = Column(String, nullable=False)  # Name of the procedure
    code = Column(String, nullable=True)  # Code for the procedure (e.g., CPT code)
    date = Column(Date, nullable=False)  # Date when the procedure was performed
    description = Column(String, nullable=True)  # Description of the procedure
    status = Column(
        String, nullable=True
    )  # Use ProcedureStatus enum: scheduled, in_progress, completed, cancelled
    notes = Column(String, nullable=True)  # Additional notes about the procedure
    facility = Column(
        String, nullable=True
    )  # Facility where the procedure was performed

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="procedures")
    practitioner = orm_relationship("Practitioner", back_populates="procedures")


class Treatment(Base):
    __tablename__ = "treatments"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=True)

    treatment_name = Column(String, nullable=False)  # Name of the treatment
    treatment_type = Column(
        String, nullable=False
    )  # Type of treatment (e.g., 'physical therapy', 'surgery')
    start_date = Column(Date, nullable=False)  # Start date of the treatment
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

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="treatments")
    practitioner = orm_relationship("Practitioner", back_populates="treatments")
    condition = orm_relationship("Condition", back_populates="treatments")


class Allergy(Base):
    __tablename__ = "allergies"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
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

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="allergies")


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
