from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class ImportProvenance(Base):
    """Where an imported record came from, and a hash of what the import wrote."""

    __tablename__ = "import_provenance"

    id = Column(Integer, primary_key=True)
    patient_id = Column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    record_type = Column(String, nullable=False)  # 'condition', 'allergy', ...
    record_id = Column(Integer, nullable=False)  # ID in that record type's table
    source = Column(String, nullable=False)  # 'fhir', 'ccda'
    external_id = Column(String, nullable=True)  # Resource id in the source file
    content_hash = Column(String(64), nullable=False)  # sha256 of the mapped fields
    import_batch_id = Column(String(32), nullable=False)  # One id per execute call
    imported_at = Column(DateTime, default=get_utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "record_type", "record_id", name="uq_import_provenance_record"
        ),
        UniqueConstraint(
            "patient_id",
            "record_type",
            "source",
            "external_id",
            name="uq_import_provenance_external",
        ),
        Index(
            "idx_import_provenance_patient_hash",
            "patient_id",
            "record_type",
            "content_hash",
        ),
        Index("idx_import_provenance_batch", "import_batch_id"),
    )

    patient = orm_relationship("Patient")
