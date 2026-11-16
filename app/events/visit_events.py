"""Visit (encounter) domain events."""

from dataclasses import dataclass
from datetime import date, time
from typing import Optional

from app.core.events.base import DomainEvent


@dataclass(frozen=True)
class VisitReminderDueEvent(DomainEvent):
    """A reminder for an upcoming visit is due.

    ``user_id`` is the patient owner. ``encounter_id`` + ``scheduled_fire_local``
    are the scheduler's dedup key; test reminders set ``is_test`` and leave
    ``scheduled_fire_local`` empty. ``practitioner_name`` and ``location`` are
    only set when the visit opts in to detailed reminders.

    Attributes:
        visit_date: YYYY-MM-DD, facility local
        visit_time: HH:MM facility local, empty for an all-day visit
        offset_minutes: minutes before the visit this reminder is for
        scheduled_fire_local: YYYY-MM-DDTHH:MM facility local
    """

    patient_id: int = 0
    encounter_id: int = 0
    reason: str = ""
    visit_date: str = ""
    visit_time: str = ""
    offset_minutes: int = 0
    practitioner_name: Optional[str] = None
    location: Optional[str] = None
    scheduled_fire_local: str = ""
    is_test: bool = False

    @classmethod
    def for_visit(
        cls,
        *,
        owner_user_id: int,
        patient_id: int,
        encounter_id: int,
        reason: str,
        visit_date: date,
        visit_time: Optional[time],
        include_details: bool,
        practitioner_name: Optional[str],
        location: Optional[str],
        offset_minutes: int = 0,
        scheduled_fire_local: str = "",
        is_test: bool = False,
    ) -> "VisitReminderDueEvent":
        """Event for a visit; practitioner and location are dropped unless ``include_details``."""
        return cls(
            user_id=owner_user_id,
            patient_id=patient_id,
            encounter_id=encounter_id,
            reason=reason,
            visit_date=visit_date.isoformat(),
            visit_time=visit_time.strftime("%H:%M") if visit_time else "",
            offset_minutes=offset_minutes,
            practitioner_name=practitioner_name if include_details else None,
            location=location if include_details else None,
            scheduled_fire_local=scheduled_fire_local,
            is_test=is_test,
        )
