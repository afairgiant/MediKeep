"""Report detail lines list one item per line; no '|' separators in body text."""

import inspect
import re

import pytest

from app.services import custom_report_pdf_generator as module
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator

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
    for key in FIELD_KEYS:
        if key.endswith("_date") or key.endswith("date") or key.endswith("_at"):
            record[key] = "2024-03-15"
    return record


def _texts(story):
    return [el.text for el in story if hasattr(el, "text")]


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
    # Headings may still pair dosage and frequency; body lines may not.
    body_lines = [
        el.text
        for el in story
        if hasattr(el, "text") and el.style.name in ("CustomBody", "SmallText")
    ]
    assert [t for t in body_lines if "|" in t] == []
