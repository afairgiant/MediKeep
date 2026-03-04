"""Tests for trend chart generator (app/services/trend_chart_generator.py)"""

from datetime import datetime, timedelta

import pytest

from app.services.trend_chart_generator import TrendChartGenerator


def _make_dates(count, start_days_ago=365):
    """Create a list of datetime objects spaced evenly."""
    base = datetime.now() - timedelta(days=start_days_ago)
    interval = start_days_ago / max(count - 1, 1)
    return [base + timedelta(days=i * interval) for i in range(count)]


def _is_valid_png(data: bytes) -> bool:
    """Check PNG magic bytes."""
    return data[:8] == b'\x89PNG\r\n\x1a\n'


class TestTrendChartGenerator:
    """Tests for TrendChartGenerator."""

    def setup_method(self):
        self.generator = TrendChartGenerator()

    def test_generate_vital_chart_basic(self):
        dates = _make_dates(10)
        values = [72, 75, 70, 68, 73, 71, 76, 74, 69, 72]
        data = {
            "dates": dates,
            "values": values,
            "display_name": "Heart Rate",
            "unit": "bpm",
            "reference_range": (60, 100),
            "statistics": {
                "count": 10,
                "latest": 72,
                "average": 72.0,
                "min": 68,
                "max": 76,
                "trend_direction": "stable",
            },
        }
        png = self.generator.generate_vital_chart(data, "heart_rate")
        assert png is not None
        assert _is_valid_png(png)
        assert len(png) > 1000  # Reasonable size for a chart image

    def test_generate_vital_chart_empty_data(self):
        data = {"dates": [], "values": [], "display_name": "Heart Rate", "unit": "bpm"}
        result = self.generator.generate_vital_chart(data, "heart_rate")
        assert result is None

    def test_generate_vital_chart_single_point(self):
        data = {
            "dates": [datetime.now()],
            "values": [72.0],
            "display_name": "Heart Rate",
            "unit": "bpm",
            "reference_range": (60, 100),
            "statistics": {"count": 1, "latest": 72, "trend_direction": "stable"},
        }
        png = self.generator.generate_vital_chart(data, "heart_rate")
        assert png is not None
        assert _is_valid_png(png)

    def test_generate_vital_chart_no_reference_range(self):
        dates = _make_dates(5)
        data = {
            "dates": dates,
            "values": [150, 155, 160, 158, 162],
            "display_name": "Weight",
            "unit": "lbs",
            "reference_range": None,
            "statistics": {"count": 5, "latest": 162, "trend_direction": "increasing"},
        }
        png = self.generator.generate_vital_chart(data, "weight")
        assert png is not None
        assert _is_valid_png(png)

    def test_generate_bp_chart(self):
        dates = _make_dates(8)
        data = {
            "dates": dates,
            "systolic_values": [120, 125, 118, 130, 122, 128, 119, 124],
            "diastolic_values": [80, 82, 78, 85, 79, 83, 77, 81],
            "display_name": "Blood Pressure",
            "unit": "mmHg",
            "reference_range": {"systolic": (90, 120), "diastolic": (60, 80)},
            "statistics": {
                "systolic": {"count": 8, "latest": 124, "average": 123.3, "trend_direction": "stable"},
                "diastolic": {"count": 8, "latest": 81, "average": 80.6, "trend_direction": "stable"},
            },
        }
        png = self.generator.generate_vital_chart(data, "blood_pressure")
        assert png is not None
        assert _is_valid_png(png)

    def test_generate_lab_test_chart_basic(self):
        dates = _make_dates(6)
        data = {
            "dates": dates,
            "values": [95, 102, 98, 88, 110, 97],
            "statuses": ["normal", "high", "normal", "low", "high", "normal"],
            "display_name": "Glucose",
            "unit": "mg/dL",
            "ref_range_min": 70,
            "ref_range_max": 100,
            "statistics": {
                "count": 6,
                "latest": 97,
                "average": 98.3,
                "min": 88,
                "max": 110,
                "trend_direction": "stable",
            },
        }
        png = self.generator.generate_lab_test_chart(data)
        assert png is not None
        assert _is_valid_png(png)

    def test_generate_lab_test_chart_empty_data(self):
        data = {"dates": [], "values": [], "statuses": [], "display_name": "Test"}
        result = self.generator.generate_lab_test_chart(data)
        assert result is None

    def test_generate_lab_test_chart_with_none_values(self):
        dates = _make_dates(5)
        data = {
            "dates": dates,
            "values": [95, None, 98, None, 97],
            "statuses": ["normal", "unknown", "normal", "unknown", "normal"],
            "display_name": "Glucose",
            "unit": "mg/dL",
            "ref_range_min": 70,
            "ref_range_max": 100,
            "statistics": {"count": 3, "latest": 97, "trend_direction": "stable"},
        }
        png = self.generator.generate_lab_test_chart(data)
        assert png is not None
        assert _is_valid_png(png)

    def test_generate_lab_test_chart_no_ref_range(self):
        dates = _make_dates(4)
        data = {
            "dates": dates,
            "values": [1.2, 1.5, 1.1, 1.3],
            "statuses": ["normal"] * 4,
            "display_name": "TSH",
            "unit": "mIU/L",
            "ref_range_min": None,
            "ref_range_max": None,
            "statistics": {"count": 4, "latest": 1.3, "trend_direction": "stable"},
        }
        png = self.generator.generate_lab_test_chart(data)
        assert png is not None
        assert _is_valid_png(png)

    def test_generate_lab_test_chart_all_statuses(self):
        """Test that all status colors render without error."""
        dates = _make_dates(7)
        statuses = ["normal", "high", "low", "critical_high", "critical_low", "abnormal", "unknown"]
        data = {
            "dates": dates,
            "values": [95, 110, 60, 200, 30, 105, 90],
            "statuses": statuses,
            "display_name": "Mixed Status Test",
            "unit": "units",
            "ref_range_min": 70,
            "ref_range_max": 100,
            "statistics": {},
        }
        png = self.generator.generate_lab_test_chart(data)
        assert png is not None
        assert _is_valid_png(png)
