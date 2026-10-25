"""Failed-login throttling on /auth/login and the GitHub manual-link endpoint."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.sso.exceptions import SSOAuthenticationError
from app.core.http.auth_codes import AuthErrorCode
from app.crud.user import user as user_crud
from app.schemas.user import UserCreate
from app.services.login_throttle import login_throttle

LOGIN_URL = "/api/v1/auth/login"
GITHUB_LINK_URL = "/api/v1/auth/sso/resolve-github-link"
PASSWORD = "Password123"


@pytest.fixture
def user(db_session: Session):
    return user_crud.create(
        db_session,
        obj_in=UserCreate(
            username="throttled",
            email="throttled@example.com",
            password=PASSWORD,
            full_name="Throttled User",
            role="user",
        ),
    )


@pytest.fixture
def per_username(limiter_ceiling):
    return lambda n: limiter_ceiling(login_throttle.by_username, n)


@pytest.fixture
def per_ip(limiter_ceiling):
    return lambda n: limiter_ceiling(login_throttle.by_ip, n)


def _login(client: TestClient, username: str, password: str):
    return client.post(LOGIN_URL, data={"username": username, "password": password})


class TestPasswordLogin:
    def test_locks_after_limit_and_reports_retry_after(
        self, client: TestClient, user, per_username
    ):
        per_username(3)
        for _ in range(3):
            assert _login(client, "throttled", "wrong-pass1").status_code == 401

        response = _login(client, "throttled", "wrong-pass1")

        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) >= 1
        assert response.json()["error_code"] == AuthErrorCode.LOGIN_RATE_LIMITED

    def test_correct_password_is_refused_while_locked(
        self, client: TestClient, user, per_username
    ):
        per_username(2)
        for _ in range(2):
            _login(client, "throttled", "wrong-pass1")

        response = _login(client, "throttled", PASSWORD)

        assert response.status_code == 429
        assert "access_token" not in response.json()

    def test_successful_logins_are_not_counted(
        self, client: TestClient, user, per_username
    ):
        per_username(2)
        for _ in range(5):
            assert _login(client, "throttled", PASSWORD).status_code == 200

        assert _login(client, "throttled", "wrong-pass1").status_code == 401

    def test_username_limit_ignores_case_and_spaces(
        self, client: TestClient, user, per_username
    ):
        per_username(2)
        _login(client, "Throttled", "wrong-pass1")
        _login(client, " throttled ", "wrong-pass1")

        assert _login(client, "throttled", PASSWORD).status_code == 429

    def test_other_usernames_are_unaffected_by_username_limit(
        self, client: TestClient, user, per_username
    ):
        per_username(2)
        for _ in range(2):
            _login(client, "someone-else", "wrong-pass1")

        assert _login(client, "throttled", PASSWORD).status_code == 200

    def test_ip_limit_spans_usernames(self, client: TestClient, user, per_ip):
        per_ip(3)
        for name in ("alpha", "bravo", "charlie"):
            assert _login(client, name, "wrong-pass1").status_code == 401

        assert _login(client, "throttled", PASSWORD).status_code == 429

    def test_sso_only_mode_answers_before_the_throttle(
        self, client: TestClient, user, per_username, monkeypatch
    ):
        from app.core.config import settings

        per_username(1)
        _login(client, "throttled", "wrong-pass1")
        monkeypatch.setattr(settings, "SSO_ONLY_MODE", True)

        assert _login(client, "throttled", PASSWORD).status_code == 403


class TestGitHubManualLink:
    BODY = {"temp_token": "t", "username": "throttled", "password": "wrong-pass1"}

    def _fail_with(self, code: str):
        return patch(
            "app.api.v1.endpoints.sso.sso_service.resolve_github_manual_link",
            side_effect=SSOAuthenticationError("failed", error_code=code),
        )

    def test_wrong_password_counts_toward_the_limit(
        self, client: TestClient, user, per_username
    ):
        per_username(2)
        with self._fail_with(AuthErrorCode.INVALID_CREDENTIALS):
            for _ in range(2):
                assert client.post(GITHUB_LINK_URL, json=self.BODY).status_code == 400
            response = client.post(GITHUB_LINK_URL, json=self.BODY)

        assert response.status_code == 429
        assert _login(client, "throttled", PASSWORD).status_code == 429

    def test_expired_link_token_does_not_count(
        self, client: TestClient, user, per_username
    ):
        per_username(2)
        with self._fail_with(AuthErrorCode.SSO_GITHUB_TOKEN_EXPIRED):
            for _ in range(3):
                assert client.post(GITHUB_LINK_URL, json=self.BODY).status_code == 400

        assert _login(client, "throttled", PASSWORD).status_code == 200


class TestReservation:
    """The slot is taken before the password check, so parallel guesses cannot overrun."""

    @staticmethod
    def _request(client_ip: str = "203.0.113.9"):
        from starlette.requests import Request

        return Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/v1/auth/login",
                "headers": [],
                "client": (client_ip, 50000),
            }
        )

    def test_username_lockout_does_not_reach_other_addresses(self, per_username):
        from fastapi import HTTPException

        per_username(1)
        attacker = self._request("203.0.113.9")
        login_throttle.reserve(attacker, "racer")
        with pytest.raises(HTTPException):
            login_throttle.reserve(attacker, "racer")

        login_throttle.reserve(self._request("198.51.100.4"), "racer")

    def test_unreleased_attempts_use_up_the_limit(self, per_username):
        from fastapi import HTTPException

        per_username(2)
        request = self._request()
        login_throttle.reserve(request, "racer")
        login_throttle.reserve(request, "racer")

        with pytest.raises(HTTPException) as rejected:
            login_throttle.reserve(request, "racer")
        assert rejected.value.status_code == 429

    def test_rejected_attempt_gives_back_the_ip_slot(self, per_username, per_ip):
        from fastapi import HTTPException

        per_username(1)
        per_ip(5)
        request = self._request()
        login_throttle.reserve(request, "racer")
        with pytest.raises(HTTPException):
            login_throttle.reserve(request, "racer")

        assert login_throttle.by_ip.get_remaining_requests("203.0.113.9") == 4

    def test_zero_turns_a_limit_off(self, client: TestClient, user, per_username):
        per_username(0)
        for _ in range(5):
            assert _login(client, "throttled", "wrong-pass1").status_code == 401

        assert _login(client, "throttled", PASSWORD).status_code == 200


class TestConfigValidation:
    @pytest.mark.parametrize(
        "name", ["LOGIN_MAX_FAILED_ATTEMPTS", "LOGIN_MAX_FAILED_ATTEMPTS_PER_IP"]
    )
    def test_negative_limit_fails_startup_validation(self, name, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, name, -1)

        with pytest.raises(ValueError, match=name):
            settings.validate_auth_mode_config()

    @pytest.mark.parametrize("minutes", [0, -5])
    def test_window_below_one_minute_is_rejected(self, minutes, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "LOGIN_FAILED_WINDOW_MINUTES", minutes)

        with pytest.raises(ValueError, match="LOGIN_FAILED_WINDOW_MINUTES"):
            settings.validate_login_throttle_config()

    def test_zero_limits_are_accepted(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS", 0)
        monkeypatch.setattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS_PER_IP", 0)

        settings.validate_login_throttle_config()
