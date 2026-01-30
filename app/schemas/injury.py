"""
Pydantic schemas for Injury entity.

Injury represents a physical injury record for a patient,
tracking injuries like sprains, fractures, burns, etc.
"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import get_all_injury_statuses, get_all_severity_levels, get_all_laterality_values
from app.schemas.base_tags import TaggedEntityMixin
from app.schemas.validators import validate_date_not_future, validate_text_field
from app.schemas.injury_type import InjuryTypeResponse


# Pre-fetch valid values for reuse
VALID_INJURY_STATUSES = get_all_injury_statuses()
VALID_SEVERITY_LEVELS = get_all_severity_levels()
VALID_LATERALITY_VALUES = get_all_laterality_values()


def _validate_injury_status(v: Optional[str], required: bool = True) -> Optional[str]:
    """Validate injury status value."""
    if v is None:
        if required:
            raise ValueError("Status is required")
        return None
    lower_v = v.lower()
    if lower_v not in VALID_INJURY_STATUSES:
        raise ValueError(f"Status must be one of: {', '.join(VALID_INJURY_STATUSES)}")
    return lower_v


def _validate_severity(v: Optional[str]) -> Optional[str]:
    """Validate severity level value."""
    if v is None:
        return None
    lower_v = v.lower()
    if lower_v not in VALID_SEVERITY_LEVELS:
        raise ValueError(f"Severity must be one of: {', '.join(VALID_SEVERITY_LEVELS)}")
    return lower_v


def _validate_laterality(v: Optional[str]) -> Optional[str]:
    """Validate laterality value."""
    if v is None:
        return None
    lower_v = v.lower()
    if lower_v not in VALID_LATERALITY_VALUES:
        raise ValueError(f"Laterality must be one of: {', '.join(VALID_LATERALITY_VALUES)}")
    return lower_v


def _validate_relevance_note(v: Optional[str]) -> Optional[str]:
    """Shared validation for relevance note fields."""
    return validate_text_field(v, max_length=500, field_name="Relevance note")


class InjuryBase(TaggedEntityMixin):
    """Base schema for Injury"""
    injury_name: str = Field(
        ..., min_length=2, max_length=300, description="User-friendly name for the injury"
    )
    injury_type_id: Optional[int] = Field(
        None, gt=0, description="Link to InjuryType table"
    )
    body_part: str = Field(
        ..., min_length=1, max_length=100, description="Affected body part"
    )
    laterality: Optional[str] = Field(
        None, description="Side of body affected (left/right/bilateral/not_applicable)"
    )
    date_of_injury: Optional[date] = Field(None, description="When the injury occurred (optional if unknown)")
    mechanism: Optional[str] = Field(
        None, max_length=500, description="How the injury happened"
    )
    severity: Optional[str] = Field(
        None, description="Injury severity (mild/moderate/severe/life-threatening)"
    )
    status: str = Field(
        default="active", description="Current status (active/healing/resolved/chronic)"
    )
    treatment_received: Optional[str] = Field(
        None, description="Description of treatment received"
    )
    recovery_notes: Optional[str] = Field(
        None, description="Notes about recovery progress"
    )
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of treating practitioner"
    )
    notes: Optional[str] = Field(None, description="General notes")

    @field_validator("date_of_injury")
    @classmethod
    def validate_date_of_injury(cls, v):
        if v is None:
            return None
        return validate_date_not_future(v, field_name="Date of injury")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        return _validate_injury_status(v)

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        return _validate_severity(v)

    @field_validator("laterality")
    @classmethod
    def validate_laterality(cls, v):
        return _validate_laterality(v)

    @field_validator("mechanism")
    @classmethod
    def validate_mechanism(cls, v):
        return validate_text_field(v, max_length=500, field_name="Mechanism")

    @field_validator("treatment_received")
    @classmethod
    def validate_treatment_received(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Treatment received")

    @field_validator("recovery_notes")
    @classmethod
    def validate_recovery_notes(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Recovery notes")

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Notes")


class InjuryCreate(InjuryBase):
    """Schema for creating a new Injury"""
    patient_id: int = Field(..., gt=0, description="ID of the patient")


class InjuryUpdate(BaseModel):
    """Schema for updating an existing Injury"""
    injury_name: Optional[str] = Field(None, min_length=2, max_length=300)
    injury_type_id: Optional[int] = Field(None, gt=0)
    body_part: Optional[str] = Field(None, min_length=1, max_length=100)
    laterality: Optional[str] = None
    date_of_injury: Optional[date] = None
    mechanism: Optional[str] = Field(None, max_length=500)
    severity: Optional[str] = None
    status: Optional[str] = None
    treatment_received: Optional[str] = None
    recovery_notes: Optional[str] = None
    practitioner_id: Optional[int] = Field(None, gt=0)
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator("date_of_injury")
    @classmethod
    def validate_date_of_injury(cls, v):
        if v is None:
            return None
        return validate_date_not_future(v, field_name="Date of injury")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        return _validate_injury_status(v, required=False)

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        return _validate_severity(v)

    @field_validator("laterality")
    @classmethod
    def validate_laterality(cls, v):
        return _validate_laterality(v)

    @field_validator("mechanism")
    @classmethod
    def validate_mechanism(cls, v):
        return validate_text_field(v, max_length=500, field_name="Mechanism")

    @field_validator("treatment_received")
    @classmethod
    def validate_treatment_received(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Treatment received")

    @field_validator("recovery_notes")
    @classmethod
    def validate_recovery_notes(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Recovery notes")

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Notes")


class InjuryResponse(InjuryBase):
    """Schema for Injury response"""
    id: int
    patient_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InjuryWithRelations(InjuryResponse):
    """Schema for Injury with related data"""
    injury_type: Optional[InjuryTypeResponse] = None
    practitioner: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("injury_type", mode="before")
    @classmethod
    def validate_injury_type(cls, v):
        """Convert SQLAlchemy InjuryType object to dict"""
        if v is None:
            return None
        if hasattr(v, "__dict__"):
            return {
                "id": getattr(v, "id", None),
                "name": getattr(v, "name", None),
                "description": getattr(v, "description", None),
                "is_system": getattr(v, "is_system", False),
                "created_at": getattr(v, "created_at", None),
                "updated_at": getattr(v, "updated_at", None),
            }
        return v

    @field_validator("practitioner", mode="before")
    @classmethod
    def validate_practitioner(cls, v):
        """Convert SQLAlchemy Practitioner object to dict"""
        if v is None:
            return None
        if hasattr(v, "__dict__"):
            return {
                "id": getattr(v, "id", None),
                "name": getattr(v, "name", None),
                "specialty": getattr(v, "specialty", None),
                "phone_number": getattr(v, "phone_number", None),
            }
        return v


class InjurySummary(BaseModel):
    """Minimal Injury data for list views"""
    id: int
    injury_name: str
    body_part: str
    laterality: Optional[str]
    date_of_injury: Optional[date] = None
    severity: Optional[str]
    status: str
    injury_type_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InjuryDropdownOption(BaseModel):
    """Minimal Injury data for dropdown selections"""
    id: int
    injury_name: str
    body_part: str
    status: str
    date_of_injury: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


# Junction Table Schemas

class InjuryMedicationBase(BaseModel):
    """Base schema for injury medication relationship"""
    injury_id: int
    medication_id: int
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryMedicationCreate(BaseModel):
    """Schema for creating an injury medication relationship"""
    medication_id: int
    relevance_note: Optional[str] = None
    injury_id: Optional[int] = None  # Will be set from URL path parameter

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryMedicationUpdate(BaseModel):
    """Schema for updating an injury medication relationship"""
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryMedicationResponse(InjuryMedicationBase):
    """Schema for injury medication relationship response"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InjuryMedicationWithDetails(InjuryMedicationResponse):
    """Schema for injury medication relationship with medication details"""
    medication: Optional[dict] = None

    model_config = {"from_attributes": True}


class InjuryConditionBase(BaseModel):
    """Base schema for injury condition relationship"""
    injury_id: int
    condition_id: int
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryConditionCreate(BaseModel):
    """Schema for creating an injury condition relationship"""
    condition_id: int
    relevance_note: Optional[str] = None
    injury_id: Optional[int] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryConditionResponse(InjuryConditionBase):
    """Schema for injury condition relationship response"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InjuryConditionWithDetails(InjuryConditionResponse):
    """Schema for injury condition relationship with condition details"""
    condition: Optional[dict] = None

    model_config = {"from_attributes": True}


class InjuryTreatmentBase(BaseModel):
    """Base schema for injury treatment relationship"""
    injury_id: int
    treatment_id: int
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryTreatmentCreate(BaseModel):
    """Schema for creating an injury treatment relationship"""
    treatment_id: int
    relevance_note: Optional[str] = None
    injury_id: Optional[int] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryTreatmentResponse(InjuryTreatmentBase):
    """Schema for injury treatment relationship response"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InjuryTreatmentWithDetails(InjuryTreatmentResponse):
    """Schema for injury treatment relationship with treatment details"""
    treatment: Optional[dict] = None

    model_config = {"from_attributes": True}


class InjuryProcedureBase(BaseModel):
    """Base schema for injury procedure relationship"""
    injury_id: int
    procedure_id: int
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryProcedureCreate(BaseModel):
    """Schema for creating an injury procedure relationship"""
    procedure_id: int
    relevance_note: Optional[str] = None
    injury_id: Optional[int] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class InjuryProcedureResponse(InjuryProcedureBase):
    """Schema for injury procedure relationship response"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InjuryProcedureWithDetails(InjuryProcedureResponse):
    """Schema for injury procedure relationship with procedure details"""
    procedure: Optional[dict] = None

    model_config = {"from_attributes": True}
