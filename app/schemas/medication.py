from pydantic import BaseModel, validator, root_validator
from typing import Optional
from datetime import date


class MedicationBase(BaseModel):
    """Base schema for Medication"""

    medication_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    indication: Optional[str] = None
    effectivePeriod_start: Optional[date] = None
    effectivePeriod_end: Optional[date] = None
    status: Optional[str] = None

    @root_validator(pre=True)
    def clean_empty_strings(cls, values):
        """Convert empty strings to None for optional date fields"""
        if isinstance(values, dict):
            for field in [
                "effectivePeriod_start",
                "effectivePeriod_end",
                "dosage",
                "frequency",
                "route",
                "indication",
                "status",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @validator("medication_name")
    def validate_medication_name(cls, v):
        """
        Validate medication name requirements.

        Args:
            v: The medication name value to validate

        Returns:
            Cleaned medication name (stripped whitespace)

        Raises:
            ValueError: If medication name doesn't meet requirements
        """
        if not v or len(v.strip()) < 2:
            raise ValueError("Medication name must be at least 2 characters long")
        if len(v) > 100:
            raise ValueError("Medication name must be less than 100 characters")
        return v.strip()

    @validator("dosage")
    def validate_dosage(cls, v):
        """Validate dosage format"""
        if v and len(v.strip()) > 50:
            raise ValueError("Dosage must be less than 50 characters")
        return v.strip() if v else None

    @validator("frequency")
    def validate_frequency(cls, v):
        """Validate frequency format"""
        if v and len(v.strip()) > 50:
            raise ValueError("Frequency must be less than 50 characters")
        return v.strip() if v else None

    @validator("route")
    def validate_route(cls, v):
        """Validate route of administration"""
        valid_routes = [
            "oral",
            "injection",
            "topical",
            "intravenous",
            "intramuscular",
            "subcutaneous",
            "inhalation",
            "nasal",
            "rectal",
            "sublingual",
        ]
        if v and v.lower() not in valid_routes:
            raise ValueError(f"Route must be one of: {', '.join(valid_routes)}")
        return v.lower() if v else None

    @validator("status")
    def validate_status(cls, v):
        """Validate medication status"""
        valid_statuses = ["active", "stopped", "on-hold", "completed", "cancelled"]
        if v and v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower() if v else None

    @validator("effectivePeriod_end")
    def validate_effective_period(cls, v, values):
        """Validate that end date is after start date"""
        # Only validate if both dates are provided and not None
        if v and "effectivePeriod_start" in values and values["effectivePeriod_start"]:
            if v < values["effectivePeriod_start"]:
                raise ValueError("End date must be after start date")
        return v


class MedicationCreate(MedicationBase):
    """Schema for creating a new medication"""

    patient_id: int
    practitioner_id: Optional[int] = None


class MedicationUpdate(BaseModel):
    """Schema for updating an existing medication"""

    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    indication: Optional[str] = None
    effectivePeriod_start: Optional[date] = None
    effectivePeriod_end: Optional[date] = None
    status: Optional[str] = None
    practitioner_id: Optional[int] = None

    @root_validator(pre=True)
    def clean_empty_strings(cls, values):
        """Convert empty strings to None for optional fields"""
        if isinstance(values, dict):
            for field in [
                "medication_name",
                "dosage",
                "frequency",
                "route",
                "indication",
                "effectivePeriod_start",
                "effectivePeriod_end",
                "status",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @validator("medication_name")
    def validate_medication_name(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 2:
                raise ValueError("Medication name must be at least 2 characters long")
            if len(v) > 100:
                raise ValueError("Medication name must be less than 100 characters")            
            return v.strip()
        return v

    @validator("effectivePeriod_end")
    def validate_end_date(cls, v, values):
        """Validate end date - check against start date"""
        # Only validate if both dates are provided and not None
        if v and "effectivePeriod_start" in values and values["effectivePeriod_start"]:
            if v < values["effectivePeriod_start"]:
                raise ValueError("End date must be after start date")
        return v

    @validator("route")
    def validate_route(cls, v):
        if v is not None:
            valid_routes = [
                "oral",
                "injection",
                "topical",
                "intravenous",
                "intramuscular",
                "subcutaneous",
                "inhalation",
                "nasal",
                "rectal",
                "sublingual",
            ]
            if v.lower() not in valid_routes:
                raise ValueError(f"Route must be one of: {', '.join(valid_routes)}")
            return v.lower()
        return v

    @validator("status")
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ["active", "stopped", "on-hold", "completed", "cancelled"]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v


class MedicationResponse(MedicationBase):
    """Schema for medication response"""

    id: int
    patient_id: int
    practitioner_id: Optional[int] = None

    class Config:
        from_attributes = True


class MedicationWithRelations(MedicationResponse):
    """Schema for medication with related data"""

    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
