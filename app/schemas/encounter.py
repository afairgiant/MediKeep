from pydantic import BaseModel, validator
from typing import Optional
from datetime import date as DateType


class EncounterBase(BaseModel):
    """Base schema for Encounter"""

    reason: str
    date: DateType
    notes: Optional[str] = None

    @validator("reason")
    def validate_reason(cls, v):
        """Validate encounter reason"""
        if not v or len(v.strip()) < 2:
            raise ValueError("Encounter reason must be at least 2 characters long")
        if len(v) > 200:
            raise ValueError("Encounter reason must be less than 200 characters")
        return v.strip()

    @validator("notes")
    def validate_notes(cls, v):
        """Validate notes field"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Notes must be less than 1000 characters")
        return v.strip() if v else None

    @validator("date")
    def validate_date(cls, v):
        """Validate encounter date"""
        from datetime import date as date_type

        if v > date_type.today():
            raise ValueError("Encounter date cannot be in the future")
        return v


class EncounterCreate(EncounterBase):
    """Schema for creating a new encounter"""

    patient_id: int
    practitioner_id: Optional[int] = None

    @validator("patient_id")
    def validate_patient_id(cls, v):
        """Validate patient ID"""
        if v <= 0:
            raise ValueError("Patient ID must be a positive integer")
        return v

    @validator("practitioner_id")
    def validate_practitioner_id(cls, v):
        """Validate practitioner ID"""
        if v is not None and v <= 0:
            raise ValueError("Practitioner ID must be a positive integer")
        return v


class EncounterUpdate(BaseModel):
    """Schema for updating an existing encounter"""

    reason: Optional[str] = None
    date: Optional[DateType] = None
    notes: Optional[str] = None
    practitioner_id: Optional[int] = None

    @validator("reason")
    def validate_reason(cls, v):
        """Validate encounter reason if provided"""
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError("Encounter reason must be at least 2 characters long")
            if len(v) > 200:
                raise ValueError("Encounter reason must be less than 200 characters")
            return v.strip()
        return v

    @validator("notes")
    def validate_notes(cls, v):
        """Validate notes if provided"""
        if v is not None and len(v.strip()) > 1000:
            raise ValueError("Notes must be less than 1000 characters")
        return v.strip() if v else None

    @validator("date")
    def validate_date(cls, v):
        """Validate encounter date if provided"""
        if v is not None:
            from datetime import date as date_type

            if v > date_type.today():
                raise ValueError("Encounter date cannot be in the future")
        return v

    @validator("practitioner_id")
    def validate_practitioner_id(cls, v):
        """Validate practitioner ID if provided"""
        if v is not None and v <= 0:
            raise ValueError("Practitioner ID must be a positive integer")
        return v


class EncounterResponse(EncounterBase):
    """Schema for encounter response"""

    id: int
    patient_id: int
    practitioner_id: Optional[int] = None

    class Config:
        from_attributes = True


class EncounterWithRelations(EncounterResponse):
    """Schema for encounter with related data"""

    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True


class EncounterSummary(BaseModel):
    """Schema for encounter summary information"""

    id: int
    reason: str
    date: DateType
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
