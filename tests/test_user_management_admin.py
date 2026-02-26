"""
Tests for admin user management features:
- Login history endpoint
- Inactive user login blocking
- is_active and last_login_at fields
"""
import pytest
from datetime import datetime, timezone

from app.models.activity_log import ActivityLog, ActionType, EntityType


class TestUserModelFields:
    """Test that is_active and last_login_at fields work on the User model."""

    def test_user_has_is_active_default_true(self, test_user):
        """New users should have is_active=True by default."""
        assert test_user.is_active is True

    def test_user_has_last_login_at_null(self, test_user):
        """New users should have last_login_at=None."""
        assert test_user.last_login_at is None

    def test_user_is_active_can_be_set_false(self, db_session, test_user):
        """is_active can be set to False."""
        test_user.is_active = False
        db_session.commit()
        db_session.refresh(test_user)
        assert test_user.is_active is False

    def test_user_last_login_at_can_be_set(self, db_session, test_user):
        """last_login_at can be set to a datetime."""
        now = datetime.now(timezone.utc)
        test_user.last_login_at = now
        db_session.commit()
        db_session.refresh(test_user)
        assert test_user.last_login_at is not None


class TestInactiveUserLogin:
    """Test that inactive users are blocked from logging in."""

    def test_inactive_user_cannot_login(self, client, db_session, test_user):
        """A user with is_active=False should be rejected at login."""
        test_user.is_active = False
        db_session.commit()

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testuser", "password": "testpassword123"},
        )
        assert response.status_code == 401
        data = response.json()
        message = data.get("message", "") or ""
        assert "deactivated" in message.lower()

    def test_active_user_can_login(self, client, db_session, test_user):
        """A user with is_active=True should be able to login."""
        assert test_user.is_active is True

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testuser", "password": "testpassword123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_login_updates_last_login_at(self, client, db_session, test_user):
        """Successful login should set last_login_at."""
        assert test_user.last_login_at is None

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testuser", "password": "testpassword123"},
        )
        assert response.status_code == 200

        db_session.refresh(test_user)
        assert test_user.last_login_at is not None


class TestLoginHistoryEndpoint:
    """Test the admin login history endpoint."""

    def _create_login_activity(self, db_session, user_id, description="User logged in"):
        """Helper to create a login activity log entry."""
        entry = ActivityLog(
            user_id=user_id,
            action=ActionType.LOGIN,
            entity_type=EntityType.USER,
            entity_id=user_id,
            description=description,
            ip_address="127.0.0.1",
            user_agent="test-agent",
        )
        db_session.add(entry)
        db_session.commit()
        return entry

    def test_login_history_returns_events(
        self, client, admin_token_headers, db_session, test_admin_user, test_user
    ):
        """Login history endpoint returns login events for a user."""
        self._create_login_activity(db_session, test_user.id, "User logged in: testuser")
        self._create_login_activity(db_session, test_user.id, "User logged in: testuser again")

        response = client.get(
            f"/api/v1/admin/user-management/users/{test_user.id}/login-history",
            headers=admin_token_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["data"]["items"]) == 2
        assert data["data"]["total"] == 2

    def test_login_history_requires_admin(self, client, user_token_headers, test_user):
        """Non-admin users cannot access login history."""
        response = client.get(
            f"/api/v1/admin/user-management/users/{test_user.id}/login-history",
            headers=user_token_headers,
        )
        assert response.status_code in (401, 403)

    def test_login_history_user_not_found(self, client, admin_token_headers, test_admin_user):
        """Login history for a nonexistent user returns 404."""
        response = client.get(
            "/api/v1/admin/user-management/users/99999/login-history",
            headers=admin_token_headers,
        )
        assert response.status_code == 404

    def test_login_history_empty(
        self, client, admin_token_headers, db_session, test_admin_user, test_user
    ):
        """Login history returns empty list when no login events exist."""
        response = client.get(
            f"/api/v1/admin/user-management/users/{test_user.id}/login-history",
            headers=admin_token_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["items"] == []
        assert data["data"]["total"] == 0

    def test_login_history_pagination(
        self, client, admin_token_headers, db_session, test_admin_user, test_user
    ):
        """Login history supports pagination."""
        for i in range(5):
            self._create_login_activity(db_session, test_user.id, f"Login {i}")

        response = client.get(
            f"/api/v1/admin/user-management/users/{test_user.id}/login-history",
            headers=admin_token_headers,
            params={"page": 1, "per_page": 2},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["items"]) == 2
        assert data["data"]["total"] == 5
        assert data["data"]["page"] == 1
        assert data["data"]["per_page"] == 2

    def test_login_history_only_returns_login_events(
        self, client, admin_token_headers, db_session, test_admin_user, test_user
    ):
        """Login history should only return LOGIN action type, not other actions."""
        # Create a login event
        self._create_login_activity(db_session, test_user.id)

        # Create a non-login event
        other_entry = ActivityLog(
            user_id=test_user.id,
            action=ActionType.UPDATED,
            entity_type=EntityType.USER,
            entity_id=test_user.id,
            description="Updated user profile",
            ip_address="127.0.0.1",
        )
        db_session.add(other_entry)
        db_session.commit()

        response = client.get(
            f"/api/v1/admin/user-management/users/{test_user.id}/login-history",
            headers=admin_token_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["items"]) == 1
        assert data["data"]["total"] == 1
