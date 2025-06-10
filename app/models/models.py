from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Text
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)

    # Role-based access control
    role = Column(String, nullable=False)  # e.g., 'admin', 'user', 'guest'

    patient = relationship("Patient", back_populates="user", uselist=False)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    birthDate = Column(Date, nullable=False)

    gender = Column(String, nullable=False)
    address = Column(String, nullable=False)  # Table Relationships
    user = relationship("User", back_populates="patient")
    medications = relationship("Medication", back_populates="patient")
    encounters = relationship("Encounter", back_populates="patient")
    lab_results = relationship("LabResult", back_populates="patient")
    immunizations = relationship("Immunization", back_populates="patient")
    conditions = relationship("Condition", back_populates="patient")
    procedures = relationship("Procedure", back_populates="patient")
    treatments = relationship("Treatment", back_populates="patient")
    allergies = relationship("Allergy", back_populates="patient")


class Practitioner(Base):
    __tablename__ = "practitioners"
    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)
    specialty = Column(String, nullable=False)
    practice = Column(String, nullable=False)

    # Table Relationships
    medications = relationship("Medication", back_populates="practitioner")
    encounters = relationship("Encounter", back_populates="practitioner")
    lab_results = relationship("LabResult", back_populates="practitioner")
    immunizations = relationship("Immunization", back_populates="practitioner")
    procedures = relationship("Procedure", back_populates="practitioner")
    treatments = relationship("Treatment", back_populates="practitioner")
    conditions = relationship("Condition", back_populates="practitioner")


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

    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)

    # Table Relationships
    patient = relationship("Patient", back_populates="medications")
    practitioner = relationship("Practitioner", back_populates="medications")


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

    # Status and dates
    status = Column(
        String, nullable=False, default="ordered"
    )  # 'ordered', 'completed', 'cancelled'
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
    code = Column(String, nullable=True)  # Code for the procedure (e.g., CPT code)
    date = Column(Date, nullable=False)  # Date when the procedure was performed
    description = Column(String, nullable=True)  # Description of the procedure
    status = Column(
        String, nullable=True
    )  # e.g., 'completed', 'in-progress', 'cancelled'
    notes = Column(String, nullable=True)  # Additional notes about the procedure

    # Table Relationships
    patient = relationship("Patient", back_populates="procedures")
    practitioner = relationship("Practitioner", back_populates="procedures")


class Treatment(Base):
    __tablename__ = "treatments"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    practitioner_id = Column(Integer, ForeignKey("practitioners.id"), nullable=True)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=True)
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
