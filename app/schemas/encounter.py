from datetime import date as DateType
from typing import Optional

from pydantic import BaseModel, validator


class EncounterBase(BaseModel):
    """Base schema for Encounter"""

    reason: str
    date: DateType
    notes: Optional[str] = None

    # Enhanced encounter fields (all optional)
    visit_type: Optional[str] = None
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    priority: Optional[str] = None

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

    @validator("visit_type")
    def validate_visit_type(cls, v):
        """Validate visit type"""
        if v and len(v.strip()) > 100:
            raise ValueError("Visit type must be less than 100 characters")
        return v.strip() if v else None

    @validator("chief_complaint")
    def validate_chief_complaint(cls, v):
        """Validate chief complaint"""
        if v and len(v.strip()) > 500:
            raise ValueError("Chief complaint must be less than 500 characters")
        return v.strip() if v else None

    @validator("diagnosis")
    def validate_diagnosis(cls, v):
        """Validate diagnosis"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Diagnosis must be less than 1000 characters")
        return v.strip() if v else None

    @validator("treatment_plan")
    def validate_treatment_plan(cls, v):
        """Validate treatment plan"""
        if v and len(v.strip()) > 2000:
            raise ValueError("Treatment plan must be less than 2000 characters")
        return v.strip() if v else None

    @validator("follow_up_instructions")
    def validate_follow_up_instructions(cls, v):
        """Validate follow-up instructions"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Follow-up instructions must be less than 1000 characters")
        return v.strip() if v else None

    @validator("duration_minutes")
    def validate_duration_minutes(cls, v):
        """Validate duration in minutes"""
        if v is not None and (v < 1 or v > 600):  # Max 10 hours
            raise ValueError("Duration must be between 1 and 600 minutes")
        return v

    @validator("location")
    def validate_location(cls, v):
        """Validate location"""
        if v and len(v.strip()) > 200:
            raise ValueError("Location must be less than 200 characters")
        return v.strip() if v else None

    @validator("priority")
    def validate_priority(cls, v):
        """Validate priority"""
        if v and len(v.strip()) > 50:
            raise ValueError("Priority must be less than 50 characters")
        return v.strip() if v else None


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

    # Enhanced encounter fields (all optional for updates)
    visit_type: Optional[str] = None
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    priority: Optional[str] = None

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

    @validator("visit_type")
    def validate_visit_type(cls, v):
        """Validate visit type if provided"""
        if v is not None and len(v.strip()) > 100:
            raise ValueError("Visit type must be less than 100 characters")
        return v.strip() if v else None

    @validator("chief_complaint")
    def validate_chief_complaint(cls, v):
        """Validate chief complaint if provided"""
        if v is not None and len(v.strip()) > 500:
            raise ValueError("Chief complaint must be less than 500 characters")
        return v.strip() if v else None

    @validator("diagnosis")
    def validate_diagnosis(cls, v):
        """Validate diagnosis if provided"""
        if v is not None and len(v.strip()) > 1000:
            raise ValueError("Diagnosis must be less than 1000 characters")
        return v.strip() if v else None

    @validator("treatment_plan")
    def validate_treatment_plan(cls, v):
        """Validate treatment plan if provided"""
        if v is not None and len(v.strip()) > 2000:
            raise ValueError("Treatment plan must be less than 2000 characters")
        return v.strip() if v else None

    @validator("follow_up_instructions")
    def validate_follow_up_instructions(cls, v):
        """Validate follow-up instructions if provided"""
        if v is not None and len(v.strip()) > 1000:
            raise ValueError("Follow-up instructions must be less than 1000 characters")
        return v.strip() if v else None

    @validator("duration_minutes")
    def validate_duration_minutes(cls, v):
        """Validate duration in minutes if provided"""
        if v is not None and (v < 1 or v > 600):  # Max 10 hours
            raise ValueError("Duration must be between 1 and 600 minutes")
        return v

    @validator("location")
    def validate_location(cls, v):
        """Validate location if provided"""
        if v is not None and len(v.strip()) > 200:
            raise ValueError("Location must be less than 200 characters")
        return v.strip() if v else None

    @validator("priority")
    def validate_priority(cls, v):
        """Validate priority if provided"""
        if v is not None and len(v.strip()) > 50:
            raise ValueError("Priority must be less than 50 characters")
        return v.strip() if v else None


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
