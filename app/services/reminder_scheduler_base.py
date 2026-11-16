"""Shared per-minute APScheduler wrapper for reminder schedulers."""

from datetime import date, datetime
from typing import Dict, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.datetime_utils import get_facility_timezone, to_utc

logger = get_logger(__name__, "app")


def facility_day_start_utc(day: date) -> datetime:
    """UTC instant of facility-local midnight on ``day``, for bounding history queries."""
    start_local = datetime.combine(day, datetime.min.time()).replace(
        tzinfo=get_facility_timezone()
    )
    return to_utc(start_local)


class MinuteReminderScheduler:
    """Singleton that runs ``_run_tick`` on the :00 second of every facility-local minute.

    Subclasses set the job and log event names and implement ``_run_tick``, which
    returns counts for the tick log; a non-zero ``due`` count logs at INFO.
    """

    JOB_ID: str = ""
    JOB_NAME: str = ""
    LABEL: str = ""
    EVENT_PREFIX: str = ""
    TICK_COMPLETE_EVENT: str = ""

    _instance: Optional["MinuteReminderScheduler"] = None

    def __init__(self) -> None:
        # CronTrigger must see the facility zone, not the host zone, for wall-clock firing
        self._scheduler: AsyncIOScheduler = AsyncIOScheduler(
            timezone=get_facility_timezone()
        )

    @classmethod
    def get_instance(cls):
        if cls.__dict__.get("_instance") is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Tests only: tear down the singleton."""
        instance = cls.__dict__.get("_instance")
        if instance is not None:
            if instance._scheduler.running:
                instance._scheduler.shutdown(wait=False)
            cls._instance = None

    async def start(self) -> None:
        """Start the scheduler and register the per-minute tick job."""
        if not self._scheduler.running:
            self._scheduler.start()

        self._scheduler.add_job(
            self._tick,
            # A pre-built CronTrigger defaults to the host timezone, not the scheduler's
            trigger=CronTrigger(second=0, timezone=get_facility_timezone()),
            id=self.JOB_ID,
            name=self.JOB_NAME,
            replace_existing=True,
            misfire_grace_time=120,
            coalesce=True,
        )

        logger.info(
            "%s scheduler started",
            self.LABEL,
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: f"{self.EVENT_PREFIX}_scheduler_started",
            },
        )

    async def shutdown(self) -> None:
        """Gracefully shut down the scheduler."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info(
                "%s scheduler stopped",
                self.LABEL,
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: f"{self.EVENT_PREFIX}_scheduler_stopped",
                },
            )

    async def _run_tick(self, db: Session, now_local: datetime) -> Dict[str, int]:
        raise NotImplementedError

    async def _tick(self) -> None:
        from app.core.database.database import SessionLocal

        db: Session = SessionLocal()
        try:
            counts = await self._run_tick(db, datetime.now(get_facility_timezone()))
            # Idle ticks are the common case; INFO for them would bury the real work
            log = logger.info if counts.get("due") else logger.debug
            log(
                "%s tick complete",
                self.LABEL,
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: self.TICK_COMPLETE_EVENT,
                    **counts,
                },
            )
        except Exception as e:  # pylint: disable=broad-exception-caught
            logger.error(
                "%s tick failed",
                self.LABEL,
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: f"{self.EVENT_PREFIX}_tick_error",
                    LogFields.ERROR: str(e),
                },
                exc_info=True,
            )
        finally:
            db.close()
