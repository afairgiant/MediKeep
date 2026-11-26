from datetime import date as DateType
from typing import ClassVar, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import ProcedureStatus, get_all_procedure_outcomes
from app.schemas.base_tags import (
    TaggedEntityMixin,
    TaggedEntityResponseMixin,
    TaggedEntityUpdateMixin,
)
from app.schemas.merged_rules import MergedRule, as_date, status_date_check
from app.schemas.read_model import read_model

# Pre-fetch valid values for reuse
VALID_PROCEDURE_STATUSES = [s.value for s in ProcedureStatus]
VALID_PROCEDURE_OUTCOMES = get_all_procedure_outcomes()


def _validate_procedure_outcome(v: Optional[str]) -> Optional[str]:
    """Validate procedure outcome value."""
    if v is None:
        return None
    lower_v = v.lower()
    if lower_v not in VALID_PROCEDURE_OUTCOMES:
        raise ValueError(
            f"Outcome must be one of: {', '.join(VALID_PROCEDURE_OUTCOMES)}"
        )
    return lower_v


check_date_for_status = status_date_check(
    "Procedure date",
    "procedures",
    future_ok={"scheduled", "postponed", "cancelled"},
)


def _validate_date_with_status(values: dict) -> dict:
    """Validate procedure date based on status, when both are sent."""
    if not isinstance(values, dict):
        return values

    check_date_for_status(as_date(values.get("date")), values.get("status"))
    return values


class ProcedureBase(TaggedEntityMixin):
    procedure_name: str = Field(
        ..., min_length=2, max_length=300, description="Name of the procedure"
    )
    procedure_type: Optional[str] = Field(
        None,
        max_length=50,
        description="Type of procedure (e.g., surgical, diagnostic)",
    )
    procedure_code: Optional[str] = Field(
        None, max_length=50, description="Code for the procedure (e.g., CPT code)"
    )
    description: Optional[str] = Field(
        None, max_length=5000, description="Detailed description of the procedure"
    )
    date: DateType = Field(..., description="Date when the procedure was performed")
    notes: Optional[str] = Field(None, max_length=5000, description="Additional notes")
    status: str = Field(..., description="Status of the procedure")
    outcome: Optional[str] = Field(
        None, max_length=50, description="Outcome of the procedure"
    )
    facility: Optional[str] = Field(
        None, max_length=300, description="Facility where the procedure was performed"
    )
    procedure_setting: Optional[str] = Field(
        None,
        max_length=100,
        description="Setting of procedure (outpatient, inpatient, office)",
    )
    procedure_complications: Optional[str] = Field(
        None,
        max_length=500,
        description="Any complications that occurred during the procedure",
    )
    procedure_duration: Optional[int] = Field(
        None, gt=0, description="Duration of the procedure in minutes"
    )
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of the performing practitioner"
    )
    condition_id: Optional[int] = Field(
        None, gt=0, description="ID of the condition this procedure addresses"
    )
    anesthesia_type: Optional[str] = Field(
        None, max_length=100, description="Type of Anesthesia used during the procedure"
    )
    anesthesia_notes: Optional[str] = Field(
        None, max_length=5000, description="Additional notes about the anesthesia"
    )

    @model_validator(mode="before")
    @classmethod
    def validate_date_with_status(cls, values):
        return _validate_date_with_status(values)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v.lower() not in VALID_PROCEDURE_STATUSES:
            raise ValueError(
                f"Status must be one of: {', '.join(VALID_PROCEDURE_STATUSES)}"
            )
        return v.lower()

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, v):
        return _validate_procedure_outcome(v)


class ProcedureCreate(ProcedureBase):
    pass


class ProcedureUpdate(TaggedEntityUpdateMixin):
    procedure_name: Optional[str] = Field(None, min_length=2, max_length=300)
    procedure_type: Optional[str] = Field(None, max_length=50)
    procedure_code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=5000)
    date: Optional[DateType] = None
    notes: Optional[str] = Field(None, max_length=5000)
    status: Optional[str] = None
    outcome: Optional[str] = Field(None, max_length=50)
    facility: Optional[str] = Field(None, max_length=300)
    procedure_setting: Optional[str] = Field(None, max_length=100)
    procedure_complications: Optional[str] = Field(None, max_length=500)
    procedure_duration: Optional[int] = Field(None, gt=0)
    practitioner_id: Optional[int] = Field(None, gt=0)
    anesthesia_type: Optional[str] = Field(None, max_length=100)
    anesthesia_notes: Optional[str] = Field(None, max_length=5000)

    MERGED_RULES: ClassVar[tuple[MergedRule, ...]] = (
        MergedRule(("date", "status"), check_date_for_status),
    )

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            if v.lower() not in VALID_PROCEDURE_STATUSES:
                raise ValueError(
                    f"Status must be one of: {', '.join(VALID_PROCEDURE_STATUSES)}"
                )
            return v.lower()
        return v

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, v):
        return _validate_procedure_outcome(v)


class ProcedureResponse(TaggedEntityResponseMixin, read_model(ProcedureBase)):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ProcedureWithRelations(ProcedureResponse):
    patient: Optional["PatientResponse"] = None
    practitioner: Optional["PractitionerSummary"] = None

    model_config = ConfigDict(from_attributes=True)


class ProcedureSummary(BaseModel):
    id: int
    procedure_name: str
    date: DateType
    status: str
    outcome: Optional[str] = None
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, v):
        return _validate_procedure_outcome(v)

    model_config = ConfigDict(from_attributes=True)


# Late imports to avoid circular dependencies; must come after all class definitions.
# pylint: disable=wrong-import-position
from app.schemas.patient import PatientResponse  # noqa: E402
from app.schemas.practitioner import PractitionerSummary  # noqa: E402

# pylint: enable=wrong-import-position

ProcedureWithRelations.model_rebuild()
