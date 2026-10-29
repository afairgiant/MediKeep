"""Tests for BackupSchedulerService."""

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from itertools import islice
from unittest.mock import ANY, AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.services import backup_scheduler_service
from app.services.backup_scheduler_service import (
    CATCH_UP_DELAY,
    CATCH_UP_JOB_ID,
    DEFAULT_CONFIG,
    JOB_ID,
    BackupSchedulerService,
    ScheduleValidationError,
    _config_from_stored,
    _fire_times,
    clean_schedule,
)

# Slack for the time that passes between building a trigger and asserting on it.
CLOCK_TOLERANCE = timedelta(seconds=5)


def _enabled_config(preset="interval", last_run_at=None, **fields):
    return {
        **DEFAULT_CONFIG,
        "interval_hours": 6,
        "preset": preset,
        "enabled": True,
        "last_run_at": last_run_at,
        **fields,
    }


def _first_fire(trigger):
    now = datetime.now(timezone.utc)
    return trigger.get_next_fire_time(None, now)


def _ago(**kwargs):
    return (datetime.now(timezone.utc) - timedelta(**kwargs)).isoformat()


async def _start_with(service, config):
    with patch.object(service, "_load_config", return_value=config):
        await service.start()


async def _run_backup_with(service, backup_service, db=None):
    """Run one scheduled backup against mocks; returns the _update_last_run mock."""
    with patch.object(service, "_update_last_run") as mock_update, patch(
        "app.core.database.database.SessionLocal", return_value=db or MagicMock()
    ), patch("app.services.backup_service.BackupService", return_value=backup_service):
        await service._run_backup()
    return mock_update


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
                config = service.update_schedule(preset="daily", time_of_day="03:30")

        assert config["preset"] == "daily"
        assert config["enabled"] is True
        assert config["time_of_day"] == "03:30"
        mock_save.assert_called_once()

        job = service._scheduler.get_job(JOB_ID)
        assert job is not None

        service._scheduler.shutdown(wait=False)

    @pytest.mark.asyncio
    async def test_update_to_interval(self, db_session):
        """Setting interval preset creates interval trigger."""
        service = BackupSchedulerService.get_instance()
        service._scheduler.start()

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config"):
                config = service.update_schedule(preset="interval", interval_hours=3)

        assert config["preset"] == "interval"
        assert config["interval_hours"] == 3
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
    async def test_update_to_weekly_with_several_days(self, db_session):
        """Days are stored Monday first without duplicates."""
        service = BackupSchedulerService.get_instance()
        service._scheduler.start()

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config") as mock_save:
                config = service.update_schedule(
                    preset="weekly",
                    time_of_day="05:00",
                    days_of_week=["fri", "mon", "wed", "mon"],
                )

        assert config["preset"] == "weekly"
        assert config["enabled"] is True
        assert config["time_of_day"] == "05:00"
        assert config["days_of_week"] == ["mon", "wed", "fri"]
        mock_save.assert_called_once()

        job = service._scheduler.get_job(JOB_ID)
        assert job is not None

        service._scheduler.shutdown(wait=False)

    def test_invalid_day_of_week_raises_error(self):
        """Invalid day_of_week raises ValueError."""
        service = BackupSchedulerService.get_instance()
        with pytest.raises(ValueError, match="Invalid day_of_week"):
            service.update_schedule(preset="weekly", days_of_week=["monday"])

    def test_switching_preset_keeps_other_presets_fields(self):
        """Switching weekly to daily and back must not lose the chosen days."""
        service = BackupSchedulerService.get_instance()
        stored = _enabled_config("weekly", days_of_week=["tue", "thu"])

        with patch.object(service, "_load_config", return_value=stored):
            with patch.object(service, "_save_config") as mock_save:
                service.update_schedule(preset="daily")

        assert mock_save.call_args.args[0]["days_of_week"] == ["tue", "thu"]

    @pytest.mark.asyncio
    async def test_response_includes_run_times_and_timezone(self, db_session):
        service = BackupSchedulerService.get_instance()
        service._scheduler.start()

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config"):
                config = service.update_schedule(preset="daily")

        assert len(config["upcoming_runs"]) == 3
        assert config["next_run_at"] == config["upcoming_runs"][0]
        assert config["timezone"] == str(service._timezone)
        service._scheduler.shutdown(wait=False)


class TestTimezone:
    """Schedules run in TZ when it is set, else in the host timezone."""

    def test_uses_tz_when_set(self, monkeypatch):
        monkeypatch.setenv("TZ", "Asia/Tokyo")
        monkeypatch.setattr(
            backup_scheduler_service,
            "get_facility_timezone",
            lambda: ZoneInfo("Asia/Tokyo"),
        )

        service = BackupSchedulerService()

        assert service._scheduler.timezone == ZoneInfo("Asia/Tokyo")

    def test_uses_host_timezone_when_tz_unset(self, monkeypatch):
        """Installs without TZ keep the run times they had before TZ was honoured."""
        monkeypatch.delenv("TZ", raising=False)
        monkeypatch.setattr(
            backup_scheduler_service,
            "get_facility_timezone",
            lambda: ZoneInfo("UTC"),
        )

        service = BackupSchedulerService()

        assert service._scheduler.timezone == AsyncIOScheduler().timezone

    @pytest.mark.parametrize("preset", ["interval", "daily", "weekly", "monthly"])
    def test_triggers_use_scheduler_timezone(self, preset):
        service = BackupSchedulerService.get_instance()
        trigger = service._build_trigger({**DEFAULT_CONFIG, "preset": preset})
        assert trigger.timezone == service._timezone

    def test_daily_fires_at_time_of_day_in_scheduler_timezone(self):
        service = BackupSchedulerService.get_instance()
        trigger = service._build_trigger(
            {**DEFAULT_CONFIG, "preset": "daily", "time_of_day": "03:15"}
        )
        fire = _first_fire(trigger).astimezone(service._timezone)
        assert (fire.hour, fire.minute) == (3, 15)


class TestIntervalAnchoring:
    """Interval schedules count from the last run, so restarts don't reset them."""

    def test_never_run_starts_one_interval_from_now(self):
        service = BackupSchedulerService.get_instance()
        expected = datetime.now(timezone.utc) + timedelta(hours=6)

        fire = _first_fire(service._build_trigger(_enabled_config()))

        assert abs(fire - expected) < CLOCK_TOLERANCE

    def test_recent_run_continues_from_last_run(self):
        service = BackupSchedulerService.get_instance()
        last_run = datetime.now(timezone.utc) - timedelta(hours=2)

        fire = _first_fire(
            service._build_trigger(_enabled_config(last_run_at=last_run.isoformat()))
        )

        assert abs(fire - (last_run + timedelta(hours=6))) < CLOCK_TOLERANCE

    def test_restart_does_not_postpone_the_next_run(self):
        """Rebuilding the trigger later lands on the same run time."""
        service = BackupSchedulerService.get_instance()
        last_run = (datetime.now(timezone.utc) - timedelta(hours=11)).isoformat()
        config = _enabled_config(last_run_at=last_run, interval_hours=12)

        first = _first_fire(service._build_trigger(config))
        after_restart = _first_fire(service._build_trigger(config))

        assert first == after_restart

    def test_overdue_last_run_starts_one_interval_from_now(self):
        """Without a catch-up, an overdue schedule simply restarts its interval."""
        service = BackupSchedulerService.get_instance()
        expected = datetime.now(timezone.utc) + timedelta(hours=6)

        fire = _first_fire(
            service._build_trigger(_enabled_config(last_run_at=_ago(hours=30)))
        )

        assert abs(fire - expected) < CLOCK_TOLERANCE

    def test_interval_counts_from_catch_up_run(self):
        service = BackupSchedulerService.get_instance()
        catch_up_at = datetime.now(timezone.utc) + CATCH_UP_DELAY

        fire = _first_fire(
            service._build_trigger(
                _enabled_config(last_run_at=_ago(hours=30)), catch_up_at
            )
        )

        assert fire == catch_up_at + timedelta(hours=6)

    @pytest.mark.parametrize(
        "bad_value",
        [
            "not-a-date",
            "2026-10-29T02:00:00",
            (datetime.now(timezone.utc) + timedelta(days=300)).isoformat(),
        ],
        ids=["malformed", "naive", "future"],
    )
    def test_unusable_last_run_falls_back_to_now(self, bad_value):
        """Malformed, timezone-less and future values are treated as never run."""
        service = BackupSchedulerService.get_instance()
        expected = datetime.now(timezone.utc) + timedelta(hours=6)

        fire = _first_fire(
            service._build_trigger(_enabled_config(last_run_at=bad_value))
        )

        assert abs(fire - expected) < CLOCK_TOLERANCE

    @pytest.mark.asyncio
    async def test_start_restores_anchored_job(self, db_session):
        """On startup the job's next run comes from the stored last run."""
        service = BackupSchedulerService.get_instance()
        last_run = datetime.now(timezone.utc) - timedelta(hours=4)

        await _start_with(service, _enabled_config(last_run_at=last_run.isoformat()))

        next_run = service._scheduler.get_job(JOB_ID).next_run_time
        assert abs(next_run - (last_run + timedelta(hours=6))) < CLOCK_TOLERANCE
        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is None


class TestCatchUp:
    """A run missed while the app was down is made up once, shortly after startup."""

    @pytest.mark.asyncio
    async def test_missed_interval_run_catches_up(self, db_session):
        service = BackupSchedulerService.get_instance()
        expected = datetime.now(timezone.utc) + CATCH_UP_DELAY

        await _start_with(service, _enabled_config(last_run_at=_ago(hours=30)))

        catch_up = service._scheduler.get_job(CATCH_UP_JOB_ID).next_run_time
        assert abs(catch_up - expected) < CLOCK_TOLERANCE
        regular = service._scheduler.get_job(JOB_ID).next_run_time
        assert regular == catch_up + timedelta(hours=6)

    @pytest.mark.asyncio
    async def test_missed_daily_run_catches_up(self, db_session):
        service = BackupSchedulerService.get_instance()
        await _start_with(service, _enabled_config("daily", _ago(days=2)))

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is not None

    @pytest.mark.asyncio
    async def test_missed_monthly_run_catches_up(self, db_session):
        service = BackupSchedulerService.get_instance()
        await _start_with(service, _enabled_config("monthly", _ago(days=40)))

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is not None

    @pytest.mark.asyncio
    async def test_missed_weekly_run_catches_up(self, db_session):
        service = BackupSchedulerService.get_instance()
        await _start_with(service, _enabled_config("weekly", _ago(days=8)))

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is not None

    @pytest.mark.asyncio
    async def test_run_on_its_fire_time_is_not_missed(self, db_session):
        """A daily run stamped exactly at its fire time is not caught up again."""
        service = BackupSchedulerService.get_instance()
        config = _enabled_config("daily")
        trigger = service._build_trigger(config)
        previous_fire = _first_fire(trigger) - timedelta(days=1)
        config["last_run_at"] = previous_fire.isoformat()

        await _start_with(service, config)

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is None

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "last_run_at",
        [None, (datetime.now(timezone.utc) + timedelta(days=300)).isoformat()],
        ids=["never-run", "future"],
    )
    async def test_no_catch_up_without_a_usable_last_run(self, db_session, last_run_at):
        service = BackupSchedulerService.get_instance()

        await _start_with(service, _enabled_config(last_run_at=last_run_at))

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is None

    @pytest.mark.asyncio
    async def test_saving_a_schedule_does_not_catch_up(self, db_session):
        """Turning a schedule on after a long gap waits a full interval."""
        service = BackupSchedulerService.get_instance()
        service._scheduler.start()
        stored = {**DEFAULT_CONFIG, "last_run_at": _ago(days=30)}
        expected = datetime.now(timezone.utc) + timedelta(hours=6)

        with patch.object(service, "_load_config", return_value=stored):
            with patch.object(service, "_save_config"):
                service.update_schedule(preset="interval", interval_hours=6)

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is None
        next_run = service._scheduler.get_job(JOB_ID).next_run_time
        assert abs(next_run - expected) < CLOCK_TOLERANCE

    @pytest.mark.asyncio
    async def test_disabling_cancels_a_pending_catch_up(self, db_session):
        service = BackupSchedulerService.get_instance()
        await _start_with(service, _enabled_config(last_run_at=_ago(hours=30)))

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config"):
                service.update_schedule(preset="disabled")

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is None

    @pytest.mark.asyncio
    async def test_saving_keeps_a_pending_catch_up(self, db_session):
        """Editing the schedule just after startup must not drop the missed backup."""
        service = BackupSchedulerService.get_instance()
        await _start_with(service, _enabled_config(last_run_at=_ago(hours=30)))
        catch_up = service._scheduler.get_job(CATCH_UP_JOB_ID).next_run_time

        with patch.object(service, "_load_config", return_value=_enabled_config()):
            with patch.object(service, "_save_config"):
                service.update_schedule(preset="daily", time_of_day="04:00")

        assert service._scheduler.get_job(CATCH_UP_JOB_ID).next_run_time == catch_up

    @pytest.mark.asyncio
    async def test_no_catch_up_when_the_regular_run_comes_first(self, db_session):
        """Restarting just before a daily run must not queue a second backup."""
        service = BackupSchedulerService.get_instance()
        soon = datetime.now(service._timezone) + timedelta(minutes=2)
        config = {
            **_enabled_config("daily", _ago(days=2)),
            "time_of_day": soon.strftime("%H:%M"),
        }

        await _start_with(service, config)

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is None

    @pytest.mark.asyncio
    async def test_never_run_schedule_catches_up_from_save_time(self, db_session):
        """A new schedule is not postponed forever by restarts before its first run."""
        service = BackupSchedulerService.get_instance()
        config = {**_enabled_config(), "schedule_saved_at": _ago(hours=7)}

        await _start_with(service, config)

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is not None

    @pytest.mark.asyncio
    async def test_re_enabled_schedule_does_not_catch_up(self, db_session):
        """An old last run from before the schedule was saved is not a missed run."""
        service = BackupSchedulerService.get_instance()
        later = datetime.now(service._timezone) + timedelta(hours=3)
        config = {
            **_enabled_config("daily", _ago(days=30)),
            "time_of_day": later.strftime("%H:%M"),
            "schedule_saved_at": _ago(hours=1),
        }

        await _start_with(service, config)

        assert service._scheduler.get_job(CATCH_UP_JOB_ID) is None

    @pytest.mark.asyncio
    async def test_next_run_reports_the_pending_catch_up(self, db_session):
        service = BackupSchedulerService.get_instance()
        await _start_with(service, _enabled_config("daily", _ago(days=2)))

        catch_up = service._scheduler.get_job(CATCH_UP_JOB_ID).next_run_time
        with patch.object(service, "_load_config", return_value=_enabled_config()):
            schedule = service.get_schedule()
        assert schedule["next_run_at"] == catch_up.isoformat()
        assert schedule["upcoming_runs"][0] == catch_up.isoformat()


class TestScheduleSave:
    """What a schedule save writes."""

    def test_records_when_the_schedule_was_saved(self):
        service = BackupSchedulerService.get_instance()
        before = datetime.now(timezone.utc)

        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            with patch.object(service, "_save_config") as mock_save:
                service.update_schedule(preset="daily")

        saved = mock_save.call_args.args[0]
        assert datetime.fromisoformat(saved["schedule_saved_at"]) >= before

    def test_interval_counts_from_save_when_never_run(self):
        service = BackupSchedulerService.get_instance()
        saved_at = datetime.now(timezone.utc) - timedelta(hours=2)
        config = {**_enabled_config(), "schedule_saved_at": saved_at.isoformat()}

        fire = _first_fire(service._build_trigger(config))

        assert abs(fire - (saved_at + timedelta(hours=6))) < CLOCK_TOLERANCE

    def test_keeps_a_last_run_written_since_loading(self):
        """A backup finishing mid-save must not have its result overwritten."""
        service = BackupSchedulerService.get_instance()
        newer = {
            "last_run_at": _ago(minutes=1),
            "last_run_status": "success",
            "last_run_error": None,
        }
        stale = {**_enabled_config("daily", _ago(days=1)), "last_run_status": "failed"}
        mock_crud = MagicMock()
        mock_crud.get_setting.return_value = json.dumps({**stale, **newer})

        with patch("app.core.database.database.SessionLocal", return_value=MagicMock()):
            with patch("app.crud.system_setting.system_setting", mock_crud):
                service._save_config(stale)

        written = json.loads(mock_crud.set_setting.call_args.args[2])
        assert {k: written[k] for k in newer} == newer
        assert written["preset"] == "daily"


class TestCleanSchedule:
    """Per-preset validation shared by the service and the API."""

    @pytest.mark.parametrize("hours", [0, 169, None])
    def test_interval_hours_out_of_range(self, hours):
        with pytest.raises(ScheduleValidationError, match="interval_hours"):
            clean_schedule("interval", interval_hours=hours)

    @pytest.mark.parametrize("hours", [1, 168])
    def test_interval_hours_bounds_accepted(self, hours):
        assert (
            clean_schedule("interval", interval_hours=hours)["interval_hours"] == hours
        )

    @pytest.mark.parametrize("days", [None, []])
    def test_weekly_needs_a_day(self, days):
        with pytest.raises(ScheduleValidationError, match="at least one day"):
            clean_schedule("weekly", days_of_week=days)

    @pytest.mark.parametrize("day", [0, 29, 31, None])
    def test_day_of_month_out_of_range(self, day):
        with pytest.raises(ScheduleValidationError, match="day_of_month"):
            clean_schedule("monthly", day_of_month=day)

    def test_drops_fields_the_preset_does_not_use(self):
        cleaned = clean_schedule(
            "daily", "04:00", interval_hours=3, days_of_week=["mon"], day_of_month=5
        )
        assert cleaned == {"preset": "daily", "time_of_day": "04:00"}

    @pytest.mark.parametrize("preset", ["every_6_hours", "every_12_hours"])
    def test_old_preset_names_are_rejected(self, preset):
        with pytest.raises(ScheduleValidationError, match="Invalid preset"):
            clean_schedule(preset)


class TestLegacyConfig:
    """Schedules saved before custom schedules keep working without a re-save."""

    @pytest.mark.parametrize(
        "preset,hours", [("every_6_hours", 6), ("every_12_hours", 12)]
    )
    def test_fixed_intervals_become_interval(self, preset, hours):
        config = _config_from_stored(json.dumps({"preset": preset, "enabled": True}))
        assert (config["preset"], config["interval_hours"]) == ("interval", hours)

    def test_single_day_becomes_a_list(self):
        config = _config_from_stored(
            json.dumps({"preset": "weekly", "day_of_week": "wed"})
        )
        assert config["days_of_week"] == ["wed"]
        assert "day_of_week" not in config

    def test_new_config_is_left_alone(self):
        stored = {"preset": "weekly", "days_of_week": ["mon", "fri"]}
        assert _config_from_stored(json.dumps(stored))["days_of_week"] == [
            "mon",
            "fri",
        ]

    def test_defaults_are_not_shared_between_loads(self):
        _config_from_stored(None)["days_of_week"].append("mon")
        assert _config_from_stored(None)["days_of_week"] == ["sun"]

    def test_last_run_save_drops_old_keys(self):
        """The first backup after an upgrade writes the new shape."""
        service = BackupSchedulerService.get_instance()
        mock_crud = MagicMock()
        mock_crud.get_setting.return_value = json.dumps(
            {"preset": "every_6_hours", "day_of_week": "sun", "enabled": True}
        )

        with patch("app.crud.system_setting.system_setting", mock_crud):
            service._update_last_run(
                MagicMock(), datetime.now(timezone.utc), "success", None
            )

        written = json.loads(mock_crud.set_setting.call_args.args[2])
        assert written["preset"] == "interval"
        assert written["interval_hours"] == 6
        assert "day_of_week" not in written


def _fires(trigger, start, count):
    """count fire times of trigger from start."""
    return list(
        islice(_fire_times(trigger, trigger.get_next_fire_time(None, start)), count)
    )


class TestTriggers:
    """Run times each preset produces."""

    def test_weekly_runs_on_each_chosen_day(self):
        service = BackupSchedulerService.get_instance()
        trigger = service._build_trigger(
            _enabled_config("weekly", days_of_week=["mon", "wed", "fri"])
        )

        fires = _fires(trigger, datetime.now(service._timezone), 6)

        assert {f.strftime("%a") for f in fires} == {"Mon", "Wed", "Fri"}
        assert all((f.hour, f.minute) == (2, 0) for f in fires)

    def test_monthly_day_28_runs_every_month(self):
        """February has a 28th, so no month is skipped."""
        service = BackupSchedulerService.get_instance()
        trigger = service._build_trigger(_enabled_config("monthly", day_of_month=28))
        start = datetime(2027, 1, 1, tzinfo=service._timezone)

        fires = _fires(trigger, start, 12)

        assert [f.month for f in fires] == list(range(1, 13))
        assert all(f.day == 28 for f in fires)

    def test_daily_keeps_wall_clock_time_across_dst(self):
        service = BackupSchedulerService()
        service._timezone = ZoneInfo("America/New_York")
        trigger = service._build_trigger(_enabled_config("daily", time_of_day="03:00"))
        start = datetime(2026, 10, 30, tzinfo=service._timezone)

        fires = _fires(trigger, start, 4)

        assert all((f.hour, f.minute) == (3, 0) for f in fires)
        assert fires[1].utcoffset() != fires[2].utcoffset()


class TestPreview:
    """Run times and disk estimate for a draft schedule."""

    def _preview(self, cleaned, retention_days=7, min_count=2, size=None):
        service = BackupSchedulerService.get_instance()
        with patch.object(service, "_load_config", return_value=dict(DEFAULT_CONFIG)):
            return service.preview_schedule(cleaned, retention_days, min_count, size)

    def test_lists_next_three_runs_and_timezone(self):
        preview = self._preview(clean_schedule("daily", "02:00"))

        runs = [datetime.fromisoformat(r) for r in preview["upcoming_runs"]]
        assert len(runs) == 3
        assert runs == sorted(runs)
        assert preview["timezone"] == str(
            BackupSchedulerService.get_instance()._timezone
        )

    def test_interval_counts_from_now_like_a_save(self):
        expected = datetime.now(timezone.utc) + timedelta(hours=4)

        preview = self._preview(clean_schedule("interval", interval_hours=4))

        first = datetime.fromisoformat(preview["upcoming_runs"][0])
        assert abs(first - expected) < CLOCK_TOLERANCE

    def test_counts_runs_in_retention_window(self):
        preview = self._preview(
            clean_schedule("interval", interval_hours=7), retention_days=30, size=10
        )

        assert preview["retained_count"] == 30 * 24 // 7
        assert preview["estimated_bytes"] == 30 * 24 // 7 * 10

    def test_never_below_min_count(self):
        preview = self._preview(
            clean_schedule("monthly", day_of_month=1),
            retention_days=7,
            min_count=5,
            size=100,
        )

        assert preview["retained_count"] == 5
        assert preview["estimated_bytes"] == 500

    def test_no_estimate_without_a_backup(self):
        preview = self._preview(clean_schedule("daily"))

        assert preview["retained_count"] is not None
        assert preview["latest_backup_size_bytes"] is None
        assert preview["estimated_bytes"] is None

    def test_disabled_has_no_runs(self):
        preview = self._preview(clean_schedule("disabled"), size=100)

        assert preview["upcoming_runs"] == []
        assert preview["retained_count"] is None

    def test_saves_nothing(self):
        service = BackupSchedulerService.get_instance()
        with patch.object(service, "_save_config") as mock_save:
            self._preview(clean_schedule("daily"))

        mock_save.assert_not_called()
        assert service._scheduler.get_job(JOB_ID) is None

    @pytest.mark.asyncio
    async def test_includes_a_pending_catch_up(self, db_session):
        service = BackupSchedulerService.get_instance()
        await _start_with(service, _enabled_config(last_run_at=_ago(hours=30)))
        catch_up = service._scheduler.get_job(CATCH_UP_JOB_ID).next_run_time

        preview = self._preview(clean_schedule("weekly", days_of_week=["sun"]))

        assert preview["upcoming_runs"][0] == catch_up.isoformat()


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

        mock_update = await _run_backup_with(service, mock_bs, mock_db)

        mock_bs.create_full_backup.assert_called_once_with(
            description="Scheduled auto-backup"
        )
        mock_update.assert_called_once_with(mock_db, ANY, "success", None)
        mock_db.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_last_run_is_the_start_time(self, db_session):
        """Stamping the start keeps interval schedules from drifting by the backup's duration."""
        service = BackupSchedulerService.get_instance()
        finished = {}

        async def slow_backup(**_kwargs):
            finished["at"] = datetime.now(timezone.utc) + timedelta(minutes=20)
            return {"filename": "full.zip", "size_bytes": 1}

        mock_bs = MagicMock()
        mock_bs.create_full_backup = slow_backup

        before = datetime.now(timezone.utc)
        mock_update = await _run_backup_with(service, mock_bs)

        run_at = mock_update.call_args.args[1]
        assert before <= run_at < finished["at"]

    @pytest.mark.asyncio
    async def test_run_backup_failure_records_error(self, db_session):
        """Failed backup records error in last_run_error."""
        service = BackupSchedulerService.get_instance()

        mock_db = MagicMock()
        mock_bs = MagicMock()
        mock_bs.create_full_backup = AsyncMock(side_effect=Exception("pg_dump failed"))

        mock_update = await _run_backup_with(service, mock_bs, mock_db)

        mock_update.assert_called_once_with(mock_db, ANY, "failed", "pg_dump failed")
        mock_db.close.assert_called_once()


class TestAutoCleanup:
    """Retention clean-up after scheduled backups, behind an opt-in setting."""

    @pytest.fixture
    def backup_service(self):
        mock_bs = MagicMock()
        mock_bs.create_full_backup = AsyncMock(
            return_value={"filename": "full.zip", "size_bytes": 1}
        )
        mock_bs.cleanup_old_backups = AsyncMock(return_value={"total_deleted": 3})
        return mock_bs

    @pytest.mark.asyncio
    async def test_cleans_up_after_success_when_enabled(
        self, backup_service, monkeypatch
    ):
        monkeypatch.setattr(settings, "BACKUP_AUTO_CLEANUP_ENABLED", True)
        service = BackupSchedulerService.get_instance()

        await _run_backup_with(service, backup_service)

        backup_service.cleanup_old_backups.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_no_cleanup_when_disabled(self, backup_service, monkeypatch):
        monkeypatch.setattr(settings, "BACKUP_AUTO_CLEANUP_ENABLED", False)
        service = BackupSchedulerService.get_instance()

        await _run_backup_with(service, backup_service)

        backup_service.cleanup_old_backups.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_cleanup_when_backup_fails(self, backup_service, monkeypatch):
        """A failed backup must not delete older backups it was meant to replace."""
        monkeypatch.setattr(settings, "BACKUP_AUTO_CLEANUP_ENABLED", True)
        backup_service.create_full_backup.side_effect = Exception("pg_dump failed")
        service = BackupSchedulerService.get_instance()

        await _run_backup_with(service, backup_service)

        backup_service.cleanup_old_backups.assert_not_called()

    @pytest.mark.asyncio
    async def test_cleanup_failure_keeps_backup_successful(
        self, backup_service, monkeypatch
    ):
        monkeypatch.setattr(settings, "BACKUP_AUTO_CLEANUP_ENABLED", True)
        backup_service.cleanup_old_backups.side_effect = Exception("disk error")
        service = BackupSchedulerService.get_instance()

        mock_update = await _run_backup_with(service, backup_service)

        mock_update.assert_called_once()
        assert mock_update.call_args.args[2:] == ("success", None)

    @pytest.mark.asyncio
    async def test_partial_cleanup_is_logged_as_failed(
        self, backup_service, monkeypatch
    ):
        """Per-backup delete errors come back in the result, not as an exception."""
        monkeypatch.setattr(settings, "BACKUP_AUTO_CLEANUP_ENABLED", True)
        backup_service.cleanup_old_backups.return_value = {
            "total_deleted": 1,
            "errors": ["Failed to delete backup 7: permission denied"],
        }
        service = BackupSchedulerService.get_instance()

        with patch.object(backup_scheduler_service, "logger") as mock_logger:
            await _run_backup_with(service, backup_service)

        events = [
            call.kwargs["extra"]["event"] for call in mock_logger.warning.call_args_list
        ]
        assert "auto_backup_cleanup_failed" in events
        info_events = [
            call.kwargs["extra"]["event"] for call in mock_logger.info.call_args_list
        ]
        assert "auto_backup_cleanup_completed" not in info_events

    def test_disabled_by_default(self):
        """Upgrades must not start deleting backups without an admin opting in."""
        env = {
            k: v for k, v in os.environ.items() if k != "BACKUP_AUTO_CLEANUP_ENABLED"
        }
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from app.core.config import Settings;"
                "print(Settings.BACKUP_AUTO_CLEANUP_ENABLED)",
            ],
            capture_output=True,
            text=True,
            env=env,
            check=True,
        )
        assert result.stdout.strip().splitlines()[-1] == "False"


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
