from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class Procedure(Base):
    """Represents a medical procedure performed on a patient."""
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
    outcome = Column(
        String, nullable=True
    )  # Use ProcedureOutcome enum: successful, abnormal, complications, inconclusive, pending
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
    """Represents a treatment plan for a patient, linked to conditions and medications."""
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
    mode = Column(String, nullable=False, default="simple")  # "simple" or "advanced"

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
