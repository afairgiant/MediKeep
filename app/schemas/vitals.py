from datetime import datetime
from typing import Optional

from pydantic import BaseModel, validator


class VitalsBase(BaseModel):
    """Base schema for Vitals"""

    recorded_date: datetime
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    respiratory_rate: Optional[int] = None
    blood_glucose: Optional[float] = None
    a1c: Optional[float] = None
    bmi: Optional[float] = None
    pain_scale: Optional[int] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    device_used: Optional[str] = None
    patient_id: int
    practitioner_id: Optional[int] = None

    @validator("systolic_bp")
    def validate_systolic_bp(cls, v):
        """Validate systolic blood pressure"""
        if v is not None:
            if v < 60 or v > 250:
                raise ValueError("Systolic blood pressure must be between 60-250 mmHg")
        return v

    @validator("diastolic_bp")
    def validate_diastolic_bp(cls, v):
        """Validate diastolic blood pressure"""
        if v is not None:
            if v < 30 or v > 150:
                raise ValueError("Diastolic blood pressure must be between 30-150 mmHg")
        return v

    @validator("heart_rate")
    def validate_heart_rate(cls, v):
        """Validate heart rate"""
        if v is not None:
            if v < 30 or v > 250:
                raise ValueError("Heart rate must be between 30-250 bpm")
        return v

    @validator("temperature")
    def validate_temperature(cls, v):
        """Validate temperature (stored as Fahrenheit, converted from user's preferred units)"""
        if v is not None:
            if v < 80.0 or v > 115.0:
                raise ValueError("Temperature must be between 80-115°F")
        return v

    @validator("weight")
    def validate_weight(cls, v):
        """Validate weight (stored as pounds, converted from user's preferred units)"""
        if v is not None:
            # Allow up to 2 decimal places for precision from metric conversion
            if v < 1.0 or v > 992.0:
                raise ValueError("Weight must be between 1-992 lbs")
        return v

    @validator("height")
    def validate_height(cls, v):
        """Validate height (stored as inches, converted from user's preferred units)"""
        if v is not None:
            # Allow up to 2 decimal places for precision from metric conversion
            if v < 12.0 or v > 108.0:
                raise ValueError("Height must be between 12-108 inches")
        return v

    @validator("oxygen_saturation")
    def validate_oxygen_saturation(cls, v):
        """Validate oxygen saturation percentage"""
        if v is not None:
            if v < 70.0 or v > 100.0:
                raise ValueError("Oxygen saturation must be between 70-100%")
        return v

    @validator("respiratory_rate")
    def validate_respiratory_rate(cls, v):
        """Validate respiratory rate"""
        if v is not None:
            if v < 8 or v > 50:
                raise ValueError("Respiratory rate must be between 8-50 breaths/min")
        return v

    @validator("blood_glucose")
    def validate_blood_glucose(cls, v):
        """Validate blood glucose (mg/dL)"""
        if v is not None:
            if v < 20.0 or v > 800.0:
                raise ValueError("Blood glucose must be between 20-800 mg/dL")
        return v

    @validator("a1c")
    def validate_a1c(cls, v):
        """Validate hemoglobin A1C (%)"""
        if v is not None:
            if v < 0.0 or v > 20.0:
                raise ValueError("A1C must be between 0-20%")
        return v

    @validator("bmi")
    def validate_bmi(cls, v):
        """Validate BMI"""
        if v is not None:
            if v < 10.0 or v > 100.0:
                raise ValueError("BMI must be between 10-100")
        return v

    @validator("pain_scale")
    def validate_pain_scale(cls, v):
        """Validate pain scale (0-10)"""
        if v is not None:
            if v < 0 or v > 10:
                raise ValueError("Pain scale must be between 0-10")
        return v

    @validator("notes")
    def validate_notes(cls, v):
        """Validate notes"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Notes must be less than 1000 characters")
        return v.strip() if v else None

    @validator("location")
    def validate_location(cls, v):
        """Validate location"""
        if v and len(v.strip()) > 100:
            raise ValueError("Location must be less than 100 characters")
        return v.strip() if v else None

    @validator("device_used")
    def validate_device_used(cls, v):
        """Validate device used"""
        if v and len(v.strip()) > 100:
            raise ValueError("Device used must be less than 100 characters")
        return v.strip() if v else None


class VitalsCreate(VitalsBase):
    """Schema for creating new vitals"""

    pass


class VitalsUpdate(BaseModel):
    """Schema for updating existing vitals"""

    recorded_date: Optional[datetime] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    respiratory_rate: Optional[int] = None
    blood_glucose: Optional[float] = None
    a1c: Optional[float] = None
    bmi: Optional[float] = None
    pain_scale: Optional[int] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    device_used: Optional[str] = None
    practitioner_id: Optional[int] = None


class VitalsResponse(VitalsBase):
    """Schema for vitals response"""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VitalsWithRelations(VitalsResponse):
    """Schema for vitals with related data"""

    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True


class VitalsSummary(BaseModel):
    """Schema for vitals summary/dashboard display"""

    id: int
    recorded_date: datetime
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    patient_name: Optional[str] = None

    class Config:
        from_attributes = True


class VitalsStats(BaseModel):
    """Schema for vitals statistics"""

    total_readings: int
    latest_reading_date: Optional[datetime] = None
    avg_systolic_bp: Optional[float] = None
    avg_diastolic_bp: Optional[float] = None
    avg_heart_rate: Optional[float] = None
    avg_temperature: Optional[float] = None
    current_temperature: Optional[float] = None
    current_weight: Optional[float] = None
    current_bmi: Optional[float] = None
    weight_change: Optional[float] = None  # Change from first to latest reading
    current_blood_glucose: Optional[float] = None
    current_a1c: Optional[float] = None

    class Config:
        from_attributes = True
