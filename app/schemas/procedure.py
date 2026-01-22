from datetime import date as DateType
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.base_tags import TaggedEntityMixin
from app.models.enums import ProcedureStatus


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
        None, max_length=1000, description="Detailed description of the procedure"
    )
    date: DateType = Field(..., description="Date when the procedure was performed")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    status: str = Field(..., description="Status of the procedure")
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
        None, max_length=100, description="Type of Anethesia used during the procedure"
    )
    anesthesia_notes: Optional[str] = Field(
        None, max_length=1000, description="Additional notes about the anesthesia"
    )

    @model_validator(mode="before")
    @classmethod
    def validate_date_with_status(cls, values):
        """Validate procedure date based on status.

        When status is not provided (partial updates), skip validation to allow
        updating only the date field without requiring status.
        """
        from datetime import timedelta

        if not isinstance(values, dict):
            return values

        date_value = values.get("date")
        status = values.get("status", "").lower() if values.get("status") else ""

        if not date_value:
            return values

        # Convert string date to date object if needed
        if isinstance(date_value, str):
            try:
                date_value = DateType.fromisoformat(date_value)
            except ValueError:
                return values  # Let field validator handle invalid date

        # Skip validation if status is not provided (partial update scenario)
        if not status:
            return values

        # For scheduled or postponed procedures, allow reasonable future dates
        if status in ["scheduled", "postponed"]:
            max_future = DateType.today() + timedelta(days=3650)  # 10 years
            if date_value > max_future:
                raise ValueError("Procedure date cannot be more than 10 years in the future")
            # Allow past dates for scheduled procedures (e.g., rescheduled from past)
            return values

        # For all other statuses (completed, in_progress, cancelled), date should not be in future
        if date_value > DateType.today():
            raise ValueError(f"Procedure date cannot be in the future for {status} procedures")
        return values

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        valid_statuses = [s.value for s in ProcedureStatus]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()


class ProcedureCreate(ProcedureBase):
    pass


class ProcedureUpdate(BaseModel):
    procedure_name: Optional[str] = Field(None, min_length=2, max_length=300)
    procedure_type: Optional[str] = Field(None, max_length=50)
    procedure_code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=1000)
    date: Optional[DateType] = None
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None
    facility: Optional[str] = Field(None, max_length=300)
    procedure_setting: Optional[str] = Field(None, max_length=100)
    procedure_complications: Optional[str] = Field(None, max_length=500)
    procedure_duration: Optional[int] = Field(None, gt=0)
    practitioner_id: Optional[int] = Field(None, gt=0)
    anesthesia_type: Optional[str] = Field(None, max_length=100)
    anesthesia_notes: Optional[str] = Field(None, max_length=1000)
    tags: Optional[List[str]] = None

    @model_validator(mode="before")
    @classmethod
    def validate_date_with_status(cls, values):
        """Validate procedure date based on status.

        When status is not provided (partial updates), skip validation to allow
        updating only the date field without requiring status.
        """
        from datetime import timedelta

        if not isinstance(values, dict):
            return values

        date_value = values.get("date")
        status = values.get("status", "").lower() if values.get("status") else ""

        if not date_value:
            return values

        # Convert string date to date object if needed
        if isinstance(date_value, str):
            try:
                date_value = DateType.fromisoformat(date_value)
            except ValueError:
                return values  # Let field validator handle invalid date

        # Skip validation if status is not provided (partial update scenario)
        if not status:
            return values

        # For scheduled or postponed procedures, allow reasonable future dates
        if status in ["scheduled", "postponed"]:
            max_future = DateType.today() + timedelta(days=3650)  # 10 years
            if date_value > max_future:
                raise ValueError("Procedure date cannot be more than 10 years in the future")
            # Allow past dates for scheduled procedures (e.g., rescheduled from past)
            return values

        # For all other statuses (completed, in_progress, cancelled), date should not be in future
        if date_value > DateType.today():
            raise ValueError(f"Procedure date cannot be in the future for {status} procedures")
        return values

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [s.value for s in ProcedureStatus]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v


class ProcedureResponse(ProcedureBase):
    id: int

    class Config:
        from_attributes = True


class ProcedureWithRelations(ProcedureResponse):
    patient: Optional[dict] = None
    practitioner: Optional[dict] = None

    class Config:
        from_attributes = True


class ProcedureSummary(BaseModel):
    id: int
    procedure_name: str
    date: DateType
    status: str
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
