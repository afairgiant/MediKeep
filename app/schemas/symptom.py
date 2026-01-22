from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator, ValidationInfo

from app.models.enums import SymptomSeverity, SymptomStatus
from app.schemas.validators import (
    validate_date_not_future,
    validate_list_field,
    validate_required_text,
    validate_text_field,
)


# Valid values extracted for reuse
VALID_SYMPTOM_STATUSES = [s.value for s in SymptomStatus]
VALID_SYMPTOM_SEVERITIES = [s.value for s in SymptomSeverity]
VALID_TIMES_OF_DAY = ["morning", "afternoon", "evening", "night"]
VALID_IMPACT_LEVELS = ["no_impact", "mild", "moderate", "severe", "debilitating"]
VALID_RELATIONSHIP_TYPES = ["side_effect", "helped_by", "related_to"]


def _validate_enum_field(value: Optional[str], valid_values: List[str], field_name: str) -> Optional[str]:
    """Validate a value is in an allowed list (for optional fields)."""
    if value is None:
        return None
    if value not in valid_values:
        raise ValueError(f"{field_name} must be one of: {', '.join(valid_values)}")
    return value


def _validate_required_enum_field(value: str, valid_values: List[str], field_name: str) -> str:
    """Validate a required value is in an allowed list."""
    if value not in valid_values:
        raise ValueError(f"{field_name} must be one of: {', '.join(valid_values)}")
    return value


def _validate_relevance_note(v: Optional[str]) -> Optional[str]:
    """Shared validation for relevance note fields."""
    return validate_text_field(v, max_length=500, field_name="Relevance note")


# ============================================================================
# NEW TWO-LEVEL HIERARCHY SCHEMAS
# ============================================================================


class SymptomBase(BaseModel):
    """Base schema for Symptom (parent definition)"""

    symptom_name: str
    category: Optional[str] = None
    status: str = "active"
    is_chronic: bool = False
    typical_triggers: Optional[List[str]] = None
    general_notes: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator("symptom_name")
    @classmethod
    def validate_symptom_name(cls, v):
        return validate_required_text(v, max_length=200, field_name="Symptom name")

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        return validate_text_field(v, max_length=100, field_name="Category")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        return _validate_required_enum_field(v, VALID_SYMPTOM_STATUSES, "Status")

    @field_validator("general_notes")
    @classmethod
    def validate_general_notes(cls, v):
        return validate_text_field(v, max_length=2000, field_name="General notes")

    @field_validator("typical_triggers", "tags")
    @classmethod
    def validate_list_fields(cls, v):
        return validate_list_field(v, max_items=20, max_item_length=100)


class SymptomCreate(SymptomBase):
    """Schema for creating new symptom definition"""

    patient_id: int
    first_occurrence_date: date

    @field_validator("first_occurrence_date")
    @classmethod
    def validate_first_occurrence_date(cls, v):
        return validate_date_not_future(v, field_name="First occurrence date")


class SymptomUpdate(BaseModel):
    """Schema for updating symptom definition"""

    symptom_name: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    is_chronic: Optional[bool] = None
    typical_triggers: Optional[List[str]] = None
    general_notes: Optional[str] = None
    tags: Optional[str] = None

    @field_validator("symptom_name")
    @classmethod
    def validate_symptom_name(cls, v):
        if v is None:
            return v
        if v.strip():
            return validate_text_field(v, max_length=200, field_name="Symptom name")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        return validate_text_field(v, max_length=100, field_name="Category")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        return _validate_enum_field(v, VALID_SYMPTOM_STATUSES, "Status")

    @field_validator("general_notes")
    @classmethod
    def validate_general_notes(cls, v):
        return validate_text_field(v, max_length=2000, field_name="General notes")

    @field_validator("typical_triggers", "tags")
    @classmethod
    def validate_list_fields(cls, v):
        return validate_list_field(v, max_items=20, max_item_length=100, default_empty=False)


class SymptomResponse(SymptomBase):
    """Schema for symptom definition response"""

    id: int
    patient_id: int
    first_occurrence_date: date
    last_occurrence_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    occurrence_count: Optional[int] = 0  # Can be populated by CRUD

    class Config:
        from_attributes = True


class SymptomOccurrenceBase(BaseModel):
    """Base schema for SymptomOccurrence (individual episode)"""

    occurrence_date: date
    severity: str
    pain_scale: Optional[int] = None
    duration: Optional[str] = None
    time_of_day: Optional[str] = None
    location: Optional[str] = None
    triggers: Optional[List[str]] = None
    relief_methods: Optional[List[str]] = None
    associated_symptoms: Optional[List[str]] = None
    impact_level: Optional[str] = None
    resolved_date: Optional[date] = None
    resolution_notes: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("occurrence_date")
    @classmethod
    def validate_occurrence_date(cls, v):
        return validate_date_not_future(v, field_name="Occurrence date")

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        return _validate_required_enum_field(v, VALID_SYMPTOM_SEVERITIES, "Severity")

    @field_validator("pain_scale")
    @classmethod
    def validate_pain_scale(cls, v):
        if v is not None and (v < 0 or v > 10):
            raise ValueError("Pain scale must be between 0-10")
        return v

    @field_validator("duration")
    @classmethod
    def validate_duration(cls, v):
        return validate_text_field(v, max_length=100, field_name="Duration")

    @field_validator("time_of_day")
    @classmethod
    def validate_time_of_day(cls, v):
        if v is None:
            return None
        lower_v = v.lower()
        if lower_v not in VALID_TIMES_OF_DAY:
            raise ValueError(f"Time of day must be one of: {', '.join(VALID_TIMES_OF_DAY)}")
        return lower_v

    @field_validator("location")
    @classmethod
    def validate_location(cls, v):
        return validate_text_field(v, max_length=200, field_name="Location")

    @field_validator("impact_level")
    @classmethod
    def validate_impact_level(cls, v):
        return _validate_enum_field(v, VALID_IMPACT_LEVELS, "Impact level")

    @field_validator("triggers", "relief_methods", "associated_symptoms")
    @classmethod
    def validate_list_fields(cls, v):
        return validate_list_field(v, max_items=20, max_item_length=100)

    @field_validator("resolved_date")
    @classmethod
    def validate_resolved_date(cls, v, info: ValidationInfo):
        if v is not None:
            occurrence_date = info.data.get("occurrence_date")
            if occurrence_date is not None and v < occurrence_date:
                raise ValueError("Resolved date must be after occurrence date")
        return v

    @field_validator("resolution_notes", "notes")
    @classmethod
    def validate_text_fields(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Text field")


class SymptomOccurrenceCreate(SymptomOccurrenceBase):
    """Schema for creating new symptom occurrence

    Note: symptom_id is optional in request body since it's provided in the URL path.
    The endpoint will set it automatically from the path parameter.
    """

    symptom_id: Optional[int] = None


class SymptomOccurrenceUpdate(BaseModel):
    """Schema for updating symptom occurrence"""

    occurrence_date: Optional[date] = None
    severity: Optional[str] = None
    pain_scale: Optional[int] = None
    duration: Optional[str] = None
    time_of_day: Optional[str] = None
    location: Optional[str] = None
    triggers: Optional[List[str]] = None
    relief_methods: Optional[List[str]] = None
    associated_symptoms: Optional[List[str]] = None
    impact_level: Optional[str] = None
    resolved_date: Optional[date] = None
    resolution_notes: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("occurrence_date")
    @classmethod
    def validate_occurrence_date(cls, v):
        return validate_date_not_future(v, field_name="Occurrence date")

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        return _validate_enum_field(v, VALID_SYMPTOM_SEVERITIES, "Severity")

    @field_validator("pain_scale")
    @classmethod
    def validate_pain_scale(cls, v):
        if v is not None and (v < 0 or v > 10):
            raise ValueError("Pain scale must be between 0-10")
        return v

    @field_validator("duration")
    @classmethod
    def validate_duration(cls, v):
        return validate_text_field(v, max_length=100, field_name="Duration")

    @field_validator("time_of_day")
    @classmethod
    def validate_time_of_day(cls, v):
        if v is None:
            return v
        lower_v = v.lower()
        if lower_v not in VALID_TIMES_OF_DAY:
            raise ValueError(f"Time of day must be one of: {', '.join(VALID_TIMES_OF_DAY)}")
        return lower_v

    @field_validator("location")
    @classmethod
    def validate_location(cls, v):
        return validate_text_field(v, max_length=200, field_name="Location")

    @field_validator("impact_level")
    @classmethod
    def validate_impact_level(cls, v):
        return _validate_enum_field(v, VALID_IMPACT_LEVELS, "Impact level")

    @field_validator("triggers", "relief_methods", "associated_symptoms")
    @classmethod
    def validate_list_fields(cls, v):
        return validate_list_field(v, max_items=20, max_item_length=100, default_empty=False)

    @field_validator("resolved_date")
    @classmethod
    def validate_resolved_date(cls, v, info: ValidationInfo):
        if v is not None:
            occurrence_date = info.data.get("occurrence_date")
            if occurrence_date is not None and v < occurrence_date:
                raise ValueError("Resolved date must be after occurrence date")
        return v

    @field_validator("resolution_notes", "notes")
    @classmethod
    def validate_text_fields(cls, v):
        return validate_text_field(v, max_length=2000, field_name="Text field")


class SymptomOccurrenceResponse(SymptomOccurrenceBase):
    """Schema for symptom occurrence response"""

    id: int
    symptom_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Junction Table Schemas
# ============================================================================


class SymptomConditionBase(BaseModel):
    """Base schema for symptom-condition relationship"""

    symptom_id: int
    condition_id: int
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class SymptomConditionCreate(SymptomConditionBase):
    """Schema for creating symptom-condition relationship"""

    pass


class SymptomConditionUpdate(BaseModel):
    """Schema for updating symptom-condition relationship"""

    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class SymptomConditionResponse(SymptomConditionBase):
    """Schema for symptom-condition relationship response"""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SymptomMedicationBase(BaseModel):
    """Base schema for symptom-medication relationship"""

    symptom_id: int
    medication_id: int
    relationship_type: str = "related_to"  # side_effect, helped_by, related_to
    relevance_note: Optional[str] = None

    @field_validator("relationship_type")
    @classmethod
    def validate_relationship_type(cls, v):
        return _validate_required_enum_field(v, VALID_RELATIONSHIP_TYPES, "Relationship type")

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class SymptomMedicationCreate(SymptomMedicationBase):
    """Schema for creating symptom-medication relationship"""

    pass


class SymptomMedicationUpdate(BaseModel):
    """Schema for updating symptom-medication relationship"""

    relationship_type: Optional[str] = None
    relevance_note: Optional[str] = None

    @field_validator("relationship_type")
    @classmethod
    def validate_relationship_type(cls, v):
        return _validate_enum_field(v, VALID_RELATIONSHIP_TYPES, "Relationship type")

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class SymptomMedicationResponse(SymptomMedicationBase):
    """Schema for symptom-medication relationship response"""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SymptomTreatmentBase(BaseModel):
    """Base schema for symptom-treatment relationship"""

    symptom_id: int
    treatment_id: int
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class SymptomTreatmentCreate(SymptomTreatmentBase):
    """Schema for creating symptom-treatment relationship"""

    pass


class SymptomTreatmentUpdate(BaseModel):
    """Schema for updating symptom-treatment relationship"""

    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class SymptomTreatmentResponse(SymptomTreatmentBase):
    """Schema for symptom-treatment relationship response"""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
