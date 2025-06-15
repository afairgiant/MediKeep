from datetime import date as DateType
from typing import Optional
from pydantic import BaseModel, Field, validator


class ProcedureBase(BaseModel):
    procedure_name: str = Field(
        ..., min_length=2, max_length=300, description="Name of the procedure"
    )
    code: Optional[str] = Field(
        None, max_length=50, description="Code for the procedure (e.g., CPT code)"
    )
    description: Optional[str] = Field(
        None, max_length=1000, description="Detailed description of the procedure"
    )
    date: DateType = Field(..., description="Date when the procedure was performed")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    status: str = Field(..., description="Status of the procedure")
    facility: Optional[str] = Field(
        None, max_length=300, description="Facility where the procedure was performed"
    )
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


class ProcedureCreate(ProcedureBase):
    pass


class ProcedureUpdate(BaseModel):
    procedure_name: Optional[str] = Field(None, min_length=2, max_length=300)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=1000)
    date: Optional[DateType] = None
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None
    facility: Optional[str] = Field(None, max_length=300)
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
    procedure_name: str
    date: DateType
    status: str
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
