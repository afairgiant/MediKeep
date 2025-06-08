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
    status: str = Field(..., description="Status of the condition")
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


class ConditionCreate(ConditionBase):
    pass


class ConditionUpdate(BaseModel):
    diagnosis: Optional[str] = Field(None, min_length=2, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    onsetDate: Optional[date] = None
    status: Optional[str] = None
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
    onsetDate: Optional[date]
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
