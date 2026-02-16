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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class Patient(Base):
    """Represents a patient record with demographics, ownership, and sharing controls."""
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


class EmergencyContact(Base):
    """Represents an emergency contact for a patient."""
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
