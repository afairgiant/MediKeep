"""
Trend Chart Schemas

Pydantic models for trend chart requests used in custom report generation.
Supports vital sign and lab test trend charts with configurable time ranges.
"""

from enum import Enum
from typing import List

from pydantic import BaseModel, Field, field_validator, model_validator


# Vital types that can be charted (must match Vitals model columns)
SUPPORTED_VITAL_TYPES = [
    "blood_pressure", "heart_rate", "temperature",
    "weight", "oxygen_saturation", "respiratory_rate",
    "blood_glucose", "a1c", "bmi", "pain_scale",
]


class TrendChartTimeRange(str, Enum):
    """Time range options for trend charts"""
    ALL = "all"
    THREE_MONTHS = "3months"
    SIX_MONTHS = "6months"
    ONE_YEAR = "1year"
    TWO_YEARS = "2years"
    FIVE_YEARS = "5years"


class VitalChartRequest(BaseModel):
    """Request for a single vital sign trend chart"""
    vital_type: str = Field(..., description="Vital sign column name")
    time_range: TrendChartTimeRange = Field(
        default=TrendChartTimeRange.ONE_YEAR,
        description="Time range for the chart"
    )

    @field_validator("vital_type")
    @classmethod
    def validate_vital_type(cls, v):
        if v not in SUPPORTED_VITAL_TYPES:
            raise ValueError(
                f"Unsupported vital type: {v}. "
                f"Must be one of: {', '.join(SUPPORTED_VITAL_TYPES)}"
            )
        return v


class LabTestChartRequest(BaseModel):
    """Request for a single lab test trend chart"""
    test_name: str = Field(..., min_length=1, max_length=500, description="Lab test name")
    time_range: TrendChartTimeRange = Field(
        default=TrendChartTimeRange.ONE_YEAR,
        description="Time range for the chart"
    )


class TrendChartSelection(BaseModel):
    """Collection of trend charts to include in a report"""
    vital_charts: List[VitalChartRequest] = Field(
        default_factory=list,
        description="Vital sign charts to include"
    )
    lab_test_charts: List[LabTestChartRequest] = Field(
        default_factory=list,
        description="Lab test charts to include"
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

        # Check for duplicate lab test names (case-insensitive)
        lab_names = [lc.test_name.lower() for lc in self.lab_test_charts]
        if len(lab_names) != len(set(lab_names)):
            raise ValueError("Duplicate lab test names are not allowed")

        return self
