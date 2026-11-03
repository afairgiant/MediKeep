"""Content hashing and provenance lookups for imported records."""

import hashlib
from datetime import date, datetime
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.models.import_provenance import ImportProvenance


def content_hash(parts: Iterable[Optional[object]]) -> str:
    """sha256 over the normalized parts; dates and ISO strings hash the same."""
    normalized = []
    for part in parts:
        if part is None:
            normalized.append("")
            continue
        if isinstance(part, (date, datetime)):
            part = part.isoformat()
        normalized.append(" ".join(str(part).split()).lower())
    return hashlib.sha256("\x1f".join(normalized).encode("utf-8")).hexdigest()


def find_by_external_id(
    db: Session,
    patient_id: int,
    record_type: str,
    source: str,
    external_id: Optional[str],
) -> Optional[ImportProvenance]:
    """Provenance row for a source record id, if that record was imported before."""
    if not external_id:
        return None
    return (
        db.query(ImportProvenance)
        .filter(
            ImportProvenance.patient_id == patient_id,
            ImportProvenance.record_type == record_type,
            ImportProvenance.source == source,
            ImportProvenance.external_id == external_id,
        )
        .first()
    )


def find_by_content_hash(
    db: Session, patient_id: int, record_type: str, hash_value: str
) -> Optional[ImportProvenance]:
    """Provenance row whose imported content matches, regardless of source id."""
    return (
        db.query(ImportProvenance)
        .filter(
            ImportProvenance.patient_id == patient_id,
            ImportProvenance.record_type == record_type,
            ImportProvenance.content_hash == hash_value,
        )
        .first()
    )


def is_locally_edited(provenance: ImportProvenance, current_hash: str) -> bool:
    """True when the row no longer matches what the import wrote."""
    return provenance.content_hash != current_hash
