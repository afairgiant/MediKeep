"""Per-minute scheduler that publishes VisitReminderDueEvent for upcoming visits.

Fire times are computed from each visit's date, start time and offsets on every
tick, so editing or deleting a visit needs no rescheduling. Each tick covers every
minute since the previous one, so a late tick or a DST jump loses nothing.
NotificationHistory dedups on (encounter_id, scheduled_fire_local). PHI (reason,
practitioner, location) is never logged.
"""

import asyncio
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.core.events.bus import get_event_bus
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.visit_reminders import (
    MAX_REMINDER_OFFSET_MINUTES,
    MINUTES_PER_DAY,
    reminder_fire_times,
)
from app.events.visit_events import VisitReminderDueEvent
from app.models.clinical import Encounter
from app.models.notifications import NotificationHistory
from app.models.patient import Patient
from app.models.practice import Practitioner
from app.services.reminder_scheduler_base import (
    MinuteReminderScheduler,
    facility_day_start_utc,
)

logger = get_logger(__name__, "app")

EVENT_TYPE = "visit_reminder_due"
FIRE_KEY_FORMAT = "%Y-%m-%dT%H:%M"
MAX_LOOKAHEAD_DAYS = MAX_REMINDER_OFFSET_MINUTES // MINUTES_PER_DAY
ONE_MINUTE = timedelta(minutes=1)
# Longer than a DST jump; a longer gap is downtime, not a late tick
MAX_CATCH_UP = timedelta(hours=2)


def _counts(seen: int = 0, due: int = 0, skipped: int = 0, published: int = 0):
    return {
        "candidates_seen": seen,
        "due": due,
        "skipped_dedup": skipped,
        "events_published": published,
    }


class VisitReminderSchedulerService(MinuteReminderScheduler):
    """Singleton APScheduler wrapper that ticks visit reminders."""

    JOB_ID = "visit_reminder_tick"
    JOB_NAME = "Visit Reminder Tick"
    LABEL = "Visit reminder"
    EVENT_PREFIX = "visit_reminder"
    TICK_COMPLETE_EVENT = "visit_reminders_tick_complete"

    def __init__(self) -> None:
        super().__init__()
        self._last_minute: Optional[datetime] = None

    async def _run_tick(self, db: Session, now_local: datetime) -> Dict[str, int]:
        minute = now_local.replace(second=0, microsecond=0, tzinfo=None)
        if self._last_minute is None:
            # Set before processing so a failed first tick is retried next minute
            self._last_minute = minute - ONE_MINUTE
        last = self._last_minute
        if minute <= last:
            # DST fall-back repeats wall-clock minutes already covered
            return _counts()
        since = last if minute - last <= MAX_CATCH_UP else minute - ONE_MINUTE
        counts = await self._process_tick(db, minute, since)
        # Only after success, so a failed tick's minutes are covered by the next one
        self._last_minute = minute
        return counts

    async def _process_tick(
        self, db: Session, minute: datetime, since: Optional[datetime] = None
    ) -> Dict[str, int]:
        """Publish reminders due in (``since``, ``minute``], naive facility local.

        ``since`` defaults to the minute before. DB work runs off-loop; the Session is
        only touched by one awaited call at a time.
        """
        since = since or minute - ONE_MINUTE
        candidates = await asyncio.to_thread(
            self._discover_candidates, db, since.date(), minute.date()
        )
        due: List[Tuple[object, int, str]] = [
            (row, offset, fire_at.strftime(FIRE_KEY_FORMAT))
            for row in candidates
            for offset, fire_at in reminder_fire_times(
                row.date, row.visit_time, row.reminder_offsets
            )
            if since < fire_at <= minute
        ]
        if not due:
            return _counts(seen=len(candidates))

        already_fired = await asyncio.to_thread(
            self._fetch_already_fired, db, since.date()
        )
        # Two offsets can share a fire time (a day reminder and an hour one)
        claimed = set(already_fired)
        to_publish = []
        for row, offset, key in due:
            if (row.id, key) not in claimed:
                claimed.add((row.id, key))
                to_publish.append((row, offset, key))

        # Each publish is an independent network send; one slow channel must not delay the rest
        await asyncio.gather(
            *(
                self._publish_reminder(row, offset, key)
                for row, offset, key in to_publish
            )
        )
        return _counts(
            seen=len(candidates),
            due=len(due),
            skipped=len(due) - len(to_publish),
            published=len(to_publish),
        )

    def _discover_candidates(
        self, db: Session, first_day: date, last_day: date
    ) -> list:
        """Visits with reminders on, dated ``first_day`` to ``last_day`` + max lookahead."""
        return (
            db.query(
                Encounter.id,
                Encounter.patient_id,
                Encounter.reason,
                Encounter.date,
                Encounter.visit_time,
                Encounter.reminder_offsets,
                Encounter.reminder_include_details,
                Encounter.location,
                Practitioner.name.label("practitioner_name"),
                Patient.owner_user_id,
            )
            .join(Patient, Patient.id == Encounter.patient_id)
            .outerjoin(Practitioner, Practitioner.id == Encounter.practitioner_id)
            .filter(Encounter.reminder_enabled.is_(True))
            .filter(Encounter.date >= first_day)
            .filter(Encounter.date <= last_day + timedelta(days=MAX_LOOKAHEAD_DAYS))
            .all()
        )

    def _fetch_already_fired(
        self, db: Session, since_day: date
    ) -> Set[Tuple[int, str]]:
        """(encounter_id, scheduled_fire_local) pairs sent since ``since_day`` began."""
        rows = (
            db.query(NotificationHistory.event_data)
            .filter(NotificationHistory.event_type == EVENT_TYPE)
            .filter(NotificationHistory.created_at >= facility_day_start_utc(since_day))
            .all()
        )
        fired = set()
        for (data,) in rows:
            data = data or {}
            if data.get("is_test") or data.get("encounter_id") is None:
                continue
            fired.add((data["encounter_id"], data.get("scheduled_fire_local")))
        return fired

    async def _publish_reminder(self, row, offset: int, fire_key: str) -> None:
        await get_event_bus().publish(
            VisitReminderDueEvent.for_visit(
                owner_user_id=row.owner_user_id,
                patient_id=row.patient_id,
                encounter_id=row.id,
                reason=row.reason,
                visit_date=row.date,
                visit_time=row.visit_time,
                include_details=row.reminder_include_details,
                practitioner_name=row.practitioner_name,
                location=row.location,
                offset_minutes=offset,
                scheduled_fire_local=fire_key,
            )
        )
        logger.info(
            "Visit reminder published",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "visit_reminder_published",
                LogFields.RECORD_ID: row.id,
                LogFields.PATIENT_ID: row.patient_id,
                LogFields.USER_ID: row.owner_user_id,
                "scheduled_fire_local": fire_key,
            },
        )
