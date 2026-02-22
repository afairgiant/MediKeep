"""
Unit tests for LabTestComponentBase schema validation

Tests cover:
1. Full range (min and max) auto-status calculation
2. Upper bound only (e.g., "< 0.41") auto-status calculation
3. Lower bound only (e.g., "> 39") auto-status calculation
4. No range provided (status stays None)
5. Explicit status is not overridden
6. Qualitative test creation and validation
7. Qualitative auto-status calculation
8. Cross-field validation (quantitative vs qualitative)
"""

import pytest
from pydantic import ValidationError

from app.schemas.lab_test_component import LabTestComponentBase


def make_component(**overrides):
    """Helper to create a LabTestComponentBase with sensible defaults."""
    defaults = {
        "test_name": "Test",
        "value": 5.0,
        "unit": "mg/dL",
        "lab_result_id": 1,
    }
    defaults.update(overrides)
    return LabTestComponentBase(**defaults)


def make_qualitative_component(**overrides):
    """Helper to create a qualitative LabTestComponentBase."""
    defaults = {
        "test_name": "HIV 1 Antibody",
        "lab_result_id": 1,
        "result_type": "qualitative",
        "qualitative_value": "negative",
        "value": None,
        "unit": None,
    }
    defaults.update(overrides)
    return LabTestComponentBase(**defaults)


class TestAutoCalculateStatusFullRange:
    """Tests for auto-status with both ref_range_min and ref_range_max."""

    def test_normal_within_range(self):
        comp = make_component(value=5.0, ref_range_min=3.0, ref_range_max=10.0)
        assert comp.status == "normal"

    def test_high_above_max(self):
        comp = make_component(value=12.0, ref_range_min=3.0, ref_range_max=10.0)
        assert comp.status == "high"

    def test_low_below_min(self):
        comp = make_component(value=1.0, ref_range_min=3.0, ref_range_max=10.0)
        assert comp.status == "low"

    def test_normal_at_min_boundary(self):
        comp = make_component(value=3.0, ref_range_min=3.0, ref_range_max=10.0)
        assert comp.status == "normal"

    def test_normal_at_max_boundary(self):
        comp = make_component(value=10.0, ref_range_min=3.0, ref_range_max=10.0)
        assert comp.status == "normal"


class TestAutoCalculateStatusUpperBoundOnly:
    """Tests for auto-status with only ref_range_max (e.g., '< 0.41')."""

    def test_normal_below_max(self):
        comp = make_component(value=0.19, ref_range_max=0.41)
        assert comp.status == "normal"

    def test_high_above_max(self):
        comp = make_component(value=0.50, ref_range_max=0.41)
        assert comp.status == "high"

    def test_normal_at_max_boundary(self):
        comp = make_component(value=0.41, ref_range_max=0.41)
        assert comp.status == "normal"


class TestAutoCalculateStatusLowerBoundOnly:
    """Tests for auto-status with only ref_range_min (e.g., '> 39')."""

    def test_normal_above_min(self):
        comp = make_component(value=50.0, ref_range_min=39.0)
        assert comp.status == "normal"

    def test_low_below_min(self):
        comp = make_component(value=30.0, ref_range_min=39.0)
        assert comp.status == "low"

    def test_normal_at_min_boundary(self):
        comp = make_component(value=39.0, ref_range_min=39.0)
        assert comp.status == "normal"


class TestAutoCalculateStatusNoRange:
    """Tests for auto-status with no reference range data."""

    def test_status_remains_none(self):
        comp = make_component(value=5.0)
        assert comp.status is None


class TestExplicitStatusNotOverridden:
    """Tests that explicit status is preserved."""

    def test_explicit_status_with_full_range(self):
        comp = make_component(
            value=5.0,
            ref_range_min=3.0,
            ref_range_max=10.0,
            status="abnormal",
        )
        assert comp.status == "abnormal"

    def test_explicit_status_with_upper_bound(self):
        comp = make_component(
            value=0.19,
            ref_range_max=0.41,
            status="critical",
        )
        assert comp.status == "critical"

    def test_explicit_status_with_lower_bound(self):
        comp = make_component(
            value=50.0,
            ref_range_min=39.0,
            status="borderline",
        )
        assert comp.status == "borderline"


class TestQualitativeCreation:
    """Tests for creating qualitative test components."""

    def test_qualitative_negative(self):
        comp = make_qualitative_component(qualitative_value="negative")
        assert comp.result_type == "qualitative"
        assert comp.qualitative_value == "negative"
        assert comp.value is None
        assert comp.unit is None

    def test_qualitative_positive(self):
        comp = make_qualitative_component(qualitative_value="positive")
        assert comp.qualitative_value == "positive"

    def test_qualitative_detected(self):
        comp = make_qualitative_component(qualitative_value="detected")
        assert comp.qualitative_value == "detected"

    def test_qualitative_undetected(self):
        comp = make_qualitative_component(qualitative_value="undetected")
        assert comp.qualitative_value == "undetected"

    def test_qualitative_value_normalized_to_lowercase(self):
        comp = make_qualitative_component(qualitative_value="Positive")
        assert comp.qualitative_value == "positive"

    def test_qualitative_allows_ref_range_text(self):
        """ref_range_text is intentionally allowed for qualitative tests."""
        comp = make_qualitative_component(ref_range_text="Expected: Negative")
        assert comp.ref_range_text == "Expected: Negative"

    def test_invalid_qualitative_value_rejected(self):
        with pytest.raises(ValidationError, match="Qualitative value must be one of"):
            make_qualitative_component(qualitative_value="maybe")

    def test_invalid_result_type_rejected(self):
        with pytest.raises(ValidationError, match="Result type must be one of"):
            make_component(result_type="semi-quantitative")


class TestQualitativeAutoStatus:
    """Tests for auto-status calculation on qualitative tests."""

    def test_positive_auto_status_abnormal(self):
        comp = make_qualitative_component(qualitative_value="positive")
        assert comp.status == "abnormal"

    def test_negative_auto_status_normal(self):
        comp = make_qualitative_component(qualitative_value="negative")
        assert comp.status == "normal"

    def test_detected_auto_status_abnormal(self):
        comp = make_qualitative_component(qualitative_value="detected")
        assert comp.status == "abnormal"

    def test_undetected_auto_status_normal(self):
        comp = make_qualitative_component(qualitative_value="undetected")
        assert comp.status == "normal"

    def test_explicit_status_not_overridden(self):
        comp = make_qualitative_component(
            qualitative_value="positive",
            status="normal",
        )
        assert comp.status == "normal"


class TestCrossFieldValidation:
    """Tests for cross-field validation between quantitative and qualitative."""

    def test_quantitative_requires_value(self):
        with pytest.raises(ValidationError, match="Value is required for quantitative"):
            make_component(value=None, unit="mg/dL")

    def test_quantitative_requires_unit(self):
        with pytest.raises(ValidationError, match="Unit is required for quantitative"):
            make_component(value=5.0, unit=None)

    def test_qualitative_rejects_numeric_value(self):
        with pytest.raises(ValidationError, match="Numeric value must be empty"):
            make_qualitative_component(value=5.0)

    def test_qualitative_requires_qualitative_value(self):
        with pytest.raises(ValidationError, match="Qualitative value is required"):
            LabTestComponentBase(
                test_name="HIV",
                lab_result_id=1,
                result_type="qualitative",
                qualitative_value=None,
                value=None,
                unit=None,
            )

    def test_qualitative_rejects_ref_range_min(self):
        with pytest.raises(ValidationError, match="Reference ranges are not applicable"):
            make_qualitative_component(ref_range_min=0.0)

    def test_qualitative_rejects_ref_range_max(self):
        with pytest.raises(ValidationError, match="Reference ranges are not applicable"):
            make_qualitative_component(ref_range_max=1.0)

    def test_default_result_type_is_quantitative(self):
        comp = make_component()
        assert comp.result_type == "quantitative"

    def test_none_result_type_defaults_to_quantitative(self):
        comp = make_component(result_type=None)
        assert comp.result_type == "quantitative"
