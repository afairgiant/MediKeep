"""Markdown notes -> ReportLab markup and plain text."""

import json
import re
import time
from pathlib import Path

import pytest
from reportlab.platypus import Paragraph

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.utils.notes_markdown import notes_to_plain_text, notes_to_reportlab_markup

CASES = json.loads(
    (Path(__file__).parent.parent / "fixtures" / "markdown_notes_cases.json").read_text(
        "utf-8"
    )
)["cases"]

ALLOWED_TAGS = {"b", "i", "u", "strike", "font", "a", "br"}
TAG = re.compile(r"</?([a-zA-Z]+)([^>]*)>")


@pytest.fixture(scope="module")
def body_style():
    return CustomReportPDFGenerator().styles["DetailValue"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_fixture_case(case, body_style):
    markup = notes_to_reportlab_markup(case["input"])
    assert markup == case["pdf"]
    Paragraph(markup, body_style)
    for name, attrs in TAG.findall(markup):
        assert name in ALLOWED_TAGS
        if name == "a" and attrs.strip():
            assert re.fullmatch(r' href="(https?://|mailto:)[^"<>]*"', attrs)
        if name == "font" and attrs.strip():
            assert re.fullmatch(r' size="\+[1-3]"', attrs)


class TestRendering:
    def test_formatting_symbols_do_not_reach_the_pdf(self, body_style):
        note = "**Plan**\n- rest\n- [x] fluids\n# Done"
        text = Paragraph(notes_to_reportlab_markup(note), body_style).getPlainText()
        assert "**" not in text and "# " not in text and "- " not in text

    def test_list_item_with_two_paragraphs_indents_the_second(self):
        markup = notes_to_reportlab_markup("- first\n\n  second")
        assert markup == "&bull; first<br/>" + "&nbsp;" * 4 + "second"

    @pytest.mark.parametrize(
        "note",
        [
            "*" * 5000,
            "[" * 5000,
            "> " * 2500,
            "- " * 2500,
            "**a " * 1250,
            "`" * 5000,
            "\n" * 5000,
        ],
    )
    def test_adversarial_input_is_fast(self, note, body_style):
        start = time.perf_counter()
        Paragraph(notes_to_reportlab_markup(note), body_style)
        assert time.perf_counter() - start < 2


class TestPlainText:
    def test_none_and_blank(self):
        assert notes_to_plain_text(None) == ""
        assert notes_to_plain_text("  \n ") == ""

    def test_strips_formatting_and_joins_lines(self):
        note = (
            "# Fall\n**Slipped** on *wet* stairs\n\n- [x] iced\n- [link](https://e.com)"
        )
        assert notes_to_plain_text(note) == "Fall Slipped on wet stairs iced link"

    def test_markup_stays_literal(self):
        assert notes_to_plain_text("<b>x</b> & y") == "<b>x</b> & y"
