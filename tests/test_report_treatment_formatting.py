"""Treatment details print one item per line, not joined with '|'."""

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator
from tests.utils.report_story import story_texts

def _lines(record):
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator("en", "mdy")
    story = gen._format_treatments([record])
    return story_texts(story)


RECORD = {
    "treatment_name": "Physio",
    "treatment_type": "Therapy",
    "dosage": "30 min",
    "frequency": "Weekly",
    "practitioner_name": "Dr. Smith",
    "condition_name": "Back pain",
    "start_date": "2024-01-01",
    "end_date": "2024-02-01",
    "status": "completed",
    "treatment_category": "Rehab",
    "location": "Clinic",
}


def test_detail_items_on_separate_lines():
    lines = _lines(RECORD)
    detail_lines = lines[1:]
    assert not any("|" in line for line in detail_lines)
    for label in ("Practitioner", "Period", "Status", "Type", "Location"):
        matching = [line for line in detail_lines if f"{label}:" in line]
        assert len(matching) == 1
    # Each label sits on its own line
    assert not any(
        "Practitioner:" in line and "Back pain" in line for line in detail_lines
    )
    assert any("Dr. Smith" in line for line in detail_lines)
    assert any("Back pain" in line for line in detail_lines)


def test_single_item_still_printed():
    lines = _lines({"treatment_name": "X", "practitioner_name": "Dr. Who"})
    assert any("Dr. Who" in line for line in lines)
