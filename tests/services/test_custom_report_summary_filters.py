"""
Parity tests: the SQL date filter used by the selection summary must agree with
the Python filter used by report generation and the count preview.
"""

from datetime import date, datetime

import pytest

from app.models.models import Condition, Vitals
from app.schemas.custom_reports import DateRange
from app.services.custom_report_service import (
    MAX_SUMMARY_RECORDS_PER_CATEGORY,
    CustomReportService,
)


def _condition(patient_id, onset, tags=None, name="c"):
    return Condition(
        patient_id=patient_id,
        diagnosis=name,
        status="active",
        onset_date=onset,
        tags=tags or [],
    )


RANGES = [
    DateRange(start_date=date(2023, 1, 1)),
    DateRange(end_date=date(2023, 12, 31)),
    DateRange(start_date=date(2023, 1, 1), end_date=date(2023, 12, 31)),
    DateRange(start_date=date(2023, 6, 1), end_date=date(2023, 6, 1)),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("date_range", RANGES)
async def test_conditions_sql_and_python_date_filters_agree(
    db_session, test_patient, date_range
):
    onsets = [
        date(2022, 12, 31),
        date(2023, 1, 1),
        date(2023, 6, 1),
        date(2023, 12, 31),
        date(2024, 1, 1),
        None,
    ]
    for i, onset in enumerate(onsets):
        db_session.add(_condition(test_patient.id, onset, name=f"c{i}"))
    db_session.commit()

    svc = CustomReportService(db_session)
    summary = await svc._get_category_summary(
        test_patient.id, "conditions", Condition, date_range, None
    )
    all_rows = (
        db_session.query(Condition)
        .filter(Condition.patient_id == test_patient.id)
        .all()
    )
    expected = svc._apply_report_filters(all_rows, "conditions", date_range, None)

    assert summary.count == len(expected)
    assert {r.id for r in summary.records} == {r.id for r in expected}


@pytest.mark.asyncio
async def test_datetime_column_includes_whole_end_day(db_session, test_patient):
    for hour in (0, 23):
        db_session.add(
            Vitals(
                patient_id=test_patient.id,
                recorded_date=datetime(2024, 3, 1, hour, 30),
            )
        )
    db_session.add(
        Vitals(patient_id=test_patient.id, recorded_date=datetime(2024, 3, 2, 0, 5))
    )
    db_session.commit()

    svc = CustomReportService(db_session)
    summary = await svc._get_category_summary(
        test_patient.id, "vitals", Vitals, DateRange(end_date=date(2024, 3, 1)), None
    )
    assert summary.count == 2


@pytest.mark.asyncio
async def test_tag_filter_combined_with_date(db_session, test_patient):
    db_session.add(_condition(test_patient.id, date(2024, 1, 1), ["fred"], "keep"))
    db_session.add(_condition(test_patient.id, date(2019, 1, 1), ["fred"], "old"))
    db_session.add(_condition(test_patient.id, date(2024, 1, 1), ["x"], "other"))
    db_session.commit()

    svc = CustomReportService(db_session)
    summary = await svc._get_category_summary(
        test_patient.id,
        "conditions",
        Condition,
        DateRange(start_date=date(2023, 1, 1)),
        ["FRED"],
    )
    assert summary.count == 1


@pytest.mark.asyncio
async def test_category_without_tags_is_zero_under_tag_filter(db_session, test_patient):
    db_session.add(
        Vitals(patient_id=test_patient.id, recorded_date=datetime(2024, 3, 1, 8, 0))
    )
    db_session.commit()

    svc = CustomReportService(db_session)
    summary = await svc._get_category_summary(
        test_patient.id, "vitals", Vitals, None, ["fred"]
    )
    assert summary.count == 0
    assert summary.records == []


def test_record_summary_includes_tags(db_session, test_patient):
    cond = _condition(test_patient.id, date(2024, 1, 1), ["fred", "cardio"], "tagged")
    untagged = _condition(test_patient.id, date(2024, 1, 1), None, "untagged")
    db_session.add_all([cond, untagged])
    db_session.commit()

    svc = CustomReportService(db_session)
    svc._user_unit_system = "imperial"
    assert svc._convert_to_record_summary(cond, "conditions").tags == ["fred", "cardio"]
    assert svc._convert_to_record_summary(untagged, "conditions").tags == []


@pytest.mark.asyncio
async def test_summary_not_capped_at_100_records(db_session, test_patient):
    """Regression for #1136: the record picker only offered the first 100."""
    for i in range(120):
        db_session.add(_condition(test_patient.id, date(2024, 1, 1), name=f"c{i}"))
    db_session.commit()

    svc = CustomReportService(db_session)
    summary = await svc._get_category_summary(
        test_patient.id, "conditions", Condition, None, None
    )
    assert summary.count == 120
    assert len(summary.records) == 120
    assert summary.has_more is False


@pytest.mark.asyncio
async def test_summary_capped_at_max_records(db_session, test_patient):
    for i in range(MAX_SUMMARY_RECORDS_PER_CATEGORY + 5):
        db_session.add(_condition(test_patient.id, date(2024, 1, 1), name=f"c{i}"))
    db_session.commit()

    svc = CustomReportService(db_session)
    summary = await svc._get_category_summary(
        test_patient.id, "conditions", Condition, None, None
    )
    assert summary.count == MAX_SUMMARY_RECORDS_PER_CATEGORY + 5
    assert len(summary.records) == MAX_SUMMARY_RECORDS_PER_CATEGORY
    assert summary.has_more is True
