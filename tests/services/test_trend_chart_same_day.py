"""
Regression tests for #1092: lab results recorded on the same day share one x
position on the trend chart, so close values overlapped and four results read as
two points. Same-day points are now spread apart and keep a stable entry order.
"""

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.crud.lab_result import lab_result as lab_result_crud
from app.crud.lab_test_component import lab_test_component as lab_test_component_crud
from app.crud.patient import patient as patient_crud
from app.schemas.lab_result import LabResultCreate
from app.schemas.lab_test_component import LabTestComponentCreate
from app.schemas.patient import PatientCreate
from app.services.trend_chart_generator import (
    TrendChartGenerator,
    _axis_label,
    _spread_same_day_dates,
)
from app.services.trend_data_fetcher import TrendDataFetcher


class TestSpreadSameDayDates:
    def test_distinct_days_are_not_moved(self):
        dates = [date(2026, 1, 1), date(2026, 1, 5), date(2026, 2, 1)]
        result = _spread_same_day_dates(dates)
        assert result == [datetime.combine(d, datetime.min.time()) for d in dates]

    def test_same_day_points_get_distinct_positions(self):
        dates = [
            date(2026, 1, 5),
            date(2026, 1, 5),
            date(2026, 2, 10),
            date(2026, 2, 10),
        ]
        result = _spread_same_day_dates(dates)
        assert len(set(result)) == 4

    def test_entry_order_is_preserved_within_a_day(self):
        dates = [date(2026, 1, 5)] * 3 + [date(2026, 3, 1)]
        result = _spread_same_day_dates(dates)
        assert result[0] < result[1] < result[2]

    def test_spread_stays_close_to_the_real_day(self):
        dates = [date(2026, 1, 1), date(2026, 1, 1), date(2026, 12, 31)]
        span = (date(2026, 12, 31) - date(2026, 1, 1)).days
        result = _spread_same_day_dates(dates)
        for original, moved in zip(dates, result):
            offset = abs(moved - datetime.combine(original, datetime.min.time()))
            assert offset <= timedelta(days=span * 0.08)

    def test_adjacent_days_and_a_distant_result_stay_chronological(self):
        # Three results on Jan 5, one on the next day and one far away: the
        # series span is large, so an unbounded spread would carry Jan 5's
        # points past Jan 6's.
        dates = [date(2026, 1, 5)] * 3 + [date(2026, 1, 6), date(2026, 12, 31)]
        result = _spread_same_day_dates(dates)
        assert result == sorted(result)
        assert len(set(result)) == len(result)
        assert max(result[:3]) < result[3] < result[4]

    def test_adjacent_groups_spreading_toward_each_other_do_not_meet(self):
        dates = [date(2026, 1, 5)] * 3 + [date(2026, 1, 6)] * 3 + [date(2027, 1, 5)]
        result = _spread_same_day_dates(dates)
        assert max(result[:3]) < min(result[3:6])
        assert result == sorted(result)

    def test_all_results_on_one_day_do_not_divide_by_zero(self):
        dates = [date(2026, 1, 5)] * 4
        result = _spread_same_day_dates(dates)
        assert len(set(result)) == 4

    def test_mixed_date_and_datetime_values(self):
        dates = [date(2026, 1, 5), datetime(2026, 1, 5, 9, 30), date(2026, 2, 1)]
        result = _spread_same_day_dates(dates)
        assert len(set(result)) == 3
        assert all(isinstance(r, datetime) for r in result)


class TestGenerateLabTestChartSameDay:
    def test_chart_renders_with_same_day_results(self):
        png = TrendChartGenerator().generate_lab_test_chart(
            {
                "dates": [
                    date(2026, 1, 5),
                    date(2026, 1, 5),
                    date(2026, 2, 10),
                    date(2026, 2, 10),
                ],
                "values": [90, 90.5, 101, 101.2],
                "statuses": ["normal"] * 4,
                "display_name": "Glucose",
                "unit": "mg/dL",
            }
        )
        assert png is not None
        assert png.startswith(b"\x89PNG")


class TestFetchSameDayOrder:
    def test_same_day_results_keep_entry_order(self, db_session: Session, test_user):
        patient = patient_crud.create_for_user(
            db_session,
            user_id=test_user.id,
            patient_data=PatientCreate(
                first_name="Trend",
                last_name="Fetcher",
                birth_date=date(1980, 1, 1),
                gender="F",
                address="Fetcher Lane",
            ),
        )
        for i, value in enumerate([10.0, 20.0, 30.0, 40.0]):
            lab = lab_result_crud.create(
                db_session,
                obj_in=LabResultCreate(
                    patient_id=patient.id,
                    test_name=f"Panel {i}",
                    test_category="blood work",
                    status="completed",
                    completed_date=date(2026, 1, 5 if i < 2 else 6),
                ),
            )
            lab_test_component_crud.create(
                db_session,
                obj_in=LabTestComponentCreate(
                    lab_result_id=lab.id,
                    test_name="Glucose",
                    value=value,
                    unit="mg/dL",
                ),
            )

        result = TrendDataFetcher(db_session).fetch_lab_test_trend(
            patient_id=patient.id, test_name="Glucose", unit="mg/dL"
        )

        assert result["values"] == [10.0, 20.0, 30.0, 40.0]


class TestAxisLabel:
    def test_does_not_repeat_unit_already_in_display_name(self):
        assert _axis_label("Albumin (g/dL)", "g/dL") == "Albumin (g/dL)"

    def test_appends_unit_when_missing_from_display_name(self):
        assert _axis_label("Weight", "lbs") == "Weight (lbs)"

    def test_no_unit_returns_display_name(self):
        assert _axis_label("Pain Scale", "") == "Pain Scale"
        assert _axis_label("Pain Scale", None) == "Pain Scale"

    def test_different_unit_in_name_still_appends(self):
        assert _axis_label("Calcium (mg/L)", "mmol/L") == "Calcium (mg/L) (mmol/L)"
