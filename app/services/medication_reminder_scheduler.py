"""
Medication Reminder Scheduler Service

Wakes up every minute on the :00 second and publishes
MedicationReminderDueEvent for any active medication whose configured
reminder_times include the current facility-local HH:MM, provided the
current date sits within the medication's effective period (inclusive).

The cron uses the facility timezone from datetime_utils so reminders fire at
wall-clock time, including across DST transitions. Idempotency is enforced by
checking NotificationHistory for a matching (medication_id, scheduled_local_date,
scheduled_time_local) triple before publishing — this guards against
APScheduler misfires, restarts during a tick, and concurrent dev/EXE
instances.

PHI is never logged: medication_name stays out of log payloads; only IDs and
the scheduled HH:MM are recorded.
"""

import asyncio
from datetime import date, datetime
from typing import Dict

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.events.bus import get_event_bus
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.events.medication_events import MedicationReminderDueEvent
from app.models.clinical import Medication
from app.models.notifications import NotificationHistory
from app.models.patient import Patient
from app.services.reminder_scheduler_base import (
    MinuteReminderScheduler,
    facility_day_start_utc,
)

logger = get_logger(__name__, "app")

class MedicationReminderSchedulerService(MinuteReminderScheduler):
    """Singleton APScheduler wrapper that ticks medication reminders."""

    JOB_ID = "medication_reminder_tick"
    JOB_NAME = "Medication Reminder Tick"
    LABEL = "Medication reminder"
    EVENT_PREFIX = "medication_reminder"
    TICK_COMPLETE_EVENT = "medication_reminders_tick_complete"

    async def _run_tick(self, db: Session, now_local: datetime) -> Dict[str, int]:
        seen, due, skipped, published = await self._process_tick(
            db, now_local.date(), now_local.strftime("%H:%M")
        )
        return {
            "candidates_seen": seen,
            "due": due,
            "skipped_dedup": skipped,
            "events_published": published,
        }

    async def _process_tick(
        self, db: Session, today_local: date, current_hhmm: str
    ) -> tuple:
        """Run discovery + publish loop. Returns (seen, due, skipped, published)."""
        # DB queries are synchronous; run them off-loop so a slow query
        # doesn't stall in-flight HTTP requests every minute. Sharing the
        # Session across to_thread calls is safe because access is strictly
        # serialized — each call is awaited before the next; the Session is
        # never touched from two threads concurrently.
        candidates = await asyncio.to_thread(self._discover_candidates, db, today_local)
        current_weekday = today_local.weekday()  # Mon=0, Sun=6; derived from same instant as today_local
        due_rows = [
            row
            for row in candidates
            if isinstance(row.reminder_times, list)
            and current_hhmm in row.reminder_times
            and (not row.reminder_days or current_weekday in row.reminder_days)
        ]

        if not due_rows:
            return len(candidates), 0, 0, 0

        scheduled_local_date = today_local.isoformat()

        already_fired_ids = await asyncio.to_thread(
            self._fetch_already_fired, db, today_local, current_hhmm
        )

        to_publish = []
        for row in due_rows:
            if row.id in already_fired_ids:
                logger.debug(
                    "Medication reminder dedup skip",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: "medication_reminder_dedup_skip",
                        "medication_id": row.id,
                        "scheduled_time_local": current_hhmm,
                        "scheduled_local_date": scheduled_local_date,
                    },
                )
            else:
                to_publish.append(row)

        # Deliveries are independent network sends; one slow channel must not
        # delay every subsequent reminder in the same minute.
        await asyncio.gather(
            *(
                self._publish_reminder(row, current_hhmm, scheduled_local_date)
                for row in to_publish
            )
        )

        skipped = len(due_rows) - len(to_publish)
        return len(candidates), len(due_rows), skipped, len(to_publish)

    def _discover_candidates(self, db: Session, today_local: date) -> list:
        """Return rows of (id, patient_id, medication_name, dosage,
        reminder_times, reminder_message, reminder_days, owner_user_id)
        for enabled+active+in-period meds.

        Selects only the columns the tick needs rather than hydrating full
        Medication entities — this query runs every minute.

        Mirrored by frontend/src/utils/medicationReminders.js
        (getReminderBlockers) for the UI "won't fire" warning — keep the
        two in sync.
        """
        rows = (
            db.query(
                Medication.id,
                Medication.patient_id,
                Medication.medication_name,
                Medication.dosage,
                Medication.reminder_times,
                Medication.reminder_message,
                Medication.reminder_days,
                Patient.owner_user_id,
            )
            .join(Patient, Patient.id == Medication.patient_id)
            .filter(Medication.reminder_enabled.is_(True))
            .filter(Medication.status == "active")
            .filter(
                or_(
                    Medication.effective_period_start.is_(None),
                    Medication.effective_period_start <= today_local,
                )
            )
            .filter(
                or_(
                    Medication.effective_period_end.is_(None),
                    Medication.effective_period_end >= today_local,
                )
            )
            .all()
        )
        return rows

    def _fetch_already_fired(
        self, db: Session, today_local: date, current_hhmm: str
    ) -> set:
        """Return set of medication_ids already fired for this minute today.

        Bounded by the UTC equivalent of facility-local midnight (NOT
        naive-UTC midnight of the local date — the two diverge by the
        facility offset and the latter excludes legitimate history rows
        for east-of-UTC timezones).
        """
        scheduled_local_date = today_local.isoformat()
        today_start_utc = facility_day_start_utc(today_local)

        recent = (
            db.query(NotificationHistory.event_data)
            .filter(NotificationHistory.event_type == "medication_reminder_due")
            .filter(NotificationHistory.created_at >= today_start_utc)
            .all()
        )

        already_fired = set()
        for (data,) in recent:
            data = data or {}
            if data.get("is_test"):
                continue
            if (
                data.get("scheduled_local_date") == scheduled_local_date
                and data.get("scheduled_time_local") == current_hhmm
            ):
                medication_id = data.get("medication_id")
                if medication_id is not None:
                    already_fired.add(medication_id)
        return already_fired

    async def _publish_reminder(
        self,
        row,
        scheduled_time_local: str,
        scheduled_local_date: str,
    ) -> None:
        """Publish a single MedicationReminderDueEvent for a candidate row."""
        event = MedicationReminderDueEvent(
            user_id=row.owner_user_id,
            patient_id=row.patient_id,
            medication_id=row.id,
            medication_name=row.medication_name,
            dosage=row.dosage,
            reminder_message=row.reminder_message,
            scheduled_time_local=scheduled_time_local,
            scheduled_local_date=scheduled_local_date,
        )

        await get_event_bus().publish(event)

        logger.info(
            "Medication reminder published",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "medication_reminder_published",
                "medication_id": row.id,
                LogFields.PATIENT_ID: row.patient_id,
                LogFields.USER_ID: row.owner_user_id,
                "scheduled_time_local": scheduled_time_local,
            },
        )
