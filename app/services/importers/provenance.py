"""Content hashing and provenance lookups for imported records."""

import hashlib
from datetime import date, datetime
from decimal import Decimal
from typing import Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models.import_provenance import ImportProvenance


def _normalize(part: object) -> str:
    """One hash part as text: dates in ISO form, numbers canonical, the rest folded."""
    if isinstance(part, (date, datetime)):
        return part.isoformat().lower()
    if isinstance(part, bool):
        return str(part).lower()
    text = " ".join(str(part).split())
    if isinstance(part, (int, float, Decimal)) or _looks_numeric(text):
        try:
            number = Decimal(text)
            if number.is_finite():
                # 120, 120.0 and 120.00 are the same value
                number = number.normalize()
                if number == 0:
                    number = Decimal(0)
                return format(number, "f")
        except ArithmeticError:
            # Exponents past the decimal context (1e1000000) hash as text
            pass
    return text.lower()


def _looks_numeric(text: str) -> bool:
    """True for plain decimal strings like 7, -3.5 or 1e3; not for dates or codes."""
    stripped = text.lstrip("+-")
    return (
        bool(stripped)
        and stripped[0].isdigit()
        and all(c.isdigit() or c in ".eE+-" for c in stripped)
    )


def content_hash(parts: Iterable[Optional[object]]) -> str:
    """sha256 over the normalized parts; dates, numbers and case are canonicalized."""
    normalized = ["" if part is None else _normalize(part) for part in parts]
    return hashlib.sha256("\x1f".join(normalized).encode("utf-8")).hexdigest()


def list_for_patient(
    db: Session, patient_id: int, record_types: Iterable[str]
) -> List[ImportProvenance]:
    """Every provenance row of the patient for the given record types."""
    return (
        db.query(ImportProvenance)
        .filter(
            ImportProvenance.patient_id == patient_id,
            ImportProvenance.record_type.in_(list(record_types)),
        )
        .order_by(ImportProvenance.id)
        .all()
    )


def is_locally_edited(provenance: ImportProvenance, current_hash: str) -> bool:
    """True when the row no longer matches what the import wrote."""
    return provenance.content_hash != current_hash
