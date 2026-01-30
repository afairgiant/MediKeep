from datetime import date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.base_tags import TaggedEntityMixin


class AllergyBase(TaggedEntityMixin):
    allergen: str = Field(
        ..., min_length=2, max_length=200, description="Name of the allergen"
    )
    reaction: Optional[str] = Field(
        None, max_length=500, description="Description of the allergic reaction"
    )
    severity: str = Field(..., description="Severity of the allergy")
    onset_date: Optional[date] = Field(
        None, description="Date when the allergy was first identified"
    )
    notes: Optional[str] = Field(
        None, max_length=1000, description="Additional notes about the allergy"
    )
    status: str = Field(default="active", description="Status of the allergy")
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    medication_id: Optional[int] = Field(None, gt=0, description="ID of the medication causing this allergy")

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        valid_severities = ["mild", "moderate", "severe", "life-threatening"]
        if v.lower() not in valid_severities:
            raise ValueError(f"Severity must be one of: {', '.join(valid_severities)}")
        return v.lower()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        valid_statuses = ["active", "inactive", "resolved", "unconfirmed"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()

    @field_validator("onset_date")
    @classmethod
    def validate_onset_date(cls, v):
        if v and v > date.today():
            raise ValueError("Onset date cannot be in the future")
        return v


class AllergyCreate(AllergyBase):
    pass


class AllergyUpdate(BaseModel):
    allergen: Optional[str] = Field(None, min_length=2, max_length=200)
    reaction: Optional[str] = Field(None, max_length=500)
    severity: Optional[str] = None
    onset_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None
    medication_id: Optional[int] = Field(None, gt=0)
    tags: Optional[List[str]] = None

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        if v is not None:
            valid_severities = ["mild", "moderate", "severe", "life-threatening"]
            if v.lower() not in valid_severities:
                raise ValueError(
                    f"Severity must be one of: {', '.join(valid_severities)}"
                )
            return v.lower()
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ["active", "inactive", "resolved", "unconfirmed"]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @field_validator("onset_date")
    @classmethod
    def validate_onset_date(cls, v):
        if v and v > date.today():
            raise ValueError("Onset date cannot be in the future")
        return v


class AllergyResponse(AllergyBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class AllergyWithRelations(AllergyResponse):
    patient: Optional[dict] = None
    medication: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class AllergySummary(BaseModel):
    id: int
    allergen: str
    severity: str
    status: str
    onset_date: Optional[date]
    patient_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
