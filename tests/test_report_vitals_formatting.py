"""Tests for vitals formatting in the PDF report generator."""

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator


class TestVitalsFormatting:
    """Test the _format_vitals method with unit conversion."""

    @pytest.fixture
    def generator(self):
        return CustomReportPDFGenerator()

    @pytest.fixture
    def sample_vital_record(self):
        return {
            "measurement_date": "2024-03-15",
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "heart_rate": 72,
            "temperature": 98.6,
            "weight": 180.0,
            "height": 70.0,
            "oxygen_saturation": 98,
            "respiratory_rate": 16,
            "blood_glucose": 95,
            "a1c": 5.7,
            "bmi": 25.8,
            "pain_scale": 3,
            "notes": "Routine checkup",
        }

    def test_imperial_vitals_no_conversion(self, generator, sample_vital_record):
        """Vitals should display raw imperial values when unit_system is imperial."""
        generator.unit_system = "imperial"
        generator.translator = get_translator("en", "mdy")

        story = generator._format_vitals([sample_vital_record])
        # Story should have content (paragraphs, tables, spacers)
        assert len(story) > 0

        # Extract all text from table cells to verify values
        all_text = _extract_table_text(story)

        assert "98.6" in all_text  # Temperature in Fahrenheit
        assert "180.0" in all_text  # Weight in lbs
        assert "70.0" in all_text  # Height in inches
        assert "120/80" in all_text  # Blood pressure
        assert "72 bpm" in all_text  # Heart rate

    def test_metric_vitals_converted(self, generator, sample_vital_record):
        """Vitals should be converted to metric when unit_system is metric."""
        generator.unit_system = "metric"
        generator.translator = get_translator("en", "mdy")

        story = generator._format_vitals([sample_vital_record])
        all_text = _extract_table_text(story)

        # Temperature: (98.6 - 32) * 5/9 = 37.0
        assert "37.0" in all_text
        # Weight: 180 * 0.453592 = 81.6 kg
        assert "81.6" in all_text
        # Height: 70 * 2.54 = 177.8 cm
        assert "177.8" in all_text
        # Unit labels should be metric
        assert "kg" in all_text
        assert "cm" in all_text

    def test_french_labels(self, generator, sample_vital_record):
        """Field labels should be translated when language is French."""
        generator.unit_system = "imperial"
        generator.translator = get_translator("fr", "dmy")

        story = generator._format_vitals([sample_vital_record])
        all_text = _extract_table_text(story)

        assert "Tension artérielle" in all_text
        assert "Fréquence cardiaque" in all_text
        assert "Température" in all_text

    def test_date_format_respected(self, generator, sample_vital_record):
        """Dates should be formatted according to user preference."""
        generator.unit_system = "imperial"
        generator.translator = get_translator("en", "dmy")

        story = generator._format_vitals([sample_vital_record])
        all_text = _extract_table_text(story)

        # Date should be DD/MM/YYYY format
        assert "15/03/2024" in all_text

    def test_null_values_skipped(self, generator):
        """Fields with None values should not appear in output."""
        generator.unit_system = "imperial"
        generator.translator = get_translator("en", "mdy")

        record = {
            "measurement_date": "2024-03-15",
            "heart_rate": 72,
            "temperature": None,
            "weight": None,
            "height": None,
        }
        story = generator._format_vitals([record])
        all_text = _extract_table_text(story)

        assert "72 bpm" in all_text
        assert "Temperature" not in all_text
        assert "Weight" not in all_text

    def test_multiple_records(self, generator, sample_vital_record):
        """Multiple vital records should each produce formatted output."""
        generator.unit_system = "imperial"
        generator.translator = get_translator("en", "mdy")

        records = [
            sample_vital_record,
            {**sample_vital_record, "measurement_date": "2024-04-15"},
        ]
        story = generator._format_vitals(records)

        # Should have content for both records
        assert len(story) > 5  # At minimum: 2x (header + table + spacer)


def _extract_table_text(story) -> str:
    """Helper to extract all text content from ReportLab story elements."""
    texts = []
    for element in story:
        # Extract from Paragraph elements
        if hasattr(element, "text"):
            texts.append(str(element.text))
        # Extract from Table elements
        if hasattr(element, "_cellvalues"):
            for row in element._cellvalues:
                for cell in row:
                    texts.append(str(cell))
    return " ".join(texts)
