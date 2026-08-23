"""Tests for SSO_ONLY_MODE's server-side enforcement.

Hiding the login form is cosmetic - anyone can POST to /auth/login directly - so
these guards are the security boundary for the feature. The login test uses *valid*
credentials on purpose: a test with bad ones passes against an implementation that
never guards anything and simply returns 401.

What must keep working under the flag is as important as what must not:
/auth/change-password is the break-glass route for an admin and the completion route
for a hybrid account's forced password change.
"""

import logging
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from tests.utils.user import create_random_user

LOGIN_URL = "/api/v1/auth/login"
REGISTER_URL = "/api/v1/auth/register"
REGISTRATION_STATUS_URL = "/api/v1/auth/registration-status"
CHANGE_PASSWORD_URL = "/api/v1/auth/change-password"
SSO_CONFIG_URL = "/api/v1/auth/sso/config"

AUTH_LOGGER = "medical_records.app.api.v1.endpoints.auth"


@pytest.fixture
def sso_only():
    """Turn on SSO-only mode for the duration of a test.

    Patched inside the test rather than around the client fixture: startup
    validation refuses to boot with this flag set and SSO_ENABLED false, and the
    lifespan has already run by the time a test body executes.
    """
    with patch.object(settings, "SSO_ONLY_MODE", True):
        yield


def registration_payload(username: str = "newlocaluser") -> dict:
    return {
        "username": username,
        "email": f"{username}@example.com",
        "password": "password123",
        "full_name": "New Local User",
    }


class TestPasswordLoginIsRefused:
    def test_valid_credentials_are_refused_with_403(
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

    def test_no_token_and_no_cookie_are_issued(
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

        assert "access_token" not in response.json()
        assert not response.cookies

    def test_the_refusal_emits_a_security_event(
        self, client: TestClient, db_session, sso_only, caplog
    ):
        user_data = create_random_user(db_session)

        with caplog.at_level(logging.INFO, logger=AUTH_LOGGER):
            client.post(
                LOGIN_URL,
                data={
                    "username": user_data["username"],
                    "password": user_data["password"],
                },
            )

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "password_login_blocked_sso_only" in events
        # The blocked request is not a login attempt, and must not be counted as one.
        assert "login_attempt" not in events

    def test_login_still_works_with_the_flag_off(self, client: TestClient, db_session):
        user_data = create_random_user(db_session)

        response = client.post(
            LOGIN_URL,
            data={
                "username": user_data["username"],
                "password": user_data["password"],
            },
        )

        assert response.status_code == 200
        assert "access_token" in response.json()


class TestRegistrationIsRefused:
    @pytest.mark.parametrize("allow_registration", [True, False])
    def test_registration_is_refused_regardless_of_the_registration_setting(
        self, client: TestClient, sso_only, allow_registration
    ):
        with patch.object(settings, "ALLOW_USER_REGISTRATION", allow_registration):
            response = client.post(REGISTER_URL, json=registration_payload())

        assert response.status_code == 403

    def test_the_refusal_emits_its_own_security_event(
        self, client: TestClient, sso_only, caplog
    ):
        with caplog.at_level(logging.INFO, logger=AUTH_LOGGER):
            client.post(REGISTER_URL, json=registration_payload())

        events = [getattr(record, "event", None) for record in caplog.records]
        # Distinct from registration_blocked, which means ALLOW_USER_REGISTRATION.
        assert "registration_blocked_sso_only" in events
        assert "registration_blocked" not in events

    def test_registration_still_works_with_the_flag_off(self, client: TestClient):
        with patch.object(settings, "ALLOW_USER_REGISTRATION", True):
            response = client.post(
                REGISTER_URL, json=registration_payload("flagoffuser")
            )

        assert response.status_code == 200


class TestBreakGlassRoutesStayOpen:
    def test_change_password_still_works(self, client: TestClient, db_session):
        """A hybrid account's forced change and an admin's recovery both land here.

        The session is established before the flag goes on, which is the real
        sequence: an operator enables SSO-only, and an already-signed-in admin (or a
        hybrid user sent to the forced-change form) must still be able to finish.
        """
        user_data = create_random_user(db_session)
        login = client.post(
            LOGIN_URL,
            data={
                "username": user_data["username"],
                "password": user_data["password"],
            },
        )
        assert login.status_code == 200, "sign in before the flag goes on"
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        with patch.object(settings, "SSO_ONLY_MODE", True):
            response = client.post(
                CHANGE_PASSWORD_URL,
                json={
                    "currentPassword": user_data["password"],
                    "newPassword": "newpassword123",
                },
                headers=headers,
            )

        assert response.status_code == 200


class TestConfigPayload:
    def test_the_flags_are_exposed(self, client: TestClient):
        with patch.object(settings, "SSO_ONLY_MODE", True):
            with patch.object(settings, "SSO_AUTO_REDIRECT", True):
                body = client.get(SSO_CONFIG_URL).json()

        assert body["sso_only"] is True
        assert body["auto_redirect"] is True

    def test_the_flags_default_off(self, client: TestClient):
        body = client.get(SSO_CONFIG_URL).json()

        assert body["sso_only"] is False
        assert body["auto_redirect"] is False

    def test_a_failure_is_not_reported_as_sso_being_off(self, client: TestClient):
        """The endpoint must not synthesize a plausible-looking payload on error.

        `enabled: false, sso_only: false` is the one answer that strands a user
        under SSO-only: the client hides the SSO button and shows a password form
        the server refuses. A 500 cannot be mistaken for "SSO is off", so the client
        retries instead.
        """
        # Its own client: the shared fixture sets raise_server_exceptions=True, which
        # re-raises instead of letting the app's registered handler produce the
        # response the client would actually receive. Built before the patch, since
        # startup validation reads the attribute being made to raise.
        with TestClient(app, raise_server_exceptions=False) as unguarded:
            with patch.object(settings, "SSO_ONLY_MODE", True), patch.object(
                type(settings),
                "SSO_ENABLED",
                new_callable=PropertyMock,
                side_effect=RuntimeError("settings unavailable"),
            ):
                response = unguarded.get(SSO_CONFIG_URL)

        assert response.status_code == 500
        assert response.json().get("enabled") is None


class TestRegistrationStatus:
    def test_it_reports_the_effective_value_under_sso_only(
        self, client: TestClient, sso_only
    ):
        """Registration is refused under the flag, so the endpoint must say so.

        /auth/sso/config keeps reporting the raw setting, because there the field
        governs whether SSO may provision accounts - which this flag does not stop.
        """
        with patch.object(settings, "ALLOW_USER_REGISTRATION", True):
            status = client.get(REGISTRATION_STATUS_URL).json()
            sso_config = client.get(SSO_CONFIG_URL).json()

        assert status["registration_enabled"] is False
        assert status["message"]
        assert sso_config["registration_enabled"] is True

    def test_it_is_unchanged_with_the_flag_off(self, client: TestClient):
        with patch.object(settings, "ALLOW_USER_REGISTRATION", True):
            body = client.get(REGISTRATION_STATUS_URL).json()

        assert body["registration_enabled"] is True
        assert body["message"] is None
