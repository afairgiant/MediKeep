from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, validator


class ConditionBase(BaseModel):
    diagnosis: str = Field(
        ..., min_length=2, max_length=500, description="Medical diagnosis"
    )
    notes: Optional[str] = Field(
        None, max_length=1000, description="Additional notes about the condition"
    )
    onsetDate: Optional[date] = Field(
        None, description="Date when the condition was first diagnosed"
    )
    endDate: Optional[date] = Field(
        None, description="Date when the condition was resolved"
    )
    status: str = Field(..., description="Status of the condition")
    severity: Optional[str] = Field(
        None, description="Severity of the condition"
    )
    icd10_code: Optional[str] = Field(
        None, max_length=10, description="ICD-10 diagnosis code"
    )
    snomed_code: Optional[str] = Field(
        None, max_length=20, description="SNOMED CT code"
    )
    code_description: Optional[str] = Field(
        None, max_length=500, description="Description of the medical code"
    )
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of the practitioner"
    )

    @validator("status")
    def validate_status(cls, v):
        valid_statuses = [
            "active",
            "resolved",
            "chronic",
            "inactive",
            "recurrence",
            "relapse",
        ]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()

    @validator("onsetDate")
    def validate_onset_date(cls, v):
        if v and v > date.today():
            raise ValueError("Onset date cannot be in the future")
        return v

    @validator("endDate")
    def validate_end_date(cls, v, values):
        if v:
            if v > date.today():
                raise ValueError("End date cannot be in the future")
            if (
                "onsetDate" in values
                and values["onsetDate"]
                and v < values["onsetDate"]
            ):
                raise ValueError("End date cannot be before onset date")
        return v

    @validator("severity")
    def validate_severity(cls, v):
        if v is not None:
            valid_severities = ["mild", "moderate", "severe", "critical"]
            if v.lower() not in valid_severities:
                raise ValueError(f"Severity must be one of: {', '.join(valid_severities)}")
            return v.lower()
        return v


class ConditionCreate(ConditionBase):
    pass


class ConditionUpdate(BaseModel):
    diagnosis: Optional[str] = Field(None, min_length=2, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    onsetDate: Optional[date] = None
    endDate: Optional[date] = None
    status: Optional[str] = None
    severity: Optional[str] = None
    icd10_code: Optional[str] = Field(None, max_length=10)
    snomed_code: Optional[str] = Field(None, max_length=20)
    code_description: Optional[str] = Field(None, max_length=500)
    practitioner_id: Optional[int] = Field(None, gt=0)

    @validator("status")
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [
                "active",
                "resolved",
                "chronic",
                "inactive",
                "recurrence",
                "relapse",
            ]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @validator("onsetDate")
    def validate_onset_date(cls, v):
        if v and v > date.today():
            raise ValueError("Onset date cannot be in the future")
        return v

    @validator("endDate")
    def validate_end_date(cls, v, values):
        if v:
            if v > date.today():
                raise ValueError("End date cannot be in the future")
            if (
                "onsetDate" in values
                and values["onsetDate"]
                and v < values["onsetDate"]
            ):
                raise ValueError("End date cannot be before onset date")
        return v

    @validator("severity")
    def validate_severity(cls, v):
        if v is not None:
            valid_severities = ["mild", "moderate", "severe", "critical"]
            if v.lower() not in valid_severities:
                raise ValueError(f"Severity must be one of: {', '.join(valid_severities)}")
            return v.lower()
        return v


class ConditionResponse(ConditionBase):
    id: int

    class Config:
        from_attributes = True


class ConditionWithRelations(ConditionResponse):
    patient: Optional[dict] = None
    practitioner: Optional[dict] = None
    treatments: Optional[list] = None

    class Config:
        from_attributes = True


class ConditionSummary(BaseModel):
    id: int
    diagnosis: str
    status: str
    severity: Optional[str]
    onsetDate: Optional[date]
    endDate: Optional[date]
    icd10_code: Optional[str]
    snomed_code: Optional[str]
    code_description: Optional[str]
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
