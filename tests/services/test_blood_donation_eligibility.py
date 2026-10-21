"""Unit tests for the pure blood donation eligibility calculation."""

from datetime import date, timedelta

from app.models.enums import get_all_donation_types
from app.services.blood_donation_eligibility import (
    DEFAULT_DONATION_INTERVALS,
    calculate_eligibility,
    resolve_intervals,
)

TODAY = date(2026, 10, 1)


class TestResolveIntervals:
    def test_none_returns_defaults(self):
        assert resolve_intervals(None) == DEFAULT_DONATION_INTERVALS

    def test_defaults_cover_all_donation_types(self):
        assert set(DEFAULT_DONATION_INTERVALS) == set(get_all_donation_types())

    def test_invalid_override_values_are_ignored(self):
        resolved = resolve_intervals(
            {
                "plasma": 0,
                "platelets": "7",
                "whole_blood": True,
                "double_red_cells": 400,
            }
        )
        assert resolved == DEFAULT_DONATION_INTERVALS

    def test_defaults_are_not_mutated(self):
        resolved = resolve_intervals({"plasma": 3})
        assert resolved["plasma"] == 3
        assert DEFAULT_DONATION_INTERVALS["plasma"] == 14

    def test_partial_override_keeps_other_defaults(self):
        resolved = resolve_intervals({"whole_blood": 84})
        assert resolved["whole_blood"] == 84
        assert resolved["platelets"] == DEFAULT_DONATION_INTERVALS["platelets"]

    def test_unknown_keys_are_ignored(self):
        assert "bone_marrow" not in resolve_intervals({"bone_marrow": 10})


class TestCalculateEligibility:
    def test_no_donations_is_eligible_now(self):
        result = calculate_eligibility(
            donations=[],
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.is_eligible is True
        assert result.next_eligible_date is None
        assert result.days_remaining == 0
        assert result.interval_days is None

    def test_whole_blood_uses_whole_blood_interval(self):
        result = calculate_eligibility(
            donations=[(date(2026, 9, 21), "whole_blood")],
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.interval_days == 56
        assert result.next_eligible_date == date(2026, 11, 16)
        assert result.days_remaining == 46
        assert result.is_eligible is False

    def test_custom_interval_is_used(self):
        result = calculate_eligibility(
            donations=[(date(2026, 9, 28), "plasma")],
            intervals=resolve_intervals({"plasma": 2}),
            today=TODAY,
        )
        assert result.next_eligible_date == date(2026, 9, 30)
        assert result.days_remaining == 0
        assert result.is_eligible is True

    def test_eligible_exactly_on_next_date(self):
        result = calculate_eligibility(
            donations=[(date(2026, 9, 17), "platelets")],
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.next_eligible_date == TODAY
        assert result.days_remaining == 0
        assert result.is_eligible is True

    def test_one_day_before_is_not_eligible(self):
        result = calculate_eligibility(
            donations=[(date(2026, 9, 18), "platelets")],
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.days_remaining == 1
        assert result.is_eligible is False

    def test_reports_limiting_donation(self):
        result = calculate_eligibility(
            donations=[(date(2026, 6, 1), "double_red_cells")],
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.limiting_donation_date == date(2026, 6, 1)
        assert result.limiting_donation_type == "double_red_cells"
        assert result.interval_days == 112


class TestMultipleDonations:
    def test_longer_earlier_wait_wins_over_short_later_one(self):
        # Whole blood on day 0 (56 days), plasma on day 20 (14 days): on day 34
        # the whole blood wait still has 22 days left.
        start = date(2026, 9, 1)
        result = calculate_eligibility(
            donations=[
                (start, "whole_blood"),
                (start + timedelta(days=20), "plasma"),
            ],
            intervals=DEFAULT_DONATION_INTERVALS,
            today=start + timedelta(days=34),
        )
        assert result.limiting_donation_type == "whole_blood"
        assert result.limiting_donation_date == start
        assert result.next_eligible_date == start + timedelta(days=56)
        assert result.days_remaining == 22
        assert result.is_eligible is False

    def test_order_of_donations_does_not_matter(self):
        start = date(2026, 9, 1)
        donations = [(start, "whole_blood"), (start + timedelta(days=20), "plasma")]
        forward = calculate_eligibility(
            donations=donations, intervals=DEFAULT_DONATION_INTERVALS, today=TODAY
        )
        backward = calculate_eligibility(
            donations=donations[::-1], intervals=DEFAULT_DONATION_INTERVALS, today=TODAY
        )
        assert forward == backward

    def test_later_donation_wins_when_it_ends_last(self):
        result = calculate_eligibility(
            donations=[(date(2026, 8, 1), "plasma"), (date(2026, 9, 20), "plasma")],
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.limiting_donation_date == date(2026, 9, 20)
        assert result.next_eligible_date == date(2026, 10, 4)

    def test_all_waits_over_is_eligible(self):
        result = calculate_eligibility(
            donations=[(date(2026, 1, 1), "whole_blood"), (date(2026, 2, 1), "plasma")],
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.is_eligible is True
        assert result.days_remaining == 0
