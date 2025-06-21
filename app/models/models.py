from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Text, Float
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, timezone

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
    role = Column(String, nullable=False)  # e.g., 'admin', 'user', 'guest'    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    patient = relationship("Patient", back_populates="user", uselist=False)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    birthDate = Column(Date, nullable=False)

    physician_id = Column(
        Integer, ForeignKey("practitioners.id"), nullable=True
    )  # Primary care physician

    bloodType = Column(String, nullable=True)  # e.g., 'A+', 'O-', etc.
    height = Column(Integer, nullable=True)  # in inches
    weight = Column(Integer, nullable=True)  # in lbs
    gender = Column(String, nullable=True)
    address = Column(String, nullable=True)  
    
    # Table Relationships
    user = relationship("User", back_populates="patient")
    practitioner = relationship("Practitioner", back_populates="patients")
    medications = relationship("Medication", back_populates="patient")
    encounters = relationship("Encounter", back_populates="patient")
    lab_results = relationship("LabResult", back_populates="patient")
    immunizations = relationship("Immunization", back_populates="patient")
    conditions = relationship("Condition", back_populates="patient")
    procedures = relationship("Procedure", back_populates="patient")
    treatments = relationship("Treatment", back_populates="patient")
    allergies = relationship("Allergy", back_populates="patient")
    vitals = relationship("Vitals", back_populates="patient")


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
    patients = relationship("Patient", back_populates="practitioner")
    medications = relationship("Medication", back_populates="practitioner")
    encounters = relationship("Encounter", back_populates="practitioner")
    lab_results = relationship("LabResult", back_populates="practitioner")
    immunizations = relationship("Immunization", back_populates="practitioner")
    procedures = relationship("Procedure", back_populates="practitioner")
    treatments = relationship("Treatment", back_populates="practitioner")
    conditions = relationship("Condition", back_populates="practitioner")
    vitals = relationship("Vitals", back_populates="practitioner")


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
    effectivePeriod_start = Column(Date, nullable=True)  # Start date of the medication
    effectivePeriod_end = Column(Date, nullable=True)  # End date of the medication
    status = Column(String, nullable=True)  # e.g., 'active', 'stopped, 'on-hold'
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    # Table Relationships
    patient = relationship("Patient", back_populates="medications")
    practitioner = relationship("Practitioner", back_populates="medications")
    pharmacy = relationship("Pharmacy", back_populates="medications")


class Encounter(Base):
    """
    Represents a medical encounter between a patient and a practitioner.
    """

    __tablename__ = "encounters"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"))

    reason = Column(String, nullable=False)  # Reason for the encounter
    date = Column(Date, nullable=False)  # Date of the encounter
    notes = Column(String, nullable=True)  # Additional notes from the encounter

    # Table Relationships
    patient = relationship("Patient", back_populates="encounters")
    practitioner = relationship("Practitioner", back_populates="encounters")


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
    )  # 'ordered', 'completed', 'cancelled'
    labs_result = Column(
        String, nullable=True
    )  # Lab result interpretation: 'normal', 'abnormal', etc.
    ordered_date = Column(DateTime, nullable=False)  # When the test was ordered
    completed_date = Column(DateTime, nullable=True)  # When results were received

    # Optional notes
    notes = Column(Text, nullable=True)  # Any additional notes about the test

    # Audit fields
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    # Table Relationships
    patient = relationship("Patient", back_populates="lab_results")
    practitioner = relationship("Practitioner", back_populates="lab_results")

    # One-to-Many relationship with LabResultFile (actual test results: PDFs, images, etc.)
    files = relationship(
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
    lab_result = relationship("LabResult", back_populates="files")


class Condition(Base):
    __tablename__ = "conditions"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    # Condition details
    condition_name = Column(String, nullable=True)  # Name of the condition
    diagnosis = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    onsetDate = Column(
        Date, nullable=True
    )  # Date when the condition was first diagnosed
    status = Column(String, nullable=False)  # e.g., 'active', 'resolved', 'chronic'

    # Table Relationships
    patient = relationship("Patient", back_populates="conditions")
    practitioner = relationship("Practitioner", back_populates="conditions")
    treatments = relationship("Treatment", back_populates="condition")


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

    # Table Relationships
    patient = relationship("Patient", back_populates="immunizations")
    practitioner = relationship("Practitioner", back_populates="immunizations")


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
    )  # e.g., 'completed', 'in-progress', 'cancelled'
    notes = Column(String, nullable=True)  # Additional notes about the procedure
    facility = Column(
        String, nullable=True
    )  # Facility where the procedure was performed
    # Table Relationships
    patient = relationship("Patient", back_populates="procedures")
    practitioner = relationship("Practitioner", back_populates="procedures")


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
    status = Column(String, nullable=True)  # e.g., 'ongoing', 'completed', 'cancelled'
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
    )  # Location where the treatment is administered    # Table Relationships
    patient = relationship("Patient", back_populates="treatments")
    practitioner = relationship("Practitioner", back_populates="treatments")
    condition = relationship("Condition", back_populates="treatments")


class Allergy(Base):
    __tablename__ = "allergies"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    allergen = Column(String, nullable=False)  # Allergen name
    reaction = Column(String, nullable=False)  # Reaction to the allergen
    severity = Column(
        String, nullable=True
    )  # Severity of the reaction (e.g., 'mild', 'severe')
    onset_date = Column(Date, nullable=True)  # Date when the allergy was first noted
    status = Column(String, nullable=True)  # e.g., 'active', 'resolved'
    notes = Column(String, nullable=True)  # Additional notes about the allergy

    # Table Relationships
    patient = relationship("Patient", back_populates="allergies")


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
    location = Column(String, nullable=True)  # Where readings were taken (home, clinic, etc.)
    device_used = Column(String, nullable=True)  # Device used for measurement    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    patient = relationship("Patient", back_populates="vitals")
    practitioner = relationship("Practitioner", back_populates="vitals")

class Pharmacy(Base):
    __tablename__ = "pharmacies"
    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)

    # Table Relationships
    medications = relationship("Medication", back_populates="pharmacy")