"""Tests for custom report schema changes supporting trend charts."""

import pytest
from pydantic import ValidationError

from app.schemas.custom_reports import CustomReportRequest, ReportTemplate
from app.schemas.trend_charts import (
    LabTestChartRequest,
    TrendChartSelection,
    VitalChartRequest,
)


class TestCustomReportRequestWithCharts:
    """Test CustomReportRequest with trend chart support."""

    def test_records_only(self):
        """Original behavior: records without charts still works."""
        req = CustomReportRequest(
            selected_records=[{"category": "medications", "record_ids": [1, 2, 3]}]
        )
        assert len(req.selected_records) == 1
        assert req.trend_charts is None

    def test_charts_only(self):
        """New behavior: charts without records works."""
        req = CustomReportRequest(
            trend_charts=TrendChartSelection(
                vital_charts=[VitalChartRequest(vital_type="heart_rate")]
            )
        )
        assert len(req.selected_records) == 0
        assert req.trend_charts is not None
        assert len(req.trend_charts.vital_charts) == 1

    def test_records_and_charts(self):
        """Both records and charts together."""
        req = CustomReportRequest(
            selected_records=[{"category": "vitals", "record_ids": [1]}],
            trend_charts=TrendChartSelection(
                lab_test_charts=[LabTestChartRequest(test_name="Glucose")]
            ),
        )
        assert len(req.selected_records) == 1
        assert len(req.trend_charts.lab_test_charts) == 1

    def test_empty_request_rejected(self):
        """Neither records nor charts should fail."""
        with pytest.raises(ValidationError, match="must include at least"):
            CustomReportRequest()

    def test_empty_records_no_charts_rejected(self):
        """Explicit empty records without charts should fail."""
        with pytest.raises(ValidationError, match="must include at least"):
            CustomReportRequest(selected_records=[])

    def test_selected_records_default_is_empty_list(self):
        """selected_records defaults to empty list when not provided."""
        req = CustomReportRequest(
            trend_charts=TrendChartSelection(
                vital_charts=[VitalChartRequest(vital_type="weight")]
            )
        )
        assert req.selected_records == []

    def test_duplicate_categories_still_rejected(self):
        """Duplicate category validation still works."""
        with pytest.raises(ValidationError, match="Duplicate categories"):
            CustomReportRequest(
                selected_records=[
                    {"category": "medications", "record_ids": [1]},
                    {"category": "medications", "record_ids": [2]},
                ]
            )

    def test_record_count_limit_still_enforced(self):
        """5000 record limit is still enforced."""
        with pytest.raises(ValidationError, match="5000"):
            CustomReportRequest(
                selected_records=[
                    {"category": "medications", "record_ids": list(range(5001))}
                ]
            )


class TestReportTemplateWithCharts:
    """Test ReportTemplate with trend chart support."""

    def test_template_with_charts(self):
        tmpl = ReportTemplate(
            name="My Template",
            trend_charts=TrendChartSelection(
                vital_charts=[VitalChartRequest(vital_type="heart_rate")]
            ),
        )
        assert tmpl.trend_charts is not None
        assert len(tmpl.trend_charts.vital_charts) == 1

    def test_template_without_charts(self):
        tmpl = ReportTemplate(
            name="My Template",
            selected_records=[{"category": "medications", "record_ids": [1]}],
        )
        assert tmpl.trend_charts is None

    def test_template_selected_records_defaults_to_empty(self):
        tmpl = ReportTemplate(
            name="My Template",
        )
        assert tmpl.selected_records == []
