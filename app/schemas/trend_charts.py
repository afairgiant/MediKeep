"""
Trend Chart Schemas

Pydantic models for trend chart requests used in custom report generation.
Supports vital sign and lab test trend charts with configurable date ranges.
"""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator

# Vital types that can be charted (must match Vitals model columns)
SUPPORTED_VITAL_TYPES = [
    "blood_pressure",
    "heart_rate",
    "temperature",
    "weight",
    "oxygen_saturation",
    "respiratory_rate",
    "blood_glucose",
    "a1c",
    "bmi",
    "pain_scale",
]


class VitalChartRequest(BaseModel):
    """Request for a single vital sign trend chart"""

    vital_type: str = Field(..., description="Vital sign column name")
    date_from: Optional[date] = Field(default=None, description="Start date filter")
    date_to: Optional[date] = Field(default=None, description="End date filter")

    @field_validator("vital_type")
    @classmethod
    def validate_vital_type(cls, v):
        if v not in SUPPORTED_VITAL_TYPES:
            raise ValueError(
                f"Unsupported vital type: {v}. "
                f"Must be one of: {', '.join(SUPPORTED_VITAL_TYPES)}"
            )
        return v

    @field_validator("date_to")
    @classmethod
    def validate_date_to(cls, v, info: ValidationInfo):
        date_from = info.data.get("date_from")
        if date_from and v and v < date_from:
            raise ValueError("date_to must be on or after date_from")
        return v


class LabTestChartRequest(BaseModel):
    """Request for a single lab test trend chart"""

    test_name: str = Field(
        ..., min_length=1, max_length=500, description="Lab test name"
    )
    unit: Optional[str] = Field(
        default=None,
        max_length=50,
        description=(
            "Lab test unit (e.g. mg/dL). Scopes the trend to a single unit so "
            "values recorded in different units are not merged. Omit on legacy "
            "templates for backward-compatible merged behavior."
        ),
    )
    date_from: Optional[date] = Field(default=None, description="Start date filter")
    date_to: Optional[date] = Field(default=None, description="End date filter")

    @field_validator("date_to")
    @classmethod
    def validate_date_to(cls, v, info: ValidationInfo):
        date_from = info.data.get("date_from")
        if date_from and v and v < date_from:
            raise ValueError("date_to must be on or after date_from")
        return v


class TrendChartSelection(BaseModel):
    """Collection of trend charts to include in a report"""

    vital_charts: List[VitalChartRequest] = Field(
        default_factory=list, description="Vital sign charts to include"
    )
    lab_test_charts: List[LabTestChartRequest] = Field(
        default_factory=list, description="Lab test charts to include"
    )

    @model_validator(mode="after")
    def validate_chart_selection(self):
        total = len(self.vital_charts) + len(self.lab_test_charts)
        if total > 10:
            raise ValueError(f"Cannot include more than 10 charts (requested {total})")
        if total == 0:
            raise ValueError("At least one chart must be selected")

        # Check for duplicate vital types
        vital_types = [vc.vital_type for vc in self.vital_charts]
        if len(vital_types) != len(set(vital_types)):
            raise ValueError("Duplicate vital types are not allowed")

        # Check for duplicate lab test (test_name, unit) pairs — case-insensitive.
        # Same test_name with different units is allowed (and is the whole reason
        # unit is part of the key).
        lab_keys = [
            (lc.test_name.lower(), (lc.unit or "").strip().lower())
            for lc in self.lab_test_charts
        ]
        if len(lab_keys) != len(set(lab_keys)):
            raise ValueError("Duplicate lab test charts are not allowed")

        return self
