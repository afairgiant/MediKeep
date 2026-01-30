from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, ValidationInfo

# Import enums for validation
from ..models.enums import get_all_family_relationships


class FamilyMemberBase(BaseModel):
    name: str = Field(
        ..., min_length=1, max_length=100, description="Full name of family member"
    )
    relationship: str = Field(..., description="Relationship to patient")
    gender: Optional[str] = Field(
        None, max_length=20, description="Gender of family member"
    )
    birth_year: Optional[int] = Field(
        None, ge=1900, le=2030, description="Birth year of family member"
    )
    death_year: Optional[int] = Field(
        None, ge=1900, le=2030, description="Death year of family member"
    )
    is_deceased: bool = Field(False, description="Whether family member is deceased")
    notes: Optional[str] = Field(
        None, max_length=1000, description="Additional notes about family member"
    )
    patient_id: int = Field(..., gt=0, description="ID of the patient")

    @field_validator("relationship")
    @classmethod
    def validate_relationship(cls, v):
        valid_relationships = get_all_family_relationships()
        if v.lower() not in valid_relationships:
            raise ValueError(f"Relationship must be one of: {', '.join(valid_relationships)}")
        return v.lower()

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        if v is not None:
            # Accept both full names and single letter abbreviations
            gender_mapping = {
                "m": "male",
                "f": "female",
                "male": "male",
                "female": "female",
                "other": "other",
            }
            normalized = v.lower().strip()
            if normalized not in gender_mapping:
                raise ValueError(f"Gender must be one of: male, female, other (or M, F)")
            return gender_mapping[normalized]
        return v

    @field_validator("death_year")
    @classmethod
    def validate_death_year(cls, v, info: ValidationInfo):
        if v:
            if info.data.get("birth_year") and v < info.data["birth_year"]:
                raise ValueError("Death year cannot be before birth year")
            # Only validate is_deceased flag if it's explicitly set to False
            # (don't fail if is_deceased isn't in values yet due to field order)
            if info.data.get("is_deceased") is False:
                raise ValueError("Death year can only be set if family member is deceased")
        return v

    @field_validator("is_deceased")
    @classmethod
    def validate_is_deceased(cls, v, info: ValidationInfo):
        if not v and info.data.get("death_year"):
            raise ValueError("If death year is provided, family member must be marked as deceased")
        return v


class FamilyMemberCreate(FamilyMemberBase):
    pass


class FamilyMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    relationship: Optional[str] = None
    gender: Optional[str] = Field(None, max_length=20)
    birth_year: Optional[int] = Field(None, ge=1900, le=2030)
    death_year: Optional[int] = Field(None, ge=1900, le=2030)
    is_deceased: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("relationship")
    @classmethod
    def validate_relationship(cls, v):
        if v is not None:
            valid_relationships = get_all_family_relationships()
            if v.lower() not in valid_relationships:
                raise ValueError(f"Relationship must be one of: {', '.join(valid_relationships)}")
            return v.lower()
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        if v is not None:
            # Accept both full names and single letter abbreviations
            gender_mapping = {
                "m": "male",
                "f": "female",
                "male": "male",
                "female": "female",
                "other": "other",
            }
            normalized = v.lower().strip()
            if normalized not in gender_mapping:
                raise ValueError(f"Gender must be one of: male, female, other (or M, F)")
            return gender_mapping[normalized]
        return v

    @field_validator("death_year")
    @classmethod
    def validate_death_year(cls, v, info: ValidationInfo):
        if v:
            if info.data.get("birth_year") and v < info.data["birth_year"]:
                raise ValueError("Death year cannot be before birth year")
            if info.data.get("is_deceased") is False:
                raise ValueError("Death year can only be set if family member is deceased")
        return v


class FamilyMemberResponse(FamilyMemberBase):
    id: int
    created_at: datetime
    updated_at: datetime
    family_conditions: List["FamilyConditionResponse"] = []

    @model_validator(mode='after')
    def auto_correct_deceased_status(self):
        """Auto-correct is_deceased if death_year is present but is_deceased is False."""
        # If death_year exists but is_deceased is False, auto-correct it
        if self.death_year and not self.is_deceased:
            self.is_deceased = True
        return self

    model_config = ConfigDict(from_attributes=True)


class FamilyMemberSummary(BaseModel):
    id: int
    name: str
    relationship: str
    gender: Optional[str]
    birth_year: Optional[int]
    death_year: Optional[int]
    is_deceased: bool
    condition_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class FamilyMemberDropdownOption(BaseModel):
    """Minimal family member data for dropdown selections in forms."""

    id: int
    name: str
    relationship: str

    model_config = ConfigDict(from_attributes=True)


# Import this here to avoid circular imports
from .family_condition import FamilyConditionResponse
FamilyMemberResponse.model_rebuild()
