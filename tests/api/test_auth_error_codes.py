"""Every auth failure a client renders must name which rule fired.

The client picks translated copy from `error_code`, so these assertions are the
contract behind `auth.errors.*` in the frontend locales.

The status is asserted alongside each code deliberately: a code arriving on the wrong
status still breaks the client, which branches on both.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.http.auth_codes import AuthErrorCode, AuthMessageCode
from tests.utils.user import create_random_user

LOGIN_URL = "/api/v1/auth/login"
REGISTER_URL = "/api/v1/auth/register"
REGISTRATION_STATUS_URL = "/api/v1/auth/registration-status"
CHANGE_PASSWORD_URL = "/api/v1/auth/change-password"


@pytest.fixture
def sso_only():
    """Startup validation refuses this flag at boot, so patch inside the test."""
    with patch.object(settings, "SSO_ONLY_MODE", True):
        yield


def registration_payload(username: str = "codeduser") -> dict:
    return {
        "username": username,
        "email": f"{username}@example.com",
        "password": "password123",
        "full_name": "Coded User",
    }


class TestLoginCodes:
    def test_wrong_password_says_which_rule_fired(self, client: TestClient, db_session):
        user_data = create_random_user(db_session)

        response = client.post(
            LOGIN_URL,
            data={"username": user_data["username"], "password": "wrong-password"},
        )

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.INVALID_CREDENTIALS

    def test_deactivated_account_is_distinct_from_bad_credentials(
        self, client: TestClient, db_session
    ):
        """Both are 401s. Only the code separates them, which is the whole point."""
        user_data = create_random_user(db_session)
        db_user = user_data["user"]
        db_user.is_active = False
        db_session.commit()

        response = client.post(
            LOGIN_URL,
            data={
                "username": user_data["username"],
                "password": user_data["password"],
            },
        )

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.ACCOUNT_DEACTIVATED

    def test_sso_only_mode_refusal_is_coded(
        self, client: TestClient, db_session, sso_only
    ):
        user_data = create_random_user(db_session)

        response = client.post(
            LOGIN_URL,
            data={
                "username": user_data["username"],
                "password": user_data["password"],
            },
        )

        assert response.status_code == 403
        assert (
            response.json()["error_code"]
            == AuthErrorCode.SSO_ONLY_PASSWORD_LOGIN_DISABLED
        )


class TestRegistrationCodes:
    def test_duplicate_username_is_coded(self, client: TestClient, db_session):
        user_data = create_random_user(db_session)
        payload = registration_payload()
        payload["username"] = user_data["username"]

        response = client.post(REGISTER_URL, json=payload)

        assert response.status_code == 409
        assert response.json()["error_code"] == AuthErrorCode.USERNAME_TAKEN

    def test_duplicate_email_is_coded(self, client: TestClient, db_session):
        user_data = create_random_user(db_session)
        payload = registration_payload()
        payload["email"] = user_data["user"].email

        response = client.post(REGISTER_URL, json=payload)

        assert response.status_code == 409
        assert response.json()["error_code"] == AuthErrorCode.EMAIL_TAKEN

    def test_sso_only_mode_blocks_registration_with_its_own_code(
        self, client: TestClient, sso_only
    ):
        """Distinct from plain registration-disabled: the remedy differs."""
        response = client.post(REGISTER_URL, json=registration_payload())

        assert response.status_code == 403
        assert (
            response.json()["error_code"] == AuthErrorCode.SSO_ONLY_REGISTRATION_BLOCKED
        )

    def test_registration_disabled_is_coded(self, client: TestClient):
        with patch.object(settings, "ALLOW_USER_REGISTRATION", False):
            response = client.post(REGISTER_URL, json=registration_payload())

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.REGISTRATION_DISABLED


class TestRegistrationStatusCodes:
    """A 200 body, so the code travels as message_code rather than error_code."""

    def test_sso_only_carries_its_message_code(self, client: TestClient, sso_only):
        body = client.get(REGISTRATION_STATUS_URL).json()

        assert body["registration_enabled"] is False
        assert body["message_code"] == AuthMessageCode.SSO_ONLY_REGISTRATION_UNAVAILABLE

    def test_registration_disabled_carries_its_message_code(self, client: TestClient):
        with patch.object(settings, "ALLOW_USER_REGISTRATION", False):
            body = client.get(REGISTRATION_STATUS_URL).json()

        assert body["registration_enabled"] is False
        assert body["message_code"] == AuthMessageCode.REGISTRATION_DISABLED

    def test_registration_available_carries_no_code(self, client: TestClient):
        """Nothing to explain, so there is nothing for the client to render."""
        with patch.object(settings, "ALLOW_USER_REGISTRATION", True):
            body = client.get(REGISTRATION_STATUS_URL).json()

        assert body["registration_enabled"] is True
        assert body["message_code"] is None
        assert body["message"] is None


class TestChangePasswordCodes:
    def test_wrong_current_password_is_coded(
        self, client: TestClient, authenticated_headers
    ):
        response = client.post(
            CHANGE_PASSWORD_URL,
            json={
                "currentPassword": "not-the-current-password",
                "newPassword": "newpass123",
            },
            headers=authenticated_headers,
        )

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.CURRENT_PASSWORD_INCORRECT
