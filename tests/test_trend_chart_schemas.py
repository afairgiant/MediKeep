"""Tests for trend chart schemas (app/schemas/trend_charts.py)"""

import pytest
from pydantic import ValidationError

from app.schemas.trend_charts import (
    SUPPORTED_VITAL_TYPES,
    LabTestChartRequest,
    TrendChartSelection,
    TrendChartTimeRange,
    VitalChartRequest,
)


class TestTrendChartTimeRange:
    """Tests for TrendChartTimeRange enum."""

    def test_all_values_exist(self):
        assert TrendChartTimeRange.ALL == "all"
        assert TrendChartTimeRange.THREE_MONTHS == "3months"
        assert TrendChartTimeRange.SIX_MONTHS == "6months"
        assert TrendChartTimeRange.ONE_YEAR == "1year"
        assert TrendChartTimeRange.TWO_YEARS == "2years"
        assert TrendChartTimeRange.FIVE_YEARS == "5years"

    def test_enum_string_coercion(self):
        req = VitalChartRequest(vital_type="heart_rate", time_range="1year")
        assert req.time_range == TrendChartTimeRange.ONE_YEAR

    def test_invalid_time_range(self):
        with pytest.raises(ValidationError):
            VitalChartRequest(vital_type="heart_rate", time_range="10years")


class TestVitalChartRequest:
    """Tests for VitalChartRequest schema."""

    def test_valid_vital_type(self):
        req = VitalChartRequest(vital_type="heart_rate")
        assert req.vital_type == "heart_rate"
        assert req.time_range == TrendChartTimeRange.ONE_YEAR  # default

    def test_all_supported_vital_types(self):
        for vt in SUPPORTED_VITAL_TYPES:
            req = VitalChartRequest(vital_type=vt)
            assert req.vital_type == vt

    def test_invalid_vital_type(self):
        with pytest.raises(ValidationError, match="Unsupported vital type"):
            VitalChartRequest(vital_type="invalid_type")

    def test_custom_time_range(self):
        req = VitalChartRequest(vital_type="weight", time_range="3months")
        assert req.time_range == TrendChartTimeRange.THREE_MONTHS


class TestLabTestChartRequest:
    """Tests for LabTestChartRequest schema."""

    def test_valid_request(self):
        req = LabTestChartRequest(test_name="Glucose")
        assert req.test_name == "Glucose"
        assert req.time_range == TrendChartTimeRange.ONE_YEAR

    def test_empty_test_name_rejected(self):
        with pytest.raises(ValidationError):
            LabTestChartRequest(test_name="")

    def test_long_test_name(self):
        name = "A" * 500
        req = LabTestChartRequest(test_name=name)
        assert len(req.test_name) == 500

    def test_too_long_test_name_rejected(self):
        with pytest.raises(ValidationError):
            LabTestChartRequest(test_name="A" * 501)


class TestTrendChartSelection:
    """Tests for TrendChartSelection schema."""

    def test_vitals_only(self):
        sel = TrendChartSelection(
            vital_charts=[VitalChartRequest(vital_type="heart_rate")]
        )
        assert len(sel.vital_charts) == 1
        assert len(sel.lab_test_charts) == 0

    def test_labs_only(self):
        sel = TrendChartSelection(
            lab_test_charts=[LabTestChartRequest(test_name="Glucose")]
        )
        assert len(sel.vital_charts) == 0
        assert len(sel.lab_test_charts) == 1

    def test_mixed(self):
        sel = TrendChartSelection(
            vital_charts=[VitalChartRequest(vital_type="heart_rate")],
            lab_test_charts=[LabTestChartRequest(test_name="Glucose")],
        )
        assert len(sel.vital_charts) == 1
        assert len(sel.lab_test_charts) == 1

    def test_empty_rejected(self):
        with pytest.raises(ValidationError, match="At least one chart"):
            TrendChartSelection()

    def test_max_10_charts(self):
        vitals = [
            VitalChartRequest(vital_type=vt)
            for vt in SUPPORTED_VITAL_TYPES[:6]
        ]
        labs = [
            LabTestChartRequest(test_name=f"Test{i}")
            for i in range(4)
        ]
        # 10 total - should work
        sel = TrendChartSelection(vital_charts=vitals, lab_test_charts=labs)
        assert len(sel.vital_charts) + len(sel.lab_test_charts) == 10

    def test_over_10_charts_rejected(self):
        vitals = [
            VitalChartRequest(vital_type=vt)
            for vt in SUPPORTED_VITAL_TYPES[:6]
        ]
        labs = [
            LabTestChartRequest(test_name=f"Test{i}")
            for i in range(5)
        ]
        with pytest.raises(ValidationError, match="Cannot include more than 10"):
            TrendChartSelection(vital_charts=vitals, lab_test_charts=labs)

    def test_duplicate_vital_types_rejected(self):
        with pytest.raises(ValidationError, match="Duplicate vital types"):
            TrendChartSelection(
                vital_charts=[
                    VitalChartRequest(vital_type="heart_rate"),
                    VitalChartRequest(vital_type="heart_rate"),
                ]
            )

    def test_duplicate_lab_names_rejected(self):
        with pytest.raises(ValidationError, match="Duplicate lab test names"):
            TrendChartSelection(
                lab_test_charts=[
                    LabTestChartRequest(test_name="Glucose"),
                    LabTestChartRequest(test_name="glucose"),  # case-insensitive
                ]
            )

    def test_different_time_ranges_allowed(self):
        sel = TrendChartSelection(
            vital_charts=[
                VitalChartRequest(vital_type="heart_rate", time_range="3months"),
                VitalChartRequest(vital_type="weight", time_range="1year"),
            ]
        )
        assert sel.vital_charts[0].time_range == TrendChartTimeRange.THREE_MONTHS
        assert sel.vital_charts[1].time_range == TrendChartTimeRange.ONE_YEAR
