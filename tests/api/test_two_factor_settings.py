"""The signed-in user's two-factor settings and "sign out other sessions"."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.http.auth_codes import AuthErrorCode
from app.models.activity_log import ActionType, ActivityLog
from app.models.mfa import UserBackupCode, UserTotp
from app.services import two_factor_service
from tests.utils.two_factor import (
    PASSWORD,
    code_at,
    enroll,
    login,
    make_user,
    request_ticket,
    verify,
)

BASE = "/api/v1/users/me"
STATUS_URL = f"{BASE}/two-factor"
SETUP_URL = f"{BASE}/two-factor/totp/setup"
CONFIRM_URL = f"{BASE}/two-factor/totp/confirm"
DISABLE_URL = f"{BASE}/two-factor/disable"
REGENERATE_URL = f"{BASE}/two-factor/backup-codes/regenerate"
REVOKE_URL = f"{BASE}/sessions/revoke-others"
PROTECTED_URL = f"{BASE}/preferences"


@pytest.fixture
def user(db_session: Session):
    return make_user(db_session, "settingsuser")


def _sign_in(client: TestClient) -> str:
    """Sign in with the cookie; returns the issued token for use from another 'device'."""
    response = login(client, "settingsuser")
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def signed_in(client: TestClient, user) -> TestClient:
    _sign_in(client)
    return client


def _actions(db: Session) -> list[str]:
    db.expire_all()
    return [a.action for a in db.query(ActivityLog).all()]


class TestStatus:
    def test_new_user(self, signed_in: TestClient):
        assert signed_in.get(STATUS_URL).json() == {
            "totp_enabled": False,
            "backup_codes_remaining": 0,
            "enrollment_allowed": True,
            "blocked_reason": None,
        }

    def test_enrolled_user(self, signed_in: TestClient, db_session, user):
        _enroll_here(signed_in)

        body = signed_in.get(STATUS_URL).json()

        assert body["totp_enabled"] is True
        assert body["backup_codes_remaining"] == 10

    @pytest.mark.parametrize(
        "patched, reason",
        [
            ({"TWO_FACTOR_ENABLED": False}, "disabled_by_operator"),
            ({"SECRET_KEY_IS_EPHEMERAL": True}, "secret_key_not_configured"),
        ],
    )
    def test_blocked_reasons(self, signed_in: TestClient, patched, reason):
        with patch.multiple(settings, **patched):
            body = signed_in.get(STATUS_URL).json()

        assert body["enrollment_allowed"] is False
        assert body["blocked_reason"] == reason

    def test_requires_a_session(self, client: TestClient):
        client.cookies.clear()
        assert client.get(STATUS_URL).status_code == 401


class TestEnrollment:
    def _setup(self, client: TestClient, password: str = PASSWORD):
        return client.post(SETUP_URL, json={"current_password": password})

    def test_full_enrollment(self, signed_in: TestClient, db_session):
        setup = self._setup(signed_in)
        assert setup.status_code == 200
        secret = setup.json()["secret"]
        assert setup.json()["otpauth_uri"].startswith("otpauth://totp/")

        confirm = signed_in.post(CONFIRM_URL, json={"code": code_at(secret)})

        assert confirm.status_code == 200
        assert len(confirm.json()["backup_codes"]) == 10
        assert signed_in.get(STATUS_URL).json()["totp_enabled"] is True
        assert ActionType.TWO_FACTOR_ENABLED in _actions(db_session)

    def test_confirm_ends_other_sessions_and_keeps_this_one(
        self, client: TestClient, user
    ):
        other_device = _sign_in(client)
        _sign_in(client)
        secret = self._setup(client).json()["secret"]

        confirm = client.post(CONFIRM_URL, json={"code": code_at(secret)})

        assert confirm.status_code == 200
        fresh = confirm.cookies.get(settings.AUTH_COOKIE_NAME)
        assert fresh
        client.cookies.clear()
        assert _get(client, other_device).status_code == 401
        assert _get(client, fresh).status_code == 200

    def test_wrong_password(self, signed_in: TestClient):
        response = self._setup(signed_in, password="wrong-pass1")

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.CURRENT_PASSWORD_INCORRECT

    @pytest.mark.parametrize("password", ["x" * 73, "é" * 40])
    def test_password_past_bcrypt_limit_is_incorrect_not_an_error(
        self, signed_in: TestClient, password
    ):
        response = self._setup(signed_in, password=password)

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.CURRENT_PASSWORD_INCORRECT

    def test_already_enabled(self, signed_in: TestClient, db_session, user):
        _enroll_here(signed_in)

        response = self._setup(signed_in)

        assert response.status_code == 409
        assert response.json()["error_code"] == AuthErrorCode.TWO_FACTOR_ALREADY_ENABLED

    def test_confirm_without_setup(self, signed_in: TestClient):
        response = signed_in.post(CONFIRM_URL, json={"code": "123456"})

        assert response.status_code == 409
        assert (
            response.json()["error_code"] == AuthErrorCode.TWO_FACTOR_SETUP_NOT_STARTED
        )

    def test_confirm_with_wrong_code(self, signed_in: TestClient):
        self._setup(signed_in)

        response = signed_in.post(CONFIRM_URL, json={"code": "000000"})

        assert response.status_code == 400
        assert response.json()["error_code"] == AuthErrorCode.MFA_CODE_INVALID
        assert signed_in.get(STATUS_URL).json()["totp_enabled"] is False

    @pytest.mark.parametrize(
        "patched",
        [
            {"TWO_FACTOR_ENABLED": False},
            {"SSO_ONLY_MODE": True},
            {"SECRET_KEY_IS_EPHEMERAL": True},
        ],
    )
    def test_blocked_setup(self, signed_in: TestClient, patched):
        with patch.multiple(settings, **patched):
            response = self._setup(signed_in)

        assert response.status_code == 403
        assert (
            response.json()["error_code"] == AuthErrorCode.TWO_FACTOR_ENROLLMENT_BLOCKED
        )

    def test_sso_account_cannot_enroll(self, signed_in: TestClient, db_session, user):
        user.auth_method = "sso"
        db_session.commit()

        assert self._setup(signed_in).status_code == 403

    def test_failed_checks_are_limited(self, signed_in: TestClient, limiter_ceiling):
        limiter_ceiling(two_factor_service.settings_check_limiter, 2)
        for _ in range(2):
            assert self._setup(signed_in, password="wrong-pass1").status_code == 401

        response = self._setup(signed_in)

        assert response.status_code == 429
        assert response.json()["error_code"] == AuthErrorCode.TWO_FACTOR_RATE_LIMITED

    def test_successful_checks_are_not_counted(
        self, signed_in: TestClient, limiter_ceiling
    ):
        limiter_ceiling(two_factor_service.settings_check_limiter, 1)
        for _ in range(3):
            assert self._setup(signed_in).status_code == 200


class TestDisable:
    def test_disable_with_totp_ends_other_sessions_only(
        self, client: TestClient, db_session, user
    ):
        secret, codes = enroll(db_session, user)
        other_device = _sign_in_with_mfa(client, codes[0], method="backup_code")
        this_device = _sign_in_with_mfa(client, code_at(secret))
        client.cookies.clear()
        headers = {"Authorization": f"Bearer {this_device}"}

        response = client.post(
            DISABLE_URL,
            json={"current_password": PASSWORD, "code": code_at(secret, 1)},
            headers=headers,
        )

        assert response.status_code == 200
        fresh = response.cookies.get(settings.AUTH_COOKIE_NAME)
        assert fresh
        assert db_session.query(UserTotp).count() == 0
        assert db_session.query(UserBackupCode).count() == 0
        client.cookies.clear()
        assert _get(client, other_device).status_code == 401
        assert _get(client, fresh).status_code == 200
        assert ActionType.TWO_FACTOR_DISABLED in _actions(db_session)

    def test_disable_with_backup_code(self, signed_in: TestClient, db_session, user):
        _, codes = _enroll_here(signed_in)

        response = signed_in.post(
            DISABLE_URL, json={"current_password": PASSWORD, "code": codes[0]}
        )

        assert response.status_code == 200

    def test_wrong_code(self, signed_in: TestClient, db_session, user):
        _enroll_here(signed_in)

        response = signed_in.post(
            DISABLE_URL, json={"current_password": PASSWORD, "code": "000000"}
        )

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.MFA_CODE_INVALID
        assert signed_in.get(STATUS_URL).json()["totp_enabled"] is True

    def test_wrong_password(self, signed_in: TestClient, db_session, user):
        secret, _ = _enroll_here(signed_in)

        response = signed_in.post(
            DISABLE_URL, json={"current_password": "nope", "code": code_at(secret)}
        )

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.CURRENT_PASSWORD_INCORRECT

    def test_not_enabled(self, signed_in: TestClient):
        response = signed_in.post(
            DISABLE_URL, json={"current_password": PASSWORD, "code": "123456"}
        )

        assert response.status_code == 409
        assert response.json()["error_code"] == AuthErrorCode.TWO_FACTOR_NOT_ENABLED

    def test_allowed_while_kill_switch_is_off(
        self, signed_in: TestClient, db_session, user
    ):
        _, codes = _enroll_here(signed_in)

        with patch.object(settings, "TWO_FACTOR_ENABLED", False):
            response = signed_in.post(
                DISABLE_URL, json={"current_password": PASSWORD, "code": codes[0]}
            )

        assert response.status_code == 200

    def test_next_login_has_no_second_step(
        self, signed_in: TestClient, db_session, user
    ):
        _, codes = _enroll_here(signed_in)
        signed_in.post(
            DISABLE_URL, json={"current_password": PASSWORD, "code": codes[0]}
        )

        assert _sign_in(signed_in)


class TestRegenerate:
    def test_returns_new_codes_and_old_ones_stop_working(
        self, signed_in: TestClient, db_session, user
    ):
        secret, old = _enroll_here(signed_in)

        response = signed_in.post(
            REGENERATE_URL,
            json={"current_password": PASSWORD, "code": code_at(secret)},
        )

        assert response.status_code == 200
        new = response.json()["backup_codes"]
        assert len(new) == 10 and not set(new) & set(old)
        with pytest.raises(two_factor_service.CodeRejected):
            two_factor_service.verify_backup_code(db_session, user, old[1])
        assert ActionType.BACKUP_CODES_REGENERATED in _actions(db_session)

    def test_not_enabled(self, signed_in: TestClient):
        response = signed_in.post(
            REGENERATE_URL, json={"current_password": PASSWORD, "code": "123456"}
        )

        assert response.status_code == 409


class TestRevokeOthers:
    def test_ends_other_sessions_and_keeps_this_one(
        self, client: TestClient, db_session, user
    ):
        other_device = _sign_in(client)
        this_device = _sign_in(client)
        client.cookies.clear()

        response = client.post(
            REVOKE_URL, headers={"Authorization": f"Bearer {this_device}"}
        )

        assert response.status_code == 200
        fresh = response.cookies.get(settings.AUTH_COOKIE_NAME)
        client.cookies.clear()
        assert _get(client, other_device).status_code == 401
        assert _get(client, this_device).status_code == 401
        assert _get(client, fresh).status_code == 200
        assert ActionType.SESSIONS_REVOKED in _actions(db_session)

    def test_requires_a_session(self, client: TestClient):
        client.cookies.clear()
        assert client.post(REVOKE_URL).status_code == 401


def _get(client: TestClient, token: str):
    return client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})


def _sign_in_with_mfa(client: TestClient, code: str, method: str = "totp") -> str:
    response = verify(client, request_ticket(client, "settingsuser"), code, method)
    assert response.status_code == 200
    return response.json()["access_token"]


def _enroll_here(client: TestClient) -> tuple[str, list[str]]:
    """Turn on two-factor through the API, so this client keeps its session."""
    setup = client.post(SETUP_URL, json={"current_password": PASSWORD})
    secret = setup.json()["secret"]
    # The previous step, so the current one is still free for the test
    confirm = client.post(CONFIRM_URL, json={"code": code_at(secret, -1)})
    assert confirm.status_code == 200
    return secret, confirm.json()["backup_codes"]
