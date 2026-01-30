from datetime import date
from typing import TYPE_CHECKING, Optional, List

from pydantic import BaseModel, ConfigDict, model_validator, field_validator, ValidationInfo

from app.models.enums import get_all_medication_statuses, get_all_medication_types
from app.schemas.base_tags import TaggedEntityMixin

if TYPE_CHECKING:
    from app.schemas.pharmacy import Pharmacy
    from app.schemas.practitioner import Practitioner


class MedicationBase(TaggedEntityMixin):
    """Base schema for Medication"""

    medication_name: str
    medication_type: Optional[str] = 'prescription'
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    indication: Optional[str] = None
    effective_period_start: Optional[date] = None
    effective_period_end: Optional[date] = None
    status: Optional[str] = None
    practitioner_id: Optional[int] = None
    pharmacy_id: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def clean_empty_strings(cls, values):
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
                "medication_type",
                "practitioner_id",
                "pharmacy_id",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @field_validator("medication_name")
    @classmethod
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

    @field_validator("dosage")
    @classmethod
    def validate_dosage(cls, v):
        """Validate dosage format"""
        if v and len(v.strip()) > 50:
            raise ValueError("Dosage must be less than 50 characters")
        return v.strip() if v else None

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, v):
        """Validate frequency format"""
        if v and len(v.strip()) > 50:
            raise ValueError("Frequency must be less than 50 characters")
        return v.strip() if v else None

    @field_validator("route")
    @classmethod
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

    @field_validator("medication_type")
    @classmethod
    def validate_medication_type(cls, v):
        """Validate medication type using enum"""
        if v is not None:
            valid_types = get_all_medication_types()
            if v not in valid_types:
                raise ValueError(f"Medication type must be one of: {', '.join(valid_types)}")
            return v
        return 'prescription'

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """Validate medication status using enum"""
        if v is not None:
            valid_statuses = get_all_medication_statuses()
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @field_validator("effective_period_end")
    @classmethod
    def validate_effective_period(cls, v, info: ValidationInfo):
        """Validate that end date is after start date"""
        # Only validate if both dates are provided and not None
        if (
            v
            and info.data.get("effective_period_start")
        ):
            if v < info.data["effective_period_start"]:
                raise ValueError("End date must be after start date")
        return v


class MedicationCreate(MedicationBase):
    """Schema for creating a new medication"""

    patient_id: int
    practitioner_id: Optional[int] = None
    pharmacy_id: Optional[int] = None


class MedicationUpdate(BaseModel):
    """Schema for updating an existing medication"""

    medication_name: Optional[str] = None
    medication_type: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    indication: Optional[str] = None
    effective_period_start: Optional[date] = None
    effective_period_end: Optional[date] = None
    status: Optional[str] = None
    practitioner_id: Optional[int] = None
    pharmacy_id: Optional[int] = None
    tags: Optional[List[str]] = None

    @model_validator(mode="before")
    @classmethod
    def clean_empty_strings(cls, values):
        """Convert empty strings to None for optional fields"""
        if isinstance(values, dict):
            for field in [
                "medication_name",
                "medication_type",
                "dosage",
                "frequency",
                "route",
                "indication",
                "effective_period_start",
                "effective_period_end",
                "status",
                "practitioner_id",
                "pharmacy_id",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @field_validator("medication_name")
    @classmethod
    def validate_medication_name(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 2:
                raise ValueError("Medication name must be at least 2 characters long")
            if len(v) > 100:
                raise ValueError("Medication name must be less than 100 characters")
            return v.strip()
        return v

    @field_validator("effective_period_end")
    @classmethod
    def validate_end_date(cls, v, info: ValidationInfo):
        """Validate end date - check against start date"""
        # Only validate if both dates are provided and not None
        if (
            v
            and info.data.get("effective_period_start")
        ):
            if v < info.data["effective_period_start"]:
                raise ValueError("End date must be after start date")
        return v

    @field_validator("route")
    @classmethod
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

    @field_validator("medication_type")
    @classmethod
    def validate_medication_type(cls, v):
        if v is not None:
            valid_types = get_all_medication_types()
            if v not in valid_types:
                raise ValueError(f"Medication type must be one of: {', '.join(valid_types)}")
            return v
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = get_all_medication_statuses()
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v


class MedicationResponse(MedicationBase):
    """Schema for medication response"""

    id: int
    patient_id: int
    practitioner_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class MedicationWithRelations(MedicationResponse):
    """Schema for medication with related data"""

    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Enhanced response schema with nested objects
class MedicationResponseWithNested(MedicationBase):
    """Schema for medication response with nested practitioner and pharmacy objects"""

    id: int
    patient_id: int
    practitioner: Optional["Practitioner"] = None
    pharmacy: Optional["Pharmacy"] = None

    model_config = ConfigDict(from_attributes=True)


from app.schemas.pharmacy import Pharmacy

# Import here to avoid circular imports
from app.schemas.practitioner import Practitioner

# Rebuild the model to resolve forward references
MedicationResponseWithNested.model_rebuild()
