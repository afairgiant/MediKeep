"""Tests that user-supplied text cannot inject ReportLab Paragraph markup.

ReportLab's Paragraph parses <b>, <a href>, <img>, <font>... so record data must
be escaped before formatting. The report data is escaped once in generate_pdf;
plain-string table cells then undo the escaping so they show literal text.
"""

import asyncio

import pytest
from reportlab.platypus import Paragraph

from app.services.custom_report_pdf_generator import (
    CustomReportPDFGenerator,
    _PlainTextTable,
    escape_markup_values,
)
from app.services.report_translations import get_translator

HOSTILE = [
    "<b>Bold</b>",
    "<a href='https://evil.example'>click</a>",
    "<img src='https://evil.example/x.png' width='10' height='10'/>",
    "<font size='500'>HUGE</font>",
    "Smith & Sons <5 mg > 3",
    "&amp; &lt; already-escaped &#65;",
]


class TestEscapeMarkupValues:
    def test_escapes_markup_characters(self):
        assert escape_markup_values("<b>A & B</b>") == "&lt;b&gt;A &amp; B&lt;/b&gt;"

    def test_recurses_into_dicts_lists_and_tuples(self):
        data = {"a": ["<x>", ("&", 1)], "b": {"c": "<y>"}}
        assert escape_markup_values(data) == {
            "a": ["&lt;x&gt;", ("&amp;", 1)],
            "b": {"c": "&lt;y&gt;"},
        }

    def test_non_strings_and_keys_are_untouched(self):
        raw = b"<png>"
        data = {"<key>": None, "n": 5, "f": 1.5, "t": True, "bytes": raw}
        result = escape_markup_values(data)
        assert result == data
        assert result["bytes"] is raw

    def test_does_not_mutate_the_input(self):
        data = {"name": "<b>x</b>", "list": ["&"]}
        escape_markup_values(data)
        assert data == {"name": "<b>x</b>", "list": ["&"]}

    @pytest.mark.parametrize("text", HOSTILE)
    def test_escaped_text_displays_literally_in_a_paragraph(self, text):
        generator = CustomReportPDFGenerator()
        paragraph = Paragraph(
            escape_markup_values(text), generator.styles["CustomBody"]
        )
        assert paragraph.getPlainText() == text


class TestPlainTextTable:
    def test_string_cells_are_unescaped(self):
        table = _PlainTextTable([["Name:", escape_markup_values("A & B <5")]])
        assert table._cellvalues[0] == ["Name:", "A & B <5"]

    @pytest.mark.parametrize("text", HOSTILE)
    def test_escape_then_table_round_trips_exactly(self, text):
        table = _PlainTextTable([["k", escape_markup_values(text)]])
        assert table._cellvalues[0][1] == text

    def test_non_string_cells_are_left_alone(self):
        generator = CustomReportPDFGenerator()
        paragraph = Paragraph("&lt;b&gt;", generator.styles["CustomBody"])
        table = _PlainTextTable([[paragraph, 5]])
        assert table._cellvalues[0][0] is paragraph
        assert table._cellvalues[0][1] == 5


class TestPlainTextTableSplit:
    """ReportLab rebuilds split fragments via self.__class__(..., normalizedData=1);
    cells that were already decoded must not be decoded a second time."""

    def _long_table(self, text, rows=30):
        escaped = escape_markup_values(text)
        return _PlainTextTable([["Name:", escaped] for _ in range(rows)])

    @pytest.mark.parametrize("text", ["&amp;", "&lt;b&gt;", "A &amp; B", "&#65;"])
    def test_entity_text_is_unchanged_after_a_split(self, text):
        table = self._long_table(text)
        table.wrap(400, 1000)
        parts = table.split(400, 80)

        assert len(parts) > 1
        for part in parts:
            for row in part._cellvalues:
                assert row[1] == text

    def test_fragments_built_with_normalized_data_are_not_decoded_again(self):
        table = _PlainTextTable([["k", "&amp;"]], normalizedData=1)
        assert table._cellvalues[0][1] == "&amp;"

    def test_a_split_table_in_a_real_document_keeps_the_text(self):
        import io

        from reportlab.platypus import SimpleDocTemplate

        table = self._long_table("A &amp; B", rows=120)
        SimpleDocTemplate(io.BytesIO()).build([table])
        # The original table is split into fragments while building; the source
        # cell text must be what the user typed, not decoded twice.
        assert table._cellvalues[0][1] == "A &amp; B"


class TestGeneratePdfEscapesReportData:
    def test_records_reach_the_formatters_escaped(self, monkeypatch):
        gen = CustomReportPDFGenerator()
        seen = {}

        def fake_section(category, records):
            seen[category] = records
            return []

        monkeypatch.setattr(gen, "_create_category_section", fake_section)
        asyncio.run(
            gen.generate_pdf(
                {
                    "report_title": "<b>Title</b>",
                    "data": {"pharmacies": [{"name": "<b>CVS</b> & Co", "id": 3}]},
                }
            )
        )

        assert seen["pharmacies"] == [
            {"name": "&lt;b&gt;CVS&lt;/b&gt; &amp; Co", "id": 3}
        ]

    def test_the_callers_report_data_is_not_modified(self):
        gen = CustomReportPDFGenerator()
        report_data = {
            "report_title": "<b>T</b>",
            "data": {"pharmacies": [{"name": "<i>"}]},
        }
        asyncio.run(gen.generate_pdf(report_data))
        assert report_data == {
            "report_title": "<b>T</b>",
            "data": {"pharmacies": [{"name": "<i>"}]},
        }

    @pytest.mark.parametrize("text", HOSTILE)
    def test_hostile_text_everywhere_still_builds_a_pdf(self, text):
        gen = CustomReportPDFGenerator()
        record = {"name": text, "notes": text, "street_address": text, "city": text}
        pdf = asyncio.run(
            gen.generate_pdf(
                {
                    "report_title": text,
                    "patient": {
                        "id": None,
                        "first_name": text,
                        "last_name": text,
                        "gender": text,
                        "blood_type": text,
                        "address": text,
                    },
                    "include_patient_info": True,
                    "data": {
                        "pharmacies": [record],
                        "practitioners": [{**record, "specialty": text}],
                        "allergies": [
                            {"allergen": text, "severity": "mild", "notes": text}
                        ],
                        "insurance": [
                            {
                                "company_name": text,
                                "coverage_details": {"plan_type": text},
                                "contact_info": {"website_url": text},
                            }
                        ],
                    },
                }
            )
        )
        assert pdf.startswith(b"%PDF")
