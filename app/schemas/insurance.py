from datetime import date, datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, model_validator, field_validator, ValidationInfo

from app.models.enums import InsuranceStatus, InsuranceType


class InsuranceBase(BaseModel):
    """Base schema for Insurance"""

    insurance_type: str
    company_name: str
    employer_group: Optional[str] = None
    member_name: str
    member_id: str
    group_number: Optional[str] = None
    plan_name: Optional[str] = None
    policy_holder_name: Optional[str] = None
    relationship_to_holder: Optional[str] = None
    effective_date: date
    expiration_date: Optional[date] = None
    status: str = "active"
    is_primary: bool = False
    coverage_details: Optional[Dict[str, Any]] = None
    contact_info: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def clean_empty_strings(cls, values):
        """Convert empty strings to None for optional fields"""
        if isinstance(values, dict):
            for field in [
                "employer_group",
                "group_number",
                "plan_name",
                "policy_holder_name",
                "relationship_to_holder",
                "expiration_date",
                "notes",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @field_validator("insurance_type")
    @classmethod
    def validate_insurance_type(cls, v):
        """Validate insurance type is one of the allowed values"""
        if v not in [t.value for t in InsuranceType]:
            raise ValueError(f"Invalid insurance type. Must be one of: {[t.value for t in InsuranceType]}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """Validate status is one of the allowed values"""
        if v not in [s.value for s in InsuranceStatus]:
            raise ValueError(f"Invalid status. Must be one of: {[s.value for s in InsuranceStatus]}")
        return v

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v):
        """Validate company name requirements"""
        if not v or not v.strip():
            raise ValueError("Company name is required")
        if len(v.strip()) > 255:
            raise ValueError("Company name must be 255 characters or less")
        return v.strip()

    @field_validator("member_name")
    @classmethod
    def validate_member_name(cls, v):
        """Validate member name requirements"""
        if not v or not v.strip():
            raise ValueError("Member name is required")
        if len(v.strip()) > 255:
            raise ValueError("Member name must be 255 characters or less")
        return v.strip()

    @field_validator("member_id")
    @classmethod
    def validate_member_id(cls, v):
        """Validate member ID requirements"""
        if not v or not v.strip():
            raise ValueError("Member ID is required")
        if len(v.strip()) > 100:
            raise ValueError("Member ID must be 100 characters or less")
        return v.strip()

    @field_validator("relationship_to_holder")
    @classmethod
    def validate_relationship_to_holder(cls, v):
        """Validate relationship to holder"""
        if v is not None:
            allowed_relationships = ["self", "spouse", "child", "dependent", "other"]
            if v not in allowed_relationships:
                raise ValueError(f"Invalid relationship. Must be one of: {allowed_relationships}")
        return v

    @field_validator("expiration_date")
    @classmethod
    def validate_expiration_date(cls, v, info: ValidationInfo):
        """Validate expiration date is after effective date"""
        if v is not None and info.data.get("effective_date") is not None:
            if v <= info.data["effective_date"]:
                raise ValueError("Expiration date must be after effective date")
        return v

    @model_validator(mode="after")
    def validate_coverage_details_by_type(self):
        """Validate coverage details based on insurance type"""
        insurance_type = self.insurance_type
        coverage_details = self.coverage_details or {}

        if insurance_type == "medical" and coverage_details:
            # Validate medical insurance specific fields
            for field in ["copay_pcp", "copay_specialist", "copay_er", "copay_urgent_care"]:
                if field in coverage_details and coverage_details[field]:
                    try:
                        float(coverage_details[field])
                    except (ValueError, TypeError):
                        raise ValueError(f"Invalid {field}: must be a valid number")

        elif insurance_type == "dental" and coverage_details:
            # Validate dental insurance specific fields
            for field in ["preventive_coverage", "basic_coverage", "major_coverage"]:
                if field in coverage_details and coverage_details[field]:
                    try:
                        val = float(coverage_details[field])
                        if val < 0 or val > 100:
                            raise ValueError(f"Invalid {field}: must be between 0 and 100")
                    except (ValueError, TypeError):
                        raise ValueError(f"Invalid {field}: must be a valid percentage")

        elif insurance_type == "prescription" and coverage_details:
            # Validate prescription insurance specific fields
            if "bin_number" in coverage_details and coverage_details["bin_number"]:
                if len(str(coverage_details["bin_number"])) > 10:
                    raise ValueError("BIN number must be 10 characters or less")

        return self


class InsuranceCreate(InsuranceBase):
    """Schema for creating insurance"""
    patient_id: int


class InsuranceUpdate(BaseModel):
    """Schema for updating insurance"""

    insurance_type: Optional[str] = None
    company_name: Optional[str] = None
    employer_group: Optional[str] = None
    member_name: Optional[str] = None
    member_id: Optional[str] = None
    group_number: Optional[str] = None
    plan_name: Optional[str] = None
    policy_holder_name: Optional[str] = None
    relationship_to_holder: Optional[str] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    status: Optional[str] = None
    is_primary: Optional[bool] = None
    coverage_details: Optional[Dict[str, Any]] = None
    contact_info: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def clean_empty_strings(cls, values):
        """Convert empty strings to None for optional fields"""
        if isinstance(values, dict):
            for field in [
                "employer_group",
                "group_number",
                "plan_name",
                "policy_holder_name",
                "relationship_to_holder",
                "expiration_date",
                "notes",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @field_validator("insurance_type")
    @classmethod
    def validate_insurance_type(cls, v):
        """Validate insurance type is one of the allowed values"""
        if v is not None and v not in [t.value for t in InsuranceType]:
            raise ValueError(f"Invalid insurance type. Must be one of: {[t.value for t in InsuranceType]}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """Validate status is one of the allowed values"""
        if v is not None and v not in [s.value for s in InsuranceStatus]:
            raise ValueError(f"Invalid status. Must be one of: {[s.value for s in InsuranceStatus]}")
        return v


class Insurance(InsuranceBase):
    """Schema for reading insurance (includes database fields)"""

    id: int
    patient_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Updated from orm_mode for Pydantic v2 compatibility


class InsuranceStatusUpdate(BaseModel):
    """Schema for updating only insurance status"""

    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """Validate status is one of the allowed values"""
        if v not in [s.value for s in InsuranceStatus]:
            raise ValueError(f"Invalid status. Must be one of: {[s.value for s in InsuranceStatus]}")
        return v
