from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


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
