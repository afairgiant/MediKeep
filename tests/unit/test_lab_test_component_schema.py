"""
Unit tests for LabTestComponentBase.auto_calculate_status

Tests cover:
1. Full range (min and max) auto-status calculation
2. Upper bound only (e.g., "< 0.41") auto-status calculation
3. Lower bound only (e.g., "> 39") auto-status calculation
4. No range provided (status stays None)
5. Explicit status is not overridden
"""

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
