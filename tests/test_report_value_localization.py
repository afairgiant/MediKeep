"""Regression tests for #1104: custom report labels and enum values were
rendered in English regardless of the report language."""

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import (
    SUPPORTED_LANGUAGES,
    ReportTranslator,
    _load_locale,
    get_translator,
)

# Stored values from app/models/enums.py and the lab result schema validators,
# including hyphenated and spaced values.
STORED_VALUES = [
    "active", "inactive", "resolved", "chronic", "recurrence", "relapse",
    "recurring", "healing", "stopped", "on-hold", "on_hold", "completed",
    "cancelled", "ordered", "in-progress", "in_progress", "scheduled",
    "postponed", "planned", "pending", "expired", "unconfirmed", "confirmed",
    "provisional", "successful", "abnormal", "complications", "inconclusive",
    "none", "mild", "moderate", "severe", "critical", "life-threatening",
    "routine", "urgent", "stat", "emergency", "follow-up", "screening",
    "prescription", "otc", "supplement", "herbal", "other", "medical",
    "dental", "vision", "left", "right", "bilateral", "not_applicable",
    "blood work", "imaging", "pathology", "microbiology", "chemistry",
    "hematology", "hepatology", "immunology", "genetics", "cardiology",
    "pulmonology", "hearing", "stomatology", "drug", "food", "environmental",
    "spouse", "partner", "child", "son", "daughter", "parent", "father",
    "mother", "sibling", "brother", "sister", "grandparent", "grandchild",
    "other_family", "friend", "self", "negative", "positive", "detected",
    "undetected", "normal", "high", "low",
]

NEW_FIELD_KEYS = ["reference_range", "member_id", "code", "ordered_by", "treating_provider"]


def _text(story) -> str:
    return " ".join(str(e.text) for e in story if hasattr(e, "text"))


def _generator(language: str) -> CustomReportPDFGenerator:
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator(language, "dmy")
    return gen


class TestValueTranslator:
    def test_english_display_values(self):
        t = ReportTranslator("en")
        assert t.value("otc") == "OTC"
        assert t.value("on-hold") == "On Hold"
        assert t.value("IN_PROGRESS") == "In Progress"
        assert t.value("blood work") == "Blood Work"
        assert t.value("life-threatening") == "Life-Threatening"

    def test_hyphen_and_underscore_forms_match(self):
        t = ReportTranslator("fr")
        assert t.value("on-hold") == t.value("on_hold")
        assert t.value("in-progress") == t.value("in_progress")

    @pytest.mark.parametrize(
        "free_text", ["MRI-guided PT", "COVID-19", "co-worker", "Boss's Wife"]
    )
    def test_unknown_and_free_text_values_are_unchanged(self, free_text):
        assert ReportTranslator("fr").value(free_text) == free_text

    def test_empty_values_render_empty(self):
        t = ReportTranslator("en")
        assert t.value(None) == ""
        assert t.value("  ") == ""

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES) + ["th"])
    def test_every_stored_value_has_a_translation(self, lang):
        values = _load_locale(lang)["values"]
        t = ReportTranslator(lang)
        for raw in STORED_VALUES:
            key = ReportTranslator._to_camel_case(
                raw.lower().replace("-", "_").replace(" ", "_")
            )
            assert values.get(key), f"{lang}: no value translation for {raw!r}"
            if lang in SUPPORTED_LANGUAGES:  # th is not yet a report language
                assert t.value(raw) == values[key]

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES) + ["th"])
    def test_locale_value_keys_match_english(self, lang):
        assert set(_load_locale(lang)["values"]) == set(_load_locale("en")["values"])

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_new_field_labels_exist_in_every_language(self, lang):
        fields = _load_locale(lang)["fields"]
        for key in NEW_FIELD_KEYS:
            assert fields.get(ReportTranslator._to_camel_case(key))

    @pytest.mark.parametrize("lang", [l for l in SUPPORTED_LANGUAGES if l != "en"])
    def test_non_english_values_differ_from_raw_english(self, lang):
        t = ReportTranslator(lang)
        assert t.value("active") not in ("active", "Active")


class TestLocalizedFormatters:
    """Records use the keys emitted by the real models/schemas."""

    @pytest.fixture
    def fr(self):
        return _generator("fr")

    def test_insurance_labels_and_values(self, fr):
        story = fr._format_insurance([{
            "company_name": "Acme", "insurance_type": "medical",
            "status": "active", "member_id": "M123", "group_number": "G9",
        }])
        text = _text(story)
        assert "Member ID" not in text and "Group #" not in text
        assert "N° d'adhérent: M123" in text
        assert "Numéro du groupe: G9" in text
        assert "Actif" in text and "Médicale" in text

    def test_injury_treating_provider_and_values(self, fr):
        story = fr._format_injuries([{
            "injury_name": "Sprain", "severity": "moderate", "status": "healing",
            "body_part": "ankle", "laterality": "left", "practitioner": "Dr X",
        }])
        text = _text(story)
        assert "Treating Provider" not in text
        assert "Médecin traitant: Dr X" in text
        assert "MODÉRÉ" in text and "En guérison" in text and "Gauche ankle" in text

    def test_lab_labels_and_values(self, fr):
        story = fr._format_lab_results([{
            "test_name": "CT", "test_code": "CT1", "test_category": "imaging",
            "ordered_by": "Dr Y", "status": "completed",
            "ordered_date": "2024-01-02",
        }])
        text = _text(story)
        assert "Ordered by" not in text
        assert "Code: CT1" in text
        assert "Prescrit par: Dr Y" in text
        assert "Imagerie" in text and "Terminé" in text
        assert "completed" not in text and "imaging" not in text

    def test_lab_component_qualitative_value_and_ref_translated(self, fr):
        story = fr._format_lab_results([{
            "test_name": "HIV", "ordered_date": "2024-01-02",
            "test_components": [
                {"test_name": "HIV", "qualitative_value": "negative",
                 "status": "normal", "reference_range": "negative"},
                {"test_name": "K", "value": 6.1, "unit": "mmol/L",
                 "status": "high", "reference_range": "3.5-5.0"},
            ],
        }])
        text = _text(story)
        assert "Négatif" in text and "[Réf.: 3.5-5.0]" in text
        assert "Ref:" not in text and "(ÉLEVÉ)" in text

    def test_immunization_manufacturer_is_labelled(self, fr):
        story = fr._format_immunizations([{
            "vaccine_name": "Flu", "date_administered": "2024-01-02",
            "manufacturer": "Pfizer",
        }])
        assert "Fabricant: Pfizer" in _text(story)

    def test_emergency_contact_free_text_relationship_is_unchanged(self, fr):
        story = fr._format_emergency_contacts([{
            "name": "Jo", "relationship": "Co-worker",
        }])
        assert "Co-worker" in _text(story)

    def test_insurance_holder_relationship_is_translated(self, fr):
        story = fr._format_insurance([{
            "company_name": "Acme", "policy_holder_name": "Pat",
            "relationship_to_holder": "spouse",
        }])
        assert "Conjoint" in _text(story)

    def test_emergency_contact_address_label(self, fr):
        story = fr._format_emergency_contacts([{
            "name": "Jo", "relationship": "spouse", "address": "1 Main St",
            "phone_number": "555",
        }])
        text = _text(story)
        assert "Address:" not in text
        assert "Adresse: 1 Main St" in text
        assert "Conjoint" in text

    def test_family_history_condition_values(self, fr):
        story = fr._format_family_history([{
            "name": "Pop", "relationship": "father",
            "conditions": [{
                "condition_name": "Diabetes", "severity": "moderate",
                "status": "active", "condition_type": "other",
            }],
        }])
        text = _text(story)
        assert "moderate" not in text and "active" not in text
        assert "other" not in text
        assert "Modéré" in text and "Actif" in text and "Autre" in text

    def test_medication_values(self, fr):
        story = fr._format_medications([{
            "medication_name": "Aspirin", "medication_type": "otc",
            "status": "active",
        }])
        text = _text(story)
        assert "Otc" not in text and "Active" not in text
        assert "Sans ordonnance" in text and "Actif" in text

    def test_condition_status_values(self, fr):
        story = fr._format_conditions([{
            "condition_name": "Asthma", "status": "active",
            "verification_status": "confirmed",
        }])
        text = _text(story)
        assert "Actif" in text and "Confirmé" in text

    def test_english_output_is_title_cased_not_raw(self):
        story = _generator("en")._format_medications([{
            "medication_name": "Aspirin", "medication_type": "otc",
            "status": "on-hold",
        }])
        text = _text(story)
        assert "OTC" in text and "On Hold" in text
