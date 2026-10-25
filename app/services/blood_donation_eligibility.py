"""
Blood donation eligibility calculation.

Pure functions without database access so the rule can be unit tested in
isolation.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable, Mapping, Optional

from app.models.enums import DonationType

# Minimum days between donations, by type of the previous donation.
# Users can override these per type in their preferences to match regional
# guidelines.
DEFAULT_DONATION_INTERVALS: dict[str, int] = {
    DonationType.WHOLE_BLOOD.value: 56,
    DonationType.PLASMA.value: 14,
    DonationType.PLATELETS.value: 14,
    DonationType.DOUBLE_RED_CELLS.value: 112,
}

# Bounds for a valid per-type interval override. Shared with the
# user-preferences validator, so they live here rather than being inlined.
MIN_DONATION_INTERVAL_DAYS = 1
MAX_DONATION_INTERVAL_DAYS = 365


@dataclass(frozen=True)
class Eligibility:
    """Result of an eligibility calculation."""

    # The donation whose waiting period ends last, i.e. the one that sets the date.
    limiting_donation_date: Optional[date]
    limiting_donation_type: Optional[str]
    interval_days: Optional[int]
    next_eligible_date: Optional[date]
    days_remaining: int
    is_eligible: bool


def resolve_intervals(custom: Optional[Mapping[str, int]]) -> dict[str, int]:
    """Merge user-configured intervals over the defaults.

    Ignores unknown donation types and invalid override values (non-int,
    bool, or out of the [MIN_DONATION_INTERVAL_DAYS, MAX_DONATION_INTERVAL_DAYS]
    range).
    """
    intervals = dict(DEFAULT_DONATION_INTERVALS)
    if custom:
        intervals.update(
            {
                k: v
                for k, v in custom.items()
                if k in intervals
                and isinstance(v, int)
                and not isinstance(v, bool)
                and MIN_DONATION_INTERVAL_DAYS <= v <= MAX_DONATION_INTERVAL_DAYS
            }
        )
    return intervals


def calculate_eligibility(
    *,
    donations: Iterable[tuple[date, str]],
    intervals: Mapping[str, int],
    today: date,
) -> Eligibility:
    """Calculate when the patient may donate again.

    The next eligible date is the latest of donation date + interval[type]
    over all donations, so a short wait after one type never hides a longer
    wait left over from an earlier donation.
    """
    default_interval = DEFAULT_DONATION_INTERVALS[DonationType.WHOLE_BLOOD.value]
    limiting: Optional[tuple[date, date, str, int]] = None
    for donation_date, donation_type in donations:
        interval_days = intervals.get(donation_type, default_interval)
        eligible_on = donation_date + timedelta(days=interval_days)
        if limiting is None or eligible_on > limiting[0]:
            limiting = (eligible_on, donation_date, donation_type, interval_days)

    if limiting is None:
        return Eligibility(
            limiting_donation_date=None,
            limiting_donation_type=None,
            interval_days=None,
            next_eligible_date=None,
            days_remaining=0,
            is_eligible=True,
        )

    next_eligible_date, donation_date, donation_type, interval_days = limiting
    days_remaining = max(0, (next_eligible_date - today).days)

    return Eligibility(
        limiting_donation_date=donation_date,
        limiting_donation_type=donation_type,
        interval_days=interval_days,
        next_eligible_date=next_eligible_date,
        days_remaining=days_remaining,
        is_eligible=days_remaining == 0,
    )
