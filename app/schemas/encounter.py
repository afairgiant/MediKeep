from datetime import date as DateType, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.base_tags import TaggedEntityMixin
from app.schemas.validators import (
    validate_date_not_future,
    validate_positive_id,
    validate_required_text,
    validate_text_field,
)


class EncounterBase(TaggedEntityMixin):
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

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v):
        """Validate encounter reason"""
        return validate_required_text(v, max_length=200, min_length=2, field_name="Encounter reason")

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        """Validate notes field"""
        return validate_text_field(v, max_length=5000, field_name="Notes")

    @field_validator("date")
    @classmethod
    def validate_date(cls, v):
        """Validate encounter date"""
        return validate_date_not_future(v, field_name="Encounter date")

    @field_validator("visit_type")
    @classmethod
    def validate_visit_type(cls, v):
        """Validate visit type"""
        return validate_text_field(v, max_length=100, field_name="Visit type")

    @field_validator("chief_complaint")
    @classmethod
    def validate_chief_complaint(cls, v):
        """Validate chief complaint"""
        return validate_text_field(v, max_length=500, field_name="Chief complaint")

    @field_validator("diagnosis")
    @classmethod
    def validate_diagnosis(cls, v):
        """Validate diagnosis"""
        return validate_text_field(v, max_length=5000, field_name="Diagnosis")

    @field_validator("treatment_plan")
    @classmethod
    def validate_treatment_plan(cls, v):
        """Validate treatment plan"""
        return validate_text_field(v, max_length=5000, field_name="Treatment plan")

    @field_validator("follow_up_instructions")
    @classmethod
    def validate_follow_up_instructions(cls, v):
        """Validate follow-up instructions"""
        return validate_text_field(v, max_length=5000, field_name="Follow-up instructions")

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration_minutes(cls, v):
        """Validate duration in minutes"""
        if v is not None and (v < 1 or v > 600):  # Max 10 hours
            raise ValueError("Duration must be between 1 and 600 minutes")
        return v

    @field_validator("location")
    @classmethod
    def validate_location(cls, v):
        """Validate location"""
        return validate_text_field(v, max_length=200, field_name="Location")

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        """Validate priority"""
        return validate_text_field(v, max_length=50, field_name="Priority")


class EncounterCreate(EncounterBase):
    """Schema for creating a new encounter"""

    patient_id: int
    practitioner_id: Optional[int] = None
    condition_id: Optional[int] = None

    @field_validator("patient_id")
    @classmethod
    def validate_patient_id(cls, v):
        """Validate patient ID"""
        return validate_positive_id(v, field_name="Patient ID", required=True)

    @field_validator("practitioner_id")
    @classmethod
    def validate_practitioner_id(cls, v):
        """Validate practitioner ID"""
        return validate_positive_id(v, field_name="Practitioner ID")

    @field_validator("condition_id")
    @classmethod
    def validate_condition_id(cls, v):
        """Validate condition ID"""
        return validate_positive_id(v, field_name="Condition ID")


class EncounterUpdate(BaseModel):
    """Schema for updating an existing encounter"""

    reason: Optional[str] = None
    date: Optional[DateType] = None
    notes: Optional[str] = None
    practitioner_id: Optional[int] = None
    condition_id: Optional[int] = None

    # Enhanced encounter fields (all optional for updates)
    visit_type: Optional[str] = None
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v):
        """Validate encounter reason if provided"""
        if v is None:
            return v
        if len(v.strip()) < 2:
            raise ValueError("Encounter reason must be at least 2 characters long")
        if len(v) > 200:
            raise ValueError("Encounter reason must be less than 200 characters")
        return v.strip()

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        """Validate notes if provided"""
        return validate_text_field(v, max_length=5000, field_name="Notes")

    @field_validator("date")
    @classmethod
    def validate_date(cls, v):
        """Validate encounter date if provided"""
        return validate_date_not_future(v, field_name="Encounter date")

    @field_validator("practitioner_id")
    @classmethod
    def validate_practitioner_id(cls, v):
        """Validate practitioner ID if provided"""
        return validate_positive_id(v, field_name="Practitioner ID")

    @field_validator("visit_type")
    @classmethod
    def validate_visit_type(cls, v):
        """Validate visit type if provided"""
        return validate_text_field(v, max_length=100, field_name="Visit type")

    @field_validator("chief_complaint")
    @classmethod
    def validate_chief_complaint(cls, v):
        """Validate chief complaint if provided"""
        return validate_text_field(v, max_length=500, field_name="Chief complaint")

    @field_validator("diagnosis")
    @classmethod
    def validate_diagnosis(cls, v):
        """Validate diagnosis if provided"""
        return validate_text_field(v, max_length=5000, field_name="Diagnosis")

    @field_validator("treatment_plan")
    @classmethod
    def validate_treatment_plan(cls, v):
        """Validate treatment plan if provided"""
        return validate_text_field(v, max_length=5000, field_name="Treatment plan")

    @field_validator("follow_up_instructions")
    @classmethod
    def validate_follow_up_instructions(cls, v):
        """Validate follow-up instructions if provided"""
        return validate_text_field(v, max_length=5000, field_name="Follow-up instructions")

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration_minutes(cls, v):
        """Validate duration in minutes if provided"""
        if v is not None and (v < 1 or v > 600):  # Max 10 hours
            raise ValueError("Duration must be between 1 and 600 minutes")
        return v

    @field_validator("location")
    @classmethod
    def validate_location(cls, v):
        """Validate location if provided"""
        return validate_text_field(v, max_length=200, field_name="Location")

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        """Validate priority if provided"""
        return validate_text_field(v, max_length=50, field_name="Priority")


class EncounterResponse(EncounterBase):
    """Schema for encounter response"""

    id: int
    patient_id: int
    practitioner_id: Optional[int] = None
    condition_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class EncounterWithRelations(EncounterResponse):
    """Schema for encounter with related data"""

    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EncounterSummary(BaseModel):
    """Schema for encounter summary information"""

    id: int
    reason: str
    date: DateType
    practitioner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Encounter - Lab Result Relationship Schemas

ENCOUNTER_LAB_RESULT_PURPOSES = [
    "ordered_during",
    "results_reviewed",
    "follow_up_for",
    "reference",
    "other",
]


class EncounterLabResultCreate(BaseModel):
    """Schema for creating an encounter-lab result relationship"""

    lab_result_id: int
    purpose: Optional[str] = None
    relevance_note: Optional[str] = None

    @field_validator("lab_result_id")
    @classmethod
    def validate_lab_result_id(cls, v):
        """Validate lab result ID"""
        return validate_positive_id(v, field_name="Lab result ID", required=True)

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        """Validate purpose"""
        if v and v not in ENCOUNTER_LAB_RESULT_PURPOSES:
            raise ValueError(
                f"Purpose must be one of: {', '.join(ENCOUNTER_LAB_RESULT_PURPOSES)}"
            )
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        """Validate relevance note"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class EncounterLabResultUpdate(BaseModel):
    """Schema for updating an encounter-lab result relationship"""

    purpose: Optional[str] = None
    relevance_note: Optional[str] = None

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        """Validate purpose"""
        if v and v not in ENCOUNTER_LAB_RESULT_PURPOSES:
            raise ValueError(
                f"Purpose must be one of: {', '.join(ENCOUNTER_LAB_RESULT_PURPOSES)}"
            )
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        """Validate relevance note"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class EncounterLabResultResponse(BaseModel):
    """Schema for encounter-lab result relationship response"""

    id: int
    encounter_id: int
    lab_result_id: int
    purpose: Optional[str] = None
    relevance_note: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EncounterLabResultWithDetails(EncounterLabResultResponse):
    """Schema with display fields for both sides of the relationship"""

    lab_result_name: Optional[str] = None
    lab_result_date: Optional[DateType] = None
    lab_result_status: Optional[str] = None
    encounter_reason: Optional[str] = None
    encounter_date: Optional[DateType] = None

    model_config = ConfigDict(from_attributes=True)


class EncounterLabResultBulkCreate(BaseModel):
    """Schema for bulk creating encounter-lab result relationships"""

    lab_result_ids: List[int]
    purpose: Optional[str] = None
    relevance_note: Optional[str] = None

    @field_validator("lab_result_ids")
    @classmethod
    def validate_lab_result_ids(cls, v):
        """Validate lab result IDs list"""
        if not v:
            raise ValueError("At least one lab result ID is required")
        for id_val in v:
            if id_val <= 0:
                raise ValueError("All lab result IDs must be positive integers")
        return v

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        """Validate purpose"""
        if v and v not in ENCOUNTER_LAB_RESULT_PURPOSES:
            raise ValueError(
                f"Purpose must be one of: {', '.join(ENCOUNTER_LAB_RESULT_PURPOSES)}"
            )
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        """Validate relevance note"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class LabResultEncounterCreate(BaseModel):
    """Schema for creating a lab-result-side encounter link (uses encounter_id)"""

    encounter_id: int
    purpose: Optional[str] = None
    relevance_note: Optional[str] = None

    @field_validator("encounter_id")
    @classmethod
    def validate_encounter_id(cls, v):
        """Validate encounter ID"""
        return validate_positive_id(v, field_name="Encounter ID", required=True)

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        """Validate purpose"""
        if v and v not in ENCOUNTER_LAB_RESULT_PURPOSES:
            raise ValueError(
                f"Purpose must be one of: {', '.join(ENCOUNTER_LAB_RESULT_PURPOSES)}"
            )
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        """Validate relevance note"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None


class LabResultEncounterBulkCreate(BaseModel):
    """Schema for bulk creating lab-result-side encounter links"""

    encounter_ids: List[int]
    purpose: Optional[str] = None
    relevance_note: Optional[str] = None

    @field_validator("encounter_ids")
    @classmethod
    def validate_encounter_ids(cls, v):
        """Validate encounter IDs list"""
        if not v:
            raise ValueError("At least one encounter ID is required")
        for id_val in v:
            if id_val <= 0:
                raise ValueError("All encounter IDs must be positive integers")
        return v

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        """Validate purpose"""
        if v and v not in ENCOUNTER_LAB_RESULT_PURPOSES:
            raise ValueError(
                f"Purpose must be one of: {', '.join(ENCOUNTER_LAB_RESULT_PURPOSES)}"
            )
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        """Validate relevance note"""
        if v and len(v.strip()) > 500:
            raise ValueError("Relevance note must be less than 500 characters")
        return v.strip() if v else None
