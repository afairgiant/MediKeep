from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator, model_validator

from app.schemas.base_tags import TaggedEntityMixin


class LabResultBase(TaggedEntityMixin):
    """Base schema for LabResult - simple test tracking"""

    test_name: str
    test_code: Optional[str] = None
    test_category: Optional[str] = None
    test_type: Optional[str] = None
    facility: Optional[str] = None
    status: Optional[str] = "ordered"
    labs_result: Optional[str] = None
    ordered_date: Optional[date] = None
    completed_date: Optional[date] = None
    notes: Optional[str] = None
    patient_id: int
    practitioner_id: Optional[int] = None

    @field_validator("test_name")
    @classmethod
    def validate_test_name(cls, v):
        """Validate test name"""
        if not v or len(v.strip()) < 2:
            raise ValueError("Test name must be at least 2 characters long")
        if len(v) > 200:
            raise ValueError("Test name must be less than 200 characters")
        return v.strip()

    @field_validator("test_code")
    @classmethod
    def validate_test_code(cls, v):
        """Validate test code (LOINC, CPT, etc.)"""
        if v and len(v.strip()) > 50:
            raise ValueError("Test code must be less than 50 characters")
        return v.strip().upper() if v else None

    @field_validator("test_category")
    @classmethod
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

    @field_validator("test_type")
    @classmethod
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

    @field_validator("facility")
    @classmethod
    def validate_facility(cls, v):
        """Validate facility name"""
        if v and len(v.strip()) > 300:
            raise ValueError("Facility name must be less than 300 characters")
        return v.strip() if v else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """Validate lab result status"""
        valid_statuses = ["ordered", "in-progress", "completed", "cancelled"]
        if v and v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower() if v else "ordered"

    @field_validator("labs_result")
    @classmethod
    def validate_labs_result(cls, v):
        """Validate lab result interpretation"""
        valid_results = [
            "normal",
            "abnormal",
            "critical",
            "high",
            "low",
            "borderline",
            "inconclusive",
        ]
        if v and v.strip() and v.lower() not in valid_results:
            raise ValueError(f"Labs result must be one of: {', '.join(valid_results)}")
        return v.lower() if v and v.strip() else None

    @field_validator("ordered_date")
    @classmethod
    def validate_ordered_date(cls, v):
        """Validate ordered date - ensure it's a date object only"""
        if v is None:
            return None

        if isinstance(v, date) and not isinstance(v, datetime):
            return v

        if isinstance(v, datetime):
            # Convert datetime to date (remove time component)
            return v.date()

        if isinstance(v, str):
            try:
                # Parse string and convert to date only
                if "T" in v:
                    # Handle ISO format with time (e.g., "2024-01-15T00:00:00")
                    dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                    return dt.date()
                else:
                    # Handle date-only format (e.g., "2024-01-15")
                    return datetime.strptime(v, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError(
                    "Invalid date format for ordered_date. Use YYYY-MM-DD format."
                )

        raise ValueError("ordered_date must be a date string or date object")

    @field_validator("completed_date")
    @classmethod
    def validate_completed_date(cls, v):
        """Validate completed date - ensure it's a date object only"""
        if v is None:
            return None

        if isinstance(v, date) and not isinstance(v, datetime):
            return v

        if isinstance(v, datetime):
            # Convert datetime to date (remove time component)
            return v.date()

        if isinstance(v, str):
            try:
                # Parse string and convert to date only
                if "T" in v:
                    # Handle ISO format with time (e.g., "2024-01-15T00:00:00")
                    dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                    return dt.date()
                else:
                    # Handle date-only format (e.g., "2024-01-15")
                    return datetime.strptime(v, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError(
                    "Invalid date format for completed_date. Use YYYY-MM-DD format."
                )

        raise ValueError("completed_date must be a date string or date object")

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        """Validate notes"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Notes must be less than 1000 characters")
        return v.strip() if v else None

    @model_validator(mode="after")
    def validate_date_order(self):
        """Validate that completed date is not before ordered date"""
        if self.completed_date and self.ordered_date:
            if self.completed_date < self.ordered_date:
                raise ValueError("Completed date cannot be before ordered date")
        return self


class LabResultCreate(LabResultBase):
    """Schema for creating a new lab result"""

    patient_id: int
    practitioner_id: Optional[int] = None

    @field_validator("patient_id")
    @classmethod
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
    labs_result: Optional[str] = None
    ordered_date: Optional[date] = None
    completed_date: Optional[date] = None
    notes: Optional[str] = None
    practitioner_id: Optional[int] = None
    tags: Optional[List[str]] = None

    @field_validator("test_name")
    @classmethod
    def validate_test_name(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 2:
                raise ValueError("Test name must be at least 2 characters long")
            if len(v) > 200:
                raise ValueError("Test name must be less than 200 characters")
            return v.strip()
        return v

    @field_validator("test_code")
    @classmethod
    def validate_test_code(cls, v):
        if v is not None:
            if len(v.strip()) > 50:
                raise ValueError("Test code must be less than 50 characters")
            return v.strip().upper()
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ["ordered", "in-progress", "completed", "cancelled"]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @field_validator("labs_result")
    @classmethod
    def validate_labs_result(cls, v):
        if v is not None and v.strip():
            valid_results = [
                "normal",
                "abnormal",
                "critical",
                "high",
                "low",
                "borderline",
                "inconclusive",
            ]
            if v.lower() not in valid_results:
                raise ValueError(
                    f"Labs result must be one of: {', '.join(valid_results)}"
                )
            return v.lower()
        return v

    @field_validator("ordered_date")
    @classmethod
    def validate_ordered_date(cls, v):
        """Validate ordered date - ensure it's a date object only"""
        if v is None:
            return None

        if isinstance(v, date) and not isinstance(v, datetime):
            return v

        if isinstance(v, datetime):
            # Convert datetime to date (remove time component)
            return v.date()

        if isinstance(v, str):
            try:
                # Parse string and convert to date only
                if "T" in v:
                    # Handle ISO format with time (e.g., "2024-01-15T00:00:00")
                    dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                    return dt.date()
                else:
                    # Handle date-only format (e.g., "2024-01-15")
                    return datetime.strptime(v, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError(
                    "Invalid date format for ordered_date. Use YYYY-MM-DD format."
                )

        raise ValueError("ordered_date must be a date string or date object")

    @field_validator("completed_date")
    @classmethod
    def validate_completed_date(cls, v):
        """Validate completed date - ensure it's a date object only"""
        if v is None:
            return None

        if isinstance(v, date) and not isinstance(v, datetime):
            return v

        if isinstance(v, datetime):
            # Convert datetime to date (remove time component)
            return v.date()

        if isinstance(v, str):
            try:
                # Parse string and convert to date only
                if "T" in v:
                    # Handle ISO format with time (e.g., "2024-01-15T00:00:00")
                    dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                    return dt.date()
                else:
                    # Handle date-only format (e.g., "2024-01-15")
                    return datetime.strptime(v, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError(
                    "Invalid date format for completed_date. Use YYYY-MM-DD format."
                )

        raise ValueError("completed_date must be a date string or date object")

    @model_validator(mode="after")
    def validate_date_order(self):
        """Validate that completed date is not before ordered date"""
        if self.completed_date and self.ordered_date:
            if self.completed_date < self.ordered_date:
                raise ValueError("Completed date cannot be before ordered date")
        return self


class LabResultResponse(LabResultBase):
    """Schema for lab result response"""

    id: int
    patient_id: int
    practitioner_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LabResultWithRelations(LabResultResponse):
    """Schema for lab result with related data"""

    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None
    files: Optional[List] = []  # Will be filled with LabResultFileResponse objects

    model_config = {"from_attributes": True}


# Lab Result - Condition Relationship Schemas

class LabResultConditionBase(BaseModel):
    """Base schema for lab result condition relationship"""
    
    lab_result_id: int
    condition_id: int
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        """Validate relevance note"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class LabResultConditionCreate(LabResultConditionBase):
    """Schema for creating a lab result condition relationship"""
    pass


class LabResultConditionUpdate(BaseModel):
    """Schema for updating a lab result condition relationship"""
    
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        """Validate relevance note"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class LabResultConditionResponse(LabResultConditionBase):
    """Schema for lab result condition relationship response"""
    
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LabResultConditionWithDetails(LabResultConditionResponse):
    """Schema for lab result condition relationship with condition details"""
    
    condition: Optional[dict] = None  # Will contain condition details

    model_config = {"from_attributes": True}
