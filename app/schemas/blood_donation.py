"""Schemas for Blood Donations."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import get_all_donation_types
from app.schemas.base_tags import (
    TaggedEntityMixin,
    TaggedEntityResponseMixin,
    TaggedEntityUpdateMixin,
)
from app.schemas.validators import validate_date_not_future, validate_text_field


def _validate_donation_type(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    normalized = v.strip().lower()
    allowed = get_all_donation_types()
    if normalized not in allowed:
        raise ValueError(f"Donation type must be one of: {', '.join(allowed)}")
    return normalized


def validate_bp_order(systolic: Optional[int], diastolic: Optional[int]) -> None:
    if systolic is not None and diastolic is not None and systolic <= diastolic:
        raise ValueError("Systolic blood pressure must be greater than diastolic")


class BloodDonationBase(TaggedEntityMixin):
    """Base schema for a blood donation: field declarations only.

    No validators here, so ``BloodDonationResponse`` (also based on this
    class) stays lenient on read. Validation lives on ``BloodDonationCreate``
    and ``BloodDonationUpdate`` instead.
    """

    donation_date: date
    donation_type: str = Field(..., max_length=50)
    location: Optional[str] = Field(None, max_length=200)
    systolic_bp: Optional[int] = Field(None, description="mmHg")
    diastolic_bp: Optional[int] = Field(None, description="mmHg")
    temperature: Optional[float] = Field(
        None, description="Body temperature in Fahrenheit"
    )
    hemoglobin: Optional[float] = Field(None, description="g/dL")
    notes: Optional[str] = Field(None, max_length=5000)
    patient_id: int = Field(..., gt=0, description="ID of the patient")


class BloodDonationCreate(BloodDonationBase):
    """Schema for creating a blood donation."""

    systolic_bp: Optional[int] = Field(None, ge=60, le=250, description="mmHg")
    diastolic_bp: Optional[int] = Field(None, ge=30, le=150, description="mmHg")
    temperature: Optional[float] = Field(
        None, ge=80, le=115, description="Body temperature in Fahrenheit"
    )
    hemoglobin: Optional[float] = Field(None, ge=3, le=25, description="g/dL")

    @field_validator("donation_type")
    @classmethod
    def validate_donation_type(cls, v):
        return _validate_donation_type(v)

    @field_validator("donation_date")
    @classmethod
    def validate_donation_date(cls, v):
        return validate_date_not_future(v, field_name="Donation date")

    @field_validator("location")
    @classmethod
    def validate_location(cls, v):
        return validate_text_field(v, max_length=200, field_name="Location")

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        return validate_text_field(v, max_length=5000, field_name="Notes")

    @model_validator(mode="after")
    def validate_blood_pressure(self):
        validate_bp_order(self.systolic_bp, self.diastolic_bp)
        return self


class BloodDonationUpdate(TaggedEntityUpdateMixin):
    """Schema for updating a blood donation (partial)."""

    donation_date: Optional[date] = None
    donation_type: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=200)
    systolic_bp: Optional[int] = Field(None, ge=60, le=250)
    diastolic_bp: Optional[int] = Field(None, ge=30, le=150)
    temperature: Optional[float] = Field(None, ge=80, le=115)
    hemoglobin: Optional[float] = Field(None, ge=3, le=25)
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("donation_type")
    @classmethod
    def validate_donation_type(cls, v):
        return _validate_donation_type(v)

    @field_validator("donation_date")
    @classmethod
    def validate_donation_date(cls, v):
        if v is None:
            return None
        return validate_date_not_future(v, field_name="Donation date")

    @field_validator("location")
    @classmethod
    def validate_location(cls, v):
        return validate_text_field(v, max_length=200, field_name="Location")

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        return validate_text_field(v, max_length=5000, field_name="Notes")

    @model_validator(mode="after")
    def validate_blood_pressure(self):
        validate_bp_order(self.systolic_bp, self.diastolic_bp)
        return self

    @model_validator(mode="after")
    def validate_not_null_required_fields(self):
        # donation_date and donation_type are NOT NULL columns - an update
        # may omit them (leave unchanged), but an explicit null is a
        # client error, not a request to clear a required field.
        fields_set = self.model_fields_set
        if "donation_date" in fields_set and self.donation_date is None:
            raise ValueError("Donation date cannot be null")
        if "donation_type" in fields_set and self.donation_type is None:
            raise ValueError("Donation type cannot be null")
        return self


class BloodDonationResponse(TaggedEntityResponseMixin, BloodDonationBase):
    """Schema for blood donation responses."""

    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BloodDonationEligibilityResponse(BaseModel):
    """Next eligible donation date for a patient."""

    last_donation_date: Optional[date] = None
    last_donation_type: Optional[str] = None
    interval_days: Optional[int] = None
    next_eligible_date: Optional[date] = None
    days_remaining: int
    is_eligible: bool
