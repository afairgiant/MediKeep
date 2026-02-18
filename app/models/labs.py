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
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class LabResult(Base):
    """Represents a lab test order and its results for a patient."""
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

    # Tagging system
    tags = Column(JSON, nullable=True, default=list)

    # Table Relationships
    patient = orm_relationship("Patient", back_populates="lab_results")
    practitioner = orm_relationship("Practitioner", back_populates="lab_results")

    # One-to-Many relationship with LabResultFile (actual test results: PDFs, images, etc.)
    files = orm_relationship(
        "LabResultFile", back_populates="lab_result", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with conditions through junction table
    condition_relationships = orm_relationship(
        "LabResultCondition", back_populates="lab_result", cascade="all, delete-orphan"
    )

    # One-to-Many relationship with individual test components
    test_components = orm_relationship(
        "LabTestComponent", back_populates="lab_result", cascade="all, delete-orphan"
    )

    # Many-to-Many relationship with treatments through junction table
    treatment_relationships = orm_relationship(
        "TreatmentLabResult", back_populates="lab_result", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_lab_results_patient_id", "patient_id"),
        Index("idx_lab_results_patient_date", "patient_id", "completed_date"),
    )


class LabResultFile(Base):
    """Represents a file attachment (PDF, image) associated with a lab result."""
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


class LabTestComponent(Base):
    """
    Individual test components/values within a lab result.
    Each LabResult can have multiple test components (WBC, RBC, Glucose, etc.).
    """
    __tablename__ = "lab_test_components"

    id = Column(Integer, primary_key=True)
    lab_result_id = Column(Integer, ForeignKey("lab_results.id"), nullable=False)

    # Test identification
    test_name = Column(String, nullable=False)  # e.g., "White Blood Cell Count"
    abbreviation = Column(String, nullable=True)  # e.g., "WBC"
    test_code = Column(String, nullable=True)  # LOINC code

    # Test values
    value = Column(Float, nullable=False)  # Numeric result
    unit = Column(String, nullable=False)  # e.g., "K/uL", "mg/dL"

    # Reference ranges
    ref_range_min = Column(Float, nullable=True)
    ref_range_max = Column(Float, nullable=True)
    ref_range_text = Column(String, nullable=True)  # For non-numeric ranges

    # Status and organization
    status = Column(String, nullable=True)  # normal, high, low, critical
    category = Column(String, nullable=True)  # hematology, chemistry, etc.
    display_order = Column(Integer, nullable=True)  # For consistent ordering

    # Canonical test name for trend matching
    canonical_test_name = Column(String, nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    lab_result = orm_relationship("LabResult", back_populates="test_components")

    # Indexes for performance
    __table_args__ = (
        Index("idx_lab_test_components_lab_result_id", "lab_result_id"),
        Index("idx_lab_test_components_status", "status"),
        Index("idx_lab_test_components_category", "category"),
        Index("ix_lab_test_components_canonical_test_name", "canonical_test_name"),
        # Compound indexes for common query patterns
        Index("idx_lab_test_components_lab_result_status", "lab_result_id", "status"),
        Index("idx_lab_test_components_lab_result_category", "lab_result_id", "category"),
        Index("idx_lab_test_components_test_name_text", "test_name"),
        Index("idx_lab_test_components_abbreviation_text", "abbreviation"),
    )


class StandardizedTest(Base):
    """
    Standardized test definitions from LOINC database.
    Used for autocomplete, validation, and ensuring consistent test naming.
    """
    __tablename__ = "standardized_tests"

    id = Column(Integer, primary_key=True, index=True)
    loinc_code = Column(String(20), unique=True, index=True, nullable=True)
    test_name = Column(String(255), nullable=False, index=True)
    short_name = Column(String(100), nullable=True, index=True)
    default_unit = Column(String(50), nullable=True)
    category = Column(String(50), nullable=True, index=True)
    common_names = Column(JSON, nullable=True)  # Alternative test names (stored as JSON for SQLite compatibility)
    is_common = Column(Boolean, default=False, nullable=False, index=True)
    system = Column(String(100), nullable=True)
    loinc_class = Column(String(100), nullable=True)
    display_order = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Indexes for performance
    __table_args__ = (
        Index("idx_standardized_tests_loinc_code", "loinc_code", unique=True),
        Index("idx_standardized_tests_test_name", "test_name"),
        Index("idx_standardized_tests_category", "category"),
        Index("idx_standardized_tests_is_common", "is_common"),
        Index("idx_standardized_tests_short_name", "short_name"),
    )
