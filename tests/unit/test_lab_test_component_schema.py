"""
Unit tests for LabTestComponent schema validation

Tests cover:
1. Full range (min and max) auto-status calculation
2. Upper bound only (e.g., "< 0.41") auto-status calculation
3. Lower bound only (e.g., "> 39") auto-status calculation
4. No range provided (status stays None)
5. Explicit status is not overridden
6. Qualitative test creation and validation
7. Qualitative auto-status calculation
8. Cross-field validation (quantitative vs qualitative)
9. Empty/whitespace qualitative value normalization (Create + Update schemas)
10. Response serialization with NULL values (regression #667)
11. Update schema cross-field validation (#667)
"""

import pytest
from pydantic import ValidationError

from app.schemas.lab_test_component import (
    LabTestComponentCreate,
    LabTestComponentResponse,
    LabTestComponentUpdate,
)


def make_component(**overrides):
    """Helper to create a LabTestComponentCreate with sensible defaults."""
    defaults = {
        "test_name": "Test",
        "value": 5.0,
        "unit": "mg/dL",
        "lab_result_id": 1,
    }
    defaults.update(overrides)
    return LabTestComponentCreate(**defaults)


def make_qualitative_component(**overrides):
    """Helper to create a qualitative LabTestComponentCreate."""
    defaults = {
        "test_name": "HIV 1 Antibody",
        "lab_result_id": 1,
        "result_type": "qualitative",
        "qualitative_value": "negative",
        "value": None,
        "unit": None,
    }
    defaults.update(overrides)
    return LabTestComponentCreate(**defaults)


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
            LabTestComponentCreate(
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


class TestQualitativeValueNormalization:
    """Tests for empty/whitespace qualitative value handling (issue #598)."""

    def test_empty_string_normalized_to_none_in_create(self):
        """Empty string qualitative_value should become None (not trigger validation error)."""
        comp = make_component(qualitative_value="")
        assert comp.qualitative_value is None

    def test_whitespace_only_normalized_to_none_in_create(self):
        comp = make_component(qualitative_value="   ")
        assert comp.qualitative_value is None

    def test_whitespace_tabs_normalized_to_none_in_create(self):
        comp = make_component(qualitative_value="\n\t")
        assert comp.qualitative_value is None

    def test_padded_valid_value_accepted_in_create(self):
        """Whitespace-padded valid values should be stripped and accepted."""
        comp = make_qualitative_component(qualitative_value=" Positive ")
        assert comp.qualitative_value == "positive"

    def test_empty_string_normalized_to_none_in_update(self):
        """Empty string qualitative_value normalizes to None. Include result_type
        to avoid triggering the cross-field 'clearing without result_type' guard."""
        update = LabTestComponentUpdate(qualitative_value="", result_type="quantitative", value=1.0, unit="x")
        assert update.qualitative_value is None

    def test_whitespace_only_normalized_to_none_in_update(self):
        update = LabTestComponentUpdate(qualitative_value="   ", result_type="quantitative", value=1.0, unit="x")
        assert update.qualitative_value is None

    def test_padded_valid_value_accepted_in_update(self):
        update = LabTestComponentUpdate(qualitative_value=" negative ")
        assert update.qualitative_value == "negative"

    def test_quantitative_edit_with_empty_qualitative_in_update(self):
        """The exact scenario from issue #598: editing a quantitative test sends empty qualitative_value."""
        update = LabTestComponentUpdate(
            value=150.0,
            unit="ng/mL",
            result_type="quantitative",
            qualitative_value="",
        )
        assert update.qualitative_value is None
        assert update.value == 150.0


class TestResponseSerializationRegression:
    """Regression tests for #667: Response must not crash on NULL values from DB."""

    def test_quantitative_with_null_value(self):
        """A quantitative component with value=NULL should serialize without error."""
        resp = LabTestComponentResponse(
            id=1,
            test_name="Glucose",
            lab_result_id=1,
            result_type="quantitative",
            value=None,
            unit="mg/dL",
        )
        assert resp.value is None
        assert resp.result_type == "quantitative"

    def test_quantitative_with_null_unit(self):
        """A quantitative component with unit=NULL should serialize without error."""
        resp = LabTestComponentResponse(
            id=2,
            test_name="Glucose",
            lab_result_id=1,
            result_type="quantitative",
            value=100.0,
            unit=None,
        )
        assert resp.unit is None

    def test_quantitative_with_null_value_and_unit(self):
        """Both value and unit NULL should serialize without error."""
        resp = LabTestComponentResponse(
            id=3,
            test_name="Glucose",
            lab_result_id=1,
            result_type="quantitative",
            value=None,
            unit=None,
        )
        assert resp.value is None
        assert resp.unit is None

    def test_qualitative_with_null_qualitative_value(self):
        """A qualitative component with qualitative_value=NULL should serialize."""
        resp = LabTestComponentResponse(
            id=4,
            test_name="HIV",
            lab_result_id=1,
            result_type="qualitative",
            qualitative_value=None,
            value=None,
            unit=None,
        )
        assert resp.qualitative_value is None

    def test_response_does_not_auto_calculate_status(self):
        """Response schema should not auto-calculate status."""
        resp = LabTestComponentResponse(
            id=5,
            test_name="Glucose",
            lab_result_id=1,
            result_type="quantitative",
            value=100.0,
            unit="mg/dL",
            ref_range_min=70.0,
            ref_range_max=99.0,
            status=None,
        )
        assert resp.status is None

    def test_response_does_not_reject_inverted_ref_range(self):
        """Response schema should not reject stored data with inverted ranges."""
        resp = LabTestComponentResponse(
            id=6,
            test_name="Glucose",
            lab_result_id=1,
            result_type="quantitative",
            value=100.0,
            unit="mg/dL",
            ref_range_min=200.0,
            ref_range_max=100.0,
        )
        assert resp.ref_range_min == 200.0
        assert resp.ref_range_max == 100.0


class TestUpdateCrossFieldValidation:
    """Tests for LabTestComponentUpdate cross-field validation (#667)."""

    def test_clearing_value_on_quantitative_rejected(self):
        with pytest.raises(ValidationError, match="Value cannot be cleared"):
            LabTestComponentUpdate(
                result_type="quantitative",
                value=None,
                unit="mg/dL",
            )

    def test_clearing_unit_on_quantitative_rejected(self):
        with pytest.raises(ValidationError, match="Unit cannot be cleared"):
            LabTestComponentUpdate(
                result_type="quantitative",
                value=5.0,
                unit="",
            )

    def test_clearing_qualitative_value_on_qualitative_rejected(self):
        with pytest.raises(ValidationError, match="Qualitative value cannot be cleared"):
            LabTestComponentUpdate(
                result_type="qualitative",
                qualitative_value="",
            )

    def test_updating_value_on_quantitative_accepted(self):
        update = LabTestComponentUpdate(
            result_type="quantitative",
            value=42.0,
            unit="mg/dL",
        )
        assert update.value == 42.0

    def test_unrelated_fields_skip_validation(self):
        """Updating non-result-type fields should not trigger cross-field validation."""
        update = LabTestComponentUpdate(notes="Updated notes")
        assert update.notes == "Updated notes"

    def test_updating_only_unit_accepted(self):
        """Updating just unit without result_type should pass (not clearing)."""
        update = LabTestComponentUpdate(unit="mmol/L")
        assert update.unit == "mmol/L"

    def test_clearing_value_without_result_type_rejected(self):
        """Clearing value without specifying result_type is ambiguous."""
        with pytest.raises(ValidationError, match="result_type must be provided"):
            LabTestComponentUpdate(value=None)

    def test_clearing_unit_without_result_type_rejected(self):
        """Clearing unit without specifying result_type is ambiguous."""
        with pytest.raises(ValidationError, match="result_type must be provided"):
            LabTestComponentUpdate(unit="")

    def test_switching_to_quantitative_requires_value_and_unit(self):
        """Changing result_type to quantitative must include value and unit."""
        with pytest.raises(ValidationError, match="value and unit must be provided"):
            LabTestComponentUpdate(result_type="quantitative", value=42.0)

    def test_switching_to_qualitative_requires_qualitative_value(self):
        """Changing result_type to qualitative must include qualitative_value."""
        with pytest.raises(ValidationError, match="qualitative_value must be provided"):
            LabTestComponentUpdate(result_type="qualitative")

    def test_switching_to_quantitative_with_all_fields_accepted(self):
        update = LabTestComponentUpdate(
            result_type="quantitative",
            value=5.0,
            unit="mg/dL",
        )
        assert update.result_type == "quantitative"
        assert update.value == 5.0

    def test_switching_to_qualitative_with_qualitative_value_accepted(self):
        update = LabTestComponentUpdate(
            result_type="qualitative",
            qualitative_value="positive",
        )
        assert update.result_type == "qualitative"
        assert update.qualitative_value == "positive"

    def test_updating_value_without_result_type_accepted(self):
        """Updating value (not clearing) without result_type is fine."""
        update = LabTestComponentUpdate(value=42.0)
        assert update.value == 42.0
