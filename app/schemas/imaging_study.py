"""Schemas for Imaging Studies."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.base_tags import TaggedEntityResponseMixin, TaggedEntityUpdateMixin
from app.schemas.validators import validate_text_field

NOTES_MAX_LENGTH = 5000
REPORT_MAX_LENGTH = 50000


class ImagingStudyUpdate(TaggedEntityUpdateMixin):
    """User-editable fields; header-derived fields change only through import."""

    notes: Optional[str] = Field(None, max_length=NOTES_MAX_LENGTH)
    report_text: Optional[str] = Field(None, max_length=REPORT_MAX_LENGTH)
    procedure_id: Optional[int] = Field(None, gt=0)
    encounter_id: Optional[int] = Field(None, gt=0)
    practitioner_id: Optional[int] = Field(None, gt=0)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        return validate_text_field(v, max_length=NOTES_MAX_LENGTH, field_name="Notes")

    @field_validator("report_text")
    @classmethod
    def validate_report_text(cls, v):
        return validate_text_field(
            v, max_length=REPORT_MAX_LENGTH, field_name="Report text"
        )


class ImagingStudyResponse(TaggedEntityResponseMixin):
    id: int
    patient_id: int
    study_instance_uid: str
    study_date: Optional[date] = None
    modalities: Optional[List[str]] = []
    body_part: Optional[str] = None
    study_description: Optional[str] = None
    accession_number: Optional[str] = None
    institution_name: Optional[str] = None
    referring_physician: Optional[str] = None
    notes: Optional[str] = None
    report_text: Optional[str] = None
    procedure_id: Optional[int] = None
    encounter_id: Optional[int] = None
    practitioner_id: Optional[int] = None
    series_count: int
    instance_count: int
    total_size: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ImagingInstanceResponse(BaseModel):
    """Per-image fields the viewer needs; the file path stays server-side."""

    id: int
    sop_instance_uid: str
    instance_number: Optional[int] = None
    rows: Optional[int] = None
    cols: Optional[int] = None
    number_of_frames: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ImagingSeriesResponse(BaseModel):
    id: int
    series_instance_uid: str
    modality: Optional[str] = None
    series_number: Optional[int] = None
    series_description: Optional[str] = None
    instance_count: int
    instances: List[ImagingInstanceResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ImagingStudyMove(BaseModel):
    target_patient_id: int = Field(..., gt=0)


class ImagingImportSkippedFile(BaseModel):
    """A file left out of an import; reason is a stable code (see SkipReason)."""

    name: str
    reason: str

    model_config = ConfigDict(from_attributes=True)


class ImagingImportStudyResult(BaseModel):
    study_id: int
    created: bool
    series_added: int
    instances_added: int
    patient_mismatch: bool

    model_config = ConfigDict(from_attributes=True)


class ImagingImportSummary(BaseModel):
    """skipped is capped; skipped_count counts every skipped file."""

    studies: List[ImagingImportStudyResult]
    instances_added: int
    duplicates_skipped: int
    skipped: List[ImagingImportSkippedFile]
    skipped_count: int

    model_config = ConfigDict(from_attributes=True)


class ImagingImportJobResponse(BaseModel):
    job_id: str
    status: str
    patient_id: int
    total_files: int
    processed_files: int
    summary: Optional[ImagingImportSummary] = None
    error: Optional[str] = None
