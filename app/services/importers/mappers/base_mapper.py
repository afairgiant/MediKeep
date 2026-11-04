"""
Base class for FHIR resource mappers.
Each mapper turns one FHIR resource type into column values for one MediKeep model.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, List, Optional, Tuple

# What a mapper may raise on malformed input; the service skips the resource
MAPPING_ERRORS = (
    AttributeError,
    KeyError,
    IndexError,
    ValueError,
    TypeError,
    ArithmeticError,
)


@dataclass
class MappedRecord:
    """Column values for one row, plus what identifies it across imports."""

    record_type: str
    external_id: Optional[str]
    data: dict
    hash_parts: Tuple[Any, ...]  # Fields that define "the same record"
    label: str  # Short description for messages
    warnings: List[str] = field(default_factory=list)  # Values changed to fit


class BaseResourceMapper(ABC):
    """Base class for FHIR resource mappers."""

    RESOURCE_TYPE = "Resource"
    RECORD_TYPE = "record"  # Value of import_provenance.record_type
    MODEL: Any = None  # SQLAlchemy model the rows are written to
    CREATE_SCHEMA: Any = None  # Pydantic create schema the mapped data must satisfy

    # Fields the user owns once a row exists; never overwritten on re-import
    preserve_on_update: Tuple[str, ...] = ("notes", "tags")

    @abstractmethod
    def map(self, resource: dict, bundle: dict) -> Optional[MappedRecord]:
        """Map one resource to a MappedRecord, or None to skip it."""

    @abstractmethod
    def hash_parts_for_row(self, row: Any) -> Tuple[Any, ...]:
        """The same hash_parts, read back from an existing row."""
