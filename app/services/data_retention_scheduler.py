"""
Runs the data retention cleanup daily, plus once shortly after startup.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.datetime_utils import get_facility_timezone
from app.services.data_retention_service import run_data_retention

logger = get_logger(__name__, "app")

DAILY_JOB_ID = "data_retention_daily"
STARTUP_JOB_ID = "data_retention_startup"
STARTUP_DELAY = timedelta(minutes=5)


def _run_in_new_session() -> None:
    from app.core.database.database import SessionLocal

    db = SessionLocal()
    try:
        run_data_retention(db)
    except Exception as exc:  # pylint: disable=broad-exception-caught
        db.rollback()
        logger.error(
            "Data retention run failed",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "data_retention_failed",
                LogFields.ERROR: str(exc),
            },
        )
    finally:
        db.close()


class DataRetentionSchedulerService:
    """Singleton APScheduler wrapper for the retention cleanup."""

    _instance: Optional["DataRetentionSchedulerService"] = None

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler = AsyncIOScheduler(
            timezone=get_facility_timezone()
        )

    @classmethod
    def get_instance(cls) -> "DataRetentionSchedulerService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Tests only - tear down the singleton."""
        if cls._instance is not None:
            if cls._instance._scheduler.running:
                try:
                    cls._instance._scheduler.shutdown(wait=False)
                except RuntimeError:
                    pass  # Started by an app-startup test whose event loop is already closed
            cls._instance = None

    async def start(self) -> None:
        """Register the daily and post-startup cleanup jobs."""
        if not self._scheduler.running:
            self._scheduler.start()

        tz = self._scheduler.timezone
        self._scheduler.add_job(
            self.run,
            # A pre-built CronTrigger defaults to the host timezone, not the scheduler's.
            trigger=CronTrigger(hour=3, minute=30, timezone=tz),
            id=DAILY_JOB_ID,
            name="Data Retention Cleanup",
            replace_existing=True,
            misfire_grace_time=3600,
            coalesce=True,
        )
        # Installs that are off overnight would otherwise never clean up.
        self._scheduler.add_job(
            self.run,
            trigger=DateTrigger(run_date=datetime.now(tz) + STARTUP_DELAY),
            id=STARTUP_JOB_ID,
            name="Data Retention Cleanup (startup)",
            replace_existing=True,
        )

        logger.info(
            "Data retention scheduler started",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "data_retention_scheduler_started",
            },
        )

    async def shutdown(self) -> None:
        """Gracefully shut down the scheduler."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info(
                "Data retention scheduler stopped",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "data_retention_scheduler_stopped",
                },
            )

    async def run(self) -> None:
        """Run the cleanup off the event loop so large deletes don't block requests."""
        await asyncio.to_thread(_run_in_new_session)
