from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, ValidationInfo

from app.schemas.base_tags import TaggedEntityMixin
from app.models.enums import TreatmentStatus


# Helper function for validating relevance notes
def _validate_relevance_note(v: Optional[str]) -> Optional[str]:
    """Validate and clean relevance note."""
    if v is not None:
        v = v.strip()
        if len(v) > 500:
            raise ValueError("Relevance note must be 500 characters or less")
        if len(v) == 0:
            return None
    return v


class TreatmentBase(TaggedEntityMixin):
    treatment_name: str = Field(
        ..., min_length=2, max_length=300, description="Name of the treatment"
    )
    treatment_type: Optional[str] = Field(
        None, max_length=300, description="Category of treatment (optional)"
    )
    description: Optional[str] = Field(
        None, max_length=1000, description="Detailed description of the treatment"
    )
    start_date: Optional[date] = Field(None, description="Start date of the treatment (optional)")
    end_date: Optional[date] = Field(None, description="End date of the treatment")
    frequency: Optional[str] = Field(
        None, max_length=100, description="Frequency of the treatment"
    )
    treatment_category: Optional[str] = Field(
        None,
        max_length=200,
        description="Category of treatment (e.g., 'inpatient', 'outpatient')",
    )
    outcome: Optional[str] = Field(
        None, max_length=200, description="Expected outcome of the treatment"
    )
    location: Optional[str] = Field(
        None, max_length=200, description="Location where the treatment is administered"
    )
    dosage: Optional[str] = Field(
        None, max_length=200, description="Dosage of the treatment"
    )
    mode: str = Field(
        "simple", description="Treatment mode: 'simple' or 'advanced'"
    )
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    status: Optional[str] = Field("active", description="Status of the treatment")
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of the prescribing practitioner"
    )
    condition_id: Optional[int] = Field(
        None, gt=0, description="ID of the related condition"
    )

    @model_validator(mode="before")
    @classmethod
    def convert_empty_strings_to_none(cls, values):
        """Convert empty strings to None for optional fields."""
        if isinstance(values, dict):
            # Fields that should convert empty string to None
            optional_string_fields = [
                "treatment_type", "description", "frequency", "treatment_category",
                "outcome", "location", "dosage", "notes"
            ]
            for field in optional_string_fields:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @model_validator(mode="before")
    @classmethod
    def validate_start_date_with_status(cls, values):
        """Validate treatment start date based on status.

        When status is not provided (partial updates), skip validation to allow
        updating only the start_date field without requiring status.
        """
        from datetime import timedelta

        if not isinstance(values, dict):
            return values

        start_date_value = values.get("start_date")
        status = values.get("status", "").lower() if values.get("status") else ""

        if not start_date_value:
            return values

        # Convert string date to date object if needed
        if isinstance(start_date_value, str):
            try:
                start_date_value = date.fromisoformat(start_date_value)
            except ValueError:
                return values  # Let field validator handle invalid date

        # Skip validation if status is not provided (partial update scenario)
        if not status:
            return values

        # For planned or on_hold treatments, allow reasonable future dates
        if status in ["planned", "on_hold"]:
            max_future = date.today() + timedelta(days=3650)  # 10 years
            if start_date_value > max_future:
                raise ValueError("Start date cannot be more than 10 years in the future")
            # Allow past dates for planned treatments (e.g., rescheduled from past)
            return values

        # For all other statuses (not planned/on_hold), start date should not be in future
        if start_date_value > date.today():
            raise ValueError(f"Start date cannot be in the future for {status} treatments")
        return values

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v, info: ValidationInfo):
        if v and info.data.get("start_date") and v < info.data["start_date"]:
            raise ValueError("End date cannot be before start date")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is None:
            return "active"  # Default value
        valid_statuses = [s.value for s in TreatmentStatus]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v):
        valid_modes = ["simple", "advanced"]
        if v not in valid_modes:
            raise ValueError(f"Mode must be one of: {', '.join(valid_modes)}")
        return v


class TreatmentCreate(TreatmentBase):
    pass


class TreatmentUpdate(BaseModel):
    treatment_name: Optional[str] = Field(None, min_length=2, max_length=300)
    treatment_type: Optional[str] = Field(None, max_length=300)  # No min_length - optional field
    description: Optional[str] = Field(None, max_length=1000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    frequency: Optional[str] = Field(None, max_length=100)
    treatment_category: Optional[str] = Field(None, max_length=200)
    outcome: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    dosage: Optional[str] = Field(None, max_length=200)
    mode: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None
    practitioner_id: Optional[int] = Field(None, gt=0)
    condition_id: Optional[int] = Field(None, gt=0)
    tags: Optional[List[str]] = None

    @model_validator(mode="before")
    @classmethod
    def convert_empty_strings_to_none(cls, values):
        """Convert empty strings to None for optional fields."""
        if isinstance(values, dict):
            optional_string_fields = [
                "treatment_type", "description", "frequency", "treatment_category",
                "outcome", "location", "dosage", "notes"
            ]
            for field in optional_string_fields:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @model_validator(mode="before")
    @classmethod
    def validate_start_date_with_status(cls, values):
        """Validate treatment start date based on status.

        When status is not provided (partial updates), skip validation to allow
        updating only the start_date field without requiring status.
        """
        from datetime import timedelta

        if not isinstance(values, dict):
            return values

        start_date_value = values.get("start_date")
        status = values.get("status", "").lower() if values.get("status") else ""

        if not start_date_value:
            return values

        # Convert string date to date object if needed
        if isinstance(start_date_value, str):
            try:
                start_date_value = date.fromisoformat(start_date_value)
            except ValueError:
                return values  # Let field validator handle invalid date

        # Skip validation if status is not provided (partial update scenario)
        if not status:
            return values

        # For planned or on_hold treatments, allow reasonable future dates
        if status in ["planned", "on_hold"]:
            max_future = date.today() + timedelta(days=3650)  # 10 years
            if start_date_value > max_future:
                raise ValueError("Start date cannot be more than 10 years in the future")
            # Allow past dates for planned treatments (e.g., rescheduled from past)
            return values

        # For all other statuses (not planned/on_hold), start date should not be in future
        if start_date_value > date.today():
            raise ValueError(f"Start date cannot be in the future for {status} treatments")
        return values

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v, info: ValidationInfo):
        if (
            v
            and info.data.get("start_date")
            and v < info.data["start_date"]
        ):
            raise ValueError("End date cannot be before start date")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [s.value for s in TreatmentStatus]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v):
        if v is not None:
            valid_modes = ["simple", "advanced"]
            if v not in valid_modes:
                raise ValueError(f"Mode must be one of: {', '.join(valid_modes)}")
        return v


class TreatmentResponse(TreatmentBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class TreatmentWithRelations(TreatmentResponse):
    patient: Optional[dict] = None
    practitioner: Optional[dict] = None
    condition: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("patient", mode="before")
    @classmethod
    def validate_patient(cls, v):
        """Convert SQLAlchemy Patient object to dict"""
        if v is None:
            return None
        if hasattr(v, "__dict__"):
            return {
                "id": getattr(v, "id", None),
                "first_name": getattr(v, "first_name", None),
                "last_name": getattr(v, "last_name", None),
                "birth_date": getattr(v, "birth_date", None),
                "user_id": getattr(v, "user_id", None),
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

    @field_validator("condition", mode="before")
    @classmethod
    def validate_condition(cls, v):
        """Convert SQLAlchemy Condition object to dict"""
        if v is None:
            return None
        if hasattr(v, "__dict__"):
            return {
                "id": getattr(v, "id", None),
                "diagnosis": getattr(v, "diagnosis", None),
                "status": getattr(v, "status", None),
                "severity": getattr(v, "severity", None),
                "onset_date": getattr(v, "onset_date", None),
                "end_date": getattr(v, "end_date", None),
                "icd10_code": getattr(v, "icd10_code", None),
                "snomed_code": getattr(v, "snomed_code", None),
            }
        return v


class TreatmentSummary(BaseModel):
    id: int
    treatment_name: str
    treatment_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Treatment-Medication Relationship Schemas
# =============================================================================


class TreatmentMedicationBase(BaseModel):
    """Base schema for treatment medication relationship."""
    treatment_id: int
    medication_id: int
    specific_dosage: Optional[str] = Field(None, max_length=200)
    specific_frequency: Optional[str] = Field(None, max_length=100)
    specific_duration: Optional[str] = Field(None, max_length=100)
    timing_instructions: Optional[str] = Field(None, max_length=300)
    relevance_note: Optional[str] = None
    specific_prescriber_id: Optional[int] = None
    specific_pharmacy_id: Optional[int] = None
    specific_start_date: Optional[date] = None
    specific_end_date: Optional[date] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentMedicationCreate(BaseModel):
    """Schema for creating a treatment medication relationship."""
    medication_id: int
    specific_dosage: Optional[str] = Field(None, max_length=200)
    specific_frequency: Optional[str] = Field(None, max_length=100)
    specific_duration: Optional[str] = Field(None, max_length=100)
    timing_instructions: Optional[str] = Field(None, max_length=300)
    relevance_note: Optional[str] = None
    specific_prescriber_id: Optional[int] = Field(None, gt=0)
    specific_pharmacy_id: Optional[int] = Field(None, gt=0)
    specific_start_date: Optional[date] = None
    specific_end_date: Optional[date] = None
    treatment_id: Optional[int] = None  # Will be set from URL path parameter

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)

    @field_validator("specific_end_date")
    @classmethod
    def validate_specific_end_date(cls, v, info: ValidationInfo):
        if v and info.data.get("specific_start_date") and v < info.data["specific_start_date"]:
            raise ValueError("Specific end date cannot be before specific start date")
        return v


class TreatmentMedicationUpdate(BaseModel):
    """Schema for updating a treatment medication relationship."""
    specific_dosage: Optional[str] = Field(None, max_length=200)
    specific_frequency: Optional[str] = Field(None, max_length=100)
    specific_duration: Optional[str] = Field(None, max_length=100)
    timing_instructions: Optional[str] = Field(None, max_length=300)
    relevance_note: Optional[str] = None
    specific_prescriber_id: Optional[int] = Field(None, gt=0)
    specific_pharmacy_id: Optional[int] = Field(None, gt=0)
    specific_start_date: Optional[date] = None
    specific_end_date: Optional[date] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)

    @field_validator("specific_end_date")
    @classmethod
    def validate_specific_end_date(cls, v, info: ValidationInfo):
        if v and info.data.get("specific_start_date") and v < info.data["specific_start_date"]:
            raise ValueError("Specific end date cannot be before specific start date")
        return v


class TreatmentMedicationResponse(TreatmentMedicationBase):
    """Schema for treatment medication relationship response."""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentMedicationWithDetails(TreatmentMedicationResponse):
    """Schema for treatment medication relationship with medication details and effective values."""
    medication: Optional[dict] = None
    specific_prescriber: Optional[dict] = None
    specific_pharmacy: Optional[dict] = None
    effective_dosage: Optional[str] = None
    effective_frequency: Optional[str] = None
    effective_start_date: Optional[date] = None
    effective_end_date: Optional[date] = None
    effective_prescriber: Optional[dict] = None
    effective_pharmacy: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentMedicationBulkCreate(BaseModel):
    """Schema for bulk creating treatment medication relationships."""
    medication_ids: List[int] = Field(
        ..., min_length=1, description="List of medication IDs to link"
    )
    relevance_note: Optional[str] = Field(
        None, max_length=500, description="Optional note describing relevance"
    )

    @field_validator("medication_ids")
    @classmethod
    def validate_medication_ids(cls, v):
        if not v:
            raise ValueError("At least one medication ID is required")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate medication IDs are not allowed")
        for med_id in v:
            if med_id <= 0:
                raise ValueError("Medication IDs must be positive integers")
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


# =============================================================================
# Treatment-Encounter Relationship Schemas
# =============================================================================


class TreatmentEncounterBase(BaseModel):
    """Base schema for treatment encounter relationship."""
    treatment_id: int
    encounter_id: int
    visit_label: Optional[str] = Field(None, max_length=50)
    visit_sequence: Optional[int] = Field(None, ge=1)
    relevance_note: Optional[str] = None

    @field_validator("visit_label")
    @classmethod
    def validate_visit_label(cls, v):
        if v is not None:
            valid_labels = ["initial", "follow_up", "review", "final", "other"]
            if v.lower() not in valid_labels:
                raise ValueError(f"Visit label must be one of: {', '.join(valid_labels)}")
            return v.lower()
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentEncounterCreate(BaseModel):
    """Schema for creating a treatment encounter relationship."""
    encounter_id: int
    visit_label: Optional[str] = Field(None, max_length=50)
    visit_sequence: Optional[int] = Field(None, ge=1)
    relevance_note: Optional[str] = None
    treatment_id: Optional[int] = None  # Will be set from URL path parameter

    @field_validator("visit_label")
    @classmethod
    def validate_visit_label(cls, v):
        if v is not None:
            valid_labels = ["initial", "follow_up", "review", "final", "other"]
            if v.lower() not in valid_labels:
                raise ValueError(f"Visit label must be one of: {', '.join(valid_labels)}")
            return v.lower()
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentEncounterUpdate(BaseModel):
    """Schema for updating a treatment encounter relationship."""
    visit_label: Optional[str] = Field(None, max_length=50)
    visit_sequence: Optional[int] = Field(None, ge=1)
    relevance_note: Optional[str] = None

    @field_validator("visit_label")
    @classmethod
    def validate_visit_label(cls, v):
        if v is not None:
            valid_labels = ["initial", "follow_up", "review", "final", "other"]
            if v.lower() not in valid_labels:
                raise ValueError(f"Visit label must be one of: {', '.join(valid_labels)}")
            return v.lower()
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentEncounterResponse(TreatmentEncounterBase):
    """Schema for treatment encounter relationship response."""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentEncounterWithDetails(TreatmentEncounterResponse):
    """Schema for treatment encounter relationship with encounter details."""
    encounter: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentEncounterBulkCreate(BaseModel):
    """Schema for bulk creating treatment encounter relationships."""
    encounter_ids: List[int] = Field(
        ..., min_length=1, description="List of encounter IDs to link"
    )
    relevance_note: Optional[str] = Field(
        None, max_length=500, description="Optional note describing relevance"
    )

    @field_validator("encounter_ids")
    @classmethod
    def validate_encounter_ids(cls, v):
        if not v:
            raise ValueError("At least one encounter ID is required")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate encounter IDs are not allowed")
        for enc_id in v:
            if enc_id <= 0:
                raise ValueError("Encounter IDs must be positive integers")
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


# =============================================================================
# Treatment-LabResult Relationship Schemas
# =============================================================================


class TreatmentLabResultBase(BaseModel):
    """Base schema for treatment lab result relationship."""
    treatment_id: int
    lab_result_id: int
    purpose: Optional[str] = Field(None, max_length=50)
    expected_frequency: Optional[str] = Field(None, max_length=100)
    relevance_note: Optional[str] = None

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        if v is not None:
            valid_purposes = ["baseline", "monitoring", "outcome", "safety", "other"]
            if v.lower() not in valid_purposes:
                raise ValueError(f"Purpose must be one of: {', '.join(valid_purposes)}")
            return v.lower()
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentLabResultCreate(BaseModel):
    """Schema for creating a treatment lab result relationship."""
    lab_result_id: int
    purpose: Optional[str] = Field(None, max_length=50)
    expected_frequency: Optional[str] = Field(None, max_length=100)
    relevance_note: Optional[str] = None
    treatment_id: Optional[int] = None  # Will be set from URL path parameter

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        if v is not None:
            valid_purposes = ["baseline", "monitoring", "outcome", "safety", "other"]
            if v.lower() not in valid_purposes:
                raise ValueError(f"Purpose must be one of: {', '.join(valid_purposes)}")
            return v.lower()
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentLabResultUpdate(BaseModel):
    """Schema for updating a treatment lab result relationship."""
    purpose: Optional[str] = Field(None, max_length=50)
    expected_frequency: Optional[str] = Field(None, max_length=100)
    relevance_note: Optional[str] = None

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        if v is not None:
            valid_purposes = ["baseline", "monitoring", "outcome", "safety", "other"]
            if v.lower() not in valid_purposes:
                raise ValueError(f"Purpose must be one of: {', '.join(valid_purposes)}")
            return v.lower()
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentLabResultResponse(TreatmentLabResultBase):
    """Schema for treatment lab result relationship response."""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentLabResultWithDetails(TreatmentLabResultResponse):
    """Schema for treatment lab result relationship with lab result details."""
    lab_result: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentLabResultBulkCreate(BaseModel):
    """Schema for bulk creating treatment lab result relationships."""
    lab_result_ids: List[int] = Field(
        ..., min_length=1, description="List of lab result IDs to link"
    )
    purpose: Optional[str] = Field(
        None, max_length=50, description="Purpose of these lab results"
    )
    relevance_note: Optional[str] = Field(
        None, max_length=500, description="Optional note describing relevance"
    )

    @field_validator("lab_result_ids")
    @classmethod
    def validate_lab_result_ids(cls, v):
        if not v:
            raise ValueError("At least one lab result ID is required")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate lab result IDs are not allowed")
        for lab_id in v:
            if lab_id <= 0:
                raise ValueError("Lab result IDs must be positive integers")
        return v

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v):
        if v is not None:
            valid_purposes = ["baseline", "monitoring", "outcome", "safety", "other"]
            if v.lower() not in valid_purposes:
                raise ValueError(f"Purpose must be one of: {', '.join(valid_purposes)}")
            return v.lower()
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


# =============================================================================
# Treatment-Equipment Relationship Schemas
# =============================================================================


class TreatmentEquipmentBase(BaseModel):
    """Base schema for treatment equipment relationship."""
    treatment_id: int
    equipment_id: int
    usage_frequency: Optional[str] = Field(None, max_length=100)
    specific_settings: Optional[str] = Field(None, max_length=300)
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentEquipmentCreate(BaseModel):
    """Schema for creating a treatment equipment relationship."""
    equipment_id: int
    usage_frequency: Optional[str] = Field(None, max_length=100)
    specific_settings: Optional[str] = Field(None, max_length=300)
    relevance_note: Optional[str] = None
    treatment_id: Optional[int] = None  # Will be set from URL path parameter

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentEquipmentUpdate(BaseModel):
    """Schema for updating a treatment equipment relationship."""
    usage_frequency: Optional[str] = Field(None, max_length=100)
    specific_settings: Optional[str] = Field(None, max_length=300)
    relevance_note: Optional[str] = None

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


class TreatmentEquipmentResponse(TreatmentEquipmentBase):
    """Schema for treatment equipment relationship response."""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentEquipmentWithDetails(TreatmentEquipmentResponse):
    """Schema for treatment equipment relationship with equipment details."""
    equipment: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class TreatmentEquipmentBulkCreate(BaseModel):
    """Schema for bulk creating treatment equipment relationships."""
    equipment_ids: List[int] = Field(
        ..., min_length=1, description="List of equipment IDs to link"
    )
    relevance_note: Optional[str] = Field(
        None, max_length=500, description="Optional note describing relevance"
    )

    @field_validator("equipment_ids")
    @classmethod
    def validate_equipment_ids(cls, v):
        if not v:
            raise ValueError("At least one equipment ID is required")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate equipment IDs are not allowed")
        for eq_id in v:
            if eq_id <= 0:
                raise ValueError("Equipment IDs must be positive integers")
        return v

    @field_validator("relevance_note")
    @classmethod
    def validate_relevance_note(cls, v):
        return _validate_relevance_note(v)


# =============================================================================
# Medication-Treatment Response (for medication/{id}/treatments endpoint)
# =============================================================================


class MedicationTreatmentCondition(BaseModel):
    """Condition summary nested in treatment."""
    id: int
    condition_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MedicationTreatmentInfo(BaseModel):
    """Treatment summary nested in medication-treatment response."""
    id: int
    treatment_name: str
    treatment_type: Optional[str] = None
    status: Optional[str] = None
    mode: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    condition: Optional[MedicationTreatmentCondition] = None

    model_config = ConfigDict(from_attributes=True)


class MedicationTreatmentResponse(BaseModel):
    """Response schema for GET /medications/{id}/treatments."""
    id: int
    treatment_id: int
    medication_id: int
    specific_dosage: Optional[str] = None
    specific_frequency: Optional[str] = None
    specific_duration: Optional[str] = None
    timing_instructions: Optional[str] = None
    relevance_note: Optional[str] = None
    specific_prescriber_id: Optional[int] = None
    specific_pharmacy_id: Optional[int] = None
    specific_start_date: Optional[date] = None
    specific_end_date: Optional[date] = None
    treatment: Optional[MedicationTreatmentInfo] = None

    model_config = ConfigDict(from_attributes=True)
