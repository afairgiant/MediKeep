from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Import enums for validation
from ..models.enums import get_all_condition_types, get_all_severity_levels


class FamilyConditionBase(BaseModel):
    condition_name: str = Field(
        ..., min_length=2, max_length=200, description="Name of the medical condition"
    )
    diagnosis_age: Optional[int] = Field(
        None, ge=0, le=120, description="Age when condition was diagnosed"
    )
    severity: Optional[str] = Field(None, description="Severity of the condition")
    status: Optional[str] = Field(None, description="Status of the condition")
    condition_type: Optional[str] = Field(None, description="Type/category of condition")
    notes: Optional[str] = Field(
        None, max_length=1000, description="Additional notes about the condition"
    )
    icd10_code: Optional[str] = Field(
        None, max_length=10, description="ICD-10 diagnosis code"
    )
    family_member_id: Optional[int] = Field(None, gt=0, description="ID of the family member")

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        if v is not None:
            valid_severities = get_all_severity_levels()
            if v.lower() not in valid_severities:
                raise ValueError(f"Severity must be one of: {', '.join(valid_severities)}")
            return v.lower()
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ["active", "resolved", "chronic"]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @field_validator("condition_type")
    @classmethod
    def validate_condition_type(cls, v):
        if v is not None:
            valid_types = get_all_condition_types()
            if v.lower() not in valid_types:
                raise ValueError(f"Condition type must be one of: {', '.join(valid_types)}")
            return v.lower()
        return v


class FamilyConditionCreate(FamilyConditionBase):
    pass


class FamilyConditionUpdate(BaseModel):
    condition_name: Optional[str] = Field(None, min_length=2, max_length=200)
    diagnosis_age: Optional[int] = Field(None, ge=0, le=120)
    severity: Optional[str] = None
    status: Optional[str] = None
    condition_type: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=1000)
    icd10_code: Optional[str] = Field(None, max_length=10)

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        if v is not None:
            valid_severities = get_all_severity_levels()
            if v.lower() not in valid_severities:
                raise ValueError(f"Severity must be one of: {', '.join(valid_severities)}")
            return v.lower()
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ["active", "resolved", "chronic"]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @field_validator("condition_type")
    @classmethod
    def validate_condition_type(cls, v):
        if v is not None:
            valid_types = get_all_condition_types()
            if v.lower() not in valid_types:
                raise ValueError(f"Condition type must be one of: {', '.join(valid_types)}")
            return v.lower()
        return v


class FamilyConditionResponse(FamilyConditionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FamilyConditionWithMember(FamilyConditionResponse):
    family_member: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class FamilyConditionSummary(BaseModel):
    id: int
    condition_name: str
    severity: Optional[str]
    condition_type: Optional[str]
    diagnosis_age: Optional[int]
    family_member_name: Optional[str] = None
    family_member_relationship: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FamilyConditionDropdownOption(BaseModel):
    """Minimal family condition data for dropdown selections in forms."""

    id: int
    condition_name: str
    severity: Optional[str]
    condition_type: Optional[str]

    model_config = ConfigDict(from_attributes=True)
