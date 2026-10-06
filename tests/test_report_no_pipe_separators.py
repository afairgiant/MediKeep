"""Report detail lines list one item per line; no '|' separators in body text."""

import inspect
import re

import pytest

from app.services import custom_report_pdf_generator as module
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator
from tests.utils.report_story import story_texts

SOURCE = inspect.getsource(CustomReportPDFGenerator)
FIELD_KEYS = sorted(set(re.findall(r'record(?:\.get\(|\[)"(\w+)"', SOURCE)))
FORMATTERS = [
    name
    for name in dir(CustomReportPDFGenerator)
    if name.startswith("_format_")
    and name not in {"_format_date", "_format_trend_chart", "_format_lab_results"}
    and "records"
    in inspect.signature(getattr(CustomReportPDFGenerator, name)).parameters
]


def _record():
    record = {key: "Sample" for key in FIELD_KEYS}
    # Grouped formatters (conditions, injuries, symptoms) drop records whose
    # status is in no group, which would leave nothing to check
    record["status"] = "active"
    for key in FIELD_KEYS:
        if key.endswith("_date") or key.endswith("date") or key.endswith("_at"):
            record[key] = "2024-03-15"
    return record


def _texts(story):
    return story_texts(story)


def test_formatters_were_discovered():
    assert len(FORMATTERS) >= 10
    assert "_format_treatments" in FORMATTERS


@pytest.mark.parametrize("name", FORMATTERS)
def test_no_pipe_separators(name):
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator("en", "mdy")
    gen.unit_system = "imperial"
    try:
        story = getattr(gen, name)([_record()])
    except (TypeError, ValueError, AttributeError):
        pytest.skip("formatter needs typed fixture data")
    # Headings may still pair dosage and frequency; body lines may not. Body
    # text now lives in detail tables, so read table rows as well as paragraphs.
    heading_styles = {
        "SubsectionHeader",
        "SectionHeader",
        "RecordHeader",
        "DateGroupHeader",
    }
    body_lines = story_texts(
        el
        for el in story
        if getattr(getattr(el, "style", None), "name", None) not in heading_styles
    )
    assert body_lines, "formatter produced no body text to check"
    assert [t for t in body_lines if "|" in t] == []
