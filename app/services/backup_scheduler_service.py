"""
Auto-Backup Scheduler Service

Manages periodic automatic full backups using APScheduler.
Configuration is persisted in the SystemSetting table as a JSON blob.
"""

import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__, "app")

SETTING_KEY = "auto_backup_schedule"
JOB_ID = "auto_backup_job"

VALID_PRESETS = {"disabled", "every_6_hours", "every_12_hours", "daily", "weekly"}
VALID_DAYS_OF_WEEK = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}

DEFAULT_CONFIG: Dict[str, Any] = {
    "preset": "disabled",
    "time_of_day": "02:00",
    "day_of_week": "sun",
    "enabled": False,
    "last_run_at": None,
    "last_run_status": None,
    "last_run_error": None,
}

TIME_FORMAT_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class BackupSchedulerService:
    """Manages APScheduler for automatic backup scheduling."""

    _instance: Optional["BackupSchedulerService"] = None

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler = AsyncIOScheduler()

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
                cls._instance._scheduler.shutdown(wait=False)
            cls._instance = None

    async def start(self) -> None:
        """Start the scheduler and restore schedule from DB."""
        config = self._load_config()
        self._scheduler.start()
        if config.get("enabled") and config.get("preset") != "disabled":
            self._apply_schedule(config)
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
        if time_of_day is not None:
            config["time_of_day"] = time_of_day
        if day_of_week is not None:
            config["day_of_week"] = day_of_week

        self._save_config(config)
        self._apply_schedule(config)

        config["next_run_at"] = self._get_next_run_time()
        return config

    def _apply_schedule(self, config: Dict[str, Any]) -> None:
        """Apply schedule config to the APScheduler instance."""
        existing = self._scheduler.get_job(JOB_ID)
        if existing:
            self._scheduler.remove_job(JOB_ID)

        preset = config.get("preset", "disabled")
        if preset == "disabled" or not config.get("enabled"):
            return

        trigger = self._build_trigger(config)
        self._scheduler.add_job(
            self._run_backup,
            trigger=trigger,
            id=JOB_ID,
            name="Auto Full Backup",
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

    def _build_trigger(self, config: Dict[str, Any]):
        """Build APScheduler trigger from config."""
        preset = config["preset"]
        time_of_day = config.get("time_of_day", "02:00")
        hour, minute = map(int, time_of_day.split(":"))

        if preset == "every_6_hours":
            return IntervalTrigger(hours=6)
        elif preset == "every_12_hours":
            return IntervalTrigger(hours=12)
        elif preset == "daily":
            return CronTrigger(hour=hour, minute=minute)
        elif preset == "weekly":
            day = config.get("day_of_week", "sun")
            return CronTrigger(day_of_week=day, hour=hour, minute=minute)
        else:
            raise ValueError(f"Cannot build trigger for preset: {preset}")

    async def _run_backup(self) -> None:
        """Execute a scheduled backup. Creates its own DB session."""
        from app.core.database.database import SessionLocal
        from app.services.backup_service import BackupService

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

            self._update_last_run(db, "success", None)

            logger.info(
                "Scheduled auto-backup completed",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "auto_backup_completed",
                    "backup_filename": result.get("filename"),
                    "size_bytes": result.get("size_bytes"),
                },
            )
        except Exception as e:
            self._update_last_run(db, "failed", str(e))
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

    def _get_next_run_time(self) -> Optional[str]:
        """Get the next scheduled run time as ISO string."""
        job = self._scheduler.get_job(JOB_ID)
        if job and job.next_run_time:
            return job.next_run_time.isoformat()
        return None

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
        """Save schedule config to SystemSetting table."""
        from app.core.database.database import SessionLocal
        from app.crud.system_setting import system_setting

        db = SessionLocal()
        try:
            system_setting.set_setting(db, SETTING_KEY, json.dumps(config))
        finally:
            db.close()

    def _update_last_run(self, db, status: str, error: Optional[str]) -> None:
        """Update last_run fields in the persisted config."""
        from app.crud.system_setting import system_setting

        config = self._load_config()
        config["last_run_at"] = datetime.now(timezone.utc).isoformat()
        config["last_run_status"] = status
        config["last_run_error"] = error
        system_setting.set_setting(db, SETTING_KEY, json.dumps(config))
