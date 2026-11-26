from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class ImagingStudy(Base):
    """A DICOM imaging study (one exam) with its series and images stored on disk."""

    __tablename__ = "imaging_studies"

    id = Column(Integer, primary_key=True)
    patient_id = Column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    study_instance_uid = Column(String(64), nullable=False)

    # Read from the DICOM header on import
    study_date = Column(Date, nullable=True)
    modalities = Column(JSON, nullable=True, default=list)
    body_part = Column(String(64), nullable=True)
    study_description = Column(String(255), nullable=True)
    accession_number = Column(String(64), nullable=True)
    institution_name = Column(String(255), nullable=True)
    referring_physician = Column(String(255), nullable=True)

    notes = Column(Text, nullable=True)
    report_text = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True, default=list)

    procedure_id = Column(
        Integer, ForeignKey("procedures.id", ondelete="SET NULL"), nullable=True
    )
    encounter_id = Column(
        Integer, ForeignKey("encounters.id", ondelete="SET NULL"), nullable=True
    )
    practitioner_id = Column(
        Integer, ForeignKey("practitioners.id", ondelete="SET NULL"), nullable=True
    )

    series_count = Column(Integer, nullable=False, default=0)
    instance_count = Column(Integer, nullable=False, default=0)
    total_size = Column(BigInteger, nullable=False, default=0)  # bytes

    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    patient = orm_relationship("Patient", back_populates="imaging_studies")
    procedure = orm_relationship("Procedure")
    encounter = orm_relationship("Encounter")
    practitioner = orm_relationship("Practitioner")
    series = orm_relationship(
        "ImagingSeries",
        back_populates="study",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ImagingSeries.series_number",
    )

    __table_args__ = (
        UniqueConstraint(
            "patient_id",
            "study_instance_uid",
            name="uq_imaging_studies_patient_study_uid",
        ),
        Index("idx_imaging_studies_patient_date", "patient_id", "study_date"),
        Index("idx_imaging_studies_procedure_id", "procedure_id"),
        Index("idx_imaging_studies_encounter_id", "encounter_id"),
        Index("idx_imaging_studies_practitioner_id", "practitioner_id"),
    )


class ImagingSeries(Base):
    """One series (a run of images) within an imaging study."""

    __tablename__ = "imaging_series"

    id = Column(Integer, primary_key=True)
    study_id = Column(
        Integer, ForeignKey("imaging_studies.id", ondelete="CASCADE"), nullable=False
    )
    series_instance_uid = Column(String(64), nullable=False)
    modality = Column(String(16), nullable=True)
    series_number = Column(Integer, nullable=True)
    series_description = Column(String(255), nullable=True)
    instance_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    study = orm_relationship("ImagingStudy", back_populates="series")
    instances = orm_relationship(
        "ImagingInstance",
        back_populates="series",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ImagingInstance.instance_number",
    )

    __table_args__ = (
        UniqueConstraint(
            "study_id",
            "series_instance_uid",
            name="uq_imaging_series_study_series_uid",
        ),
    )


class ImagingInstance(Base):
    """One stored DICOM file (an image, possibly multi-frame) within a series."""

    __tablename__ = "imaging_instances"

    id = Column(Integer, primary_key=True)
    series_id = Column(
        Integer, ForeignKey("imaging_series.id", ondelete="CASCADE"), nullable=False
    )
    sop_instance_uid = Column(String(64), nullable=False)
    instance_number = Column(Integer, nullable=True)
    file_path = Column(String, nullable=False)
    file_size = Column(BigInteger, nullable=False)  # bytes
    transfer_syntax_uid = Column(String(64), nullable=True)
    rows = Column(Integer, nullable=True)
    cols = Column(Integer, nullable=True)
    number_of_frames = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    series = orm_relationship("ImagingSeries", back_populates="instances")

    __table_args__ = (
        UniqueConstraint(
            "series_id",
            "sop_instance_uid",
            name="uq_imaging_instances_series_sop_uid",
        ),
    )
