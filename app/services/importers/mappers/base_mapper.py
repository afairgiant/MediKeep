"""
Base class for FHIR resource mappers.
Each mapper turns one FHIR resource type into column values for one MediKeep model.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

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
    # Source codes with no column (an RxNorm code, say), for relating records in one file
    source_codes: Dict[str, str] = field(default_factory=dict)


class BaseResourceMapper(ABC):
    """Base class for FHIR resource mappers."""

    RESOURCE_TYPE = "Resource"
    RECORD_TYPE = "record"  # Value of import_provenance.record_type
    MODEL: Any = None  # SQLAlchemy model the rows are written to
    # Pydantic create schema the mapped data must satisfy; with one set, the service
    # re-takes hash_parts from the validated data through hash_parts_for_data
    CREATE_SCHEMA: Any = None

    # Fields the user owns once a row exists; never overwritten on re-import
    preserve_on_update: Tuple[str, ...] = ("notes", "tags")

    @abstractmethod
    def map(self, resource: dict, bundle: dict) -> Optional[MappedRecord]:
        """Map one resource to a MappedRecord, or None to skip it."""

    def skip_reason(self, resource: dict, bundle: dict) -> Optional[str]:
        """Warning to show for a resource that map() skipped, or None to skip it silently."""
        return None

    @abstractmethod
    def hash_parts_for_row(self, row: Any) -> Tuple[Any, ...]:
        """The same hash_parts, read back from an existing row."""

    def hash_parts_for_data(self, data: dict) -> Tuple[Any, ...]:
        """hash_parts for mapped column values, read from an unsaved row like a stored one."""
        row = self.MODEL(**data) if self.MODEL is not None else SimpleNamespace(**data)
        return self.hash_parts_for_row(row)

    def covered(
        self, mapped: List[Tuple[MappedRecord, "BaseResourceMapper"]]
    ) -> List[MappedRecord]:
        """Records of this mapper that another record from the same file stands for.

        Called once per mapper after every resource has been mapped and validated, so
        the answer never depends on resources that were skipped. Those records are
        dropped from the plan without a warning.
        """
        return []
