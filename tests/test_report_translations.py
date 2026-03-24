"""Tests for the report translations module."""

import pytest
from datetime import date, datetime

from app.services.report_translations import (
    ReportTranslator,
    get_translator,
    _load_locale,
    SUPPORTED_LANGUAGES,
)


class TestReportTranslator:
    """Tests for the ReportTranslator class."""

    def test_default_language_is_english(self):
        t = ReportTranslator()
        assert t.language == "en"

    def test_supported_language_accepted(self):
        t = ReportTranslator(language="fr")
        assert t.language == "fr"

    def test_unsupported_language_falls_back_to_english(self):
        t = ReportTranslator(language="xx")
        assert t.language == "en"

    def test_category_returns_translated_name(self):
        t = ReportTranslator(language="fr")
        assert t.category("vitals") == "Signes vitaux"
        assert t.category("medications") == "Médicaments"

    def test_category_falls_back_to_english(self):
        t = ReportTranslator(language="en")
        assert t.category("vitals") == "Vital Signs"

    def test_category_unknown_key_returns_title_cased(self):
        t = ReportTranslator(language="en")
        assert t.category("some_unknown_category") == "Some Unknown Category"

    def test_field_returns_translated_label(self):
        t = ReportTranslator(language="de")
        assert t.field("temperature") == "Temperatur"
        assert t.field("blood_pressure") == "Blutdruck"

    def test_field_snake_to_camel_conversion(self):
        t = ReportTranslator(language="en")
        assert t.field("heart_rate") == "Heart Rate"
        assert t.field("oxygen_saturation") == "Oxygen Saturation"
        assert t.field("blood_glucose") == "Blood Glucose"

    def test_field_unknown_key_returns_title_cased(self):
        t = ReportTranslator()
        assert t.field("unknown_field_name") == "Unknown Field Name"

    def test_text_returns_translated_report_text(self):
        t = ReportTranslator(language="es")
        result = t.text("records_summary", total=10, categories=3)
        assert "10" in result
        assert "3" in result

    def test_text_without_kwargs(self):
        t = ReportTranslator()
        result = t.text("records_by_category")
        assert result == "Records by Category"

    def test_text_unknown_key_returns_key(self):
        t = ReportTranslator()
        assert t.text("nonexistent_key") == "nonexistent_key"

    def test_text_snake_to_camel_conversion(self):
        t = ReportTranslator(language="en")
        assert t.text("active_medications") == "Active Medications"
        assert t.text("patient_information") == "Patient Information"
        assert t.text("confidential_notice") == "Confidential Medical Information"


class TestDateFormatting:
    """Tests for date formatting with different preferences."""

    def test_mdy_format(self):
        t = ReportTranslator(date_format="mdy")
        result = t.format_date("2024-03-15")
        assert result == "03/15/2024"

    def test_dmy_format(self):
        t = ReportTranslator(date_format="dmy")
        result = t.format_date("2024-03-15")
        assert result == "15/03/2024"

    def test_ymd_format(self):
        t = ReportTranslator(date_format="ymd")
        result = t.format_date("2024-03-15")
        assert result == "2024-03-15"

    def test_format_date_object(self):
        t = ReportTranslator(date_format="dmy")
        result = t.format_date(date(2024, 12, 25))
        assert result == "25/12/2024"

    def test_format_datetime_object(self):
        t = ReportTranslator(date_format="mdy")
        result = t.format_date(datetime(2024, 7, 4, 14, 30))
        assert result == "07/04/2024"

    def test_format_datetime_with_time(self):
        t = ReportTranslator(date_format="dmy")
        result = t.format_date(datetime(2024, 7, 4, 14, 30), include_time=True)
        assert result == "04/07/2024 14:30"

    def test_format_none_returns_dash(self):
        t = ReportTranslator()
        assert t.format_date(None) == "--"

    def test_format_iso_string_with_time(self):
        t = ReportTranslator(date_format="ymd")
        result = t.format_date("2024-03-15T10:30:00")
        assert result == "2024-03-15"

    def test_invalid_date_format_falls_back_to_mdy(self):
        t = ReportTranslator(date_format="xyz")
        assert t.date_format_code == "mdy"


class TestLocaleFileLoading:
    """Ensure all locale files load correctly."""

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_locale_file_loads(self, lang):
        data = _load_locale(lang)
        assert isinstance(data, dict)
        assert "categories" in data
        assert "fields" in data
        assert "report" in data

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_all_categories_present(self, lang):
        data = _load_locale(lang)
        cats = data.get("categories", {})
        assert len(cats) == 17
        assert "vitals" in cats
        assert "medications" in cats
        assert "lab_results" in cats

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_vital_fields_present(self, lang):
        data = _load_locale(lang)
        fields = data.get("fields", {})
        for vital_field in [
            "bloodPressure", "heartRate", "temperature",
            "weight", "height", "oxygenSaturation",
            "respiratoryRate", "bloodGlucose", "bmi", "painScale",
        ]:
            assert vital_field in fields, f"Missing field '{vital_field}' in language '{lang}'"

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_report_text_present(self, lang):
        data = _load_locale(lang)
        text = data.get("report", {})
        for key in ["recordsSummary", "recordsByCategory", "reportSummary", "record", "records"]:
            assert key in text, f"Missing text key '{key}' in language '{lang}'"


class TestGetTranslator:
    """Tests for the get_translator factory function."""

    def test_returns_translator_instance(self):
        t = get_translator("en", "mdy")
        assert isinstance(t, ReportTranslator)

    def test_defaults(self):
        t = get_translator()
        assert t.language == "en"
        assert t.date_format_code == "mdy"

    def test_with_language_and_format(self):
        t = get_translator("fr", "dmy")
        assert t.language == "fr"
        assert t.date_format_code == "dmy"
