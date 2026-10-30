"""
Auto-Backup Scheduler Service

Manages periodic automatic full backups using APScheduler.
Configuration is persisted in the SystemSetting table as a JSON blob.
"""

import copy
import json
import os
from datetime import datetime, timedelta, timezone
from itertools import islice, takewhile
from typing import Any, Dict, Iterator, List, Optional

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

VALID_PRESETS = {"disabled", "interval", "daily", "weekly", "monthly"}
DAYS_OF_WEEK = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
VALID_DAYS_OF_WEEK = frozenset(DAYS_OF_WEEK)
MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS = 1, 168
# Every month has a 28th, so a monthly backup is never skipped.
MIN_DAY_OF_MONTH, MAX_DAY_OF_MONTH = 1, 28
# Presets saved before custom schedules, converted on load.
LEGACY_INTERVAL_PRESETS = {"every_6_hours": 6, "every_12_hours": 12}
UPCOMING_RUN_COUNT = 3
# Gives the app time to finish starting before an overdue backup runs.
CATCH_UP_DELAY = timedelta(minutes=5)

DEFAULT_CONFIG: Dict[str, Any] = {
    "preset": "disabled",
    "time_of_day": "02:00",
    "interval_hours": 12,
    "days_of_week": ["sun"],
    "day_of_month": 1,
    "enabled": False,
    "last_run_at": None,
    "last_run_status": None,
    "last_run_error": None,
    "schedule_saved_at": None,
}
LAST_RUN_KEYS = ("last_run_at", "last_run_status", "last_run_error")

TIME_FORMAT_RE = HHMM_24H_RE


class ScheduleValidationError(ValueError):
    """A schedule update was rejected; the message is safe to show the admin."""


def clean_schedule(
    preset: str,
    time_of_day: Optional[str] = None,
    interval_hours: Optional[int] = None,
    days_of_week: Optional[List[str]] = None,
    day_of_month: Optional[int] = None,
) -> Dict[str, Any]:
    """The fields to store for preset; fields the preset does not use are left out.

    days_of_week comes back de-duplicated, Monday first.

    Raises:
        ScheduleValidationError: a field is invalid, or the preset's own field is missing.
    """
    if preset not in VALID_PRESETS:
        raise ScheduleValidationError(
            f"Invalid preset: {preset}. "
            f"Must be one of: {', '.join(sorted(VALID_PRESETS))}"
        )
    cleaned: Dict[str, Any] = {"preset": preset}

    if time_of_day is not None:
        if not TIME_FORMAT_RE.match(time_of_day):
            raise ScheduleValidationError(
                "time_of_day must be in HH:MM format (24-hour)"
            )
        cleaned["time_of_day"] = time_of_day

    if preset == "interval":
        if interval_hours is None or not (
            MIN_INTERVAL_HOURS <= interval_hours <= MAX_INTERVAL_HOURS
        ):
            raise ScheduleValidationError(
                f"interval_hours must be between {MIN_INTERVAL_HOURS} "
                f"and {MAX_INTERVAL_HOURS}"
            )
        cleaned["interval_hours"] = interval_hours
    elif preset == "weekly":
        if not days_of_week:
            raise ScheduleValidationError("days_of_week must name at least one day")
        invalid = sorted(set(days_of_week) - VALID_DAYS_OF_WEEK)
        if invalid:
            raise ScheduleValidationError(
                f"Invalid day_of_week: {', '.join(invalid)}. "
                f"Must be one of: {', '.join(DAYS_OF_WEEK)}"
            )
        cleaned["days_of_week"] = [d for d in DAYS_OF_WEEK if d in days_of_week]
    elif preset == "monthly":
        if day_of_month is None or not (
            MIN_DAY_OF_MONTH <= day_of_month <= MAX_DAY_OF_MONTH
        ):
            raise ScheduleValidationError(
                f"day_of_month must be between {MIN_DAY_OF_MONTH} "
                f"and {MAX_DAY_OF_MONTH}"
            )
        cleaned["day_of_month"] = day_of_month
    return cleaned


def _config_from_stored(raw: Optional[str]) -> Dict[str, Any]:
    """Stored config over the defaults, with pre-custom-schedule configs converted."""
    stored = json.loads(raw) if raw else {}
    legacy_hours = LEGACY_INTERVAL_PRESETS.get(stored.get("preset"))
    if legacy_hours:
        stored["preset"] = "interval"
        stored["interval_hours"] = legacy_hours
    legacy_day = stored.pop("day_of_week", None)
    if legacy_day in VALID_DAYS_OF_WEEK and "days_of_week" not in stored:
        stored["days_of_week"] = [legacy_day]
    return {**copy.deepcopy(DEFAULT_CONFIG), **stored}


def _fire_times(trigger, first: Optional[datetime]) -> Iterator[datetime]:
    """first, then each later fire time of trigger."""
    fire = first
    while fire is not None:
        yield fire
        fire = trigger.get_next_fire_time(fire, fire)


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
        """Stored schedule config plus next_run_at, upcoming_runs and timezone."""
        return self._with_run_times(self._load_config())

    def update_schedule(
        self,
        preset: str,
        time_of_day: Optional[str] = None,
        interval_hours: Optional[int] = None,
        days_of_week: Optional[List[str]] = None,
        day_of_month: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Validate, persist, and apply a new schedule; see clean_schedule().

        Fields other presets use keep their stored values.

        Raises:
            ScheduleValidationError: the input is invalid.
        """
        cleaned = clean_schedule(
            preset, time_of_day, interval_hours, days_of_week, day_of_month
        )
        config = self._draft_config(cleaned, datetime.now(timezone.utc))
        self._save_config(config)
        self._apply_schedule(config, catch_up_at=self._pending_catch_up())
        return self._with_run_times(config)

    def preview_schedule(
        self,
        cleaned: Dict[str, Any],
        retention_days: int,
        min_count: int,
        latest_backup_size: Optional[int],
    ) -> Dict[str, Any]:
        """Run times and disk estimate for a schedule as saving it would apply it.

        Saves nothing. retained_count is how many scheduled backups clean-up
        would keep: the runs inside the retention window, never below min_count.
        Other backups are ignored, though clean-up counts them toward min_count.

        Args:
            cleaned: output of clean_schedule().
            latest_backup_size: bytes; estimated_bytes is None without it.
        """
        preview: Dict[str, Any] = {
            "upcoming_runs": [],
            "timezone": str(self._timezone),
            "latest_backup_size_bytes": latest_backup_size,
            "retained_count": None,
            "estimated_bytes": None,
        }
        if cleaned["preset"] == "disabled":
            return preview

        now = datetime.now(self._timezone)
        config = self._draft_config(cleaned, now)
        catch_up_at = self._pending_catch_up()
        trigger = self._build_trigger(config, catch_up_at)
        first = trigger.get_next_fire_time(None, now)
        preview["upcoming_runs"] = self._upcoming_runs(trigger, first, catch_up_at)

        window_end = now + timedelta(days=retention_days)
        in_window = takewhile(lambda t: t < window_end, _fire_times(trigger, first))
        retained = max(sum(1 for _ in in_window), min_count)
        preview["retained_count"] = retained
        if latest_backup_size is not None:
            preview["estimated_bytes"] = retained * latest_backup_size
        return preview

    def _draft_config(self, cleaned: Dict[str, Any], now: datetime) -> Dict[str, Any]:
        """The stored config with cleaned applied, as saving it at now would."""
        config = self._load_config()
        config.update(cleaned)
        config["enabled"] = cleaned["preset"] != "disabled"
        config["schedule_saved_at"] = now.isoformat()
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

        if preset == "interval":
            hours = config["interval_hours"]
            anchor = catch_up_at or _schedule_anchor(config)
            return IntervalTrigger(
                hours=hours,
                start_date=self._interval_start(anchor, timedelta(hours=hours)),
                timezone=tz,
            )
        if preset == "daily":
            return CronTrigger(hour=hour, minute=minute, timezone=tz)
        if preset == "weekly":
            days = ",".join(config["days_of_week"])
            return CronTrigger(day_of_week=days, hour=hour, minute=minute, timezone=tz)
        if preset == "monthly":
            return CronTrigger(
                day=config["day_of_month"], hour=hour, minute=minute, timezone=tz
            )
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

    def _pending_catch_up(self) -> Optional[datetime]:
        return getattr(self._scheduler.get_job(CATCH_UP_JOB_ID), "next_run_time", None)

    def _upcoming_runs(
        self, trigger, first: Optional[datetime], catch_up_at: Optional[datetime]
    ) -> List[str]:
        """The next UPCOMING_RUN_COUNT runs, catch-up included, as ISO strings."""
        runs = list(islice(_fire_times(trigger, first), UPCOMING_RUN_COUNT))
        if catch_up_at is not None:
            runs.append(catch_up_at)
        return [t.isoformat() for t in sorted(runs)[:UPCOMING_RUN_COUNT]]

    def _with_run_times(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """config plus the scheduled jobs' run times and the scheduler time zone."""
        job = self._scheduler.get_job(JOB_ID)
        upcoming = self._upcoming_runs(
            getattr(job, "trigger", None),
            getattr(job, "next_run_time", None),
            self._pending_catch_up(),
        )
        config["upcoming_runs"] = upcoming
        config["next_run_at"] = upcoming[0] if upcoming else None
        config["timezone"] = str(self._timezone)
        return config

    def _load_config(self) -> Dict[str, Any]:
        """Load schedule config from SystemSetting table."""
        from app.core.database.database import SessionLocal
        from app.crud.system_setting import system_setting

        db = SessionLocal()
        try:
            return _config_from_stored(system_setting.get_setting(db, SETTING_KEY))
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

        config = _config_from_stored(system_setting.get_setting(db, SETTING_KEY))
        config["last_run_at"] = run_at.isoformat()
        config["last_run_status"] = status
        config["last_run_error"] = error
        system_setting.set_setting(db, SETTING_KEY, json.dumps(config))
