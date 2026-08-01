"""
Tests for shared schema validators.

Focus is on ``validate_date_not_future`` and its timezone-tolerant "future"
bound. The server cannot know the submitting user's timezone, so the check
compares against the current date at UTC+14 (the earliest timezone on Earth).
This is the backend half of the symptom date-auto-fill fix (#945/#946): once
the frontend sends the user's genuine local date, a user *ahead* of the server
(e.g. Tokyo with a UTC backend) must not be rejected for submitting "today".

The clock is pinned by patching ``datetime`` inside the validators module (the
project does not depend on freezegun), so assertions are deterministic
regardless of the CI runner's timezone.
"""

from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.schemas.validators import validate_date_not_future


class _FixedDatetime(datetime):
    """datetime subclass whose ``now(tz)`` returns a pinned instant."""

    _pinned = None

    @classmethod
    def now(cls, tz=None):
        assert cls._pinned is not None, "pin the clock with pinned_utc()"
        if tz is None:
            return cls._pinned.replace(tzinfo=None)
        return cls._pinned.astimezone(tz)


def pinned_utc(year, month, day, hour=12, minute=0):
    """Patch the validators module clock to a fixed UTC instant."""
    _FixedDatetime._pinned = datetime(
        year, month, day, hour, minute, tzinfo=timezone.utc
    )
    return patch("app.schemas.validators.datetime", _FixedDatetime)


def test_none_passes_through():
    assert validate_date_not_future(None) is None


def test_today_is_accepted():
    # The core regression: the server's own "today" must always validate.
    with pinned_utc(2026, 7, 30, hour=12):
        assert validate_date_not_future(date(2026, 7, 30)) == date(2026, 7, 30)


def test_past_date_is_accepted():
    with pinned_utc(2026, 7, 30, hour=12):
        assert validate_date_not_future(date(2020, 1, 1)) == date(2020, 1, 1)


def test_east_of_utc_local_date_is_accepted():
    """
    A user ahead of the server sends tomorrow's UTC-date as their local
    "today". With UTC late in the day, UTC+14 has already rolled over, so the
    date is accepted rather than rejected as future.
    """
    # UTC 2026-07-30 23:00 -> +14h = 2026-07-31 13:00 -> bound is 2026-07-31.
    with pinned_utc(2026, 7, 30, hour=23):
        assert validate_date_not_future(date(2026, 7, 31)) == date(2026, 7, 31)


def test_genuine_future_date_is_rejected():
    """Two days ahead of UTC is beyond any real timezone and must fail."""
    with pinned_utc(2026, 7, 30, hour=23):
        with pytest.raises(ValueError, match="cannot be in the future"):
            validate_date_not_future(date(2026, 8, 1))


def test_tomorrow_rejected_when_utc_is_early_in_the_day():
    """
    Early in the UTC day, even UTC+14 has not reached tomorrow, so a next-day
    date cannot correspond to anyone's local "today" and is rejected.
    """
    # UTC 2026-07-30 03:00 -> +14h = 2026-07-30 17:00 -> bound stays 2026-07-30.
    with pinned_utc(2026, 7, 30, hour=3):
        with pytest.raises(ValueError, match="cannot be in the future"):
            validate_date_not_future(date(2026, 7, 31))


def test_field_name_appears_in_error_message():
    with pinned_utc(2026, 7, 30, hour=3):
        with pytest.raises(ValueError, match="Onset date cannot be in the future"):
            validate_date_not_future(date(2026, 12, 1), field_name="Onset date")


def test_max_years_past_rejects_too_old():
    with pinned_utc(2026, 7, 30, hour=12):
        with pytest.raises(ValueError, match="cannot be more than 150 years ago"):
            validate_date_not_future(
                date(1850, 1, 1), field_name="Birth date", max_years_past=150
            )


def test_max_years_past_accepts_within_bound():
    with pinned_utc(2026, 7, 30, hour=12):
        assert validate_date_not_future(
            date(1990, 5, 20), field_name="Birth date", max_years_past=150
        ) == date(1990, 5, 20)


def test_bound_tracks_the_real_utc14_date():
    """Without pinning, the accepted upper bound is the live UTC+14 date."""
    expected = (datetime.now(timezone.utc) + timedelta(hours=14)).date()
    assert validate_date_not_future(expected) == expected
    # Reject with +2 days rather than +1: the validator recomputes its bound on
    # each call, so if the UTC+14 clock crosses midnight between capturing
    # `expected` and this call, the live bound would be expected+1 and a +1
    # assertion would flake. The exact expected+1 boundary is covered by the
    # pinned-clock tests above.
    with pytest.raises(ValueError, match="cannot be in the future"):
        validate_date_not_future(expected + timedelta(days=2))
