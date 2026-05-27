"""Regression tests for admin lockout protection on user PUT endpoint.

The generic admin model PUT must not allow:
- Demoting the last remaining admin
- Deactivating the last remaining active admin
- An admin demoting themselves
- An admin deactivating themselves

Frontend already enforces these checks, but the backend must enforce them too
so a direct API call cannot bypass them.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.user import user as user_crud
from app.models.models import User
from app.schemas.user import UserCreate


PUT_URL = "/api/v1/admin/models/user/{user_id}"


def _make_admin(db_session: Session, username: str) -> User:
    return user_crud.create(
        db_session,
        obj_in=UserCreate(
            username=username,
            email=f"{username}@example.com",
            password="adminpassword123",
            full_name=username.title(),
            role="admin",
        ),
    )


class TestLastAdminDemotionBlocked:
    def test_demote_only_admin_returns_400(
        self,
        client: TestClient,
        admin_token_headers,
        test_admin_user,
        db_session,
    ):
        """When test_admin_user is the only admin, demoting them must fail.

        The self-demotion guard fires first (since the authenticated admin is
        also the target); either guard is acceptable as long as the demotion
        is rejected and the role stays admin.
        """
        response = client.put(
            PUT_URL.format(user_id=test_admin_user.id),
            json={"role": "user"},
            headers=admin_token_headers,
        )
        assert response.status_code == 400
        message = response.json()["message"].lower()
        assert "admin role" in message or "last remaining admin" in message

        db_session.refresh(test_admin_user)
        assert test_admin_user.role == "admin"

    def test_demote_one_of_two_admins_succeeds(
        self,
        client: TestClient,
        admin_token_headers,
        test_admin_user,
        db_session,
    ):
        """With two admins, demoting the non-authenticated one is allowed."""
        second_admin = _make_admin(db_session, "secondadmin")

        response = client.put(
            PUT_URL.format(user_id=second_admin.id),
            json={"role": "user"},
            headers=admin_token_headers,
        )
        assert response.status_code == 200

        db_session.refresh(second_admin)
        assert second_admin.role == "user"


class TestLastActiveAdminDeactivationBlocked:
    def test_deactivate_only_active_admin_returns_400(
        self,
        client: TestClient,
        admin_token_headers,
        test_admin_user,
        db_session,
    ):
        """Cannot deactivate the last active admin even when a second admin
        exists but is inactive."""
        inactive_admin = _make_admin(db_session, "inactiveadmin")
        inactive_admin.is_active = False
        db_session.commit()

        response = client.put(
            PUT_URL.format(user_id=test_admin_user.id),
            json={"is_active": False},
            headers=admin_token_headers,
        )
        # Self-deactivation guard fires first; either guard is acceptable.
        assert response.status_code == 400
        detail = response.json()["message"].lower()
        assert "deactivate" in detail

        db_session.refresh(test_admin_user)
        assert test_admin_user.is_active is True

    def test_deactivate_non_last_active_admin_succeeds(
        self,
        client: TestClient,
        admin_token_headers,
        test_admin_user,
        db_session,
    ):
        """With two active admins, deactivating the non-authenticated one works."""
        second_admin = _make_admin(db_session, "secondadmin2")

        response = client.put(
            PUT_URL.format(user_id=second_admin.id),
            json={"is_active": False},
            headers=admin_token_headers,
        )
        assert response.status_code == 200

        db_session.refresh(second_admin)
        assert second_admin.is_active is False


class TestSelfProtection:
    def test_admin_cannot_demote_self(
        self,
        client: TestClient,
        admin_token_headers,
        test_admin_user,
        db_session,
    ):
        """Self-demotion is blocked even when another admin exists."""
        _make_admin(db_session, "backupadmin")

        response = client.put(
            PUT_URL.format(user_id=test_admin_user.id),
            json={"role": "user"},
            headers=admin_token_headers,
        )
        assert response.status_code == 400
        assert "own admin role" in response.json()["message"].lower()

        db_session.refresh(test_admin_user)
        assert test_admin_user.role == "admin"

    def test_admin_cannot_deactivate_self(
        self,
        client: TestClient,
        admin_token_headers,
        test_admin_user,
        db_session,
    ):
        """Self-deactivation is blocked even when another active admin exists."""
        _make_admin(db_session, "backupadmin2")

        response = client.put(
            PUT_URL.format(user_id=test_admin_user.id),
            json={"is_active": False},
            headers=admin_token_headers,
        )
        assert response.status_code == 400
        assert "own user account" in response.json()["message"].lower()

        db_session.refresh(test_admin_user)
        assert test_admin_user.is_active is True


class TestUnrelatedUpdatesUnaffected:
    def test_promoting_user_to_admin_succeeds(
        self,
        client: TestClient,
        admin_token_headers,
        test_admin_user,
        test_user,
        db_session,
    ):
        """Promotion path must not be blocked by the demotion guards."""
        response = client.put(
            PUT_URL.format(user_id=test_user.id),
            json={"role": "admin"},
            headers=admin_token_headers,
        )
        assert response.status_code == 200

        db_session.refresh(test_user)
        assert test_user.role == "admin"

    def test_username_change_on_other_admin_unaffected(
        self,
        client: TestClient,
        admin_token_headers,
        test_admin_user,
        db_session,
    ):
        """Renaming another admin while preserving their role works fine."""
        second_admin = _make_admin(db_session, "renametarget")

        response = client.put(
            PUT_URL.format(user_id=second_admin.id),
            json={"username": "renamed_admin"},
            headers=admin_token_headers,
        )
        assert response.status_code == 200

        db_session.refresh(second_admin)
        assert second_admin.username == "renamed_admin"
        assert second_admin.role == "admin"
