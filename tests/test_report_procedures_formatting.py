"""Tests for procedure formatting in the PDF report generator."""

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator


def _extract_paragraph_text(story) -> str:
    """Helper to extract all text content from ReportLab story elements."""
    texts = []
    for element in story:
        if hasattr(element, 'text'):
            texts.append(str(element.text))
        if hasattr(element, '_cellvalues'):
            for row in element._cellvalues:
                for cell in row:
                    texts.append(str(cell))
    return " ".join(texts)


class TestProceduresFormatting:
    """Test the _format_procedures method."""

    @pytest.fixture
    def generator(self):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator("en", "mdy")
        return gen

    @pytest.fixture
    def full_procedure_record(self):
        return {
            "procedure_name": "Appendectomy",
            "date": "2024-06-15",
            "procedure_code": "44950",
            "status": "completed",
            "outcome": "successful",
            "facility": "City General Hospital",
            "procedure_setting": "inpatient",
            "practitioner_name": "Dr. Jane Smith",
            "description": "Laparoscopic removal of inflamed appendix",
            "notes": "Patient tolerated procedure well",
            "anesthesia_type": "general",
            "anesthesia_notes": "No adverse reactions",
        }

    def test_practitioner_name_rendered(self, generator, full_procedure_record):
        """Practitioner name should appear in the output."""
        story = generator._format_procedures([full_procedure_record])
        all_text = _extract_paragraph_text(story)

        assert "Dr. Jane Smith" in all_text
        assert "performed by" in all_text.lower()

    def test_description_rendered(self, generator, full_procedure_record):
        """Description should appear in the output."""
        story = generator._format_procedures([full_procedure_record])
        all_text = _extract_paragraph_text(story)

        assert "Laparoscopic removal of inflamed appendix" in all_text
        assert "description" in all_text.lower()

    def test_status_and_outcome_rendered(self, generator, full_procedure_record):
        """Status and outcome should appear in the output."""
        story = generator._format_procedures([full_procedure_record])
        all_text = _extract_paragraph_text(story)

        assert "completed" in all_text
        assert "successful" in all_text

    def test_facility_rendered(self, generator, full_procedure_record):
        """Facility name should appear in the output."""
        story = generator._format_procedures([full_procedure_record])
        all_text = _extract_paragraph_text(story)

        assert "City General Hospital" in all_text

    def test_notes_rendered(self, generator, full_procedure_record):
        """Procedure notes should appear in the output."""
        story = generator._format_procedures([full_procedure_record])
        all_text = _extract_paragraph_text(story)

        assert "Patient tolerated procedure well" in all_text

    def test_no_practitioner_omitted(self, generator):
        """When practitioner_name is absent, the performed-by line should not appear."""
        record = {
            "procedure_name": "Biopsy",
            "date": "2024-01-10",
            "status": "completed",
        }
        story = generator._format_procedures([record])
        all_text = _extract_paragraph_text(story)

        assert "Performed by" not in all_text

    def test_no_description_omitted(self, generator):
        """When description is absent, the description line should not appear."""
        record = {
            "procedure_name": "Biopsy",
            "date": "2024-01-10",
            "status": "completed",
        }
        story = generator._format_procedures([record])
        all_text = _extract_paragraph_text(story)

        assert "Description:" not in all_text

    def test_performing_practitioner_key_ignored(self, generator):
        """Old 'performing_practitioner' key should NOT be rendered (field name was wrong)."""
        record = {
            "procedure_name": "Old Key Test",
            "date": "2024-01-10",
            "status": "completed",
            "performing_practitioner": "Dr. Ghost",
        }
        story = generator._format_procedures([record])
        all_text = _extract_paragraph_text(story)

        assert "Dr. Ghost" not in all_text

    def test_sorted_by_date_most_recent_first(self, generator):
        """Records should be sorted by date, most recent first."""
        records = [
            {"procedure_name": "First Procedure", "date": "2023-01-01", "status": "completed"},
            {"procedure_name": "Recent Procedure", "date": "2024-06-01", "status": "completed"},
        ]
        story = generator._format_procedures(records)
        all_text = _extract_paragraph_text(story)

        first_pos = all_text.find("First Procedure")
        recent_pos = all_text.find("Recent Procedure")
        assert recent_pos < first_pos

    def test_empty_records_returns_empty_story(self, generator):
        """Empty record list should produce an empty story."""
        story = generator._format_procedures([])
        assert story == []
