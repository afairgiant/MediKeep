from datetime import date
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, ValidationInfo

from app.schemas.base_tags import TaggedEntityMixin
from app.models.enums import TreatmentStatus


class TreatmentBase(TaggedEntityMixin):
    treatment_name: str = Field(
        ..., min_length=2, max_length=300, description="Name of the treatment"
    )
    treatment_type: str = Field(
        ..., min_length=2, max_length=300, description="Type of treatment"
    )
    description: Optional[str] = Field(
        None, max_length=1000, description="Detailed description of the treatment"
    )
    start_date: date = Field(..., description="Start date of the treatment")
    end_date: Optional[date] = Field(None, description="End date of the treatment")
    frequency: Optional[str] = Field(
        None, max_length=100, description="Frequency of the treatment"
    )
    treatment_category: Optional[str] = Field(
        None,
        max_length=200,
        description="Category of treatment (e.g., 'inpatient', 'outpatient')",
    )
    outcome: Optional[str] = Field(
        None, max_length=200, description="Expected outcome of the treatment"
    )
    location: Optional[str] = Field(
        None, max_length=200, description="Location where the treatment is administered"
    )
    dosage: Optional[str] = Field(
        None, max_length=200, description="Dosage of the treatment"
    )
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    status: Optional[str] = Field("active", description="Status of the treatment")
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of the prescribing practitioner"
    )
    condition_id: Optional[int] = Field(
        None, gt=0, description="ID of the related condition"
    )

    @model_validator(mode="before")
    @classmethod
    def validate_start_date_with_status(cls, values):
        """Validate treatment start date based on status.

        When status is not provided (partial updates), skip validation to allow
        updating only the start_date field without requiring status.
        """
        from datetime import timedelta

        if not isinstance(values, dict):
            return values

        start_date_value = values.get("start_date")
        status = values.get("status", "").lower() if values.get("status") else ""

        if not start_date_value:
            return values

        # Convert string date to date object if needed
        if isinstance(start_date_value, str):
            try:
                start_date_value = date.fromisoformat(start_date_value)
            except ValueError:
                return values  # Let field validator handle invalid date

        # Skip validation if status is not provided (partial update scenario)
        if not status:
            return values

        # For planned or on_hold treatments, allow reasonable future dates
        if status in ["planned", "on_hold"]:
            max_future = date.today() + timedelta(days=3650)  # 10 years
            if start_date_value > max_future:
                raise ValueError("Start date cannot be more than 10 years in the future")
            # Allow past dates for planned treatments (e.g., rescheduled from past)
            return values

        # For all other statuses (not planned/on_hold), start date should not be in future
        if start_date_value > date.today():
            raise ValueError(f"Start date cannot be in the future for {status} treatments")
        return values

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v, info: ValidationInfo):
        if v and info.data.get("start_date") and v < info.data["start_date"]:
            raise ValueError("End date cannot be before start date")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is None:
            return "active"  # Default value
        valid_statuses = [s.value for s in TreatmentStatus]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()


class TreatmentCreate(TreatmentBase):
    pass


class TreatmentUpdate(BaseModel):
    treatment_name: Optional[str] = Field(None, min_length=2, max_length=300)
    treatment_type: Optional[str] = Field(None, min_length=2, max_length=300)
    description: Optional[str] = Field(None, max_length=1000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    frequency: Optional[str] = Field(None, max_length=100)
    treatment_category: Optional[str] = Field(None, max_length=200)
    outcome: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    dosage: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None
    practitioner_id: Optional[int] = Field(None, gt=0)
    condition_id: Optional[int] = Field(None, gt=0)
    tags: Optional[List[str]] = None

    @model_validator(mode="before")
    @classmethod
    def validate_start_date_with_status(cls, values):
        """Validate treatment start date based on status.

        When status is not provided (partial updates), skip validation to allow
        updating only the start_date field without requiring status.
        """
        from datetime import timedelta

        if not isinstance(values, dict):
            return values

        start_date_value = values.get("start_date")
        status = values.get("status", "").lower() if values.get("status") else ""

        if not start_date_value:
            return values

        # Convert string date to date object if needed
        if isinstance(start_date_value, str):
            try:
                start_date_value = date.fromisoformat(start_date_value)
            except ValueError:
                return values  # Let field validator handle invalid date

        # Skip validation if status is not provided (partial update scenario)
        if not status:
            return values

        # For planned or on_hold treatments, allow reasonable future dates
        if status in ["planned", "on_hold"]:
            max_future = date.today() + timedelta(days=3650)  # 10 years
            if start_date_value > max_future:
                raise ValueError("Start date cannot be more than 10 years in the future")
            # Allow past dates for planned treatments (e.g., rescheduled from past)
            return values

        # For all other statuses (not planned/on_hold), start date should not be in future
        if start_date_value > date.today():
            raise ValueError(f"Start date cannot be in the future for {status} treatments")
        return values

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v, info: ValidationInfo):
        if (
            v
            and info.data.get("start_date")
            and v < info.data["start_date"]
        ):
            raise ValueError("End date cannot be before start date")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [s.value for s in TreatmentStatus]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v


class TreatmentResponse(TreatmentBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class TreatmentWithRelations(TreatmentResponse):
    patient: Optional[dict] = None
    practitioner: Optional[dict] = None
    condition: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentSummary(BaseModel):
    id: int
    treatment_name: str
    start_date: date
    end_date: Optional[date]
    status: str
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
