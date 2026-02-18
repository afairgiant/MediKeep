from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class Practice(Base):
    """
    Represents a medical practice or clinic that practitioners belong to.
    Stores practice-level contact info, patient portal, and location details.
    """

    __tablename__ = "practices"
    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False, unique=True)
    phone_number = Column(String, nullable=True)
    fax_number = Column(String, nullable=True)
    website = Column(String, nullable=True)
    patient_portal_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    locations = Column(JSON, nullable=True)  # Array of location objects

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    practitioners = orm_relationship("Practitioner", back_populates="practice_rel")


class Practitioner(Base):
    """Represents a healthcare practitioner (doctor, specialist, etc.)."""
    __tablename__ = "practitioners"
    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)
    specialty = Column(String, nullable=False)
    practice = Column(String, nullable=True)  # Legacy field - kept for migration safety
    practice_id = Column(Integer, ForeignKey("practices.id", ondelete="SET NULL"), nullable=True)
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    rating = Column(Float, nullable=True)  # Rating from 0.0 to 5.0

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    practice_rel = orm_relationship("Practice", back_populates="practitioners")
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

    # Indexes for performance
    __table_args__ = (Index("idx_practitioners_practice_id", "practice_id"),)


class Pharmacy(Base):
    """Represents a pharmacy where prescriptions are filled."""
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
