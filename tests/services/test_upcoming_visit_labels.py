"""Future-dated visits are labelled as upcoming in exports and custom reports."""

from datetime import date, timedelta
from unittest.mock import patch

import pytest

from app.services import custom_report_pdf_generator as report_module
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.export_service import ExportService
from app.services.report_translations import get_translator
from tests.utils.report_story import export_card_rows, story_texts

TODAY = date(2026, 11, 15)


@pytest.fixture(autouse=True)
def fixed_today():
    with patch.object(report_module, "get_facility_today", return_value=TODAY):
        yield


class TestCustomReportEncounters:
    def _header_lines(self, records):
        story = CustomReportPDFGenerator()._format_encounters(records)
        return [line for line in story_texts(story) if line.startswith("<b>")]

    def test_upcoming_visit_header_is_labelled(self):
        lines = self._header_lines([{"reason": "Checkup", "date": "2026-12-01"}])
        assert lines[0].endswith(f"[{get_translator('en').text('upcoming')}]")

    def test_past_visit_header_is_not_labelled(self):
        lines = self._header_lines([{"reason": "Checkup", "date": "2026-11-01"}])
        assert "[" not in lines[0]


class TestQuickReferenceSummary:
    def _texts(self, encounters):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator("en", "ymd")
        story = gen._create_quick_reference_summary(
            {"total_records": 1}, {"encounters": encounters}
        )
        return " ".join(story_texts(story))

    def test_last_visit_is_newest_past_visit_regardless_of_order(self):
        texts = self._texts(
            [
                {"id": 1, "date": "2024-01-05"},
                {"id": 2, "date": "2026-12-01"},
                {"id": 3, "date": "2026-11-01"},
            ]
        )
        t = get_translator("en", "ymd")
        assert f"{t.text('last_visit')}:</b> {t.format_date('2026-11-01')}" in texts

    def test_recent_visits_leave_out_upcoming(self):
        texts = self._texts([{"date": "2026-12-01"}, {"date": "2027-01-01"}])
        t = get_translator("en", "ymd")
        assert f"{t.text('recent_visits')}:</b> 0" in texts
        assert f"{t.text('last_visit')}:</b> {t.text('not_recorded')}" in texts


class TestExportEncounters:
    def test_upcoming_only_shown_on_future_visit_cards(self):
        upcoming = dict(
            export_card_rows("encounters", {"reason": "A", "upcoming": True}, "en")
        )
        past = dict(
            export_card_rows("encounters", {"reason": "B", "upcoming": False}, "en")
        )
        assert upcoming["Upcoming:"] == "Yes"
        assert "Upcoming:" not in past

    def test_upcoming_label_is_translated(self):
        rows = dict(
            export_card_rows("encounters", {"reason": "A", "upcoming": True}, "de")
        )
        t = get_translator("de")
        assert rows[f"{t.field('upcoming')}:"] == t.text("yes")

    @pytest.mark.parametrize("value, expected", [(True, "Yes"), (False, "No")])
    def test_csv_value(self, value, expected):
        service = ExportService.__new__(ExportService)
        assert service._format_csv_value("upcoming", value) == expected


class TestExportEncountersQuery:
    def test_flag_set_from_facility_today(self, db_session, test_patient):
        from app.models.models import Encounter

        for reason, offset in [("Past", -1), ("Today", 0), ("Upcoming", 1)]:
            db_session.add(
                Encounter(
                    patient_id=test_patient.id,
                    reason=reason,
                    date=TODAY + timedelta(days=offset),
                )
            )
        db_session.commit()

        with patch(
            "app.services.export_service.get_facility_today", return_value=TODAY
        ):
            rows = ExportService(db_session)._export_encounters(
                test_patient, None, None
            )

        flags = {row["reason"]: row["upcoming"] for row in rows}
        assert flags == {"Past": False, "Today": False, "Upcoming": True}
