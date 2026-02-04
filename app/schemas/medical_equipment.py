"""Schemas for Medical Equipment."""
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, ValidationInfo

from app.schemas.base_tags import TaggedEntityMixin


# Valid equipment types
EQUIPMENT_TYPES = [
    "cpap",
    "bipap",
    "nebulizer",
    "inhaler",
    "blood_pressure_monitor",
    "glucose_monitor",
    "pulse_oximeter",
    "wheelchair",
    "walker",
    "cane",
    "crutches",
    "oxygen_concentrator",
    "oxygen_tank",
    "hearing_aid",
    "insulin_pump",
    "continuous_glucose_monitor",
    "tens_unit",
    "brace",
    "prosthetic",
    "other",
]

# Valid equipment statuses
EQUIPMENT_STATUSES = ["active", "inactive", "replaced", "returned", "lost"]


class MedicalEquipmentBase(TaggedEntityMixin):
    """Base schema for medical equipment."""
    equipment_name: str = Field(
        ..., min_length=2, max_length=200, description="Name of the equipment"
    )
    equipment_type: str = Field(
        ..., min_length=2, max_length=100, description="Type of equipment"
    )
    manufacturer: Optional[str] = Field(None, max_length=200)
    model_number: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    prescribed_date: Optional[date] = None
    last_service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    usage_instructions: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = Field("active", max_length=50)
    supplier: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of the prescribing practitioner"
    )

    @field_validator("equipment_type")
    @classmethod
    def validate_equipment_type(cls, v):
        if v is not None:
            v_lower = v.lower().replace(" ", "_").replace("-", "_")
            if v_lower not in EQUIPMENT_TYPES:
                # Allow custom types but normalize known ones
                return v.strip()
            return v_lower
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is None:
            return "active"
        if v.lower() not in EQUIPMENT_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(EQUIPMENT_STATUSES)}")
        return v.lower()

    @model_validator(mode="after")
    def validate_dates(self):
        """Validate that service dates are logical."""
        if self.last_service_date and self.next_service_date:
            if self.next_service_date < self.last_service_date:
                raise ValueError("Next service date cannot be before last service date")
        return self


class MedicalEquipmentCreate(MedicalEquipmentBase):
    """Schema for creating medical equipment."""
    pass


class MedicalEquipmentUpdate(BaseModel):
    """Schema for updating medical equipment."""
    equipment_name: Optional[str] = Field(None, min_length=2, max_length=200)
    equipment_type: Optional[str] = Field(None, min_length=2, max_length=100)
    manufacturer: Optional[str] = Field(None, max_length=200)
    model_number: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    prescribed_date: Optional[date] = None
    last_service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    usage_instructions: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = Field(None, max_length=50)
    supplier: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    practitioner_id: Optional[int] = Field(None, gt=0)
    tags: Optional[List[str]] = None

    @field_validator("equipment_type")
    @classmethod
    def validate_equipment_type(cls, v):
        if v is not None:
            v_lower = v.lower().replace(" ", "_").replace("-", "_")
            if v_lower not in EQUIPMENT_TYPES:
                return v.strip()
            return v_lower
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            if v.lower() not in EQUIPMENT_STATUSES:
                raise ValueError(f"Status must be one of: {', '.join(EQUIPMENT_STATUSES)}")
            return v.lower()
        return v


class MedicalEquipmentResponse(MedicalEquipmentBase):
    """Schema for medical equipment response."""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MedicalEquipmentWithRelations(MedicalEquipmentResponse):
    """Schema for medical equipment with related entities."""
    patient: Optional[dict] = None
    practitioner: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class MedicalEquipmentSummary(BaseModel):
    """Summary schema for medical equipment."""
    id: int
    equipment_name: str
    equipment_type: str
    status: str
    prescribed_date: Optional[date] = None
    next_service_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)
