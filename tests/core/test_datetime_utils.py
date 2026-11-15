"""
Tests for datetime_utils module.

These tests cover the to_utc() function behavior, including proper handling
of timezone-aware inputs to prevent double conversion bugs.
"""

import pytest
from datetime import date, datetime, timezone
from unittest.mock import patch
from zoneinfo import ZoneInfo

from app.core.utils.datetime_utils import (
    ensure_date,
    get_facility_timezone,
    get_facility_today,
    is_future_date,
    to_local,
    to_utc,
)


class TestToUtc:
    """Tests for the to_utc() function."""

    def test_none_input_returns_none(self):
        assert to_utc(None) is None

    def test_iso_string_with_z_suffix_preserved(self):
        """
        Core fix for the double-conversion bug: ISO strings with 'Z' suffix
        (from JavaScript's toISOString()) should be recognized as already UTC.
        """
        utc_string = "2017-07-03T00:15:00.000Z"
        result = to_utc(utc_string)

        assert result is not None
        assert result.tzinfo == timezone.utc
        # The time should remain exactly as input - July 3, 00:15 UTC
        assert result.year == 2017
        assert result.month == 7
        assert result.day == 3
        assert result.hour == 0
        assert result.minute == 15
        assert result.second == 0

    def test_iso_string_with_utc_offset_preserved(self):
        """ISO strings with +00:00 offset should be recognized as UTC."""
        utc_string = "2017-07-03T00:15:00+00:00"
        result = to_utc(utc_string)

        assert result is not None
        assert result.tzinfo == timezone.utc
        assert result.year == 2017
        assert result.month == 7
        assert result.day == 3
        assert result.hour == 0
        assert result.minute == 15

    def test_iso_string_with_positive_offset_converted(self):
        """00:15 in UTC+1 should become 23:15 previous day in UTC."""
        local_string = "2017-07-03T00:15:00+01:00"
        result = to_utc(local_string)

        assert result is not None
        assert result.tzinfo == timezone.utc
        # Should be July 2, 23:15 UTC (1 hour earlier)
        assert result.year == 2017
        assert result.month == 7
        assert result.day == 2
        assert result.hour == 23
        assert result.minute == 15

    def test_iso_string_with_negative_offset_converted(self):
        """00:15 in UTC-5 (EST) should become 05:15 UTC."""
        local_string = "2017-07-03T00:15:00-05:00"
        result = to_utc(local_string)

        assert result is not None
        assert result.tzinfo == timezone.utc
        # Should be July 3, 05:15 UTC (5 hours later)
        assert result.year == 2017
        assert result.month == 7
        assert result.day == 3
        assert result.hour == 5
        assert result.minute == 15

    def test_naive_datetime_string_uses_facility_timezone(self):
        """Naive datetime strings should be treated as facility timezone."""
        naive_string = "2017-07-03 00:15:00"
        result = to_utc(naive_string)

        assert result is not None
        assert result.tzinfo == timezone.utc
        # The exact UTC time depends on facility timezone setting
        # but it should be a valid UTC datetime
        assert result.year == 2017
        assert result.month == 7

    def test_timezone_aware_datetime_object_converted(self):
        """Timezone-aware datetime objects should be converted to UTC."""
        # In July, EST observes DST (UTC-4), so 00:15 EDT = 04:15 UTC
        est = ZoneInfo("America/New_York")
        local_dt = datetime(2017, 7, 3, 0, 15, 0, tzinfo=est)
        result = to_utc(local_dt)

        assert result is not None
        assert result.tzinfo == timezone.utc
        assert result.hour == 4
        assert result.minute == 15

    def test_utc_datetime_object_preserved(self):
        """UTC datetime objects should remain unchanged."""
        utc_dt = datetime(2017, 7, 3, 0, 15, 0, tzinfo=timezone.utc)
        result = to_utc(utc_dt)

        assert result is not None
        assert result.tzinfo == timezone.utc
        assert result.year == 2017
        assert result.month == 7
        assert result.day == 3
        assert result.hour == 0
        assert result.minute == 15

    def test_naive_datetime_object_uses_facility_timezone(self):
        """Naive datetime objects should be treated as facility timezone."""
        naive_dt = datetime(2017, 7, 3, 0, 15, 0)
        result = to_utc(naive_dt)

        assert result is not None
        assert result.tzinfo == timezone.utc
        # The exact UTC time depends on facility timezone setting

    def test_midnight_edge_case_with_z_suffix(self):
        """
        Regression test: entering "03/07/2017 00:15" should NOT become
        "07/02/2017 23:15" due to double timezone conversion.
        """
        utc_string = "2017-07-03T00:15:00Z"
        result = to_utc(utc_string)

        assert result is not None
        # Should stay on July 3, not shift to July 2
        assert result.day == 3
        assert result.month == 7
        assert result.hour == 0
        assert result.minute == 15

    def test_javascript_toISOString_format(self):
        """JavaScript's toISOString() format (with milliseconds) should work."""
        js_format = "2017-07-03T00:15:00.000Z"
        result = to_utc(js_format)

        assert result is not None
        assert result.tzinfo == timezone.utc
        assert result.day == 3
        assert result.month == 7
        assert result.year == 2017
        assert result.hour == 0
        assert result.minute == 15

    def test_invalid_datetime_string_raises_error(self):
        """Invalid datetime strings should raise ValueError."""
        with pytest.raises(ValueError):
            to_utc("not a valid datetime")

    def test_malformed_iso_string_raises_error(self):
        """Malformed ISO strings should raise ValueError."""
        with pytest.raises(ValueError):
            to_utc("2017-13-45T99:99:99")  # Invalid month/day/time

    def test_empty_string_raises_error(self):
        """Empty strings should raise ValueError."""
        with pytest.raises(ValueError):
            to_utc("")


class TestToLocal:
    """Tests for the to_local() function."""

    def test_none_input_returns_none(self):
        assert to_local(None) is None

    def test_utc_datetime_converted_to_local(self):
        utc_dt = datetime(2017, 7, 3, 0, 15, 0, tzinfo=timezone.utc)
        result = to_local(utc_dt)

        assert result is not None
        assert result.tzinfo == get_facility_timezone()

    def test_naive_datetime_treated_as_utc(self):
        naive_dt = datetime(2017, 7, 3, 0, 15, 0)
        result = to_local(naive_dt)

        assert result is not None
        assert result.tzinfo == get_facility_timezone()


class TestRoundTrip:
    """Test round-trip conversion UTC -> Local -> UTC."""

    def test_utc_to_local_to_utc_preserves_time(self):
        """Converting UTC -> Local -> UTC should preserve the original time."""
        original_utc = datetime(2017, 7, 3, 0, 15, 0, tzinfo=timezone.utc)

        local_time = to_local(original_utc)
        assert local_time is not None

        back_to_utc = to_utc(local_time)
        assert back_to_utc is not None

        assert back_to_utc.year == original_utc.year
        assert back_to_utc.month == original_utc.month
        assert back_to_utc.day == original_utc.day
        assert back_to_utc.hour == original_utc.hour
        assert back_to_utc.minute == original_utc.minute
        assert back_to_utc.second == original_utc.second


class TestEnsureDate:
    def test_datetime_becomes_date(self):
        result = ensure_date(datetime(2024, 1, 15, 10, 30))
        assert result == date(2024, 1, 15)
        assert type(result) is date

    def test_date_and_string_pass_through(self):
        assert ensure_date(date(2024, 1, 15)) == date(2024, 1, 15)
        assert ensure_date("2024-01-15") == date(2024, 1, 15)
        assert ensure_date(None) is None


class TestGetFacilityToday:
    def test_uses_the_facility_timezone(self):
        # 03:00 UTC on Nov 16 is still Nov 15 in Los Angeles
        utc_now = datetime(2026, 11, 16, 3, 0, tzinfo=timezone.utc)
        la = ZoneInfo("America/Los_Angeles")
        with patch(
            "app.core.utils.datetime_utils.get_facility_timezone", return_value=la
        ), patch("app.core.utils.datetime_utils.datetime") as mock_dt:
            mock_dt.now.side_effect = lambda tz: utc_now.astimezone(tz)
            assert get_facility_today() == date(2026, 11, 15)


class TestIsFutureDate:
    TODAY = date(2026, 11, 15)

    @pytest.mark.parametrize(
        "value, expected",
        [
            ("2026-11-16", True),
            (date(2027, 1, 1), True),
            (datetime(2026, 11, 16, 0, 1), True),
            ("2026-11-15", False),
            (date(2026, 11, 14), False),
            (None, False),
            ("", False),
            ("not a date", False),
        ],
    )
    def test_compares_against_today(self, value, expected):
        assert is_future_date(value, self.TODAY) is expected

    def test_defaults_to_facility_today(self):
        with patch(
            "app.core.utils.datetime_utils.get_facility_today",
            return_value=self.TODAY,
        ):
            assert is_future_date("2026-11-16") is True
            assert is_future_date("2026-11-15") is False
