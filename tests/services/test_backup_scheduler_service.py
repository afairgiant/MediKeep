"""Tests for BackupSchedulerService."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.backup_scheduler_service import (
    DEFAULT_CONFIG,
    JOB_ID,
    SETTING_KEY,
    VALID_DAYS_OF_WEEK,
    VALID_PRESETS,
    BackupSchedulerService,
)


@pytest.fixture(autouse=True)
def reset_scheduler():
    """Reset the singleton before and after each test."""
    BackupSchedulerService.reset_instance()
    yield
    BackupSchedulerService.reset_instance()


class TestGetScheduleDefaults:
    """Test default configuration behavior."""

    def test_default_config_when_no_setting_exists(self, db_session):
        """Fresh install returns disabled config."""
        service = BackupSchedulerService.get_instance()

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            config = service.get_schedule()

        assert config["preset"] == "disabled"
        assert config["enabled"] is False
        assert config["time_of_day"] == "02:00"
        assert config["last_run_at"] is None
        assert config["next_run_at"] is None


class TestUpdateSchedule:
    """Test schedule update logic."""

    @pytest.mark.asyncio
    async def test_update_to_daily(self, db_session):
        """Setting daily preset persists and creates a job."""
        service = BackupSchedulerService.get_instance()
        service._scheduler.start()

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config") as mock_save:
                config = service.update_schedule(
                    preset="daily", time_of_day="03:30"
                )

        assert config["preset"] == "daily"
        assert config["enabled"] is True
        assert config["time_of_day"] == "03:30"
        mock_save.assert_called_once()

        job = service._scheduler.get_job(JOB_ID)
        assert job is not None

        service._scheduler.shutdown(wait=False)

    @pytest.mark.asyncio
    async def test_update_to_every_6_hours(self, db_session):
        """Setting interval preset creates interval trigger."""
        service = BackupSchedulerService.get_instance()
        service._scheduler.start()

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config"):
                config = service.update_schedule(preset="every_6_hours")

        assert config["preset"] == "every_6_hours"
        assert config["enabled"] is True

        job = service._scheduler.get_job(JOB_ID)
        assert job is not None

        service._scheduler.shutdown(wait=False)

    @pytest.mark.asyncio
    async def test_update_to_disabled_removes_job(self, db_session):
        """Disabling schedule removes the job."""
        service = BackupSchedulerService.get_instance()
        service._scheduler.start()

        enabled_config = {**DEFAULT_CONFIG, "preset": "daily", "enabled": True}
        with patch.object(service, "_load_config", return_value=enabled_config):
            with patch.object(service, "_save_config"):
                service.update_schedule(preset="daily", time_of_day="02:00")

        assert service._scheduler.get_job(JOB_ID) is not None

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config"):
                service.update_schedule(preset="disabled")

        assert service._scheduler.get_job(JOB_ID) is None

        service._scheduler.shutdown(wait=False)

    def test_invalid_preset_raises_error(self):
        """Invalid preset raises ValueError."""
        service = BackupSchedulerService.get_instance()
        with pytest.raises(ValueError, match="Invalid preset"):
            service.update_schedule(preset="every_3_hours")

    def test_invalid_time_format_raises_error(self):
        """Invalid time format raises ValueError."""
        service = BackupSchedulerService.get_instance()
        with pytest.raises(ValueError, match="HH:MM"):
            service.update_schedule(preset="daily", time_of_day="25:00")

    def test_invalid_time_non_numeric_raises_error(self):
        """Non-numeric time raises ValueError."""
        service = BackupSchedulerService.get_instance()
        with pytest.raises(ValueError, match="HH:MM"):
            service.update_schedule(preset="daily", time_of_day="abc")

    @pytest.mark.asyncio
    async def test_update_to_weekly_with_custom_day(self, db_session):
        """Setting weekly preset with a custom day_of_week persists and creates a job."""
        service = BackupSchedulerService.get_instance()
        service._scheduler.start()

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config") as mock_save:
                config = service.update_schedule(
                    preset="weekly", time_of_day="05:00", day_of_week="wed"
                )

        assert config["preset"] == "weekly"
        assert config["enabled"] is True
        assert config["time_of_day"] == "05:00"
        assert config["day_of_week"] == "wed"
        mock_save.assert_called_once()

        job = service._scheduler.get_job(JOB_ID)
        assert job is not None

        service._scheduler.shutdown(wait=False)

    def test_invalid_day_of_week_raises_error(self):
        """Invalid day_of_week raises ValueError."""
        service = BackupSchedulerService.get_instance()
        with pytest.raises(ValueError, match="Invalid day_of_week"):
            service.update_schedule(preset="weekly", day_of_week="monday")


class TestRunBackup:
    """Test the scheduled backup execution."""

    @pytest.mark.asyncio
    async def test_run_backup_success(self, db_session):
        """Successful backup updates last_run_status to success."""
        service = BackupSchedulerService.get_instance()

        mock_result = {
            "filename": "full_backup_20260225.zip",
            "size_bytes": 1024,
        }

        mock_db = MagicMock()
        mock_bs = MagicMock()
        mock_bs.create_full_backup = AsyncMock(return_value=mock_result)

        with patch.object(service, "_update_last_run") as mock_update:
            with patch(
                "app.core.database.database.SessionLocal", return_value=mock_db
            ):
                with patch(
                    "app.services.backup_service.BackupService",
                    return_value=mock_bs,
                ):
                    await service._run_backup()

                    mock_bs.create_full_backup.assert_called_once_with(
                        description="Scheduled auto-backup"
                    )
                    mock_update.assert_called_once_with(mock_db, "success", None)
                    mock_db.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_backup_failure_records_error(self, db_session):
        """Failed backup records error in last_run_error."""
        service = BackupSchedulerService.get_instance()

        mock_db = MagicMock()
        mock_bs = MagicMock()
        mock_bs.create_full_backup = AsyncMock(
            side_effect=Exception("pg_dump failed")
        )

        with patch.object(service, "_update_last_run") as mock_update:
            with patch(
                "app.core.database.database.SessionLocal", return_value=mock_db
            ):
                with patch(
                    "app.services.backup_service.BackupService",
                    return_value=mock_bs,
                ):
                    await service._run_backup()

                    mock_update.assert_called_once_with(
                        mock_db, "failed", "pg_dump failed"
                    )
                    mock_db.close.assert_called_once()


class TestSingleton:
    """Test singleton behavior."""

    def test_get_instance_returns_same_object(self):
        """get_instance returns the same instance."""
        a = BackupSchedulerService.get_instance()
        b = BackupSchedulerService.get_instance()
        assert a is b

    def test_reset_instance_clears_singleton(self):
        """reset_instance creates fresh instance next time."""
        a = BackupSchedulerService.get_instance()
        BackupSchedulerService.reset_instance()
        b = BackupSchedulerService.get_instance()
        assert a is not b
