"""Tests for auto-backup schedule API endpoints."""

from unittest.mock import patch, MagicMock

import pytest

from app.services.backup_scheduler_service import (
    DEFAULT_CONFIG,
    BackupSchedulerService,
)


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
            "preset": "daily",
            "time_of_day": "03:00",
            "enabled": True,
            "last_run_at": "2026-02-25T03:00:00+00:00",
            "last_run_status": "success",
            "last_run_error": None,
            "next_run_at": "2026-02-26T03:00:00+00:00",
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

    def test_update_to_weekly_with_day(self, admin_client):
        """Weekly preset with custom day_of_week succeeds."""
        mock_service = MagicMock()
        mock_service.update_schedule.return_value = {
            "preset": "weekly",
            "time_of_day": "05:00",
            "day_of_week": "wed",
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
                    "day_of_week": "wed",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["schedule"]["preset"] == "weekly"
        assert data["schedule"]["day_of_week"] == "wed"
        mock_service.update_schedule.assert_called_once_with(
            preset="weekly", time_of_day="05:00", day_of_week="wed"
        )

    def test_invalid_day_of_week_returns_422(self, admin_client):
        """Invalid day_of_week returns validation error."""
        response = admin_client.post(
            SCHEDULE_URL,
            json={"preset": "weekly", "day_of_week": "monday"},
        )
        assert response.status_code == 422

    def test_invalid_time_format_returns_422(self, admin_client):
        """Invalid time format returns validation error."""
        response = admin_client.post(
            SCHEDULE_URL,
            json={"preset": "daily", "time_of_day": "25:00"},
        )
        assert response.status_code == 422
