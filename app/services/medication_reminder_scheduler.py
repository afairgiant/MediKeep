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
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.events.bus import get_event_bus
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.datetime_utils import get_facility_timezone, to_utc
from app.events.medication_events import MedicationReminderDueEvent
from app.models.clinical import Medication
from app.models.notifications import NotificationHistory
from app.models.patient import Patient

logger = get_logger(__name__, "app")

JOB_ID = "medication_reminder_tick"


class MedicationReminderSchedulerService:
    """Singleton APScheduler wrapper that ticks medication reminders."""

    _instance: Optional["MedicationReminderSchedulerService"] = None

    def __init__(self) -> None:
        # Pass the facility timezone so CronTrigger evaluates wall-clock time
        # in the right zone. The backup scheduler doesn't do this, which is
        # acceptable for its single 02:00-by-default job but would be wrong
        # for per-minute reminder firing.
        self._scheduler: AsyncIOScheduler = AsyncIOScheduler(
            timezone=get_facility_timezone()
        )

    @classmethod
    def get_instance(cls) -> "MedicationReminderSchedulerService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Tests only — tear down the singleton."""
        if cls._instance is not None:
            if cls._instance._scheduler.running:
                cls._instance._scheduler.shutdown(wait=False)
            cls._instance = None

    async def start(self) -> None:
        """Start the scheduler and register the per-minute tick job."""
        if not self._scheduler.running:
            self._scheduler.start()

        self._scheduler.add_job(
            self._tick,
            # The explicit timezone matters: a pre-built CronTrigger defaults
            # to the HOST timezone (tzlocal), not the scheduler's timezone.
            trigger=CronTrigger(second=0, timezone=get_facility_timezone()),
            id=JOB_ID,
            name="Medication Reminder Tick",
            replace_existing=True,
            misfire_grace_time=120,
            coalesce=True,
        )

        logger.info(
            "Medication reminder scheduler started",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "medication_reminder_scheduler_started",
            },
        )

    async def shutdown(self) -> None:
        """Gracefully shut down the scheduler."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info(
                "Medication reminder scheduler stopped",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "medication_reminder_scheduler_stopped",
                },
            )

    async def _tick(self) -> None:
        """Discover due reminders and publish events for each."""
        from app.core.database.database import SessionLocal

        db: Session = SessionLocal()
        try:
            now_local = datetime.now(get_facility_timezone())
            current_hhmm = now_local.strftime("%H:%M")
            today_local = now_local.date()

            candidates_seen, due, skipped_dedup, published = await self._process_tick(
                db, today_local, current_hhmm
            )

            # Idle ticks (no candidates due) are the common case; logging them
            # at INFO buries the rare actual work in 1440 noop lines per day.
            log = logger.info if due else logger.debug
            log(
                "Medication reminder tick complete",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "medication_reminders_tick_complete",
                    "candidates_seen": candidates_seen,
                    "due": due,
                    "skipped_dedup": skipped_dedup,
                    "events_published": published,
                },
            )
        except Exception as e:
            logger.error(
                "Medication reminder tick failed",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "medication_reminder_tick_error",
                    LogFields.ERROR: str(e),
                },
                exc_info=True,
            )
        finally:
            db.close()

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
        due_rows = [
            row
            for row in candidates
            if isinstance(row.reminder_times, list)
            and current_hhmm in row.reminder_times
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
        reminder_times, owner_user_id) for enabled+active+in-period meds.

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
        today_start_local = datetime.combine(today_local, datetime.min.time()).replace(
            tzinfo=get_facility_timezone()
        )
        today_start_utc = to_utc(today_start_local)

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
