"""Markdown notes in the custom report PDF and the PDF data export."""

import asyncio

import pytest
from reportlab.lib.fonts import tt2ps
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph

from app.services.custom_report_pdf_generator import (
    CustomReportPDFGenerator,
    escape_report_data,
)
from app.services.custom_report_service import CustomReportService
from app.services.report_translations import get_translator
from tests.utils.report_story import export_card_rows, story_texts

NOTE = "**Plan**\nrest & fluids\n- [x] booked"
NOTE_MARKUP = "<b>Plan</b><br/>rest &amp; fluids<br/><br/>[x] booked"
HOSTILE = (
    "<a href='https://evil.example'>click</a> <img src='x'/> <font size='500'>B</font>"
)


@pytest.fixture
def gen():
    generator = CustomReportPDFGenerator()
    generator.translator = get_translator("en", "mdy")
    generator.unit_system = "imperial"
    return generator


def _text(story) -> str:
    return "\n".join(story_texts(story))


def _prepared(category, record):
    """``record`` as the formatters receive it from generate_pdf."""
    return escape_report_data({"data": {category: [record]}})["data"][category][0]


class TestEscapeReportData:
    def test_markdown_fields_become_markup(self):
        record = _prepared("medications", {"medication_name": "<M>", "notes": NOTE})
        assert record == {"medication_name": "&lt;M&gt;", "notes": NOTE_MARKUP}

    def test_hostile_markup_in_notes_stays_literal(self, gen):
        record = _prepared("allergies", {"notes": HOSTILE})
        paragraph = Paragraph(record["notes"], gen.styles["DetailValue"])
        assert paragraph.getPlainText() == HOSTILE

    def test_non_markdown_fields_are_only_escaped(self):
        record = _prepared("conditions", {"diagnosis": "**J45**", "notes": "**x**"})
        assert record == {"diagnosis": "**J45**", "notes": "<b>x</b>"}

    def test_nested_markdown_fields_become_markup(self):
        family = _prepared("family_history", {"conditions": [{"notes": "*mild*"}]})
        symptom = _prepared(
            "symptoms", {"occurrences": [{"notes": "**a**", "resolution_notes": "*b*"}]}
        )
        assert family["conditions"][0]["notes"] == "<i>mild</i>"
        assert symptom["occurrences"][0] == {
            "notes": "<b>a</b>",
            "resolution_notes": "<i>b</i>",
        }

    def test_input_is_not_mutated(self):
        data = {"data": {"vitals": [{"notes": "**x**"}]}}
        escape_report_data(data)
        assert data == {"data": {"vitals": [{"notes": "**x**"}]}}


class TestCustomReportFormatters:
    def test_multi_line_note_keeps_line_breaks(self, gen):
        story = gen._format_single_medication(
            _prepared("medications", {"medication_name": "M", "notes": "one\ntwo"})
        )
        assert "one<br/>two" in _text(story)

    def test_encounter_diagnosis_stays_bold(self, gen):
        story = gen._format_encounters(
            [_prepared("encounters", {"reason": "R", "diagnosis": "*viral*"})]
        )
        assert "<b><i>viral</i></b>" in _text(story)

    def test_procedure_complications_are_printed(self, gen):
        record = {"procedure_name": "P", "procedure_complications": "x"}
        story = gen._format_procedures([_prepared("procedures", record)])
        assert f"{gen.translator.field('complications')}: x" in _text(story)

    def test_emergency_contact_notes_are_printed(self, gen):
        record = {"name": "Pat", "notes": NOTE}
        story = gen._format_emergency_contacts([_prepared("emergency_contacts", record)])
        assert NOTE_MARKUP in _text(story)

    def test_injury_and_equipment_labels_are_translated(self, gen):
        gen.translator = get_translator("fr", "dmy")
        injury = {"injury_name": "I", "recovery_notes": "r"}
        equipment = {"equipment_name": "E", "usage_instructions": "u"}
        injury_text = _text(gen._format_single_injury(_prepared("injuries", injury)))
        equipment_text = _text(
            gen._format_medical_equipment([_prepared("medical_equipment", equipment)])
        )
        assert f"{gen.translator.field('recovery_notes')}: r" in injury_text
        assert f"{gen.translator.field('usage_instructions')}: u" in equipment_text

    def test_bold_and_italic_markup_use_real_font_variants(self, gen):
        if gen.font_normal != "UnicodeFont":
            pytest.skip("No Unicode font installed")
        assert tt2ps(gen.font_normal, 1, 0) == gen.font_bold
        assert tt2ps(gen.font_normal, 0, 1) not in (gen.font_normal, gen.font_bold)

    def test_full_report_builds_with_markdown_notes(self, gen):
        pdf = asyncio.run(
            gen.generate_pdf(
                {
                    "patient": {"first_name": "Test", "last_name": "Patient"},
                    "data": {
                        "medications": [{"medication_name": "M", "notes": NOTE}],
                        "allergies": [{"allergen": "A", "notes": HOSTILE}],
                    },
                }
            )
        )
        assert pdf.startswith(b"%PDF")


class TestExportPdfNotes:
    def test_markdown_fields_are_formatted(self):
        record = {"reason": "R", "treatment_plan": "- rest", "notes": "**b**"}
        rows = dict(export_card_rows("encounters", record, "en"))
        assert rows["Treatment Plan:"] == "&bull; rest"
        assert rows["Notes:"] == "<b>b</b>"

    def test_hostile_note_stays_literal(self):
        record = {"allergen": "P", "notes": HOSTILE}
        rows = dict(export_card_rows("allergies", record, "en"))
        style = getSampleStyleSheet()["Normal"]
        assert Paragraph(rows["Notes:"], style).getPlainText() == HOSTILE

    def test_non_markdown_field_is_not_parsed(self):
        rows = export_card_rows("medications", {"medication_name": "**Not** md"}, "en")
        assert ("Medication Name:", "**Not** md") in rows


class TestReportBuilderText:
    def test_markdown_field_is_plain_text(self):
        text = CustomReportService._field_text("injuries", "notes", "**Fell** on\n- ice")
        assert text == "Fell on ice"

    def test_other_fields_are_unchanged(self):
        text = CustomReportService._field_text("conditions", "diagnosis", " **J45** ")
        assert text == "**J45**"
