from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator

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

    @validator("relationship")
    def validate_relationship(cls, v):
        valid_relationships = get_all_family_relationships()
        if v.lower() not in valid_relationships:
            raise ValueError(f"Relationship must be one of: {', '.join(valid_relationships)}")
        return v.lower()

    @validator("gender")
    def validate_gender(cls, v):
        if v is not None:
            valid_genders = ["male", "female", "other"]
            if v.lower() not in valid_genders:
                raise ValueError(f"Gender must be one of: {', '.join(valid_genders)}")
            return v.lower()
        return v

    @validator("death_year")
    def validate_death_year(cls, v, values):
        if v:
            if "birth_year" in values and values["birth_year"] and v < values["birth_year"]:
                raise ValueError("Death year cannot be before birth year")
            if not values.get("is_deceased"):
                raise ValueError("Death year can only be set if family member is deceased")
        return v

    @validator("is_deceased")
    def validate_is_deceased(cls, v, values):
        if not v and "death_year" in values and values["death_year"]:
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

    @validator("relationship")
    def validate_relationship(cls, v):
        if v is not None:
            valid_relationships = get_all_family_relationships()
            if v.lower() not in valid_relationships:
                raise ValueError(f"Relationship must be one of: {', '.join(valid_relationships)}")
            return v.lower()
        return v

    @validator("gender")
    def validate_gender(cls, v):
        if v is not None:
            valid_genders = ["male", "female", "other"]
            if v.lower() not in valid_genders:
                raise ValueError(f"Gender must be one of: {', '.join(valid_genders)}")
            return v.lower()
        return v

    @validator("death_year")
    def validate_death_year(cls, v, values):
        if v:
            if "birth_year" in values and values["birth_year"] and v < values["birth_year"]:
                raise ValueError("Death year cannot be before birth year")
            if "is_deceased" in values and not values["is_deceased"]:
                raise ValueError("Death year can only be set if family member is deceased")
        return v


class FamilyMemberResponse(FamilyMemberBase):
    id: int
    created_at: datetime
    updated_at: datetime
    family_conditions: List["FamilyConditionResponse"] = []

    class Config:
        from_attributes = True


class FamilyMemberSummary(BaseModel):
    id: int
    name: str
    relationship: str
    gender: Optional[str]
    birth_year: Optional[int]
    death_year: Optional[int]
    is_deceased: bool
    condition_count: int = 0

    class Config:
        from_attributes = True


class FamilyMemberDropdownOption(BaseModel):
    """Minimal family member data for dropdown selections in forms."""
    
    id: int
    name: str
    relationship: str

    class Config:
        from_attributes = True


# Import this here to avoid circular imports
from .family_condition import FamilyConditionResponse
FamilyMemberResponse.model_rebuild()