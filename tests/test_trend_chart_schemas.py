"""Tests for trend chart schemas (app/schemas/trend_charts.py)"""

from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.trend_charts import (
    SUPPORTED_VITAL_TYPES,
    LabTestChartRequest,
    TrendChartSelection,
    VitalChartRequest,
)


class TestVitalChartRequest:
    """Tests for VitalChartRequest schema."""

    def test_valid_vital_type(self):
        req = VitalChartRequest(vital_type="heart_rate")
        assert req.vital_type == "heart_rate"
        assert req.date_from is None
        assert req.date_to is None

    def test_all_supported_vital_types(self):
        for vt in SUPPORTED_VITAL_TYPES:
            req = VitalChartRequest(vital_type=vt)
            assert req.vital_type == vt

    def test_invalid_vital_type(self):
        with pytest.raises(ValidationError, match="Unsupported vital type"):
            VitalChartRequest(vital_type="invalid_type")

    def test_with_date_range(self):
        req = VitalChartRequest(
            vital_type="weight",
            date_from=date(2025, 1, 1),
            date_to=date(2026, 1, 1),
        )
        assert req.date_from == date(2025, 1, 1)
        assert req.date_to == date(2026, 1, 1)

    def test_date_to_before_date_from_rejected(self):
        with pytest.raises(
            ValidationError, match="date_to must be on or after date_from"
        ):
            VitalChartRequest(
                vital_type="heart_rate",
                date_from=date(2026, 1, 1),
                date_to=date(2025, 1, 1),
            )

    def test_same_date_allowed(self):
        req = VitalChartRequest(
            vital_type="heart_rate",
            date_from=date(2026, 1, 1),
            date_to=date(2026, 1, 1),
        )
        assert req.date_from == req.date_to

    def test_date_from_only(self):
        req = VitalChartRequest(vital_type="weight", date_from=date(2025, 6, 1))
        assert req.date_from == date(2025, 6, 1)
        assert req.date_to is None

    def test_date_to_only(self):
        req = VitalChartRequest(vital_type="weight", date_to=date(2026, 1, 1))
        assert req.date_from is None
        assert req.date_to == date(2026, 1, 1)


class TestLabTestChartRequest:
    """Tests for LabTestChartRequest schema."""

    def test_valid_request(self):
        req = LabTestChartRequest(test_name="Glucose")
        assert req.test_name == "Glucose"
        assert req.date_from is None
        assert req.date_to is None

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

    def test_with_date_range(self):
        req = LabTestChartRequest(
            test_name="TSH",
            date_from=date(2025, 1, 1),
            date_to=date(2026, 1, 1),
        )
        assert req.date_from == date(2025, 1, 1)
        assert req.date_to == date(2026, 1, 1)

    def test_date_to_before_date_from_rejected(self):
        with pytest.raises(
            ValidationError, match="date_to must be on or after date_from"
        ):
            LabTestChartRequest(
                test_name="Glucose",
                date_from=date(2026, 1, 1),
                date_to=date(2025, 1, 1),
            )


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
        vitals = [VitalChartRequest(vital_type=vt) for vt in SUPPORTED_VITAL_TYPES[:6]]
        labs = [LabTestChartRequest(test_name=f"Test{i}") for i in range(4)]
        # 10 total - should work
        sel = TrendChartSelection(vital_charts=vitals, lab_test_charts=labs)
        assert len(sel.vital_charts) + len(sel.lab_test_charts) == 10

    def test_over_10_charts_rejected(self):
        vitals = [VitalChartRequest(vital_type=vt) for vt in SUPPORTED_VITAL_TYPES[:6]]
        labs = [LabTestChartRequest(test_name=f"Test{i}") for i in range(5)]
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

    def test_different_date_ranges_allowed(self):
        sel = TrendChartSelection(
            vital_charts=[
                VitalChartRequest(
                    vital_type="heart_rate",
                    date_from=date(2025, 12, 1),
                    date_to=date(2026, 3, 1),
                ),
                VitalChartRequest(
                    vital_type="weight",
                    date_from=date(2024, 1, 1),
                    date_to=date(2026, 1, 1),
                ),
            ]
        )
        assert sel.vital_charts[0].date_from == date(2025, 12, 1)
        assert sel.vital_charts[1].date_from == date(2024, 1, 1)
