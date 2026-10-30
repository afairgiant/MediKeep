"""Tests for auto-backup schedule API endpoints."""

import json
from unittest.mock import patch, MagicMock

import pytest

from app.core.config import settings
from app.services.backup_scheduler_service import (
    DEFAULT_CONFIG,
    BackupSchedulerService,
)
from app.services.backup_service import BackupService


@pytest.fixture(autouse=True)
def reset_scheduler():
    """Reset scheduler singleton for each test."""
    BackupSchedulerService.reset_instance()
    yield
    BackupSchedulerService.reset_instance()


SCHEDULE_URL = "/api/v1/admin/backups/settings/schedule"


class TestGetScheduleEndpoint:
    """GET /api/v1/admin/backups/settings/schedule"""

    def test_requires_admin(self, client, user_token_headers):
        """Non-admin user gets 403."""
        response = client.get(SCHEDULE_URL, headers=user_token_headers)
        assert response.status_code == 403

    def test_requires_auth(self, client):
        """Unauthenticated request gets 401."""
        response = client.get(SCHEDULE_URL)
        assert response.status_code == 401

    def test_returns_defaults(self, admin_client):
        """Returns disabled defaults when no config exists."""
        mock_service = MagicMock()
        mock_service.get_schedule.return_value = {
            **DEFAULT_CONFIG,
            "next_run_at": None,
            "upcoming_runs": [],
            "timezone": "America/New_York",
        }

        with patch.object(
            BackupSchedulerService,
            "get_instance",
            return_value=mock_service,
        ):
            response = admin_client.get(SCHEDULE_URL)

        assert response.status_code == 200
        data = response.json()
        assert data["preset"] == "disabled"
        assert data["enabled"] is False
        assert data["time_of_day"] == "02:00"

    def test_returns_active_schedule(self, admin_client):
        """Returns active schedule with next_run_at."""
        mock_service = MagicMock()
        mock_service.get_schedule.return_value = {
            **DEFAULT_CONFIG,
            "preset": "daily",
            "time_of_day": "03:00",
            "enabled": True,
            "last_run_at": "2026-02-25T03:00:00+00:00",
            "last_run_status": "success",
            "last_run_error": None,
            "next_run_at": "2026-02-26T03:00:00+00:00",
            "upcoming_runs": ["2026-02-26T03:00:00+00:00"],
            "timezone": "UTC",
        }

        with patch.object(
            BackupSchedulerService,
            "get_instance",
            return_value=mock_service,
        ):
            response = admin_client.get(SCHEDULE_URL)

        assert response.status_code == 200
        data = response.json()
        assert data["preset"] == "daily"
        assert data["enabled"] is True
        assert data["next_run_at"] is not None
        assert data["upcoming_runs"] == ["2026-02-26T03:00:00+00:00"]
        assert data["timezone"] == "UTC"
        assert data["days_of_week"] == ["sun"]
        assert "day_of_week" not in data


class TestUpdateScheduleEndpoint:
    """POST /api/v1/admin/backups/settings/schedule"""

    def test_requires_admin(self, client, user_token_headers):
        """Non-admin user gets 403."""
        response = client.post(
            SCHEDULE_URL,
            json={"preset": "daily"},
            headers=user_token_headers,
        )
        assert response.status_code == 403

    def test_update_to_daily(self, admin_client):
        """Valid daily preset succeeds."""
        mock_service = MagicMock()
        mock_service.update_schedule.return_value = {
            "preset": "daily",
            "time_of_day": "04:00",
            "enabled": True,
            "last_run_at": None,
            "last_run_status": None,
            "last_run_error": None,
            "next_run_at": "2026-02-26T04:00:00",
        }

        with patch.object(
            BackupSchedulerService,
            "get_instance",
            return_value=mock_service,
        ):
            response = admin_client.post(
                SCHEDULE_URL,
                json={"preset": "daily", "time_of_day": "04:00"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Auto-backup schedule updated successfully"
        assert data["schedule"]["preset"] == "daily"

    def test_update_to_disabled(self, admin_client):
        """Disabling schedule succeeds."""
        mock_service = MagicMock()
        mock_service.update_schedule.return_value = {
            **DEFAULT_CONFIG,
            "next_run_at": None,
        }

        with patch.object(
            BackupSchedulerService,
            "get_instance",
            return_value=mock_service,
        ):
            response = admin_client.post(
                SCHEDULE_URL,
                json={"preset": "disabled"},
            )

        assert response.status_code == 200

    def test_invalid_preset_returns_422(self, admin_client):
        """Invalid preset returns validation error."""
        response = admin_client.post(
            SCHEDULE_URL,
            json={"preset": "every_3_hours"},
        )
        assert response.status_code == 422

    def test_update_to_weekly_with_days(self, admin_client):
        """Weekly preset with several days passes them Monday first."""
        mock_service = MagicMock()
        mock_service.update_schedule.return_value = {
            "preset": "weekly",
            "time_of_day": "05:00",
            "days_of_week": ["mon", "wed"],
            "enabled": True,
            "last_run_at": None,
            "last_run_status": None,
            "last_run_error": None,
            "next_run_at": "2026-02-26T05:00:00",
        }

        with patch.object(
            BackupSchedulerService,
            "get_instance",
            return_value=mock_service,
        ):
            response = admin_client.post(
                SCHEDULE_URL,
                json={
                    "preset": "weekly",
                    "time_of_day": "05:00",
                    "days_of_week": ["wed", "mon", "wed"],
                    "day_of_month": 3,
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["schedule"]["preset"] == "weekly"
        mock_service.update_schedule.assert_called_once_with(
            preset="weekly", time_of_day="05:00", days_of_week=["mon", "wed"]
        )

    @pytest.mark.parametrize(
        "body",
        [
            {"preset": "weekly", "days_of_week": ["monday"]},
            {"preset": "weekly", "days_of_week": []},
            {"preset": "weekly"},
            {"preset": "interval"},
            {"preset": "interval", "interval_hours": 0},
            {"preset": "interval", "interval_hours": 169},
            {"preset": "interval", "interval_hours": True},
            {"preset": "interval", "interval_hours": 5.0},
            {"preset": "monthly"},
            {"preset": "monthly", "day_of_month": 29},
            {"preset": "monthly", "day_of_month": "5"},
            {"preset": "every_6_hours"},
            {"preset": "every_12_hours"},
        ],
        ids=[
            "bad-day",
            "no-days",
            "weekly-missing-days",
            "interval-missing-hours",
            "interval-zero",
            "interval-over-a-week",
            "interval-bool",
            "interval-float",
            "monthly-missing-day",
            "monthly-29th",
            "monthly-string",
            "old-6-hours",
            "old-12-hours",
        ],
    )
    def test_invalid_preset_fields_return_422(self, admin_client, body):
        response = admin_client.post(SCHEDULE_URL, json=body)
        assert response.status_code == 422

    @pytest.mark.parametrize(
        "body,expected",
        [
            (
                {"preset": "interval", "interval_hours": 3},
                {"preset": "interval", "interval_hours": 3},
            ),
            (
                {"preset": "monthly", "day_of_month": 28, "time_of_day": "01:30"},
                {"preset": "monthly", "day_of_month": 28, "time_of_day": "01:30"},
            ),
        ],
        ids=["interval", "monthly"],
    )
    def test_valid_presets_reach_the_service(self, admin_client, body, expected):
        mock_service = MagicMock()
        mock_service.update_schedule.return_value = {**DEFAULT_CONFIG}

        with patch.object(
            BackupSchedulerService, "get_instance", return_value=mock_service
        ):
            response = admin_client.post(SCHEDULE_URL, json=body)

        assert response.status_code == 200
        mock_service.update_schedule.assert_called_once_with(**expected)

    def test_invalid_time_format_returns_422(self, admin_client):
        """Invalid time format returns validation error."""
        response = admin_client.post(
            SCHEDULE_URL,
            json={"preset": "daily", "time_of_day": "25:00"},
        )
        assert response.status_code == 422

    def test_unexpected_error_hides_internal_detail(self, admin_client):
        """A 500 must not echo the exception text back to the client."""
        mock_service = MagicMock()
        mock_service.update_schedule.side_effect = RuntimeError(
            "connection to server at 10.0.0.5 failed"
        )

        with patch.object(
            BackupSchedulerService,
            "get_instance",
            return_value=mock_service,
        ):
            response = admin_client.post(SCHEDULE_URL, json={"preset": "daily"})

        assert response.status_code == 500
        assert "10.0.0.5" not in response.text

    def _post_with_error(self, admin_client, error):
        mock_service = MagicMock()
        mock_service.update_schedule.side_effect = error
        with patch.object(
            BackupSchedulerService, "get_instance", return_value=mock_service
        ):
            return admin_client.post(SCHEDULE_URL, json={"preset": "daily"})

    def test_corrupt_stored_schedule_is_a_500_not_a_400(self, admin_client):
        """A JSONDecodeError is a ValueError, but it is a server fault, not bad input."""
        error = json.JSONDecodeError("Expecting value", "{not json", 1)

        response = self._post_with_error(admin_client, error)

        assert response.status_code == 500
        assert "Expecting value" not in response.text

    def test_unexpected_error_logs_traceback(self, admin_client):
        with patch("app.api.v1.admin.backup.log_endpoint_error") as mock_log:
            self._post_with_error(admin_client, RuntimeError("boom"))

        assert mock_log.call_args.kwargs["exc_info"] is True


PREVIEW_URL = f"{SCHEDULE_URL}/preview"


class TestPreviewScheduleEndpoint:
    """POST /api/v1/admin/backups/settings/schedule/preview"""

    PREVIEW = {
        "upcoming_runs": ["2026-11-02T02:00:00-05:00"],
        "timezone": "America/New_York",
        "latest_backup_size_bytes": 1000,
        "retained_count": 7,
        "estimated_bytes": 7000,
    }

    def _post(self, admin_client, body, size=1000):
        mock_service = MagicMock()
        mock_service.preview_schedule.return_value = self.PREVIEW
        with patch.object(
            BackupSchedulerService, "get_instance", return_value=mock_service
        ), patch.object(BackupService, "latest_full_backup_size", return_value=size):
            response = admin_client.post(PREVIEW_URL, json=body)
        return response, mock_service

    def test_requires_admin(self, client, user_token_headers):
        response = client.post(
            PREVIEW_URL, json={"preset": "daily"}, headers=user_token_headers
        )
        assert response.status_code == 403

    def test_returns_preview(self, admin_client):
        response, _ = self._post(admin_client, {"preset": "daily"})

        assert response.status_code == 200
        assert response.json() == self.PREVIEW

    def test_uses_saved_retention_when_omitted(self, admin_client, monkeypatch):
        monkeypatch.setattr(settings, "BACKUP_RETENTION_DAYS", 9)
        monkeypatch.setattr(settings, "BACKUP_MIN_COUNT", 4)

        _, mock_service = self._post(
            admin_client, {"preset": "interval", "interval_hours": 6}
        )

        mock_service.preview_schedule.assert_called_once_with(
            {"preset": "interval", "interval_hours": 6},
            retention_days=9,
            min_count=4,
            latest_backup_size=1000,
        )

    def test_uses_draft_retention(self, admin_client):
        _, mock_service = self._post(
            admin_client,
            {"preset": "daily", "backup_retention_days": 3, "backup_min_count": 2},
        )

        kwargs = mock_service.preview_schedule.call_args.kwargs
        assert (kwargs["retention_days"], kwargs["min_count"]) == (3, 2)

    @pytest.mark.parametrize(
        "body",
        [
            {"preset": "weekly", "days_of_week": []},
            {"preset": "daily", "backup_retention_days": 0},
            {"preset": "daily", "backup_retention_days": 366},
            {"preset": "daily", "backup_min_count": 101},
        ],
        ids=["bad-schedule", "retention-zero", "retention-over-max", "min-over-max"],
    )
    def test_invalid_draft_returns_422(self, admin_client, body):
        response, mock_service = self._post(admin_client, body)

        assert response.status_code == 422
        mock_service.preview_schedule.assert_not_called()

    def test_unexpected_error_hides_internal_detail(self, admin_client):
        mock_service = MagicMock()
        mock_service.preview_schedule.side_effect = RuntimeError("db at 10.0.0.5")
        with patch.object(
            BackupSchedulerService, "get_instance", return_value=mock_service
        ), patch.object(BackupService, "latest_full_backup_size", return_value=None):
            response = admin_client.post(PREVIEW_URL, json={"preset": "daily"})

        assert response.status_code == 500
        assert "10.0.0.5" not in response.text

    def test_saves_nothing_with_the_real_service(self, admin_client):
        service = BackupSchedulerService.get_instance()
        with patch.object(
            service, "_load_config", return_value=dict(DEFAULT_CONFIG)
        ), patch.object(service, "_save_config") as mock_save:
            response = admin_client.post(
                PREVIEW_URL, json={"preset": "weekly", "days_of_week": ["mon"]}
            )

        assert response.status_code == 200
        assert len(response.json()["upcoming_runs"]) == 3
        mock_save.assert_not_called()
