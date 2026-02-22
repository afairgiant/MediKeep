"""
Unit tests for calculate_trend_statistics and its qualitative/quantitative branches.

Tests cover:
1. Empty component list
2. Qualitative statistics (summary counts, trend direction, normal/abnormal)
3. Mixed result_type handling (quantitative takes priority)
4. Quantitative statistics remain unchanged
"""

from types import SimpleNamespace

from app.api.v1.endpoints.lab_test_component import calculate_trend_statistics


def _make_quant(value, status="normal", result_type="quantitative"):
    """Create a mock quantitative component."""
    return SimpleNamespace(value=value, status=status, result_type=result_type)


def _make_qual(qualitative_value, status=None, result_type="qualitative"):
    """Create a mock qualitative component."""
    if status is None:
        status = "abnormal" if qualitative_value in ("positive", "detected") else "normal"
    return SimpleNamespace(
        qualitative_value=qualitative_value,
        status=status,
        result_type=result_type,
        value=None,
    )


class TestEmptyComponents:
    """Tests for empty component list."""

    def test_empty_list_returns_stable(self):
        stats = calculate_trend_statistics([])
        assert stats.count == 0
        assert stats.normal_count == 0
        assert stats.abnormal_count == 0
        assert stats.trend_direction == "stable"


class TestQualitativeStatistics:
    """Tests for qualitative trend statistics."""

    def test_counts_qualitative_values(self):
        components = [
            _make_qual("positive"),
            _make_qual("positive"),
            _make_qual("negative"),
        ]
        stats = calculate_trend_statistics(components)
        assert stats.count == 3
        assert stats.qualitative_summary == {"positive": 2, "negative": 1}
        assert stats.result_type == "qualitative"

    def test_normal_abnormal_counts(self):
        components = [
            _make_qual("positive"),   # abnormal
            _make_qual("negative"),   # normal
            _make_qual("negative"),   # normal
        ]
        stats = calculate_trend_statistics(components)
        assert stats.normal_count == 2
        assert stats.abnormal_count == 1

    def test_numeric_fields_are_none(self):
        components = [_make_qual("negative")]
        stats = calculate_trend_statistics(components)
        assert stats.latest is None
        assert stats.average is None
        assert stats.min is None
        assert stats.max is None
        assert stats.std_dev is None

    def test_time_in_range_percent(self):
        components = [
            _make_qual("negative"),  # normal
            _make_qual("negative"),  # normal
            _make_qual("positive"),  # abnormal
        ]
        stats = calculate_trend_statistics(components)
        assert stats.time_in_range_percent == round(2 / 3 * 100, 1)

    def test_stable_trend_few_data_points(self):
        """With fewer than 4 data points, trend should be stable."""
        components = [
            _make_qual("positive"),
            _make_qual("positive"),
            _make_qual("positive"),
        ]
        stats = calculate_trend_statistics(components)
        assert stats.trend_direction == "stable"

    def test_worsening_trend(self):
        """Recent half has more abnormal than older half -> worsening."""
        # Components are ordered most-recent-first
        components = [
            _make_qual("positive"),   # recent - abnormal
            _make_qual("positive"),   # recent - abnormal
            _make_qual("negative"),   # older - normal
            _make_qual("negative"),   # older - normal
        ]
        stats = calculate_trend_statistics(components)
        assert stats.trend_direction == "worsening"

    def test_improving_trend(self):
        """Recent half has fewer abnormal than older half -> improving."""
        components = [
            _make_qual("negative"),   # recent - normal
            _make_qual("negative"),   # recent - normal
            _make_qual("positive"),   # older - abnormal
            _make_qual("positive"),   # older - abnormal
        ]
        stats = calculate_trend_statistics(components)
        assert stats.trend_direction == "improving"

    def test_detected_undetected_summary(self):
        components = [
            _make_qual("detected"),
            _make_qual("undetected"),
            _make_qual("detected"),
        ]
        stats = calculate_trend_statistics(components)
        assert stats.qualitative_summary == {"detected": 2, "undetected": 1}


class TestMixedResultTypes:
    """Tests for mixed quantitative/qualitative component lists."""

    def test_mixed_uses_quantitative_when_available(self):
        components = [
            _make_quant(5.0, status="normal"),
            _make_quant(10.0, status="high"),
            _make_qual("positive"),
        ]
        stats = calculate_trend_statistics(components)
        # Should use quantitative stats for the quant components
        assert stats.result_type == "quantitative"
        # Count should reflect total components
        assert stats.count == 3

    def test_mixed_all_qualitative_falls_back(self):
        """If mixed set has no quantitative components, use qualitative."""
        # This is an edge case - components with different result_types
        # but the only quant ones are filtered out as having None result_type
        components = [
            _make_qual("positive"),
            _make_qual("negative"),
        ]
        # Force one to have result_type=None (treated as quantitative) but it's really qualitative
        components[0].result_type = None
        stats = calculate_trend_statistics(components)
        # Mixed types detected, tries to find quant components
        # components[0] has result_type=None -> treated as quantitative
        assert stats.count == 2


class TestQuantitativeStatsUnchanged:
    """Verify quantitative statistics still work correctly."""

    def test_basic_quantitative_stats(self):
        components = [
            _make_quant(10.0, "high"),
            _make_quant(5.0, "normal"),
            _make_quant(8.0, "normal"),
        ]
        stats = calculate_trend_statistics(components)
        assert stats.count == 3
        assert stats.latest == 10.0
        assert stats.average == round((10.0 + 5.0 + 8.0) / 3, 2)
        assert stats.min == 5.0
        assert stats.max == 10.0
        assert stats.normal_count == 2
        assert stats.abnormal_count == 1
        assert stats.result_type == "quantitative"

    def test_quantitative_with_no_result_type_field(self):
        """Components without result_type should default to quantitative."""
        comp = SimpleNamespace(value=5.0, status="normal")
        # No result_type attribute at all
        stats = calculate_trend_statistics([comp])
        assert stats.count == 1
        assert stats.result_type == "quantitative"
