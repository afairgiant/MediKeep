"""
Tests for chronological and alphabetical sorting in the PDF report generator.

Covers:
- _sort_records helper (date DESC, name ASC tiebreaker)
- _format_medications sort order (within status groups)
- _format_conditions sort order (within status groups)
- _format_treatments sort order
- _format_symptoms sort order (within status groups)
- _format_injuries sort order (within status groups)
- _format_vitals sort order
- _format_practitioners alphabetical sort
- _format_pharmacies alphabetical sort
- _format_emergency_contacts alphabetical sort
- _format_family_history alphabetical sort
- Associated-condition names rendered in medication records
"""

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(story) -> str:
    """Return all text from a ReportLab story as one concatenated string."""
    parts = []
    for element in story:
        if hasattr(element, "text"):
            parts.append(str(element.text))
        if hasattr(element, "_cellvalues"):
            for row in element._cellvalues:
                for cell in row:
                    parts.append(str(cell))
    return " ".join(parts)


def _ordered(text: str, *names: str) -> bool:
    """Return True if every name appears in text in the given left-to-right order."""
    pos = -1
    for name in names:
        found = text.find(name, pos + 1)
        if found == -1:
            return False
        pos = found
    return True


@pytest.fixture
def gen():
    g = CustomReportPDFGenerator()
    g.translator = get_translator("en", "mdy")
    return g


# ---------------------------------------------------------------------------
# _sort_records
# ---------------------------------------------------------------------------

class TestSortRecords:
    """Unit tests for the _sort_records static helper."""

    def test_date_descending(self):
        records = [
            {"date": "2022-01-01", "name": "A"},
            {"date": "2024-06-15", "name": "B"},
            {"date": "2023-03-10", "name": "C"},
        ]
        result = CustomReportPDFGenerator._sort_records(records, "date", "name")
        assert [r["name"] for r in result] == ["B", "C", "A"]

    def test_name_ascending_tiebreaker(self):
        records = [
            {"date": "2024-01-01", "name": "Zebra"},
            {"date": "2024-01-01", "name": "Alpha"},
            {"date": "2024-01-01", "name": "Mango"},
        ]
        result = CustomReportPDFGenerator._sort_records(records, "date", "name")
        assert [r["name"] for r in result] == ["Alpha", "Mango", "Zebra"]

    def test_records_without_date_sort_last(self):
        records = [
            {"date": None, "name": "NullDate"},
            {"date": "2023-05-01", "name": "HasDate"},
        ]
        result = CustomReportPDFGenerator._sort_records(records, "date", "name")
        assert result[0]["name"] == "HasDate"
        assert result[1]["name"] == "NullDate"

    def test_missing_date_key_sorts_last(self):
        records = [
            {"name": "NoKey"},
            {"date": "2023-01-01", "name": "WithKey"},
        ]
        result = CustomReportPDFGenerator._sort_records(records, "date", "name")
        assert result[0]["name"] == "WithKey"
        assert result[1]["name"] == "NoKey"

    def test_empty_list_returns_empty(self):
        assert CustomReportPDFGenerator._sort_records([], "date", "name") == []

    def test_single_record_unchanged(self):
        records = [{"date": "2024-01-01", "name": "Only"}]
        result = CustomReportPDFGenerator._sort_records(records, "date", "name")
        assert result == records

    def test_no_name_field_does_not_raise(self):
        records = [
            {"date": "2024-03-01"},
            {"date": "2022-01-01"},
        ]
        result = CustomReportPDFGenerator._sort_records(records, "date")
        assert result[0]["date"] == "2024-03-01"

    def test_case_insensitive_name_sort(self):
        records = [
            {"date": "2024-01-01", "name": "banana"},
            {"date": "2024-01-01", "name": "Apple"},
            {"date": "2024-01-01", "name": "cherry"},
        ]
        result = CustomReportPDFGenerator._sort_records(records, "date", "name")
        assert [r["name"] for r in result] == ["Apple", "banana", "cherry"]


# ---------------------------------------------------------------------------
# _format_medications
# ---------------------------------------------------------------------------

class TestMedicationSorting:

    def test_active_sorted_by_start_date_desc(self, gen):
        records = [
            {"medication_name": "OldMed", "status": "active", "effective_period_start": "2020-01-01"},
            {"medication_name": "NewMed", "status": "active", "effective_period_start": "2024-06-01"},
        ]
        story = gen._format_medications(records)
        text = _extract_text(story)
        assert _ordered(text, "NewMed", "OldMed")

    def test_inactive_sorted_by_start_date_desc(self, gen):
        records = [
            {"medication_name": "EarlyMed", "status": "discontinued", "effective_period_start": "2019-01-01"},
            {"medication_name": "LateMed", "status": "discontinued", "effective_period_start": "2023-03-01"},
        ]
        story = gen._format_medications(records)
        text = _extract_text(story)
        assert _ordered(text, "LateMed", "EarlyMed")

    def test_name_tiebreaker_within_same_date(self, gen):
        records = [
            {"medication_name": "Zinc", "status": "active", "effective_period_start": "2024-01-01"},
            {"medication_name": "Aspirin", "status": "active", "effective_period_start": "2024-01-01"},
        ]
        story = gen._format_medications(records)
        text = _extract_text(story)
        assert _ordered(text, "Aspirin", "Zinc")

    def test_associated_conditions_rendered(self, gen):
        """Associated conditions should appear under 'For Conditions:'."""
        record = {
            "medication_name": "Metformin",
            "status": "active",
            "associated_conditions": [{"condition_name": "Type 2 Diabetes"}],
        }
        story = gen._format_medications([record])
        text = _extract_text(story)
        assert "Type 2 Diabetes" in text

    def test_multiple_associated_conditions_all_rendered(self, gen):
        record = {
            "medication_name": "Prednisone",
            "status": "active",
            "associated_conditions": [
                {"condition_name": "Rheumatoid Arthritis"},
                {"condition_name": "Asthma"},
            ],
        }
        story = gen._format_medications([record])
        text = _extract_text(story)
        assert "Rheumatoid Arthritis" in text
        assert "Asthma" in text

    def test_no_associated_conditions_no_label(self, gen):
        record = {"medication_name": "Vitamin D", "status": "active"}
        story = gen._format_medications([record])
        text = _extract_text(story)
        assert "For Conditions" not in text

    def test_active_before_inactive(self, gen):
        """Active medications should appear in the report before past medications."""
        records = [
            {"medication_name": "PastMed", "status": "discontinued"},
            {"medication_name": "ActiveMed", "status": "active"},
        ]
        story = gen._format_medications(records)
        text = _extract_text(story)
        assert _ordered(text, "ActiveMed", "PastMed")


# ---------------------------------------------------------------------------
# _format_conditions
# ---------------------------------------------------------------------------

class TestConditionSorting:

    def test_sorted_by_onset_date_desc(self, gen):
        records = [
            {"condition_name": "OldCondition", "status": "active", "onset_date": "2015-01-01"},
            {"condition_name": "NewCondition", "status": "active", "onset_date": "2023-06-15"},
        ]
        story = gen._format_conditions(records)
        text = _extract_text(story)
        assert _ordered(text, "NewCondition", "OldCondition")

    def test_resolved_sorted_by_onset_date_desc(self, gen):
        records = [
            {"condition_name": "EarlyResolved", "status": "resolved", "onset_date": "2010-01-01"},
            {"condition_name": "LateResolved", "status": "resolved", "onset_date": "2022-04-01"},
        ]
        story = gen._format_conditions(records)
        text = _extract_text(story)
        assert _ordered(text, "LateResolved", "EarlyResolved")

    def test_name_tiebreaker(self, gen):
        records = [
            {"condition_name": "Psoriasis", "status": "active", "onset_date": "2022-01-01"},
            {"condition_name": "Asthma", "status": "active", "onset_date": "2022-01-01"},
        ]
        story = gen._format_conditions(records)
        text = _extract_text(story)
        assert _ordered(text, "Asthma", "Psoriasis")

    def test_active_before_resolved(self, gen):
        records = [
            {"condition_name": "OldResolved", "status": "resolved", "onset_date": "2020-01-01"},
            {"condition_name": "CurrentActive", "status": "active", "onset_date": "2018-01-01"},
        ]
        story = gen._format_conditions(records)
        text = _extract_text(story)
        assert _ordered(text, "CurrentActive", "OldResolved")

    def test_recurrence_appears_in_active_bucket(self, gen):
        records = [
            {"condition_name": "RecurringGout", "status": "recurrence", "onset_date": "2023-01-01"},
            {"condition_name": "OldResolved", "status": "resolved", "onset_date": "2020-01-01"},
        ]
        story = gen._format_conditions(records)
        text = _extract_text(story)
        assert _ordered(text, "RecurringGout", "OldResolved")

    def test_relapse_appears_in_active_bucket(self, gen):
        records = [
            {"condition_name": "RelapsingMS", "status": "relapse", "onset_date": "2024-03-01"},
            {"condition_name": "OldResolved", "status": "resolved", "onset_date": "2015-06-01"},
        ]
        story = gen._format_conditions(records)
        text = _extract_text(story)
        assert _ordered(text, "RelapsingMS", "OldResolved")

    def test_recurrence_and_relapse_not_silently_dropped(self, gen):
        records = [
            {"condition_name": "RecurringGout", "status": "recurrence", "onset_date": "2023-01-01"},
            {"condition_name": "RelapsingMS", "status": "relapse", "onset_date": "2024-03-01"},
        ]
        story = gen._format_conditions(records)
        text = _extract_text(story)
        assert "RecurringGout" in text
        assert "RelapsingMS" in text


# ---------------------------------------------------------------------------
# _format_treatments
# ---------------------------------------------------------------------------

class TestTreatmentSorting:

    def test_sorted_by_start_date_desc(self, gen):
        records = [
            {"treatment_name": "FirstTreatment", "start_date": "2021-03-01"},
            {"treatment_name": "RecentTreatment", "start_date": "2024-09-01"},
        ]
        story = gen._format_treatments(records)
        text = _extract_text(story)
        assert _ordered(text, "RecentTreatment", "FirstTreatment")

    def test_name_tiebreaker(self, gen):
        records = [
            {"treatment_name": "Yoga Therapy", "start_date": "2023-01-01"},
            {"treatment_name": "Acupuncture", "start_date": "2023-01-01"},
        ]
        story = gen._format_treatments(records)
        text = _extract_text(story)
        assert _ordered(text, "Acupuncture", "Yoga Therapy")

    def test_no_date_sorts_last(self, gen):
        records = [
            {"treatment_name": "NoDatTreatment"},
            {"treatment_name": "DatedTreatment", "start_date": "2023-06-01"},
        ]
        story = gen._format_treatments(records)
        text = _extract_text(story)
        assert _ordered(text, "DatedTreatment", "NoDatTreatment")


# ---------------------------------------------------------------------------
# _format_symptoms
# ---------------------------------------------------------------------------

class TestSymptomSorting:

    def test_active_sorted_by_first_occurrence_desc(self, gen):
        records = [
            {"symptom_name": "OldSymptom", "status": "active", "first_occurrence_date": "2018-01-01"},
            {"symptom_name": "NewSymptom", "status": "active", "first_occurrence_date": "2024-01-01"},
        ]
        story = gen._format_symptoms(records)
        text = _extract_text(story)
        assert _ordered(text, "NewSymptom", "OldSymptom")

    def test_resolved_sorted_by_first_occurrence_desc(self, gen):
        records = [
            {"symptom_name": "EarlyResolved", "status": "resolved", "first_occurrence_date": "2010-01-01"},
            {"symptom_name": "LateResolved", "status": "resolved", "first_occurrence_date": "2023-01-01"},
        ]
        story = gen._format_symptoms(records)
        text = _extract_text(story)
        assert _ordered(text, "LateResolved", "EarlyResolved")

    def test_name_tiebreaker_active(self, gen):
        records = [
            {"symptom_name": "Nausea", "status": "active", "first_occurrence_date": "2024-01-01"},
            {"symptom_name": "Fatigue", "status": "active", "first_occurrence_date": "2024-01-01"},
        ]
        story = gen._format_symptoms(records)
        text = _extract_text(story)
        assert _ordered(text, "Fatigue", "Nausea")


# ---------------------------------------------------------------------------
# _format_injuries
# ---------------------------------------------------------------------------

class TestInjurySorting:

    def test_active_sorted_by_injury_date_desc(self, gen):
        records = [
            {"injury_name": "OldInjury", "status": "active", "date_of_injury": "2019-06-01"},
            {"injury_name": "RecentInjury", "status": "active", "date_of_injury": "2024-02-01"},
        ]
        story = gen._format_injuries(records)
        text = _extract_text(story)
        assert _ordered(text, "RecentInjury", "OldInjury")

    def test_healed_sorted_by_injury_date_desc(self, gen):
        records = [
            {"injury_name": "EarlyHealed", "status": "healed", "date_of_injury": "2012-01-01"},
            {"injury_name": "LaterHealed", "status": "healed", "date_of_injury": "2022-08-01"},
        ]
        story = gen._format_injuries(records)
        text = _extract_text(story)
        assert _ordered(text, "LaterHealed", "EarlyHealed")

    def test_name_tiebreaker(self, gen):
        records = [
            {"injury_name": "Wrist Sprain", "status": "active", "date_of_injury": "2024-03-01"},
            {"injury_name": "Ankle Sprain", "status": "active", "date_of_injury": "2024-03-01"},
        ]
        story = gen._format_injuries(records)
        text = _extract_text(story)
        assert _ordered(text, "Ankle Sprain", "Wrist Sprain")


# ---------------------------------------------------------------------------
# _format_vitals
# ---------------------------------------------------------------------------

class TestVitalsSorting:

    def test_sorted_by_recorded_date_desc(self, gen):
        records = [
            {"recorded_date": "2021-01-15", "heart_rate": 60},
            {"recorded_date": "2024-06-01", "heart_rate": 75},
        ]
        story = gen._format_vitals(records)
        text = _extract_text(story)
        pos_2024 = text.find("06/01/2024")
        pos_2021 = text.find("01/15/2021")
        assert pos_2024 < pos_2021

    def test_date_key_fallback(self, gen):
        records = [
            {"date": "2021-01-15", "heart_rate": 60},
            {"date": "2024-06-01", "heart_rate": 75},
        ]
        story = gen._format_vitals(records)
        text = _extract_text(story)
        assert "06/01/2024" in text
        assert "01/15/2021" in text


# ---------------------------------------------------------------------------
# Alphabetical sorting (no date field)
# ---------------------------------------------------------------------------

class TestAlphabeticalSorting:

    def test_practitioners_alphabetical(self, gen):
        records = [
            {"name": "Dr. Zara"},
            {"name": "Dr. Adams"},
            {"name": "Dr. Miller"},
        ]
        story = gen._format_practitioners(records)
        text = _extract_text(story)
        assert _ordered(text, "Dr. Adams", "Dr. Miller", "Dr. Zara")

    def test_pharmacies_alphabetical(self, gen):
        records = [
            {"name": "Walgreens"},
            {"name": "CVS"},
            {"name": "Rite Aid"},
        ]
        story = gen._format_pharmacies(records)
        text = _extract_text(story)
        assert _ordered(text, "CVS", "Rite Aid", "Walgreens")

    def test_emergency_contacts_alphabetical(self, gen):
        records = [
            {"name": "Susan"},
            {"name": "Alice"},
            {"name": "Robert"},
        ]
        story = gen._format_emergency_contacts(records)
        text = _extract_text(story)
        assert _ordered(text, "Alice", "Robert", "Susan")

    def test_family_history_alphabetical(self, gen):
        records = [
            {"name": "Uncle Tom"},
            {"name": "Aunt Beth"},
            {"name": "Grandpa Joe"},
        ]
        story = gen._format_family_history(records)
        text = _extract_text(story)
        assert _ordered(text, "Aunt Beth", "Grandpa Joe", "Uncle Tom")

    def test_alphabetical_case_insensitive(self, gen):
        """Sorting should be case-insensitive (lowercase after uppercase)."""
        records = [
            {"name": "zoe"},
            {"name": "Alice"},
            {"name": "bob"},
        ]
        story = gen._format_practitioners(records)
        text = _extract_text(story)
        assert _ordered(text, "Alice", "bob", "zoe")


# ---------------------------------------------------------------------------
# Emergency information section — status filter coverage
# ---------------------------------------------------------------------------

class TestEmergencyInformationSection:

    def _make_data(self, status: str, condition_name: str = "Test Condition") -> dict:
        return {
            "conditions": [{"condition_name": condition_name, "status": status}],
            "allergies": [],
            "medications": [],
        }

    def test_recurrence_included_in_emergency_summary(self, gen):
        data = self._make_data("recurrence", "Recurrent Cancer")
        story = gen._create_emergency_information_section(data)
        text = _extract_text(story)
        assert "Recurrent Cancer" in text

    def test_relapse_included_in_emergency_summary(self, gen):
        data = self._make_data("relapse", "Relapsing MS")
        story = gen._create_emergency_information_section(data)
        text = _extract_text(story)
        assert "Relapsing MS" in text
