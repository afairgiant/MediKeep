"""Pydantic v2 schemas for the health record import feature."""

from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel


class HealthRecordImportFormat(BaseModel):
    """A supported upload format."""

    key: str
    name: str
    extensions: List[str]


class HealthRecordImportFormatsResponse(BaseModel):
    """Response listing supported formats and the upload size limit."""

    formats: List[HealthRecordImportFormat]
    max_file_size_bytes: int


class ImportedPatientSummary(BaseModel):
    """Demographics found in the uploaded file."""

    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None


class SectionPreviewCount(BaseModel):
    """Per-record-type counts in a preview."""

    new: int = 0
    duplicate: int = 0
    changed: int = 0
    edited: int = 0  # Subset of changed that was edited in MediKeep


class HealthRecordImportPreviewResponse(BaseModel):
    """Response from the import preview endpoint."""

    source: str
    format_key: str
    total_resources: int
    counts: Dict[str, SectionPreviewCount]
    unsupported: Dict[str, int]
    patient: Optional[ImportedPatientSummary] = None
    warnings: List[str]


class SectionResultCount(BaseModel):
    """Per-record-type counts after an import."""

    created: int = 0
    updated: int = 0
    skipped_duplicate: int = 0
    skipped_edited: int = 0


class HealthRecordImportResponse(BaseModel):
    """Response from the import execute endpoint."""

    source: str
    format_key: str
    import_batch_id: str
    counts: Dict[str, SectionResultCount]
    unsupported: Dict[str, int]
    warnings: List[str]
