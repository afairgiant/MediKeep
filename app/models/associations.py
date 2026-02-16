from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


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

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    symptom = orm_relationship("Symptom", back_populates="treatment_relationships")
    treatment = orm_relationship("Treatment", back_populates="symptom_relationships")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_symptom_treatment_symptom_id", "symptom_id"),
        Index("idx_symptom_treatment_treatment_id", "treatment_id"),
        UniqueConstraint("symptom_id", "treatment_id", name="uq_symptom_treatment"),
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

    # Treatment-specific prescriber/pharmacy/dates (overrides for advanced mode)
    specific_prescriber_id = Column(
        Integer, ForeignKey("practitioners.id", ondelete="SET NULL"), nullable=True
    )
    specific_pharmacy_id = Column(
        Integer, ForeignKey("pharmacies.id", ondelete="SET NULL"), nullable=True
    )
    specific_start_date = Column(Date, nullable=True)
    specific_end_date = Column(Date, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    treatment = orm_relationship("Treatment", back_populates="medication_relationships")
    medication = orm_relationship("Medication", back_populates="treatment_relationships")
    specific_prescriber = orm_relationship(
        "Practitioner", foreign_keys=[specific_prescriber_id]
    )
    specific_pharmacy = orm_relationship(
        "Pharmacy", foreign_keys=[specific_pharmacy_id]
    )

    # Indexes and constraints
    __table_args__ = (
        Index("idx_treatment_medication_treatment_id", "treatment_id"),
        Index("idx_treatment_medication_medication_id", "medication_id"),
        Index("idx_treatment_medication_prescriber_id", "specific_prescriber_id"),
        Index("idx_treatment_medication_pharmacy_id", "specific_pharmacy_id"),
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
