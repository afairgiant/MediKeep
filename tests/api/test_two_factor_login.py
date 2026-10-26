"""Password sign-in with two-factor: the challenge, /auth/two-factor/verify, and tickets."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.http.auth_codes import AuthErrorCode
from app.core.utils.security import decode_access_token
from app.crud.user import user as user_crud
from app.models.activity_log import ActionType, ActivityLog
from app.services import two_factor_service
from tests.utils.two_factor import (
    PASSWORD,
    VERIFY_URL,
    code_at,
    enroll,
    login,
    make_user,
    request_ticket,
    totp_row,
)
from tests.utils.two_factor import verify as _verify

ME_URL = "/api/v1/users/me"


@pytest.fixture
def user(db_session: Session):
    return make_user(db_session, "mfauser")


@pytest.fixture
def enrolled(db_session: Session, user):
    return enroll(db_session, user)


def _login(client: TestClient, password: str = PASSWORD):
    return login(client, "mfauser", password)


def _ticket(client: TestClient) -> str:
    return request_ticket(client, "mfauser")


class TestChallenge:
    def test_enrolled_user_gets_a_ticket_and_no_session(
        self, client: TestClient, enrolled
    ):
        response = _login(client)

        assert response.status_code == 200
        body = response.json()
        assert body["mfa_required"] is True
        assert body["methods"] == ["totp", "backup_code"]
        assert body["expires_in"] == 300
        assert "access_token" not in body
        assert settings.AUTH_COOKIE_NAME not in response.cookies

    def test_user_without_two_factor_is_unaffected(self, client: TestClient, user):
        body = _login(client).json()

        assert "access_token" in body
        assert "mfa_required" not in body

    def test_pending_setup_does_not_trigger_the_step(
        self, client: TestClient, db_session, user
    ):
        two_factor_service.start_enrollment(db_session, user)

        assert "access_token" in _login(client).json()

    def test_wrong_password_never_reaches_the_step(self, client: TestClient, enrolled):
        response = _login(client, password="wrong-pass1")

        assert response.status_code == 401
        assert "mfa_ticket" not in response.json()

    def test_kill_switch_skips_the_step(self, client: TestClient, enrolled):
        with patch.object(settings, "TWO_FACTOR_ENABLED", False):
            body = _login(client).json()

        assert "access_token" in body

    def test_sso_only_mode_refuses_before_the_step(self, client: TestClient, enrolled):
        with patch.object(settings, "SSO_ONLY_MODE", True):
            response = _login(client)

        assert response.status_code == 403
        assert "mfa_ticket" not in response.json()

    @pytest.mark.parametrize("where", ["header", "cookie", "query"])
    def test_ticket_is_not_a_session(self, client: TestClient, enrolled, where):
        ticket = _ticket(client)
        client.cookies.clear()

        if where == "header":
            response = client.get(ME_URL, headers={"Authorization": f"Bearer {ticket}"})
        elif where == "cookie":
            client.cookies.set(settings.AUTH_COOKIE_NAME, ticket)
            response = client.get(ME_URL)
            client.cookies.clear()
        else:
            response = client.get(
                "/api/v1/entity-files/files/999999/view", params={"token": ticket}
            )

        assert response.status_code == 401


class TestVerify:
    def test_totp_completes_the_login(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        response = _verify(client, _ticket(client), code_at(secret))

        assert response.status_code == 200
        body = response.json()
        claims = decode_access_token(body["access_token"])
        assert claims["sub"] == "mfauser"
        assert claims["typ"] == "access"
        assert response.cookies.get(settings.AUTH_COOKIE_NAME)
        assert "backup_codes_remaining" not in body
        assert client.get(ME_URL).status_code == 200

    def test_login_activity_records_the_method(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        _verify(client, _ticket(client), code_at(secret))

        entry = (
            db_session.query(ActivityLog)
            .filter(ActivityLog.action == ActionType.LOGIN)
            .order_by(ActivityLog.id.desc())
            .first()
        )
        assert entry.event_metadata["method"] == "totp"

    def test_backup_code_completes_and_reports_remaining(
        self, client: TestClient, enrolled
    ):
        _, codes = enrolled
        response = _verify(client, _ticket(client), codes[0], method="backup_code")

        assert response.status_code == 200
        assert response.json()["backup_codes_remaining"] == 9

    def test_wrong_code_is_rejected_and_ticket_survives(
        self, client: TestClient, enrolled
    ):
        secret, _ = enrolled
        ticket = _ticket(client)

        wrong = _verify(client, ticket, "000000")
        assert wrong.status_code == 401
        assert wrong.json()["error_code"] == AuthErrorCode.MFA_CODE_INVALID

        assert _verify(client, ticket, code_at(secret)).status_code == 200

    def test_replayed_code_is_rejected(self, client: TestClient, enrolled):
        secret, _ = enrolled
        code = code_at(secret)
        assert _verify(client, _ticket(client), code).status_code == 200

        response = _verify(client, _ticket(client), code)

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.MFA_CODE_INVALID

    def test_ticket_is_single_use(self, client: TestClient, enrolled):
        secret, _ = enrolled
        ticket = _ticket(client)
        assert _verify(client, ticket, code_at(secret)).status_code == 200

        response = _verify(client, ticket, code_at(secret, 1))

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.MFA_TICKET_INVALID

    def test_ticket_allows_five_attempts(self, client: TestClient, enrolled):
        secret, _ = enrolled
        ticket = _ticket(client)
        for _ in range(5):
            assert _verify(client, ticket, "000000").status_code == 401

        response = _verify(client, ticket, code_at(secret))

        assert response.json()["error_code"] == AuthErrorCode.MFA_TICKET_INVALID

    def test_unknown_ticket(self, client: TestClient, enrolled):
        response = _verify(client, "made-up", "123456")

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.MFA_TICKET_INVALID

    def test_expired_ticket(self, client: TestClient, enrolled):
        secret, _ = enrolled
        with patch(
            "app.core.utils.ephemeral_store.time.monotonic", return_value=1000.0
        ):
            ticket = _ticket(client)
        with patch(
            "app.core.utils.ephemeral_store.time.monotonic", return_value=1301.0
        ):
            response = _verify(client, ticket, code_at(secret))

        assert response.json()["error_code"] == AuthErrorCode.MFA_TICKET_INVALID

    def test_per_user_limit_spans_tickets(
        self, client: TestClient, enrolled, limiter_ceiling
    ):
        secret, _ = enrolled
        limiter_ceiling(two_factor_service.mfa_verify_limiter, 3)
        for _ in range(3):
            assert _verify(client, _ticket(client), "000000").status_code == 401

        response = _verify(client, _ticket(client), code_at(secret))

        assert response.status_code == 429
        assert response.json()["error_code"] == AuthErrorCode.MFA_RATE_LIMITED
        assert int(response.headers["Retry-After"]) >= 1

    def test_daily_limit_spans_the_short_window(
        self, client: TestClient, enrolled, limiter_ceiling
    ):
        secret, _ = enrolled
        limiter_ceiling(two_factor_service.mfa_daily_limiter, 2)
        for _ in range(2):
            assert _verify(client, _ticket(client), "000000").status_code == 401

        response = _verify(client, _ticket(client), code_at(secret))

        assert response.status_code == 429
        assert response.json()["error_code"] == AuthErrorCode.MFA_RATE_LIMITED

    def test_daily_limit_rejection_does_not_count_against_the_short_window(
        self, client: TestClient, user, enrolled, limiter_ceiling
    ):
        limiter_ceiling(two_factor_service.mfa_daily_limiter, 1)
        _verify(client, _ticket(client), "000000")
        before = two_factor_service.mfa_verify_limiter.get_remaining_requests(user.id)

        assert _verify(client, _ticket(client), "000000").status_code == 429

        after = two_factor_service.mfa_verify_limiter.get_remaining_requests(user.id)
        assert after == before

    def test_successful_code_counts_against_neither_limit(
        self, client: TestClient, user, enrolled
    ):
        secret, _ = enrolled

        assert _verify(client, _ticket(client), code_at(secret)).status_code == 200

        for limiter in (
            two_factor_service.mfa_verify_limiter,
            two_factor_service.mfa_daily_limiter,
        ):
            assert limiter.get_remaining_requests(user.id) == limiter.max_requests

    def test_non_ascii_digits_are_a_wrong_code_not_an_error(
        self, client: TestClient, enrolled
    ):
        response = _verify(client, _ticket(client), "١٢٣٤٥٦")

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.MFA_CODE_INVALID

    def test_new_login_replaces_the_earlier_ticket(self, client: TestClient, enrolled):
        secret, _ = enrolled
        first = _ticket(client)
        second = _ticket(client)

        stale = _verify(client, first, code_at(secret))

        assert stale.json()["error_code"] == AuthErrorCode.MFA_TICKET_INVALID
        assert _verify(client, second, code_at(secret)).status_code == 200

    def test_rate_limited_attempt_does_not_use_up_the_ticket(
        self, client: TestClient, enrolled, limiter_ceiling
    ):
        limiter_ceiling(two_factor_service.mfa_verify_limiter, 1)
        ticket = _ticket(client)
        _verify(client, ticket, "000000")
        for _ in range(6):
            assert _verify(client, ticket, "000000").status_code == 429

        entry = two_factor_service.take_ticket(ticket)
        assert entry is not None and entry.value.attempts == 1

    def test_unreadable_secret_points_to_backup_codes(
        self, client: TestClient, db_session, user, enrolled
    ):
        _, codes = enrolled
        totp_row(db_session, user).secret_encrypted = "garbage"
        db_session.commit()
        ticket = _ticket(client)

        response = _verify(client, ticket, "123456")

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.MFA_SECRET_UNAVAILABLE
        assert _verify(client, ticket, codes[0], "backup_code").status_code == 200

    @pytest.mark.parametrize(
        "body",
        [
            {"mfa_ticket": "t", "code": "123456", "method": "sms"},
            {"mfa_ticket": "t", "code": "", "method": "totp"},
            {"mfa_ticket": "t", "code": "1" * 33, "method": "totp"},
            {"mfa_ticket": "", "code": "123456", "method": "totp"},
            {"code": "123456", "method": "totp"},
        ],
    )
    def test_invalid_body_is_rejected(self, client: TestClient, body):
        assert client.post(VERIFY_URL, json=body).status_code == 422


class TestStateChangesBetweenSteps:
    def test_deactivated_user(self, client: TestClient, db_session, user, enrolled):
        secret, _ = enrolled
        ticket = _ticket(client)
        user.is_active = False
        db_session.commit()

        response = _verify(client, ticket, code_at(secret))

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.ACCOUNT_DEACTIVATED

    def test_deleted_user(self, client: TestClient, db_session, user, enrolled):
        secret, _ = enrolled
        ticket = _ticket(client)
        db_session.delete(user)
        db_session.commit()

        response = _verify(client, ticket, code_at(secret))

        assert response.json()["error_code"] == AuthErrorCode.MFA_TICKET_INVALID

    def test_kill_switch_lets_the_ticket_finish(self, client: TestClient, enrolled):
        ticket = _ticket(client)

        with patch.object(settings, "TWO_FACTOR_ENABLED", False):
            assert _verify(client, ticket, "anything").status_code == 200

    def test_ended_sessions_end_the_ticket(
        self, client: TestClient, db_session, user, enrolled
    ):
        """Password change, sign-out-others and a two-factor reset all end sessions."""
        secret, _ = enrolled
        ticket = _ticket(client)
        user_crud.end_sessions(user)
        db_session.commit()

        response = _verify(client, ticket, code_at(secret))

        assert response.status_code == 401
        assert response.json()["error_code"] == AuthErrorCode.MFA_TICKET_INVALID

    def test_password_change_ends_the_ticket(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        ticket = _ticket(client)
        user_crud.update_password_by_user(
            db_session, user_obj=user, new_password="Another123"
        )

        response = _verify(client, ticket, code_at(secret))

        assert response.json()["error_code"] == AuthErrorCode.MFA_TICKET_INVALID

    def test_sso_only_mode_turned_on(self, client: TestClient, enrolled):
        secret, _ = enrolled
        ticket = _ticket(client)

        with patch.object(settings, "SSO_ONLY_MODE", True):
            response = _verify(client, ticket, code_at(secret))

        assert response.status_code == 403


class TestForcedPasswordChange:
    def test_restricted_session_only_after_the_second_step(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        user.must_change_password = True
        db_session.commit()

        first = _login(client)
        assert "access_token" not in first.json()

        body = _verify(client, first.json()["mfa_ticket"], code_at(secret)).json()

        assert body["must_change_password"] is True
        assert client.get("/api/v1/users/me/preferences").status_code == 403


class TestSsoUnaffected:
    def test_sso_login_skips_the_step(self, client: TestClient, db_session, user):
        enroll(db_session, user)
        client.cookies.clear()
        with patch(
            "app.api.v1.endpoints.sso.sso_service.complete_authentication",
            new=AsyncMock(return_value={"user": user, "is_new_user": False}),
        ):
            response = client.post(
                "/api/v1/auth/sso/callback", json={"code": "c", "state": "s"}
            )

        assert response.status_code == 200
        assert "access_token" in response.json()
