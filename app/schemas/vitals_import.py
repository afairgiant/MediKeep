"""Pydantic v2 schemas for the vitals CSV import feature."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class VitalsImportDevice(BaseModel):
    """A supported import device."""

    key: str
    name: str


class VitalsImportDevicesResponse(BaseModel):
    """Response listing available import devices."""

    devices: List[VitalsImportDevice]


class VitalsPreviewRow(BaseModel):
    """A single row in the import preview table."""

    recorded_date: datetime
    blood_glucose: Optional[float] = None
    device_used: Optional[str] = None
    is_duplicate: bool = False


class VitalsImportPreviewResponse(BaseModel):
    """Response from the import preview endpoint."""

    device_name: str
    total_readings: int
    preview_rows: List[VitalsPreviewRow]
    duplicate_count: int
    new_count: int
    skipped_rows: int
    errors: List[str]
    warnings: List[str]
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None


class VitalsImportResponse(BaseModel):
    """Response from the import execute endpoint."""

    imported_count: int
    skipped_duplicates: int
    errors: List[str]
    total_processed: int
