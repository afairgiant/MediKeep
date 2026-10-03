"""
Tests for symptom episodes in custom report PDFs.

Covers the generator's rendering of a symptom's occurrences and the service
attaching those occurrences to the selected symptom records.
"""

import asyncio
from datetime import date, time, timedelta

import pytest
from sqlalchemy import JSON, Date, Integer, Time

from app.crud.symptom import symptom_occurrence, symptom_parent
from app.models.models import SymptomOccurrence
from app.schemas.symptom import SymptomCreate, SymptomOccurrenceCreate
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.custom_report_service import CustomReportService
from app.services.report_translations import get_translator

# Columns a report reader has no use for
NOT_REPORTED = {"id", "symptom_id", "time_of_day", "created_at", "updated_at"}
ENUM_VALUES = {
    "severity": ("severe", "Severe"),
    "impact_level": ("no_impact", "No Impact"),
}


@pytest.fixture
def gen():
    g = CustomReportPDFGenerator()
    g.translator = get_translator("en", "mdy")
    return g


def _render(gen, extra) -> str:
    record = {"symptom_name": "Migraine", "status": "active", **extra}
    story = gen._format_symptoms([record])
    return " ".join(str(el.text) for el in story if hasattr(el, "text"))


def _render_episodes(gen, *occurrences) -> str:
    return _render(gen, {"occurrences": list(occurrences)})


class TestSymptomEpisodeRendering:
    def test_every_occurrence_column_is_reported(self, gen):
        occurrence, expected = {}, []
        columns = [
            c for c in SymptomOccurrence.__table__.columns if c.name not in NOT_REPORTED
        ]
        for index, column in enumerate(columns, start=1):
            if isinstance(column.type, Date):
                occurrence[column.name] = date(2026, 1, index)
                expected.append(f"01/{index:02d}/2026")
            elif isinstance(column.type, Time):
                occurrence[column.name] = time(index, 0)
                expected.append(f"{index:02d}:00")
            elif isinstance(column.type, JSON):
                occurrence[column.name] = [f"value-of-{column.name}"]
                expected.append(f"value-of-{column.name}")
            elif isinstance(column.type, Integer):
                occurrence[column.name] = index
                expected.append(f"{index}/10")
            elif column.name in ENUM_VALUES:
                occurrence[column.name], label = ENUM_VALUES[column.name]
                expected.append(label)
            else:
                occurrence[column.name] = f"value-of-{column.name}"
                expected.append(f"value-of-{column.name}")

        text = _render_episodes(gen, occurrence)

        for value in expected:
            assert value in text

    def test_rows_are_labelled(self, gen):
        text = _render_episodes(
            gen,
            {
                "occurrence_date": date(2026, 3, 1),
                "occurrence_time": time(14, 30),
                "severity": "severe",
                "pain_scale": 8,
                "impact_level": "no_impact",
                "triggers": ["Stress", "Caffeine"],
                "relief_methods": ["Rest"],
                "associated_symptoms": ["Nausea", "Dizziness"],
                "resolved_date": date(2026, 3, 2),
                "resolved_time": time(9, 5),
                "resolution_notes": "Faded after sleep",
            },
        )

        for expected in (
            "Episodes",
            "03/01/2026</b> 14:30",
            "Severity: Severe",
            "Pain Scale: 8/10",
            "Impact: No Impact",
            "Triggers: Stress, Caffeine",
            "Relief Methods: Rest",
            "Associated Symptoms: Nausea, Dizziness",
            "Resolved: 03/02/2026 09:05",
            "Resolution Notes: Faded after sleep",
        ):
            assert expected in text

    def test_episodes_keep_given_order(self, gen):
        text = _render_episodes(
            gen,
            {"occurrence_date": date(2026, 3, 1), "severity": "mild"},
            {"occurrence_date": date(2025, 1, 1), "severity": "severe"},
        )

        assert text.index("03/01/2026") < text.index("01/01/2025")

    def test_minimal_episode_omits_empty_fields(self, gen):
        text = _render_episodes(
            gen,
            {
                "occurrence_date": date(2026, 3, 1),
                "severity": "mild",
                "pain_scale": None,
                "triggers": [],
                "relief_methods": None,
                "associated_symptoms": [],
                "resolved_date": None,
                "notes": None,
            },
        )

        assert "Severity: Mild" in text
        for absent in ("Pain Scale", "Triggers", "Relief", "Associated", "Resolved:"):
            assert absent not in text

    def test_pain_scale_zero_is_shown(self, gen):
        text = _render_episodes(
            gen,
            {"occurrence_date": date(2026, 3, 1), "severity": "none", "pain_scale": 0},
        )

        assert "Pain Scale: 0/10" in text

    def test_time_given_as_string(self, gen):
        text = _render_episodes(
            gen,
            {
                "occurrence_date": "2026-03-01",
                "occurrence_time": "14:30:00",
                "severity": "mild",
            },
        )

        assert "14:30" in text

    @pytest.mark.parametrize("extra", [{}, {"occurrences": []}, {"occurrences": None}])
    def test_symptom_without_episodes_has_no_episode_section(self, gen, extra):
        text = _render(gen, extra)

        assert "Migraine" in text
        assert "Episodes" not in text


class TestSymptomRecordsIncludeOccurrences:
    @pytest.fixture
    def symptom(self, db_session, test_patient):
        return symptom_parent.create(
            db_session,
            obj_in=SymptomCreate(
                patient_id=test_patient.id,
                symptom_name="Migraine",
                status="active",
                first_occurrence_date=date.today() - timedelta(days=30),
            ),
        )

    @staticmethod
    def _occurrences(db_session, symptom):
        records = asyncio.run(
            CustomReportService(db_session)._get_selected_records(
                symptom.patient_id, "symptoms", [symptom.id]
            )
        )
        assert len(records) == 1
        return records[0]["occurrences"]

    def test_occurrences_attached_newest_first(self, db_session, symptom):
        for days_ago, associated in ((10, ["Nausea"]), (1, ["Dizziness"])):
            symptom_occurrence.create(
                db_session,
                obj_in=SymptomOccurrenceCreate(
                    symptom_id=symptom.id,
                    occurrence_date=date.today() - timedelta(days=days_ago),
                    severity="moderate",
                    associated_symptoms=associated,
                ),
            )

        occurrences = self._occurrences(db_session, symptom)

        assert [o["associated_symptoms"] for o in occurrences] == [
            ["Dizziness"],
            ["Nausea"],
        ]

    def test_symptom_without_occurrences_gets_empty_list(self, db_session, symptom):
        assert self._occurrences(db_session, symptom) == []
