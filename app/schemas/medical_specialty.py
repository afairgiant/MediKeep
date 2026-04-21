from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.validators import (
    validate_required_text,
    validate_text_field,
)


class MedicalSpecialtyBase(BaseModel):
    """Base MedicalSpecialty schema with common fields."""

    name: str
    description: Optional[str] = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        return validate_required_text(
            v, max_length=100, min_length=2, field_name="Specialty name"
        )

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, v):
        return validate_text_field(v, max_length=1000, field_name="Description")


class MedicalSpecialtyCreate(MedicalSpecialtyBase):
    """Schema for creating a new medical specialty."""


class MedicalSpecialtyUpdate(BaseModel):
    """Schema for updating an existing medical specialty. All fields optional."""

    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is None:
            return v
        return validate_required_text(
            v, max_length=100, min_length=2, field_name="Specialty name"
        )

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, v):
        return validate_text_field(v, max_length=1000, field_name="Description")


class MedicalSpecialty(MedicalSpecialtyBase):
    """Schema for reading/returning medical specialty data."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MedicalSpecialtySummary(BaseModel):
    """Lightweight schema for dropdowns and lists."""

    id: int
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
