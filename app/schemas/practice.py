from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.validators import (
    empty_strings_to_none,
    validate_phone_number,
    validate_required_text,
    validate_text_field,
    validate_url,
)


class PracticeLocationSchema(BaseModel):
    """Schema for a single location within a practice."""

    label: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("label", mode="before")
    @classmethod
    def validate_label(cls, v):
        return validate_text_field(v, max_length=100, field_name="Location label")

    @field_validator("address", mode="before")
    @classmethod
    def validate_address(cls, v):
        return validate_text_field(v, max_length=200, field_name="Address")

    @field_validator("city", mode="before")
    @classmethod
    def validate_city(cls, v):
        return validate_text_field(v, max_length=100, field_name="City")

    @field_validator("state", mode="before")
    @classmethod
    def validate_state(cls, v):
        return validate_text_field(v, max_length=50, field_name="State")

    @field_validator("zip", mode="before")
    @classmethod
    def validate_zip(cls, v):
        return validate_text_field(v, max_length=20, field_name="ZIP code")

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        return validate_phone_number(v, field_name="Location phone")


class PracticeBase(BaseModel):
    """Base Practice schema with common fields."""

    name: str
    phone_number: Optional[str] = None
    fax_number: Optional[str] = None
    website: Optional[str] = None
    patient_portal_url: Optional[str] = None
    notes: Optional[str] = None
    locations: Optional[List[PracticeLocationSchema]] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        return validate_required_text(v, max_length=150, min_length=2, field_name="Practice name")

    @field_validator("phone_number", mode="before")
    @classmethod
    def validate_phone_number(cls, v):
        return validate_phone_number(v, field_name="Phone number")

    @field_validator("fax_number", mode="before")
    @classmethod
    def validate_fax_number(cls, v):
        return validate_phone_number(v, field_name="Fax number")

    @field_validator("website", mode="before")
    @classmethod
    def validate_website(cls, v):
        return validate_url(v, field_name="Website URL")

    @field_validator("patient_portal_url", mode="before")
    @classmethod
    def validate_patient_portal_url(cls, v):
        return validate_url(v, field_name="Patient portal URL")

    @field_validator("notes", mode="before")
    @classmethod
    def validate_notes(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Notes")


class PracticeCreate(PracticeBase):
    """Schema for creating a new practice."""

    pass


class PracticeUpdate(BaseModel):
    """Schema for updating an existing practice. All fields optional."""

    name: Optional[str] = None
    phone_number: Optional[str] = None
    fax_number: Optional[str] = None
    website: Optional[str] = None
    patient_portal_url: Optional[str] = None
    notes: Optional[str] = None
    locations: Optional[List[PracticeLocationSchema]] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_empty_strings(cls, values):
        return empty_strings_to_none(
            values,
            ["phone_number", "fax_number", "website", "patient_portal_url", "notes"],
        )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is None:
            return v
        return validate_required_text(v, max_length=150, min_length=2, field_name="Practice name")

    @field_validator("phone_number", mode="before")
    @classmethod
    def validate_phone_number(cls, v):
        return validate_phone_number(v, field_name="Phone number")

    @field_validator("fax_number", mode="before")
    @classmethod
    def validate_fax_number(cls, v):
        return validate_phone_number(v, field_name="Fax number")

    @field_validator("website", mode="before")
    @classmethod
    def validate_website(cls, v):
        return validate_url(v, field_name="Website URL")

    @field_validator("patient_portal_url", mode="before")
    @classmethod
    def validate_patient_portal_url(cls, v):
        return validate_url(v, field_name="Patient portal URL")

    @field_validator("notes", mode="before")
    @classmethod
    def validate_notes(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Notes")


class Practice(PracticeBase):
    """Schema for reading/returning practice data."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PracticeSummary(BaseModel):
    """Lightweight schema for dropdowns and lists."""

    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class PracticeWithPractitioners(Practice):
    """Practice response with practitioner count."""

    practitioner_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PracticeResponse(Practice):
    """Schema for practice response (alias for Practice)."""

    pass
