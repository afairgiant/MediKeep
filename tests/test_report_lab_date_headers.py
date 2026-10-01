"""Tests for the date group headings in the lab results section of the report."""

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import SUPPORTED_LANGUAGES, get_translator


def _generator(lang="en", date_format="mdy"):
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator(lang, date_format)
    return gen


def _lab(name, ordered_date):
    return {"test_name": name, "ordered_date": ordered_date, "test_components": []}


def _date_headers(story):
    return [
        el
        for el in story
        if hasattr(el, "style") and el.style.name == "DateGroupHeader"
    ]


class TestDateHeaderStyle:
    def test_date_header_is_more_prominent_than_test_names(self):
        styles = _generator().styles
        date_style = styles["DateGroupHeader"]
        test_name_style = styles["SubsectionHeader"]

        assert date_style.fontSize > test_name_style.fontSize
        assert (
            "Bold" in date_style.fontName
            or date_style.fontName == test_name_style.fontName
        )
        assert date_style.backColor is not None
        assert date_style.spaceBefore >= test_name_style.spaceBefore

    def test_date_header_is_kept_with_following_tests(self):
        assert "DateGroupHeader" in CustomReportPDFGenerator.HEADER_STYLE_NAMES


class TestDateHeaderOrderAndText:
    def test_newest_first_regardless_of_display_format(self):
        # As dd/mm/yyyy strings these sort wrongly ("31/12/2025" > "05/01/2026").
        gen = _generator("en", "dmy")
        story = gen._format_lab_results(
            [
                _lab("A", "2025-12-31"),
                _lab("B", "2026-01-05"),
                _lab("C", "2024-03-09"),
            ]
        )
        texts = [h.text for h in _date_headers(story)]
        assert texts == [
            "Tests from 05/01/2026",
            "Tests from 31/12/2025",
            "Tests from 09/03/2024",
        ]

    def test_same_day_results_share_one_header(self):
        story = _generator()._format_lab_results(
            [_lab("A", "2026-01-05"), _lab("B", "2026-01-05"), _lab("C", "2025-06-01")]
        )
        assert len(_date_headers(story)) == 2

    def test_undated_results_come_last_and_are_labelled(self):
        story = _generator()._format_lab_results(
            [_lab("A", None), _lab("B", "2026-01-05")]
        )
        texts = [h.text for h in _date_headers(story)]
        assert texts == ["Tests from 01/05/2026", "Tests from Undated"]

    def test_no_date_header_for_a_single_date(self):
        story = _generator()._format_lab_results(
            [_lab("A", "2026-01-05"), _lab("B", "2026-01-05")]
        )
        assert _date_headers(story) == []

    def test_header_comes_before_its_tests(self):
        story = _generator()._format_lab_results(
            [_lab("Newer", "2026-01-05"), _lab("Older", "2025-01-05")]
        )
        kinds = [el.style.name for el in story if hasattr(el, "style")]
        assert kinds.index("DateGroupHeader") < kinds.index("SubsectionHeader")

    def test_french_heading_is_translated(self):
        story = _generator("fr", "dmy")._format_lab_results(
            [_lab("A", "2026-01-05"), _lab("B", "2025-01-05")]
        )
        assert _date_headers(story)[0].text == "Analyses du 05/01/2026"


@pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
def test_heading_strings_exist_in_every_language(lang):
    translator = get_translator(lang, "mdy")
    heading = translator.text("tests_from", date="X")
    assert "X" in heading and "_" not in heading
    assert "_" not in translator.text("undated")
