"""
Pydantic schemas for InjuryType entity.

InjuryType represents reusable injury types that populate the dropdown.
Users can select existing types or create new ones.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.validators import validate_text_field, validate_required_text


class InjuryTypeBase(BaseModel):
    """Base schema for InjuryType"""
    name: str = Field(
        ..., min_length=2, max_length=100, description="Type name (e.g., 'Sprain', 'Fracture')"
    )
    description: Optional[str] = Field(
        None, max_length=300, description="Optional description"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        return validate_required_text(v, max_length=100, min_length=2, field_name="Name")

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        return validate_text_field(v, max_length=300, field_name="Description")


class InjuryTypeCreate(InjuryTypeBase):
    """Schema for creating a new InjuryType"""
    pass  # is_system defaults to False for user-created types


class InjuryTypeUpdate(BaseModel):
    """Schema for updating an existing InjuryType"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=300)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is None:
            return None
        return validate_required_text(v, max_length=100, min_length=2, field_name="Name")

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        return validate_text_field(v, max_length=300, field_name="Description")


class InjuryTypeResponse(InjuryTypeBase):
    """Schema for InjuryType response"""
    id: int
    is_system: bool = Field(description="True = system default, False = user-created")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InjuryTypeDropdownOption(BaseModel):
    """Minimal InjuryType data for dropdown selections"""
    id: int
    name: str
    is_system: bool = False

    class Config:
        from_attributes = True
