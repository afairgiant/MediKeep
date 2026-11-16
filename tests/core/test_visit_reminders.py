"""Visit reminder offset validation and fire-time calculation."""

from datetime import date, datetime, time

import pytest

from app.core.utils.visit_reminders import (
    DAY_REMINDER_TIME,
    MAX_REMINDER_OFFSET_MINUTES,
    check_offsets_fit_visit_time,
    normalize_reminder_offsets,
    reminder_fire_times,
)

VISIT_DAY = date(2026, 12, 10)


class TestNormalizeReminderOffsets:
    def test_none_stays_none(self):
        assert normalize_reminder_offsets(None) is None

    def test_sorts_ascending(self):
        assert normalize_reminder_offsets([1440, 0, 30]) == [0, 30, 1440]

    def test_accepts_bounds(self):
        assert normalize_reminder_offsets([0, MAX_REMINDER_OFFSET_MINUTES]) == [
            0,
            MAX_REMINDER_OFFSET_MINUTES,
        ]

    @pytest.mark.parametrize(
        "offsets",
        [
            [-1],
            [MAX_REMINDER_OFFSET_MINUTES + 1],
            [60, 60],
            [True],
            [1.5],
            list(range(11)),
        ],
    )
    def test_rejects(self, offsets):
        with pytest.raises(ValueError):
            normalize_reminder_offsets(offsets)


class TestCheckOffsetsFitVisitTime:
    def test_all_day_allows_day_offsets(self):
        check_offsets_fit_visit_time(None, [0, 1440, 7 * 1440])

    def test_all_day_rejects_hour_offsets(self):
        with pytest.raises(ValueError):
            check_offsets_fit_visit_time(None, [1440, 90])

    def test_timed_visit_allows_any_offset(self):
        check_offsets_fit_visit_time(time(10, 0), [30, 1440])

    def test_no_offsets_is_fine(self):
        check_offsets_fit_visit_time(None, None)


class TestReminderFireTimes:
    def test_timed_visit_hour_offsets_count_back_from_start(self):
        assert reminder_fire_times(VISIT_DAY, time(10, 30), [30, 120]) == [
            (30, datetime(2026, 12, 10, 10, 0)),
            (120, datetime(2026, 12, 10, 8, 30)),
        ]

    def test_timed_visit_day_offsets_fire_in_the_morning(self):
        assert reminder_fire_times(VISIT_DAY, time(14, 0), [0, 1440]) == [
            (0, datetime.combine(VISIT_DAY, DAY_REMINDER_TIME)),
            (1440, datetime.combine(date(2026, 12, 9), DAY_REMINDER_TIME)),
        ]

    def test_day_of_an_early_visit_fires_at_its_start(self):
        assert reminder_fire_times(VISIT_DAY, time(7, 45), [0, 1440]) == [
            (0, datetime(2026, 12, 10, 7, 45)),
            (1440, datetime.combine(date(2026, 12, 9), DAY_REMINDER_TIME)),
        ]

    def test_early_visit_hour_offset_crosses_midnight(self):
        assert reminder_fire_times(VISIT_DAY, time(0, 30), [60]) == [
            (60, datetime(2026, 12, 9, 23, 30))
        ]

    def test_all_day_visit_fires_day_offsets_at_fixed_time(self):
        fires = reminder_fire_times(VISIT_DAY, None, [0, 1440])
        assert fires == [
            (0, datetime.combine(VISIT_DAY, DAY_REMINDER_TIME)),
            (1440, datetime.combine(date(2026, 12, 9), DAY_REMINDER_TIME)),
        ]

    def test_all_day_visit_skips_hour_offsets(self):
        assert reminder_fire_times(VISIT_DAY, None, [60]) == []

    def test_no_offsets(self):
        assert reminder_fire_times(VISIT_DAY, time(9, 0), None) == []
