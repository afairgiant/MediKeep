from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


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
