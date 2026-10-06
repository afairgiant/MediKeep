"""Regression tests for #1129: standard export PDF was only partly localized."""

import re
from pathlib import Path

import pytest
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Table

from app.services.export_service import ExportService
from app.services.report_translations import (
    SUPPORTED_LANGUAGES,
    ReportTranslator,
    _load_locale,
    get_translator,
)

EXPORT_SERVICE_SOURCE = Path("app/services/export_service.py").read_text("utf-8")


def _card_rows(section_name, record, language="de"):
    story = []
    ExportService.__new__(ExportService)._add_card_based_section(
        story,
        [record],
        section_name,
        getSampleStyleSheet(),
        translator=get_translator(language),
    )
    rows = []
    for flowable in story:
        if isinstance(flowable, Table):
            for label, value in flowable._cellvalues:
                rows.append(
                    (
                        getattr(label, "text", label),
                        getattr(value, "text", value),
                    )
                )
    return rows


def _rendered_field_keys():
    card_source = EXPORT_SERVICE_SOURCE[
        EXPORT_SERVICE_SOURCE.index("def _add_card_based_section") :
    ]
    keys = set()
    for block in re.findall(r"field_order = \[(.*?)\]", card_source, re.S):
        keys.update(re.findall(r'"(\w+)"', block))
    # "id" / "_id" come from the unknown-section fallback filter, not a rendered field
    return keys - {"id", "_id"}


class TestLocaleCompleteness:
    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_every_rendered_field_has_a_label(self, lang):
        fields = _load_locale(lang)["fields"]
        missing = sorted(
            key
            for key in _rendered_field_keys()
            if ReportTranslator._to_camel_case(key) not in fields
        )
        assert not missing, f"{lang} reportPdf.json fields missing: {missing}"

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_locale_key_sets_match_english(self, lang):
        en, other = _load_locale("en"), _load_locale(lang)
        for section in ("fields", "report", "values"):
            assert set(other[section]) >= set(en[section]), (lang, section)

    @pytest.mark.parametrize("lang", [l for l in SUPPORTED_LANGUAGES if l != "en"])
    def test_new_labels_are_not_english_copies(self, lang):
        en, other = _load_locale("en")["fields"], _load_locale(lang)["fields"]
        for key in ("phoneNumber", "rating", "isPrimaryPhysician", "testCategory"):
            assert other[key] != en[key], (lang, key)


class TestCardLocalization:
    def test_practitioner_card_has_no_internal_ids_and_is_translated(self):
        rows = _card_rows(
            "practitioners",
            {
                "id": 7,
                "name": "Dr. Test",
                "phone_number": "555-1234",
                "rating": 4,
                "is_primary_physician": True,
            },
        )
        labels = [label for label, _ in rows]
        assert "Id:" not in labels
        assert "Phone Number:" not in labels
        assert "Telefonnummer:" in labels
        assert "Bewertung:" in labels
        assert ("Hausarzt:", "Ja") in rows

    def test_unknown_section_hides_identifier_fields(self):
        rows = _card_rows("something_new", {"id": 1, "patient_id": 2, "name": "X"})
        assert [label for label, _ in rows] == ["Name:"]

    def test_status_and_category_values_are_translated(self):
        rows = _card_rows(
            "lab_results",
            {"test_name": "CBC", "test_category": "blood work", "status": "completed"},
        )
        t = get_translator("de")
        values = dict(rows)
        assert values["Testkategorie:"] == t.value("blood work") != "blood work"
        assert values["Status:"] == t.value("completed") != "completed"

    def test_free_text_is_not_altered(self):
        rows = _card_rows("allergies", {"allergen": "Peanut", "notes": "stat"})
        assert ("Notizen:", "stat") in rows

    def test_empty_values_are_hidden_in_every_language(self):
        for lang in SUPPORTED_LANGUAGES:
            rows = _card_rows(
                "medications",
                {"medication_name": "X", "dosage": None, "notes": ""},
                language=lang,
            )
            assert len(rows) == 1

    def test_family_history_conditions_are_localized(self):
        rows = _card_rows(
            "family_history",
            {
                "name": "Anna",
                "relationship": "paternal_grandfather",
                "is_deceased": False,
                "conditions": [{"condition_name": "Diabetes", "diagnosis_age": 50}],
            },
        )
        values = dict(rows)
        assert values["Beziehung:"] != "paternal_grandfather"
        assert values["Verstorben:"] == "Nein"
        assert "Alter 50" in values["Erkrankungen:"]

    def test_insurance_detail_dicts_use_translated_labels(self):
        rows = _card_rows(
            "insurance",
            {"coverage_details": {"deductible_individual": "500"}},
            language="en",
        )
        assert rows and "500" in rows[0][1]
        assert "{" not in rows[0][1]

    def test_english_output_unchanged_for_booleans(self):
        rows = _card_rows(
            "pharmacies", {"name": "P", "drive_through": True}, language="en"
        )
        assert ("Drive-through:", "Yes") in rows

    def test_choice_fields_visit_type_and_holder_relationship_are_translated(self):
        t = get_translator("de")
        encounter = dict(_card_rows("encounters", {"visit_type": "follow_up"}))
        insurance = dict(
            _card_rows("insurance", {"relationship_to_holder": "spouse"})
        )
        assert encounter["Besuchsart:"] == t.value("follow_up") != "follow_up"
        assert insurance["Beziehung zum Versicherungsnehmer:"] == t.value("spouse")
        assert t.value("spouse") != "spouse"

    @pytest.mark.parametrize("section", ["pharmacies", "emergency_contacts"])
    def test_record_timestamps_are_shown(self, section):
        rows = dict(
            _card_rows(
                section,
                {
                    "name": "X",
                    "created_at": "2026-01-02T03:04:05",
                    "updated_at": "2026-02-03T04:05:06",
                },
                language="en",
            )
        )
        assert rows["Created:"] == "01/02/2026"
        assert rows["Last updated:"] == "02/03/2026"

    def test_lab_result_tags_are_shown(self):
        rows = dict(
            _card_rows(
                "lab_results", {"test_name": "CBC", "tags": ["a", "b"]}, language="en"
            )
        )
        assert rows["Tags:"] == "a, b"

    def test_vitals_show_units(self):
        rows = dict(
            _card_rows(
                "vitals",
                {
                    "temperature": 37.0,
                    "temperature_unit": "°C",
                    "weight": 70,
                    "weight_unit": "kg",
                    "height": 175,
                    "height_unit": "cm",
                },
                language="en",
            )
        )
        assert rows["Temperature:"] == "37.0 °C"
        assert rows["Weight:"] == "70 kg"
        assert rows["Height:"] == "175 cm"

    def test_vitals_without_unit_show_bare_value(self):
        rows = dict(_card_rows("vitals", {"weight": 70}, language="en"))
        assert rows["Weight:"] == "70"
