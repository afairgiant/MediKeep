"""
Auto-Backup Scheduler Service

Manages periodic automatic full backups using APScheduler.
Configuration is persisted in the SystemSetting table as a JSON blob.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.datetime_utils import HHMM_24H_RE, get_facility_timezone

logger = get_logger(__name__, "app")

SETTING_KEY = "auto_backup_schedule"
JOB_ID = "auto_backup_job"
CATCH_UP_JOB_ID = "auto_backup_catch_up_job"

VALID_PRESETS = {"disabled", "every_6_hours", "every_12_hours", "daily", "weekly"}
VALID_DAYS_OF_WEEK = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
INTERVAL_HOURS = {"every_6_hours": 6, "every_12_hours": 12}
# Gives the app time to finish starting before an overdue backup runs.
CATCH_UP_DELAY = timedelta(minutes=5)

DEFAULT_CONFIG: Dict[str, Any] = {
    "preset": "disabled",
    "time_of_day": "02:00",
    "day_of_week": "sun",
    "enabled": False,
    "last_run_at": None,
    "last_run_status": None,
    "last_run_error": None,
    "schedule_saved_at": None,
}
LAST_RUN_KEYS = ("last_run_at", "last_run_status", "last_run_error")

TIME_FORMAT_RE = HHMM_24H_RE


def _parse_past_time(value: Optional[str]) -> Optional[datetime]:
    """Stored timestamp; None when missing, malformed, naive or in the future."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None or parsed > datetime.now(timezone.utc):
        return None
    return parsed


def _schedule_anchor(config: Dict[str, Any]) -> Optional[datetime]:
    """The later of the last run and the last save; runs are counted from here."""
    times = [
        t
        for t in (
            _parse_past_time(config.get("last_run_at")),
            _parse_past_time(config.get("schedule_saved_at")),
        )
        if t is not None
    ]
    return max(times, default=None)


class BackupSchedulerService:
    """Manages APScheduler for automatic backup scheduling."""

    _instance: Optional["BackupSchedulerService"] = None

    def __init__(self) -> None:
        # Without TZ, APScheduler's host-zone default keeps run times where they were.
        self._scheduler: AsyncIOScheduler = (
            AsyncIOScheduler(timezone=get_facility_timezone())
            if os.getenv("TZ")
            else AsyncIOScheduler()
        )
        self._timezone = self._scheduler.timezone

    @classmethod
    def get_instance(cls) -> "BackupSchedulerService":
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset singleton. Only use in tests."""
        if cls._instance is not None:
            if cls._instance._scheduler.running:
                try:
                    cls._instance._scheduler.shutdown(wait=False)
                except RuntimeError:
                    pass  # Started by an async test whose event loop is already closed
            cls._instance = None

    async def start(self) -> None:
        """Start the scheduler and restore schedule from DB.

        A run missed while the app was down is made up once, CATCH_UP_DELAY
        after startup.
        """
        config = self._load_config()
        if not self._scheduler.running:
            self._scheduler.start()
        if config.get("enabled") and config.get("preset") != "disabled":
            self._apply_schedule(config, catch_up_at=self._catch_up_time(config))
        logger.info(
            "Backup scheduler started",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "backup_scheduler_started",
                "preset": config.get("preset", "disabled"),
            },
        )

    async def shutdown(self) -> None:
        """Gracefully shut down the scheduler."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info(
                "Backup scheduler shut down",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "backup_scheduler_stopped",
                },
            )

    def get_schedule(self) -> Dict[str, Any]:
        """Get current schedule config from DB with next_run_at."""
        config = self._load_config()
        config["next_run_at"] = self._get_next_run_time()
        return config

    def update_schedule(
        self,
        preset: str,
        time_of_day: Optional[str] = None,
        day_of_week: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Validate, persist, and apply a new schedule."""
        if preset not in VALID_PRESETS:
            raise ValueError(
                f"Invalid preset: {preset}. "
                f"Must be one of: {', '.join(sorted(VALID_PRESETS))}"
            )

        if time_of_day is not None and not TIME_FORMAT_RE.match(time_of_day):
            raise ValueError("time_of_day must be in HH:MM format (24-hour)")

        if day_of_week is not None and day_of_week not in VALID_DAYS_OF_WEEK:
            raise ValueError(
                f"Invalid day_of_week: {day_of_week}. "
                f"Must be one of: {', '.join(sorted(VALID_DAYS_OF_WEEK))}"
            )

        config = self._load_config()
        config["preset"] = preset
        config["enabled"] = preset != "disabled"
        config["schedule_saved_at"] = datetime.now(timezone.utc).isoformat()
        if time_of_day is not None:
            config["time_of_day"] = time_of_day
        if day_of_week is not None:
            config["day_of_week"] = day_of_week

        self._save_config(config)
        pending = self._scheduler.get_job(CATCH_UP_JOB_ID)
        self._apply_schedule(
            config, catch_up_at=getattr(pending, "next_run_time", None)
        )

        config["next_run_at"] = self._get_next_run_time()
        return config

    def _apply_schedule(
        self, config: Dict[str, Any], catch_up_at: Optional[datetime] = None
    ) -> None:
        """Replace the scheduled jobs, plus a one-off run at catch_up_at if given."""
        for job_id in (JOB_ID, CATCH_UP_JOB_ID):
            if self._scheduler.get_job(job_id):
                self._scheduler.remove_job(job_id)

        preset = config.get("preset", "disabled")
        if preset == "disabled" or not config.get("enabled"):
            return

        self._scheduler.add_job(
            self._run_backup,
            trigger=self._build_trigger(config, catch_up_at),
            id=JOB_ID,
            name="Auto Full Backup",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        if catch_up_at is not None:
            self._scheduler.add_job(
                self._run_backup,
                trigger=DateTrigger(run_date=catch_up_at, timezone=self._timezone),
                id=CATCH_UP_JOB_ID,
                name="Auto Full Backup (catch-up)",
                replace_existing=True,
                misfire_grace_time=3600,
            )

        logger.info(
            "Backup schedule applied",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "backup_schedule_applied",
                "preset": preset,
                "time_of_day": config.get("time_of_day"),
            },
        )

    def _build_trigger(
        self, config: Dict[str, Any], catch_up_at: Optional[datetime] = None
    ):
        """Recurring trigger; an interval counts from catch_up_at when given."""
        preset = config["preset"]
        time_of_day = config.get("time_of_day", "02:00")
        hour, minute = map(int, time_of_day.split(":"))
        # A pre-built trigger defaults to the host timezone, not the scheduler's.
        tz = self._timezone

        if preset in INTERVAL_HOURS:
            hours = INTERVAL_HOURS[preset]
            anchor = catch_up_at or _schedule_anchor(config)
            return IntervalTrigger(
                hours=hours,
                start_date=self._interval_start(anchor, timedelta(hours=hours)),
                timezone=tz,
            )
        if preset == "daily":
            return CronTrigger(hour=hour, minute=minute, timezone=tz)
        if preset == "weekly":
            day = config.get("day_of_week", "sun")
            return CronTrigger(day_of_week=day, hour=hour, minute=minute, timezone=tz)
        raise ValueError(f"Cannot build trigger for preset: {preset}")

    def _interval_start(
        self, anchor: Optional[datetime], interval: timedelta
    ) -> datetime:
        """One interval after anchor, or one interval from now if that has passed."""
        now = datetime.now(self._timezone)
        if anchor is None or anchor + interval <= now:
            return now + interval
        return anchor + interval

    def _catch_up_time(self, config: Dict[str, Any]) -> Optional[datetime]:
        """When to make up a missed run; None if none was missed or one is due anyway."""
        anchor = _schedule_anchor(config)
        if anchor is None:
            return None
        trigger = self._build_trigger(config)
        due = trigger.get_next_fire_time(anchor, anchor)
        now = datetime.now(self._timezone)
        if due is None or due > now:
            return None
        catch_up_at = now + CATCH_UP_DELAY
        next_regular = trigger.get_next_fire_time(None, now)
        if next_regular is not None and next_regular <= catch_up_at:
            return None
        return catch_up_at

    async def _run_backup(self) -> None:
        """Execute a scheduled backup. Creates its own DB session."""
        from app.core.database.database import SessionLocal
        from app.services.backup_service import BackupService

        started_at = datetime.now(timezone.utc)
        db = SessionLocal()
        try:
            logger.info(
                "Scheduled auto-backup starting",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "auto_backup_started",
                },
            )

            backup_service = BackupService(db)
            result = await backup_service.create_full_backup(
                description="Scheduled auto-backup"
            )

            self._update_last_run(db, started_at, "success", None)

            logger.info(
                "Scheduled auto-backup completed",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "auto_backup_completed",
                    "backup_filename": result.get("filename"),
                    "size_bytes": result.get("size_bytes"),
                },
            )

            if settings.BACKUP_AUTO_CLEANUP_ENABLED:
                await self._cleanup_old_backups(backup_service)
        except Exception as e:
            self._update_last_run(db, started_at, "failed", str(e))
            logger.error(
                "Scheduled auto-backup failed",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "auto_backup_failed",
                    LogFields.ERROR: str(e),
                },
            )
        finally:
            db.close()

    async def _cleanup_old_backups(self, backup_service) -> None:
        """Apply the retention policy; a failure is logged, never raised."""
        try:
            result = await backup_service.cleanup_old_backups()
            error_count = len(result.get("errors") or [])
            extra = {
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "auto_backup_cleanup_completed",
                "deleted_count": result.get("total_deleted", 0),
            }
            if error_count:
                extra[LogFields.EVENT] = "auto_backup_cleanup_failed"
                extra["error_count"] = error_count
                logger.warning(
                    "Auto-backup clean-up could not delete some backups", extra=extra
                )
            else:
                logger.info("Auto-backup clean-up completed", extra=extra)
        except Exception as e:  # pylint: disable=broad-exception-caught
            logger.error(
                "Auto-backup clean-up failed",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "auto_backup_cleanup_failed",
                    LogFields.ERROR: str(e),
                },
            )

    def _get_next_run_time(self) -> Optional[str]:
        """Earliest pending run, catch-up included, as ISO string."""
        run_times = [
            getattr(self._scheduler.get_job(job_id), "next_run_time", None)
            for job_id in (JOB_ID, CATCH_UP_JOB_ID)
        ]
        upcoming = [t for t in run_times if t is not None]
        return min(upcoming).isoformat() if upcoming else None

    def _load_config(self) -> Dict[str, Any]:
        """Load schedule config from SystemSetting table."""
        from app.core.database.database import SessionLocal
        from app.crud.system_setting import system_setting

        db = SessionLocal()
        try:
            raw = system_setting.get_setting(db, SETTING_KEY)
            if raw:
                return {**DEFAULT_CONFIG, **json.loads(raw)}
            return dict(DEFAULT_CONFIG)
        finally:
            db.close()

    def _save_config(self, config: Dict[str, Any]) -> None:
        """Save schedule config, keeping the stored last-run fields.

        A backup can finish between loading config and saving it; its result wins.
        Updates config in place with those fields.
        """
        from app.core.database.database import SessionLocal
        from app.crud.system_setting import system_setting

        db = SessionLocal()
        try:
            raw = system_setting.get_setting(db, SETTING_KEY)
            if raw:
                stored = json.loads(raw)
                config.update({k: stored[k] for k in LAST_RUN_KEYS if k in stored})
            system_setting.set_setting(db, SETTING_KEY, json.dumps(config))
        finally:
            db.close()

    def _update_last_run(
        self, db, run_at: datetime, status: str, error: Optional[str]
    ) -> None:
        """Record a run in the persisted config; run_at is when the backup started."""
        from app.crud.system_setting import system_setting

        raw = system_setting.get_setting(db, SETTING_KEY)
        config = {**DEFAULT_CONFIG, **json.loads(raw)} if raw else dict(DEFAULT_CONFIG)
        config["last_run_at"] = run_at.isoformat()
        config["last_run_status"] = status
        config["last_run_error"] = error
        system_setting.set_setting(db, SETTING_KEY, json.dumps(config))
