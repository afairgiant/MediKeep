from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, validator


class TreatmentBase(BaseModel):
    treatment_name: str = Field(
        ..., min_length=2, max_length=300, description="Name of the treatment"
    )
    treatment_type: str = Field(
        ..., min_length=2, max_length=300, description="Type of treatment"
    )
    description: Optional[str] = Field(
        None, max_length=1000, description="Detailed description of the treatment"
    )
    start_date: date = Field(..., description="Start date of the treatment")
    end_date: Optional[date] = Field(None, description="End date of the treatment")
    frequency: Optional[str] = Field(
        None, max_length=100, description="Frequency of the treatment"
    )
    treatment_category: Optional[str] = Field(
        None,
        max_length=200,
        description="Category of treatment (e.g., 'inpatient', 'outpatient')",
    )
    outcome: Optional[str] = Field(
        None, max_length=200, description="Expected outcome of the treatment"
    )
    location: Optional[str] = Field(
        None, max_length=200, description="Location where the treatment is administered"
    )
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    status: Optional[str] = Field("active", description="Status of the treatment")
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of the prescribing practitioner"
    )
    condition_id: Optional[int] = Field(
        None, gt=0, description="ID of the related condition"
    )

    @validator("start_date")
    def validate_start_date(cls, v):
        if v > date.today():
            raise ValueError("Start date cannot be in the future")
        return v

    @validator("end_date")
    def validate_end_date(cls, v, values):
        if v and "start_date" in values and v < values["start_date"]:
            raise ValueError("End date cannot be before start date")
        return v

    @validator("status")
    def validate_status(cls, v):
        if v is None:
            return "active"  # Default value
        valid_statuses = ["active", "completed", "discontinued", "on-hold", "planned"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()


class TreatmentCreate(TreatmentBase):
    pass


class TreatmentUpdate(BaseModel):
    treatment_name: Optional[str] = Field(None, min_length=2, max_length=300)
    treatment_type: Optional[str] = Field(None, min_length=2, max_length=300)
    description: Optional[str] = Field(None, max_length=1000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    frequency: Optional[str] = Field(None, max_length=100)
    treatment_category: Optional[str] = Field(None, max_length=200)
    outcome: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None
    practitioner_id: Optional[int] = Field(None, gt=0)
    condition_id: Optional[int] = Field(None, gt=0)

    @validator("start_date")
    def validate_start_date(cls, v):
        if v and v > date.today():
            raise ValueError("Start date cannot be in the future")
        return v

    @validator("end_date")
    def validate_end_date(cls, v, values):
        if (
            v
            and "start_date" in values
            and values["start_date"]
            and v < values["start_date"]
        ):
            raise ValueError("End date cannot be before start date")
        return v

    @validator("status")
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [
                "active",
                "completed",
                "discontinued",
                "on-hold",
                "planned",
            ]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v


class TreatmentResponse(TreatmentBase):
    id: int

    class Config:
        from_attributes = True


class TreatmentWithRelations(TreatmentResponse):
    patient: Optional[dict] = None
    practitioner: Optional[dict] = None
    condition: Optional[dict] = None

    class Config:
        from_attributes = True


class TreatmentSummary(BaseModel):
    id: int
    treatment_name: str
    start_date: date
    end_date: Optional[date]
    status: str
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
