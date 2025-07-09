from datetime import date
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, root_validator, validator

if TYPE_CHECKING:
    from app.schemas.pharmacy import Pharmacy
    from app.schemas.practitioner import Practitioner
    from app.schemas.condition import ConditionResponse


class MedicationBase(BaseModel):
    """Base schema for Medication"""

    medication_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    indication: Optional[str] = None
    effective_period_start: Optional[date] = None
    effective_period_end: Optional[date] = None
    status: Optional[str] = None
    practitioner_id: Optional[int] = None
    pharmacy_id: Optional[int] = None
    condition_id: Optional[int] = None

    @root_validator(pre=True)
    def clean_empty_strings(cls, values):  # noqa
        """Convert empty strings to None for optional date fields"""
        if isinstance(values, dict):
            for field in [
                "effective_period_start",
                "effective_period_end",
                "dosage",
                "frequency",
                "route",
                "indication",
                "status",
                "practitioner_id",
                "pharmacy_id",
                "condition_id",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @validator("medication_name")
    def validate_medication_name(cls, v):  # noqa
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
    def validate_dosage(cls, v):  # noqa
        """Validate dosage format"""
        if v and len(v.strip()) > 50:
            raise ValueError("Dosage must be less than 50 characters")
        return v.strip() if v else None

    @validator("frequency")
    def validate_frequency(cls, v):  # noqa
        """Validate frequency format"""
        if v and len(v.strip()) > 50:
            raise ValueError("Frequency must be less than 50 characters")
        return v.strip() if v else None

    @validator("route")
    def validate_route(cls, v):  # noqa
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
    def validate_status(cls, v):  # noqa
        """Validate medication status"""
        valid_statuses = ["active", "stopped", "on-hold", "completed", "cancelled"]
        if v and v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower() if v else None

    @validator("effective_period_end")
    def validate_effective_period(cls, v, values):
        """Validate that end date is after start date"""
        # Only validate if both dates are provided and not None
        if (
            v
            and "effective_period_start" in values
            and values["effective_period_start"]
        ):
            if v < values["effective_period_start"]:
                raise ValueError("End date must be after start date")
        return v


class MedicationCreate(MedicationBase):
    """Schema for creating a new medication"""

    patient_id: int
    practitioner_id: Optional[int] = None
    pharmacy_id: Optional[int] = None
    condition_id: Optional[int] = None


class MedicationUpdate(BaseModel):
    """Schema for updating an existing medication"""

    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    indication: Optional[str] = None
    effective_period_start: Optional[date] = None
    effective_period_end: Optional[date] = None
    status: Optional[str] = None
    practitioner_id: Optional[int] = None
    pharmacy_id: Optional[int] = None
    condition_id: Optional[int] = None

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
                "effective_period_start",
                "effective_period_end",
                "status",
                "practitioner_id",
                "pharmacy_id",
                "condition_id",
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

    @validator("effective_period_end")
    def validate_end_date(cls, v, values):
        """Validate end date - check against start date"""
        # Only validate if both dates are provided and not None
        if (
            v
            and "effective_period_start" in values
            and values["effective_period_start"]
        ):
            if v < values["effective_period_start"]:
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


# Enhanced response schema with nested objects
class MedicationResponseWithNested(MedicationBase):
    """Schema for medication response with nested practitioner, pharmacy, and condition objects"""

    id: int
    patient_id: int
    practitioner: Optional["Practitioner"] = None
    pharmacy: Optional["Pharmacy"] = None
    condition: Optional["ConditionResponse"] = None

    class Config:
        from_attributes = True


from app.schemas.pharmacy import Pharmacy

# Import here to avoid circular imports
from app.schemas.practitioner import Practitioner
from app.schemas.condition import ConditionResponse

# Rebuild the model to resolve forward references
MedicationResponseWithNested.model_rebuild()
