"""Medical equipment dates must say which date they are."""

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import SUPPORTED_LANGUAGES, get_translator

RECORD = {
    "equipment_name": "Wheelchair",
    "prescribed_date": "2024-01-10",
    "last_service_date": "2024-02-20",
    "next_service_date": "2025-02-20",
}


def _lines(lang):
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator(lang, "ymd")
    gen.unit_system = "imperial"
    return [
        el.text for el in gen._format_medical_equipment([RECORD]) if hasattr(el, "text")
    ]


def test_english_labels_name_each_date():
    text = " ".join(_lines("en"))
    assert "Prescribed Date: 2024-01-10" in text
    assert "Last Service Date: 2024-02-20" in text
    assert "Next Service Date: 2025-02-20" in text


@pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
def test_each_date_has_a_distinct_localized_label(lang):
    translator = get_translator(lang, "ymd")
    labels = [
        translator.field(k)
        for k in ("prescribed_date", "last_service_date", "next_service_date")
    ]
    assert len(set(labels)) == 3
    assert not any("_" in label for label in labels)
