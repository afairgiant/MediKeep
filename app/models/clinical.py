from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Time,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


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


class Condition(Base):
    """Represents a medical condition or diagnosis for a patient."""
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
    """Represents a vaccine or immunization administered to a patient."""
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


class Allergy(Base):
    """Represents a patient allergy with reaction details and severity."""
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
    """Represents a set of vital sign measurements recorded for a patient."""
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
