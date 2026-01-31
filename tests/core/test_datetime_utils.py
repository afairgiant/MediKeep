"""
Tests for datetime_utils module.

These tests specifically cover the UTC preservation behavior that fixes
the "double timezone conversion" bug where UTC values sent from the frontend
were incorrectly treated as local timezone values.
"""

import pytest
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.core.utils.datetime_utils import to_utc, to_local, get_facility_timezone


class TestToUtc:
    """Tests for the to_utc() function."""

    def test_none_input_returns_none(self):
        """Passing None should return None."""
        assert to_utc(None) is None

    def test_iso_string_with_z_suffix_preserved(self):
        """
        ISO strings ending with 'Z' (Zulu/UTC) should be recognized as UTC
        and NOT converted again.

        This is the core fix for the double-conversion bug where frontend
        sends toISOString() output like "2017-07-03T00:15:00.000Z".
        """
        # This is what JavaScript's toISOString() produces
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
        """
        ISO strings with +00:00 offset should be recognized as UTC.
        """
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
        """
        ISO strings with positive timezone offset should be converted to UTC.
        """
        # 00:15 in UTC+1 = 23:15 previous day in UTC
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
        """
        ISO strings with negative timezone offset should be converted to UTC.
        """
        # 00:15 in UTC-5 (EST) = 05:15 UTC
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
        """
        Naive datetime strings (no timezone) should be treated as facility timezone.
        """
        naive_string = "2017-07-03 00:15:00"
        result = to_utc(naive_string)

        assert result is not None
        assert result.tzinfo == timezone.utc
        # The exact UTC time depends on facility timezone setting
        # but it should be a valid UTC datetime
        assert result.year == 2017
        assert result.month == 7

    def test_timezone_aware_datetime_object_converted(self):
        """
        Timezone-aware datetime objects should be converted to UTC.
        """
        # Create a datetime in EST (UTC-5)
        est = ZoneInfo("America/New_York")
        local_dt = datetime(2017, 7, 3, 0, 15, 0, tzinfo=est)
        result = to_utc(local_dt)

        assert result is not None
        assert result.tzinfo == timezone.utc
        # EST is UTC-4 in July (DST), so 00:15 EST = 04:15 UTC
        assert result.hour == 4
        assert result.minute == 15

    def test_utc_datetime_object_preserved(self):
        """
        UTC datetime objects should be returned as-is.
        """
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
        """
        Naive datetime objects should be treated as facility timezone.
        """
        naive_dt = datetime(2017, 7, 3, 0, 15, 0)
        result = to_utc(naive_dt)

        assert result is not None
        assert result.tzinfo == timezone.utc
        # The exact UTC time depends on facility timezone setting

    def test_midnight_edge_case_with_z_suffix(self):
        """
        Midnight times with Z suffix should NOT shift to previous day.

        This is the specific bug case: entering "03/07/2017 00:15" and getting
        "07/02/2017 23:15" back due to double conversion.
        """
        # Midnight + 15 minutes in UTC
        utc_string = "2017-07-03T00:15:00Z"
        result = to_utc(utc_string)

        assert result is not None
        # Should stay on July 3, not shift to July 2
        assert result.day == 3
        assert result.month == 7
        assert result.hour == 0
        assert result.minute == 15

    def test_javascript_toISOString_format(self):
        """
        Test the exact format JavaScript's Date.toISOString() produces.
        """
        # JavaScript toISOString() includes milliseconds
        js_format = "2017-07-03T00:15:00.000Z"
        result = to_utc(js_format)

        assert result is not None
        assert result.tzinfo == timezone.utc
        assert result.day == 3
        assert result.month == 7
        assert result.year == 2017
        assert result.hour == 0
        assert result.minute == 15


class TestToLocal:
    """Tests for the to_local() function."""

    def test_none_input_returns_none(self):
        """Passing None should return None."""
        assert to_local(None) is None

    def test_utc_datetime_converted_to_local(self):
        """UTC datetime should be converted to facility timezone."""
        utc_dt = datetime(2017, 7, 3, 0, 15, 0, tzinfo=timezone.utc)
        result = to_local(utc_dt)

        assert result is not None
        # Result should be in facility timezone
        assert result.tzinfo == get_facility_timezone()

    def test_naive_datetime_treated_as_utc(self):
        """Naive datetime should be treated as UTC."""
        naive_dt = datetime(2017, 7, 3, 0, 15, 0)
        result = to_local(naive_dt)

        assert result is not None
        assert result.tzinfo == get_facility_timezone()


class TestRoundTrip:
    """Test round-trip conversion UTC -> Local -> UTC."""

    def test_utc_to_local_to_utc_preserves_time(self):
        """Converting UTC -> Local -> UTC should preserve the original time."""
        original_utc = datetime(2017, 7, 3, 0, 15, 0, tzinfo=timezone.utc)

        # Convert to local
        local_time = to_local(original_utc)
        assert local_time is not None

        # Convert back to UTC
        back_to_utc = to_utc(local_time)
        assert back_to_utc is not None

        # Should match original (within microseconds due to potential precision loss)
        assert back_to_utc.year == original_utc.year
        assert back_to_utc.month == original_utc.month
        assert back_to_utc.day == original_utc.day
        assert back_to_utc.hour == original_utc.hour
        assert back_to_utc.minute == original_utc.minute
        assert back_to_utc.second == original_utc.second
