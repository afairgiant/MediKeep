from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime


class LabResultBase(BaseModel):
    """Base schema for LabResult - simple test tracking"""

    test_name: str
    test_code: Optional[str] = None
    test_category: Optional[str] = None
    test_type: Optional[str] = None
    facility: Optional[str] = None
    status: Optional[str] = "ordered"
    ordered_date: datetime
    completed_date: Optional[datetime] = None
    notes: Optional[str] = None
    patient_id: int
    practitioner_id: Optional[int] = None

    @validator("test_name")
    def validate_test_name(cls, v):
        """Validate test name"""
        if not v or len(v.strip()) < 2:
            raise ValueError("Test name must be at least 2 characters long")
        if len(v) > 200:
            raise ValueError("Test name must be less than 200 characters")
        return v.strip()

    @validator("test_code")
    def validate_test_code(cls, v):
        """Validate test code (LOINC, CPT, etc.)"""
        if v and len(v.strip()) > 50:
            raise ValueError("Test code must be less than 50 characters")
        return v.strip().upper() if v else None

    @validator("test_category")
    def validate_test_category(cls, v):
        """Validate test category"""
        valid_categories = [
            "blood work",
            "imaging",
            "pathology",
            "microbiology",
            "chemistry",
            "hematology",
            "immunology",
            "genetics",
            "cardiology",
            "pulmonology",
            "other",
        ]
        if v and v.lower() not in valid_categories:
            raise ValueError(
                f"Test category must be one of: {', '.join(valid_categories)}"
            )
        return v.lower() if v else None

    @validator("test_type")
    def validate_test_type(cls, v):
        """Validate test type"""
        valid_types = [
            "routine",
            "urgent",
            "stat",
            "emergency",
            "follow-up",
            "screening",
        ]
        if v and v.lower() not in valid_types:
            raise ValueError(f"Test type must be one of: {', '.join(valid_types)}")
        return v.lower() if v else None

    @validator("facility")
    def validate_facility(cls, v):
        """Validate facility name"""
        if v and len(v.strip()) > 300:
            raise ValueError("Facility name must be less than 300 characters")
        return v.strip() if v else None

    @validator("status")
    def validate_status(cls, v):
        """Validate lab result status"""
        valid_statuses = ["ordered", "in-progress", "completed", "cancelled"]
        if v and v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower() if v else "ordered"

    @validator("notes")
    def validate_notes(cls, v):
        """Validate notes"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Notes must be less than 1000 characters")
        return v.strip() if v else None

    @validator("completed_date")
    def validate_completed_date(cls, v, values):
        """Validate that completed date is not before ordered date"""
        if v and "ordered_date" in values and values["ordered_date"]:
            if v < values["ordered_date"]:
                raise ValueError("Completed date cannot be before ordered date")
        return v


class LabResultCreate(LabResultBase):
    """Schema for creating a new lab result"""

    patient_id: int
    practitioner_id: Optional[int] = None

    @validator("patient_id")
    def validate_patient_id(cls, v):
        """Validate patient ID"""
        if v <= 0:
            raise ValueError("Patient ID must be a positive integer")
        return v


class LabResultUpdate(BaseModel):
    """Schema for updating an existing lab result"""

    test_name: Optional[str] = None
    test_code: Optional[str] = None
    test_category: Optional[str] = None
    test_type: Optional[str] = None
    facility: Optional[str] = None
    status: Optional[str] = None
    ordered_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    notes: Optional[str] = None
    practitioner_id: Optional[int] = None

    @validator("test_name")
    def validate_test_name(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 2:
                raise ValueError("Test name must be at least 2 characters long")
            if len(v) > 200:
                raise ValueError("Test name must be less than 200 characters")
            return v.strip()
        return v

    @validator("test_code")
    def validate_test_code(cls, v):
        if v is not None:
            if len(v.strip()) > 50:
                raise ValueError("Test code must be less than 50 characters")
            return v.strip().upper()
        return v

    @validator("status")
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ["ordered", "in-progress", "completed", "cancelled"]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v


class LabResultResponse(LabResultBase):
    """Schema for lab result response"""

    id: int
    patient_id: int
    practitioner_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LabResultWithRelations(LabResultResponse):
    """Schema for lab result with related data"""

    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None
    files: Optional[List] = []  # Will be filled with LabResultFileResponse objects

    class Config:
        from_attributes = True
