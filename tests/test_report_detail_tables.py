"""Custom report records render as label/value tables with styled headings."""

import pytest
from reportlab.platypus import Paragraph, Table

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator
from tests.utils.report_story import story_texts


@pytest.fixture
def gen():
    generator = CustomReportPDFGenerator()
    generator.translator = get_translator("en", "mdy")
    generator.unit_system = "imperial"
    return generator


def _tables(story):
    return [el for el in story if isinstance(el, Table)]


class TestDetailTableHelper:
    def test_no_rows_gives_no_table(self, gen):
        assert gen._detail_table([]) == []

    def test_empty_and_none_values_are_skipped(self, gen):
        assert gen._detail_table([("Notes", None), ("Tags", "")]) == []

    def test_zero_is_kept(self, gen):
        (table,) = gen._detail_table([("Refills", 0)])
        assert story_texts([table]) == ["Refills: 0"]

    def test_cells_are_paragraphs_so_long_text_wraps(self, gen):
        (table,) = gen._detail_table([("Notes", "word " * 400)])
        assert all(isinstance(cell, Paragraph) for cell in table._cellvalues[0])
        # Wrapped inside the page: the table is no wider than the text area
        table.wrapOn(None, 7.0 * 72, 10000)
        assert table._width <= 7.0 * 72 + 0.01

    def test_trailing_colon_on_label_is_dropped(self, gen):
        (table,) = gen._detail_table([["Heart Rate:", "70 bpm"]])
        assert story_texts([table]) == ["Heart Rate: 70 bpm"]

    def test_escaped_text_stays_escaped(self, gen):
        (table,) = gen._detail_table([("Notes", "a &lt;b&gt; &amp; c")])
        assert table._cellvalues[0][1].text == "a &lt;b&gt; &amp; c"

    def test_inline_markup_in_values_is_kept(self, gen):
        (table,) = gen._detail_table([("Result", "<font color='red'>HIGH</font>")])
        assert "<font color='red'>" in table._cellvalues[0][1].text


class TestCategoryTables:
    def test_medication_fields_are_table_rows_not_paragraphs(self, gen):
        story = gen._format_single_medication(
            {
                "medication_name": "Metformin",
                "status": "active",
                "prescribing_practitioner": "Dr. A",
                "notes": "take with food",
            }
        )
        (table,) = _tables(story)
        rows = story_texts([table])
        assert "Prescribed by: Dr. A" in rows
        assert "Notes: take with food" in rows
        # Only the record heading remains a standalone paragraph
        assert [el for el in story if isinstance(el, Paragraph)][0].style.name == (
            "SubsectionHeader"
        )
        assert len([el for el in story if isinstance(el, Paragraph)]) == 1

    def test_record_with_only_a_name_has_no_empty_table(self, gen):
        story = gen._format_single_medication({"medication_name": "Aspirin"})
        assert _tables(story) == []

    def test_tags_list_is_joined_into_a_row(self, gen):
        story = gen._format_single_condition(
            {"condition_name": "Asthma", "tags": ["a", "b"]}
        )
        assert "Tags: a, b" in story_texts(_tables(story))

    def test_lab_components_are_a_columnar_table(self, gen):
        story = gen._format_lab_results(
            [
                {
                    "test_name": "CBC",
                    "ordered_date": "2024-01-02",
                    "test_components": [
                        {
                            "test_name": "Hemoglobin",
                            "value": 9.1,
                            "unit": "g/dL",
                            "status": "low",
                            "reference_range": "12-16",
                        },
                        {"test_name": "WBC", "value": 6, "reference_range": ""},
                    ],
                }
            ]
        )
        components = _tables(story)[0]
        assert len(components._cellvalues) == 3  # heading + 2 components
        assert all(len(row) == 3 for row in components._cellvalues)
        heading, hemoglobin, wbc = story_texts([components])
        assert "Result" in heading
        assert "Hemoglobin" in hemoglobin and "12-16" in hemoglobin
        assert "<font color='red'>9.1 g/dL (LOW)</font>" in hemoglobin
        assert "WBC" in wbc

    def test_lab_without_components_has_no_component_table(self, gen):
        story = gen._format_lab_results(
            [{"test_name": "CBC", "ordered_date": "2024-01-02", "status": "completed"}]
        )
        tables = _tables(story)
        assert len(tables) == 1 and all(len(r) == 2 for r in tables[0]._cellvalues)

    def test_family_history_conditions_shown_in_one_row(self, gen):
        story = gen._format_family_history(
            [
                {
                    "name": "Dad",
                    "conditions": [
                        {"condition_name": "MI", "diagnosis_age": 55},
                        {"condition_name": "HTN"},
                    ],
                }
            ]
        )
        text = " ".join(story_texts(story))
        assert "MI" in text and "HTN" in text and "Diagnosed at age 55" in text


class TestHeadings:
    def test_group_header_is_a_tracked_header_style(self, gen):
        header = gen._group_header("Active Medications")
        assert gen._is_header(header)

    def test_section_header_band_is_filled(self, gen):
        assert gen.styles["SectionHeader"].backColor is not None

    def test_category_section_starts_with_section_header(self, gen):
        story = gen._create_category_section(
            "medications", [{"medication_name": "Aspirin", "status": "active"}]
        )
        assert story[0].style.name == "SectionHeader"

    def test_headers_stay_with_the_table_that_follows(self, gen):
        story = gen._keep_headers_with_body(
            gen._format_single_condition({"condition_name": "Asthma", "notes": "n"})
        )
        assert type(story[0]).__name__ == "CondPageBreak"


class TestRecordCountLabel:
    @pytest.mark.parametrize(
        "lang,count,expected",
        [
            ("en", 1, "1 record"),
            ("en", 2, "2 records"),
            ("en", 0, "0 records"),
            ("de", 1, "1 Eintrag"),
            ("de", 3, "3 Einträge"),
            ("ru", 1, "1 запись"),
            ("zh", 1, "1 条记录"),
            ("th", 1, "1 รายการ"),
        ],
    )
    def test_singular_only_for_one(self, lang, count, expected):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator(lang, "mdy")
        assert gen._record_count_label(count) == expected

    def test_section_header_uses_singular(self, gen):
        story = gen._create_category_section("family_history", [{"name": "Dad"}])
        assert "(1 record)" in story[0].text


class TestDistinctLabels:
    def _labels(self, gen, story):
        return [row.split(": ", 1)[0] for row in story_texts(_tables(story))]

    @pytest.mark.parametrize("lang", ["en", "de", "th", "zh"])
    def test_emergency_contact_phones_are_distinguishable(self, lang):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator(lang, "mdy")
        story = gen._format_emergency_contacts(
            [{"name": "Jane", "phone_number": "1", "secondary_phone": "2"}]
        )
        labels = self._labels(gen, story)
        assert len(labels) == 2 and len(set(labels)) == 2

    @pytest.mark.parametrize("lang", ["en", "de", "th", "zh"])
    def test_insurance_rows_have_unique_labels(self, lang):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator(lang, "mdy")
        story = gen._format_single_insurance(
            {
                "company_name": "Acme",
                "employer_group": "E1",
                "group_number": "G1",
                "member_name": "Pat",
                "policy_holder_name": "Sam",
            }
        )
        labels = self._labels(gen, story)
        assert len(labels) == 4 and len(set(labels)) == 4
