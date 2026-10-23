"""Unit tests for the pure blood donation eligibility calculation."""

from datetime import date

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
            last_donation_date=None,
            last_donation_type=None,
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.is_eligible is True
        assert result.next_eligible_date is None
        assert result.days_remaining == 0
        assert result.interval_days is None

    def test_whole_blood_uses_whole_blood_interval(self):
        result = calculate_eligibility(
            last_donation_date=date(2026, 9, 21),
            last_donation_type="whole_blood",
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.interval_days == 56
        assert result.next_eligible_date == date(2026, 11, 16)
        assert result.days_remaining == 46
        assert result.is_eligible is False

    def test_custom_interval_is_used(self):
        result = calculate_eligibility(
            last_donation_date=date(2026, 9, 28),
            last_donation_type="plasma",
            intervals=resolve_intervals({"plasma": 2}),
            today=TODAY,
        )
        assert result.next_eligible_date == date(2026, 9, 30)
        assert result.days_remaining == 0
        assert result.is_eligible is True

    def test_eligible_exactly_on_next_date(self):
        result = calculate_eligibility(
            last_donation_date=date(2026, 9, 17),
            last_donation_type="platelets",
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.next_eligible_date == TODAY
        assert result.days_remaining == 0
        assert result.is_eligible is True

    def test_one_day_before_is_not_eligible(self):
        result = calculate_eligibility(
            last_donation_date=date(2026, 9, 18),
            last_donation_type="platelets",
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.days_remaining == 1
        assert result.is_eligible is False

    def test_reports_last_donation(self):
        result = calculate_eligibility(
            last_donation_date=date(2026, 6, 1),
            last_donation_type="double_red_cells",
            intervals=DEFAULT_DONATION_INTERVALS,
            today=TODAY,
        )
        assert result.last_donation_date == date(2026, 6, 1)
        assert result.last_donation_type == "double_red_cells"
        assert result.interval_days == 112
