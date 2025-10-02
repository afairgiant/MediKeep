from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator, model_validator

from app.core.constants import (
    LAB_TEST_COMPONENT_LIMITS,
    LAB_TEST_COMPONENT_STATUSES,
    LAB_TEST_COMPONENT_CATEGORIES
)


class LabTestComponentBase(BaseModel):
    """Base schema for LabTestComponent - individual test results within lab result"""

    test_name: str
    abbreviation: Optional[str] = None
    test_code: Optional[str] = None
    value: float
    unit: str
    ref_range_min: Optional[float] = None
    ref_range_max: Optional[float] = None
    ref_range_text: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    display_order: Optional[int] = None
    notes: Optional[str] = None
    lab_result_id: int

    @field_validator("test_name")
    @classmethod
    def validate_test_name(cls, v):
        """Validate test name"""
        if not v or len(v.strip()) < 1:
            raise ValueError("Test name is required")
        if len(v) > LAB_TEST_COMPONENT_LIMITS["MAX_TEST_NAME_LENGTH"]:
            raise ValueError(f"Test name must be less than {LAB_TEST_COMPONENT_LIMITS['MAX_TEST_NAME_LENGTH']} characters")
        return v.strip()

    @field_validator("abbreviation")
    @classmethod
    def validate_abbreviation(cls, v):
        """Validate test abbreviation"""
        if v and len(v.strip()) > LAB_TEST_COMPONENT_LIMITS["MAX_ABBREVIATION_LENGTH"]:
            raise ValueError(f"Abbreviation must be less than {LAB_TEST_COMPONENT_LIMITS['MAX_ABBREVIATION_LENGTH']} characters")
        return v.strip().upper() if v else None

    @field_validator("test_code")
    @classmethod
    def validate_test_code(cls, v):
        """Validate test code (LOINC, CPT, etc.)"""
        if v and len(v.strip()) > LAB_TEST_COMPONENT_LIMITS["MAX_TEST_CODE_LENGTH"]:
            raise ValueError(f"Test code must be less than {LAB_TEST_COMPONENT_LIMITS['MAX_TEST_CODE_LENGTH']} characters")
        return v.strip().upper() if v else None

    @field_validator("value")
    @classmethod
    def validate_value(cls, v):
        """Validate test value"""
        if v is None:
            raise ValueError("Test value is required")
        if not isinstance(v, (int, float)):
            raise ValueError("Test value must be a number")

        # Import math for boundary checks
        import math

        # Check for invalid numbers (NaN, Infinity)
        if math.isnan(v) or math.isinf(v):
            raise ValueError("Test value must be a finite number")

        # Reasonable boundary check (prevents display/calculation issues)
        if abs(v) > 1e15:
            raise ValueError("Test value is out of reasonable range")

        return float(v)

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v):
        """Validate test unit"""
        if not v or len(v.strip()) < 1:
            raise ValueError("Unit is required")
        if len(v) > LAB_TEST_COMPONENT_LIMITS["MAX_UNIT_LENGTH"]:
            raise ValueError(f"Unit must be less than {LAB_TEST_COMPONENT_LIMITS['MAX_UNIT_LENGTH']} characters")
        return v.strip()

    @field_validator("ref_range_min")
    @classmethod
    def validate_ref_range_min(cls, v):
        """Validate reference range minimum"""
        if v is not None:
            if not isinstance(v, (int, float)):
                raise ValueError("Reference range minimum must be a number")

            import math
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Reference range minimum must be a finite number")
            if abs(v) > 1e15:
                raise ValueError("Reference range minimum is out of reasonable range")

        return float(v) if v is not None else None

    @field_validator("ref_range_max")
    @classmethod
    def validate_ref_range_max(cls, v):
        """Validate reference range maximum"""
        if v is not None:
            if not isinstance(v, (int, float)):
                raise ValueError("Reference range maximum must be a number")

            import math
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Reference range maximum must be a finite number")
            if abs(v) > 1e15:
                raise ValueError("Reference range maximum is out of reasonable range")
        return float(v) if v is not None else None

    @field_validator("ref_range_text")
    @classmethod
    def validate_ref_range_text(cls, v):
        """Validate reference range text"""
        if v and len(v.strip()) > LAB_TEST_COMPONENT_LIMITS["MAX_REF_RANGE_TEXT_LENGTH"]:
            raise ValueError(f"Reference range text must be less than {LAB_TEST_COMPONENT_LIMITS['MAX_REF_RANGE_TEXT_LENGTH']} characters")
        return v.strip() if v else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """Validate test status"""
        if v and v.lower() not in LAB_TEST_COMPONENT_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(LAB_TEST_COMPONENT_STATUSES)}")
        return v.lower() if v else None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        """Validate test category"""
        if v and v.lower() not in LAB_TEST_COMPONENT_CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(LAB_TEST_COMPONENT_CATEGORIES)}")
        return v.lower() if v else None

    @field_validator("display_order")
    @classmethod
    def validate_display_order(cls, v):
        """Validate display order"""
        if v is not None and (not isinstance(v, int) or v < 0):
            raise ValueError("Display order must be a positive integer")
        return v

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        """Validate notes"""
        if v and len(v.strip()) > LAB_TEST_COMPONENT_LIMITS["MAX_NOTES_LENGTH"]:
            raise ValueError(f"Notes must be less than {LAB_TEST_COMPONENT_LIMITS['MAX_NOTES_LENGTH']} characters")
        return v.strip() if v else None

    @field_validator("lab_result_id")
    @classmethod
    def validate_lab_result_id(cls, v):
        """Validate lab result ID"""
        if v <= 0:
            raise ValueError("Lab result ID must be a positive integer")
        return v

    @model_validator(mode="after")
    def validate_ref_range(self):
        """Validate that ref_range_max is greater than ref_range_min"""
        if self.ref_range_min is not None and self.ref_range_max is not None:
            if self.ref_range_max <= self.ref_range_min:
                raise ValueError("Reference range maximum must be greater than minimum")
        return self

    @model_validator(mode="after")
    def auto_calculate_status(self):
        """Auto-calculate status based on value and reference ranges"""
        if self.status is None and self.ref_range_min is not None and self.ref_range_max is not None:
            if self.value < self.ref_range_min:
                self.status = "low"
            elif self.value > self.ref_range_max:
                self.status = "high"
            else:
                self.status = "normal"
        return self


class LabTestComponentCreate(LabTestComponentBase):
    """Schema for creating a new lab test component"""

    lab_result_id: int

    @field_validator("lab_result_id")
    @classmethod
    def validate_lab_result_id(cls, v):
        """Validate lab result ID"""
        if v <= 0:
            raise ValueError("Lab result ID must be a positive integer")
        return v


class LabTestComponentUpdate(BaseModel):
    """Schema for updating an existing lab test component"""

    test_name: Optional[str] = None
    abbreviation: Optional[str] = None
    test_code: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    ref_range_min: Optional[float] = None
    ref_range_max: Optional[float] = None
    ref_range_text: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    display_order: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("test_name")
    @classmethod
    def validate_test_name(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 1:
                raise ValueError("Test name is required")
            if len(v) > LAB_TEST_COMPONENT_LIMITS["MAX_TEST_NAME_LENGTH"]:
                raise ValueError(f"Test name must be less than {LAB_TEST_COMPONENT_LIMITS['MAX_TEST_NAME_LENGTH']} characters")
            return v.strip()
        return v

    @field_validator("value")
    @classmethod
    def validate_value(cls, v):
        if v is not None:
            if not isinstance(v, (int, float)):
                raise ValueError("Test value must be a number")
            return float(v)
        return v

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 1:
                raise ValueError("Unit is required")
            if len(v) > LAB_TEST_COMPONENT_LIMITS["MAX_UNIT_LENGTH"]:
                raise ValueError(f"Unit must be less than {LAB_TEST_COMPONENT_LIMITS['MAX_UNIT_LENGTH']} characters")
            return v.strip()
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ["normal", "abnormal", "critical", "high", "low", "borderline"]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
            return v.lower()
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v is not None:
            valid_categories = [
                "chemistry",
                "hematology",
                "immunology",
                "microbiology",
                "endocrinology",
                "toxicology",
                "genetics",
                "molecular",
                "pathology",
                "other",
            ]
            if v.lower() not in valid_categories:
                raise ValueError(f"Category must be one of: {', '.join(valid_categories)}")
            return v.lower()
        return v

    @model_validator(mode="after")
    def validate_ref_range(self):
        """Validate that ref_range_max is greater than ref_range_min"""
        if self.ref_range_min is not None and self.ref_range_max is not None:
            if self.ref_range_max <= self.ref_range_min:
                raise ValueError("Reference range maximum must be greater than minimum")
        return self


class LabTestComponentResponse(LabTestComponentBase):
    """Schema for lab test component response"""

    id: int
    lab_result_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LabTestComponentWithLabResult(LabTestComponentResponse):
    """Schema for lab test component with related lab result data"""

    lab_result: Optional[dict] = None  # Will contain lab result details

    model_config = {"from_attributes": True}


# Bulk operations schemas

class LabTestComponentBulkCreate(BaseModel):
    """Schema for creating multiple lab test components at once"""

    lab_result_id: int
    components: List[LabTestComponentCreate]

    @field_validator("components")
    @classmethod
    def validate_components(cls, v):
        """Validate components list"""
        if not v or len(v) == 0:
            raise ValueError("At least one component is required")
        if len(v) > LAB_TEST_COMPONENT_LIMITS["MAX_BULK_COMPONENTS"]:
            raise ValueError(f"Maximum {LAB_TEST_COMPONENT_LIMITS['MAX_BULK_COMPONENTS']} components per bulk operation")
        return v

    @field_validator("lab_result_id")
    @classmethod
    def validate_lab_result_id(cls, v):
        """Validate lab result ID"""
        if v <= 0:
            raise ValueError("Lab result ID must be a positive integer")
        return v


class LabTestComponentBulkResponse(BaseModel):
    """Schema for bulk operation response"""

    created_count: int
    components: List[LabTestComponentResponse]
    errors: Optional[List[str]] = []

    model_config = {"from_attributes": True}