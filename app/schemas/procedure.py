from datetime import date as DateType
from typing import Optional
from pydantic import BaseModel, Field, validator


class ProcedureBase(BaseModel):
    name: str = Field(
        ..., min_length=2, max_length=300, description="Name of the procedure"
    )
    description: Optional[str] = Field(
        None, max_length=1000, description="Detailed description of the procedure"
    )
    date: DateType = Field(..., description="Date when the procedure was performed")
    duration: Optional[int] = Field(
        None, ge=1, description="Duration of the procedure in minutes"
    )
    outcome: Optional[str] = Field(
        None, max_length=500, description="Outcome of the procedure"
    )
    complications: Optional[str] = Field(
        None, max_length=500, description="Any complications that occurred"
    )
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    status: str = Field(..., description="Status of the procedure")
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of the performing practitioner"
    )

    @validator("date")
    def validate_date(cls, v):
        if v > DateType.today():
            raise ValueError("Procedure date cannot be in the future")
        return v

    @validator("status")
    def validate_status(cls, v):
        valid_statuses = [
            "scheduled",
            "in-progress",
            "completed",
            "cancelled",
            "postponed",
        ]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()

    @validator("duration")
    def validate_duration(cls, v):
        if v and v > 1440:  # 24 hours in minutes
            raise ValueError("Duration cannot exceed 1440 minutes (24 hours)")
        return v


class ProcedureCreate(ProcedureBase):
    pass


class ProcedureUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=300)
    description: Optional[str] = Field(None, max_length=1000)
    date: Optional[DateType] = None
    duration: Optional[int] = Field(None, ge=1)
    outcome: Optional[str] = Field(None, max_length=500)
    complications: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None
    practitioner_id: Optional[int] = Field(None, gt=0)

    @validator("date")
    def validate_date(cls, v):
        if v and v > DateType.today():
            raise ValueError("Procedure date cannot be in the future")
        return v

    @validator("status")
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [
                "scheduled",
                "in-progress",
                "completed",
                "cancelled",
                "postponed",
            ]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @validator("duration")
    def validate_duration(cls, v):
        if v and v > 1440:  # 24 hours in minutes
            raise ValueError("Duration cannot exceed 1440 minutes (24 hours)")
        return v


class ProcedureResponse(ProcedureBase):
    id: int

    class Config:
        from_attributes = True


class ProcedureWithRelations(ProcedureResponse):
    patient: Optional[dict] = None
    practitioner: Optional[dict] = None

    class Config:
        from_attributes = True


class ProcedureSummary(BaseModel):
    id: int
    name: str
    date: DateType
    status: str
    duration: Optional[int]
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
