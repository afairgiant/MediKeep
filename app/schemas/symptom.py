from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, validator

from app.models.enums import SymptomSeverity, SymptomStatus
from app.schemas.base_tags import TaggedEntityMixin


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

    @validator("symptom_name")
    def validate_symptom_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Symptom name is required")
        if len(v.strip()) > 200:
            raise ValueError("Symptom name must be less than 200 characters")
        return v.strip()

    @validator("category")
    def validate_category(cls, v):
        if v and len(v.strip()) > 100:
            raise ValueError("Category must be less than 100 characters")
        return v.strip() if v else None

    @validator("status")
    def validate_status(cls, v):
        valid_statuses = [s.value for s in SymptomStatus]
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v

    @validator("general_notes")
    def validate_general_notes(cls, v):
        if v and len(v.strip()) > 2000:
            raise ValueError("General notes must be less than 2000 characters")
        return v.strip() if v else None

    @validator("typical_triggers", "tags")
    def validate_list_fields(cls, v):
        if v is not None:
            cleaned = list(set([item.strip() for item in v if item and item.strip()]))
            if len(cleaned) > 20:
                raise ValueError("Maximum 20 items allowed")
            for item in cleaned:
                if len(item) > 100:
                    raise ValueError("Each item must be less than 100 characters")
            return cleaned
        return []


class SymptomCreate(SymptomBase):
    """Schema for creating new symptom definition"""

    patient_id: int
    first_occurrence_date: date

    @validator("first_occurrence_date")
    def validate_first_occurrence_date(cls, v):
        if v and v > date.today():
            raise ValueError("First occurrence date cannot be in the future")
        return v


class SymptomUpdate(BaseModel):
    """Schema for updating symptom definition"""

    symptom_name: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    is_chronic: Optional[bool] = None
    typical_triggers: Optional[List[str]] = None
    general_notes: Optional[str] = None
    tags: Optional[List[str]] = None

    # Use same validators as SymptomBase
    _validate_symptom_name = validator("symptom_name", allow_reuse=True)(SymptomBase.validate_symptom_name)
    _validate_category = validator("category", allow_reuse=True)(SymptomBase.validate_category)
    _validate_status = validator("status", allow_reuse=True)(SymptomBase.validate_status)
    _validate_general_notes = validator("general_notes", allow_reuse=True)(SymptomBase.validate_general_notes)
    _validate_lists = validator("typical_triggers", "tags", allow_reuse=True)(SymptomBase.validate_list_fields)


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

    @validator("occurrence_date")
    def validate_occurrence_date(cls, v):
        if v and v > date.today():
            raise ValueError("Occurrence date cannot be in the future")
        return v

    @validator("severity")
    def validate_severity(cls, v):
        valid_severities = [s.value for s in SymptomSeverity]
        if v not in valid_severities:
            raise ValueError(f"Severity must be one of: {', '.join(valid_severities)}")
        return v

    @validator("pain_scale")
    def validate_pain_scale(cls, v):
        if v is not None:
            if v < 0 or v > 10:
                raise ValueError("Pain scale must be between 0-10")
        return v

    @validator("duration")
    def validate_duration(cls, v):
        if v and len(v.strip()) > 100:
            raise ValueError("Duration must be less than 100 characters")
        return v.strip() if v else None

    @validator("time_of_day")
    def validate_time_of_day(cls, v):
        if v:
            valid_times = ["morning", "afternoon", "evening", "night"]
            if v.lower() not in valid_times:
                raise ValueError(f"Time of day must be one of: {', '.join(valid_times)}")
        return v.lower() if v else None

    @validator("location")
    def validate_location(cls, v):
        if v and len(v.strip()) > 200:
            raise ValueError("Location must be less than 200 characters")
        return v.strip() if v else None

    @validator("impact_level")
    def validate_impact_level(cls, v):
        if v:
            valid_impacts = ["no_impact", "mild", "moderate", "severe", "debilitating"]
            if v not in valid_impacts:
                raise ValueError(f"Impact level must be one of: {', '.join(valid_impacts)}")
        return v

    @validator("triggers", "relief_methods", "associated_symptoms")
    def validate_list_fields(cls, v):
        if v is not None:
            cleaned = list(set([item.strip() for item in v if item and item.strip()]))
            if len(cleaned) > 20:
                raise ValueError("Maximum 20 items allowed")
            for item in cleaned:
                if len(item) > 100:
                    raise ValueError("Each item must be less than 100 characters")
            return cleaned
        return []

    @validator("resolved_date")
    def validate_resolved_date(cls, v, values):
        if v:
            # Only validate if occurrence_date is present in values
            occurrence_date = values.get("occurrence_date")
            if occurrence_date and v < occurrence_date:
                raise ValueError("Resolved date must be after occurrence date")
        return v

    @validator("resolution_notes", "notes")
    def validate_text_fields(cls, v):
        if v and len(v.strip()) > 2000:
            raise ValueError("Text fields must be less than 2000 characters")
        return v.strip() if v else None


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

    # Reuse validators from base
    _validate_occurrence_date = validator("occurrence_date", allow_reuse=True)(SymptomOccurrenceBase.validate_occurrence_date)
    _validate_severity = validator("severity", allow_reuse=True)(SymptomOccurrenceBase.validate_severity)
    _validate_pain_scale = validator("pain_scale", allow_reuse=True)(SymptomOccurrenceBase.validate_pain_scale)
    _validate_duration = validator("duration", allow_reuse=True)(SymptomOccurrenceBase.validate_duration)
    _validate_time_of_day = validator("time_of_day", allow_reuse=True)(SymptomOccurrenceBase.validate_time_of_day)
    _validate_location = validator("location", allow_reuse=True)(SymptomOccurrenceBase.validate_location)
    _validate_impact_level = validator("impact_level", allow_reuse=True)(SymptomOccurrenceBase.validate_impact_level)
    _validate_lists = validator("triggers", "relief_methods", "associated_symptoms", allow_reuse=True)(SymptomOccurrenceBase.validate_list_fields)
    _validate_resolved_date = validator("resolved_date", allow_reuse=True)(SymptomOccurrenceBase.validate_resolved_date)
    _validate_text_fields = validator("resolution_notes", "notes", allow_reuse=True)(SymptomOccurrenceBase.validate_text_fields)


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

    @validator("relevance_note")
    def validate_relevance_note(cls, v):
        """Validate relevance note length"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class SymptomConditionCreate(SymptomConditionBase):
    """Schema for creating symptom-condition relationship"""

    pass


class SymptomConditionUpdate(BaseModel):
    """Schema for updating symptom-condition relationship"""

    relevance_note: Optional[str] = None

    @validator("relevance_note")
    def validate_relevance_note(cls, v):
        """Validate relevance note length"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


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

    @validator("relationship_type")
    def validate_relationship_type(cls, v):
        """Validate relationship type"""
        valid_types = ["side_effect", "helped_by", "related_to"]
        if v not in valid_types:
            raise ValueError(
                f"Relationship type must be one of: {', '.join(valid_types)}"
            )
        return v

    @validator("relevance_note")
    def validate_relevance_note(cls, v):
        """Validate relevance note length"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class SymptomMedicationCreate(SymptomMedicationBase):
    """Schema for creating symptom-medication relationship"""

    pass


class SymptomMedicationUpdate(BaseModel):
    """Schema for updating symptom-medication relationship"""

    relationship_type: Optional[str] = None
    relevance_note: Optional[str] = None

    @validator("relationship_type")
    def validate_relationship_type(cls, v):
        """Validate relationship type"""
        if v is not None:
            valid_types = ["side_effect", "helped_by", "related_to"]
            if v not in valid_types:
                raise ValueError(
                    f"Relationship type must be one of: {', '.join(valid_types)}"
                )
        return v

    @validator("relevance_note")
    def validate_relevance_note(cls, v):
        """Validate relevance note length"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


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

    @validator("relevance_note")
    def validate_relevance_note(cls, v):
        """Validate relevance note length"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class SymptomTreatmentCreate(SymptomTreatmentBase):
    """Schema for creating symptom-treatment relationship"""

    pass


class SymptomTreatmentUpdate(BaseModel):
    """Schema for updating symptom-treatment relationship"""

    relevance_note: Optional[str] = None

    @validator("relevance_note")
    def validate_relevance_note(cls, v):
        """Validate relevance note length"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class SymptomTreatmentResponse(SymptomTreatmentBase):
    """Schema for symptom-treatment relationship response"""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
