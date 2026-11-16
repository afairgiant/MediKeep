"""When visit reminders fire, from a visit's date, optional start time and offsets."""

from datetime import date, datetime, time, timedelta
from typing import Iterable, List, Optional, Tuple

MINUTES_PER_DAY = 1440
MAX_REMINDER_OFFSETS = 10
MAX_REMINDER_OFFSET_MINUTES = 30 * MINUTES_PER_DAY
DAY_REMINDER_TIME = time(9, 0)


def is_day_offset(offset_minutes: int) -> bool:
    """True when the offset is a whole number of days (the only kind an all-day visit allows)."""
    return offset_minutes % MINUTES_PER_DAY == 0


def normalize_reminder_offsets(value: Optional[Iterable[int]]) -> Optional[List[int]]:
    """Validate offsets (minutes before the visit) and return them sorted ascending.

    Raises:
        ValueError: on a non-integer, out-of-range or duplicate offset, or too many offsets.
    """
    if value is None:
        return None
    offsets = list(value)
    if len(offsets) > MAX_REMINDER_OFFSETS:
        raise ValueError(f"At most {MAX_REMINDER_OFFSETS} reminders allowed")
    for offset in offsets:
        if isinstance(offset, bool) or not isinstance(offset, int):
            raise ValueError("Reminder offsets must be whole minutes")
        if not 0 <= offset <= MAX_REMINDER_OFFSET_MINUTES:
            raise ValueError(
                f"Reminder offsets must be between 0 and {MAX_REMINDER_OFFSET_MINUTES} minutes"
            )
    if len(set(offsets)) != len(offsets):
        raise ValueError("Duplicate reminder offset")
    return sorted(offsets)


def check_offsets_fit_visit_time(
    visit_time: Optional[time], offsets: Optional[Iterable[int]]
) -> None:
    """Raise ValueError when an all-day visit (no start time) has an hour-based offset."""
    if visit_time is None and any(not is_day_offset(o) for o in offsets or []):
        raise ValueError("Reminders in hours or minutes need a visit start time")


def reminder_fire_times(
    visit_date: date, visit_time: Optional[time], offsets: Optional[Iterable[int]]
) -> List[Tuple[int, datetime]]:
    """(offset, naive facility-local fire time) for each offset that can fire.

    Day offsets fire at ``DAY_REMINDER_TIME`` on that day ("day of" fires at the start
    instead when the visit starts earlier). Other offsets count back from the start
    time and are skipped on an all-day visit.
    """
    start = datetime.combine(visit_date, visit_time) if visit_time else None
    fire_times = []
    for offset in offsets or []:
        if is_day_offset(offset):
            fire_day = visit_date - timedelta(days=offset // MINUTES_PER_DAY)
            fire_at = datetime.combine(fire_day, DAY_REMINDER_TIME)
            if start is not None and fire_at > start:
                fire_at = start
            fire_times.append((offset, fire_at))
        elif start is not None:
            fire_times.append((offset, start - timedelta(minutes=offset)))
    return fire_times
