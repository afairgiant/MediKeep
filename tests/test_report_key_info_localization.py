"""Regression tests: the report builder's record-selection list (key_info)
was always English and showed raw stored values."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.custom_report_service import CustomReportService
from app.services.report_translations import get_translator


def _service(language: str) -> CustomReportService:
    svc = CustomReportService(MagicMock())
    svc._translator = get_translator(language, "dmy")
    svc._user_unit_system = "metric"
    return svc


def _info(language, category, **attrs):
    return _service(language)._get_key_info(SimpleNamespace(**attrs), category)


class TestKeyInfoLocalized:
    def test_immunization_labels(self):
        text = _info("fr", "immunizations", site="bras", manufacturer="Pfizer", lot_number="L1")
        assert text == "Site d'administration: bras | Fabricant: Pfizer | Numéro de lot: L1"

    def test_insurance_member_id_and_values(self):
        text = _info(
            "zh", "insurance", insurance_type="medical", plan_name="Gold",
            member_id="M1", is_primary=True,
        )
        assert "Member ID" not in text and "Primary" not in text
        assert "M1" in text and "医疗" in text

    def test_lab_status_values_translated(self):
        text = _info("fr", "lab_results", test_type="routine", labs_result="negative", status="in-progress")
        assert "Négatif" in text and "En cours" in text
        assert "negative" not in text and "Status" not in text

    def test_medication_labels(self):
        text = _info("de", "medications", dosage="5mg", frequency="täglich", indication="Blutdruck")
        assert text.startswith("Dosierung: 5mg")
        assert "Dosage:" not in text and "For:" not in text

    def test_family_history_born_deceased_and_count(self):
        svc = _service("fr")
        svc.db.query.return_value.filter.return_value.count.return_value = 2
        item = SimpleNamespace(
            id=1, relationship="father", birth_year=1950, is_deceased=True, death_year=2010
        )
        text = svc._get_key_info(item, "family_history")
        assert "Père" in text and "Né(e) en 1950, décédé(e) en 2010" in text
        assert "2 problème(s) médical(aux)" in text
        assert "Born" not in text

    def test_free_text_values_not_altered(self):
        text = _info("fr", "emergency_contacts", relationship="Co-worker", phone_number="555")
        assert text.startswith("Co-worker")

    def test_empty_record_uses_translated_placeholder(self):
        assert _info("fr", "medications") == "Aucun détail"

    def test_vitals_labels_translated(self):
        vital = SimpleNamespace(
            blood_pressure_systolic=120, blood_pressure_diastolic=80,
            heart_rate=60, temperature=None,
        )
        text = _service("fr")._format_vitals_info(vital, "metric")
        assert "Pression artérielle: 120/80" in text and "BP" not in text
        assert _service("fr")._format_vitals_info(SimpleNamespace(), "metric") == "Aucune mesure"

    def test_medical_equipment_has_localized_details(self):
        text = _info("fr", "medical_equipment", equipment_type="CPAP", manufacturer="Acme")
        assert text == "Type: CPAP | Fabricant: Acme"

    def test_english_output_is_still_english(self):
        text = _info("en", "immunizations", manufacturer="Pfizer")
        assert text == "Manufacturer: Pfizer"

    @pytest.mark.parametrize("lang", ["fr", "zh", "de"])
    def test_unexpected_error_returns_translated_placeholder(self, lang):
        svc = _service(lang)
        svc._translator = get_translator(lang, "dmy")
        # An item whose attribute access raises
        class Boom:
            def __getattr__(self, name):
                raise RuntimeError("x")
        assert svc._get_key_info(Boom(), "medications") == svc._translator.text("details_unavailable")
