"""
Tests for must_change_password handling across the SSO login paths.

A pure-SSO account is created with a random password that is discarded immediately,
so a forced local password change can never be satisfied and locks the account out.
These tests cover the three behaviors that fix and guard that:

1. Every SSO login response carries must_change_password (all three entry points).
2. auth_method == "sso" gets the unsatisfiable flag cleared on login.
3. auth_method == "hybrid" keeps the flag - those users have a real local password.
"""

import logging
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.crud.user import user as user_crud
from app.models.models import User
from app.schemas.user import UserCreate

CALLBACK_URL = "/api/v1/auth/sso/callback"
CONFLICT_URL = "/api/v1/auth/sso/resolve-conflict"
GITHUB_LINK_URL = "/api/v1/auth/sso/resolve-github-link"

CALLBACK_BODY = {"code": "test-code", "state": "test-state"}
CONFLICT_BODY = {
    "temp_token": "test-temp-token",
    "action": "link",
    "preference": "auto_link",
}
GITHUB_LINK_BODY = {
    "temp_token": "test-temp-token",
    "username": "ssouser",
    "password": "irrelevant-for-this-test",
}


def make_sso_user(
    db_session: Session,
    *,
    username: str = "ssouser",
    auth_method: str = "sso",
    must_change_password: bool = False,
    is_active: bool = True,
) -> User:
    """Create a user with the SSO fields and flags a test needs."""
    user = user_crud.create(
        db_session,
        obj_in=UserCreate(
            username=username,
            email=f"{username}@example.com",
            password="localpassword123",
            full_name="SSO Test User",
            role="user",
        ),
        must_change_password=must_change_password,
    )

    user.auth_method = auth_method
    user.external_id = f"external-{username}"
    user.sso_provider = "google"
    user.is_active = is_active
    db_session.commit()
    db_session.refresh(user)

    return user


def patch_callback(user: User, is_new_user: bool = False):
    """Patch the SSO service so /callback returns the given user."""
    return patch(
        "app.api.v1.endpoints.sso.sso_service.complete_authentication",
        new=AsyncMock(return_value={"user": user, "is_new_user": is_new_user}),
    )


def patch_conflict(user: User, is_new_user: bool = False):
    """Patch the SSO service so /resolve-conflict returns the given user."""
    return patch(
        "app.api.v1.endpoints.sso.sso_service.resolve_account_conflict",
        return_value={"user": user, "is_new_user": is_new_user},
    )


def patch_github_link(user: User, is_new_user: bool = False):
    """Patch the SSO service so /resolve-github-link returns the given user."""
    return patch(
        "app.api.v1.endpoints.sso.sso_service.resolve_github_manual_link",
        return_value={"user": user, "is_new_user": is_new_user},
    )


# All three endpoints funnel through _complete_sso_login, so behavior that lives
# there must hold for every one of them.
ENTRY_POINTS = [
    pytest.param(CALLBACK_URL, CALLBACK_BODY, patch_callback, id="callback"),
    pytest.param(CONFLICT_URL, CONFLICT_BODY, patch_conflict, id="resolve-conflict"),
    pytest.param(
        GITHUB_LINK_URL, GITHUB_LINK_BODY, patch_github_link, id="resolve-github-link"
    ),
]


class TestSSOResponseIncludesFlag:
    """The SSO login response must expose must_change_password to the frontend."""

    @pytest.mark.parametrize("url, body, patcher", ENTRY_POINTS)
    def test_every_entry_point_returns_the_flag(
        self, client: TestClient, db_session: Session, url, body, patcher
    ):
        user = make_sso_user(
            db_session, auth_method="hybrid", must_change_password=True
        )

        with patcher(user):
            response = client.post(url, json=body)

        assert response.status_code == 200
        assert response.json()["must_change_password"] is True

    def test_flag_is_returned_as_false_when_not_set(
        self, client: TestClient, db_session: Session
    ):
        user = make_sso_user(db_session, must_change_password=False)

        with patch_callback(user):
            response = client.post(CALLBACK_URL, json=CALLBACK_BODY)

        assert response.status_code == 200
        assert response.json()["must_change_password"] is False


class TestForcedChangeClearedForSSOOnlyUsers:
    """auth_method == 'sso' users cannot satisfy a forced change, so it is cleared."""

    @pytest.mark.parametrize("url, body, patcher", ENTRY_POINTS)
    def test_every_entry_point_clears_flag_for_sso_user(
        self, client: TestClient, db_session: Session, url, body, patcher
    ):
        user = make_sso_user(db_session, auth_method="sso", must_change_password=True)
        user_id = user.id

        with patcher(user):
            response = client.post(url, json=body)

        assert response.status_code == 200
        assert response.json()["must_change_password"] is False

        db_session.expire_all()
        assert db_session.get(User, user_id).must_change_password is False

    def test_clear_emits_security_event(
        self, client: TestClient, db_session: Session, caplog
    ):
        user = make_sso_user(db_session, auth_method="sso", must_change_password=True)

        with caplog.at_level(logging.WARNING, logger="app.api.v1.endpoints.sso"):
            with patch_callback(user):
                response = client.post(CALLBACK_URL, json=CALLBACK_BODY)

        assert response.status_code == 200
        events = [getattr(record, "event", None) for record in caplog.records]
        assert "sso_forced_password_change_cleared" in events

    def test_no_event_when_flag_was_not_set(
        self, client: TestClient, db_session: Session, caplog
    ):
        user = make_sso_user(db_session, auth_method="sso", must_change_password=False)

        with caplog.at_level(logging.WARNING, logger="app.api.v1.endpoints.sso"):
            with patch_callback(user):
                response = client.post(CALLBACK_URL, json=CALLBACK_BODY)

        assert response.status_code == 200
        events = [getattr(record, "event", None) for record in caplog.records]
        assert "sso_forced_password_change_cleared" not in events


class TestForcedChangePreservedForOtherAuthMethods:
    """Only pure-SSO accounts are exempt - everyone else keeps the flag."""

    @pytest.mark.parametrize("auth_method", ["hybrid", "local"])
    def test_flag_preserved_on_sso_login(
        self, client: TestClient, db_session: Session, auth_method: str
    ):
        user = make_sso_user(
            db_session, auth_method=auth_method, must_change_password=True
        )
        user_id = user.id

        with patch_callback(user):
            response = client.post(CALLBACK_URL, json=CALLBACK_BODY)

        assert response.status_code == 200
        assert response.json()["must_change_password"] is True

        db_session.expire_all()
        assert db_session.get(User, user_id).must_change_password is True

    def test_password_login_leaves_flag_untouched(
        self, client: TestClient, db_session: Session
    ):
        """Regression guard: the password login path must not clear the flag."""
        user = make_sso_user(
            db_session,
            username="localuser",
            auth_method="local",
            must_change_password=True,
        )
        user_id = user.id

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "localuser", "password": "localpassword123"},
        )

        assert response.status_code == 200
        assert response.json()["must_change_password"] is True

        db_session.expire_all()
        assert db_session.get(User, user_id).must_change_password is True


class TestClearFailure:
    """If the clear cannot be persisted, the login must not succeed."""

    def test_commit_failure_fails_the_login_and_leaves_flag_set(
        self, client: TestClient, db_session: Session
    ):
        user = make_sso_user(db_session, auth_method="sso", must_change_password=True)
        user_id = user.id

        # Break the commit that persists the clear. Issuing a session here would
        # route the user to a forced-change form they cannot satisfy.
        with patch.object(
            Session, "commit", side_effect=SQLAlchemyError("commit failed")
        ):
            with patch_callback(user):
                response = client.post(CALLBACK_URL, json=CALLBACK_BODY)

        assert response.status_code != 200
        assert "access_token" not in response.json()

        db_session.rollback()
        db_session.expire_all()
        assert db_session.get(User, user_id).must_change_password is True

    def test_last_login_failure_alone_does_not_fail_the_login(
        self, client: TestClient, db_session: Session
    ):
        """No clear intended - the pre-existing tolerance for this must survive."""
        user = make_sso_user(db_session, auth_method="sso", must_change_password=False)

        with patch(
            "app.api.v1.endpoints.sso.get_utc_now",
            side_effect=SQLAlchemyError("clock failed"),
        ):
            with patch_callback(user):
                response = client.post(CALLBACK_URL, json=CALLBACK_BODY)

        assert response.status_code == 200
        assert "access_token" in response.json()


class TestEdgeCases:
    def test_inactive_sso_user_is_rejected_and_flag_untouched(
        self, client: TestClient, db_session: Session
    ):
        """An inactive account is rejected before the clear runs."""
        user = make_sso_user(
            db_session,
            auth_method="sso",
            must_change_password=True,
            is_active=False,
        )
        user_id = user.id

        with patch_callback(user):
            response = client.post(CALLBACK_URL, json=CALLBACK_BODY)

        # Login does not succeed, so the clear never runs. The status is currently
        # 500 rather than 401 because the endpoint's broad `except Exception`
        # swallows UnauthorizedException - a pre-existing defect tracked separately
        # in TECHNICAL_DEBT.md, deliberately not changed here.
        assert response.status_code != 200

        db_session.expire_all()
        assert db_session.get(User, user_id).must_change_password is True

    def test_new_sso_user_without_preferences_row(
        self, client: TestClient, db_session: Session
    ):
        """A first-time SSO user has no preferences row yet; login still works."""
        user = make_sso_user(db_session, auth_method="sso", must_change_password=True)

        with patch_callback(user, is_new_user=True):
            response = client.post(CALLBACK_URL, json=CALLBACK_BODY)

        assert response.status_code == 200
        data = response.json()
        assert data["is_new_user"] is True
        assert data["must_change_password"] is False
        assert "session_timeout_minutes" in data
