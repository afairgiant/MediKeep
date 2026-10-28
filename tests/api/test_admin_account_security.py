"""Admin two-factor reset, sign-in lockout clearing, security summary and login history."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.http.auth_codes import AuthErrorCode
from app.events.security_events import TwoFactorDisabledEvent
from app.models.activity_log import ActionType, ActivityLog, LoginFailureReason
from app.models.mfa import UserBackupCode, UserTotp
from app.services import two_factor_service
from app.services.login_throttle import login_throttle
from tests.utils.two_factor import (
    code_at,
    enroll,
    login,
    make_user,
    request_ticket,
    verify,
)

BASE = "/api/v1/admin/user-management"
SUMMARY_URL = f"{BASE}/security-summary"
ME_URL = "/api/v1/users/me"


def _two_factor_url(user_id: int) -> str:
    return f"{BASE}/users/{user_id}/two-factor"


def _lockout_url(user_id: int) -> str:
    return f"{BASE}/users/{user_id}/sign-in-lockout"


def _history_url(user_id: int) -> str:
    return f"{BASE}/users/{user_id}/login-history"


@pytest.fixture
def user(db_session: Session):
    return make_user(db_session, "recoverme")


@pytest.fixture
def enrolled(db_session: Session, user):
    return enroll(db_session, user)


@pytest.fixture
def published():
    events = []
    with patch(
        "app.api.v1.admin.user_management.publish_from_thread",
        side_effect=events.append,
    ):
        yield events


def _as_admin(client: TestClient, admin_token_headers: dict) -> TestClient:
    client.cookies.clear()
    client.headers.update(admin_token_headers)
    return client


def _activity(db: Session, action: str) -> list[ActivityLog]:
    db.expire_all()
    return db.query(ActivityLog).filter(ActivityLog.action == action).all()


class TestAdminOnly:
    @pytest.mark.parametrize(
        "method,url",
        [
            ("get", SUMMARY_URL),
            ("delete", _two_factor_url(1)),
            ("delete", _lockout_url(1)),
        ],
    )
    def test_non_admin_is_forbidden(
        self, authenticated_client: TestClient, method, url
    ):
        response = getattr(authenticated_client, method)(url)

        assert response.status_code == 403


class TestSecuritySummary:
    def test_lists_two_factor_users_only(
        self, admin_client: TestClient, db_session, user, enrolled
    ):
        make_user(db_session, "plainuser")

        data = admin_client.get(SUMMARY_URL).json()["data"]

        assert data == {
            str(user.id): {
                "totp_enabled": True,
                "backup_codes_remaining": len(enrolled[1]),
                "sign_in_locked": False,
            }
        }

    def test_used_backup_codes_are_not_counted(
        self, admin_client: TestClient, db_session, user, enrolled
    ):
        two_factor_service.verify_backup_code(db_session, user, enrolled[1][0])

        data = admin_client.get(SUMMARY_URL).json()["data"]

        assert data[str(user.id)]["backup_codes_remaining"] == len(enrolled[1]) - 1

    def test_password_lockout_is_shown(
        self, client: TestClient, admin_token_headers, user, limiter_ceiling
    ):
        limiter_ceiling(login_throttle.by_username, 1)
        login(client, "RecoverMe", "wrong-pass1")

        data = _as_admin(client, admin_token_headers).get(SUMMARY_URL).json()["data"]

        assert data == {
            str(user.id): {
                "totp_enabled": False,
                "backup_codes_remaining": 0,
                "sign_in_locked": True,
            }
        }

    def test_code_lockout_is_shown(
        self, client: TestClient, admin_token_headers, user, enrolled, limiter_ceiling
    ):
        limiter_ceiling(two_factor_service.mfa_verify_limiter, 1)
        verify(client, request_ticket(client, "recoverme"), "000000")

        data = _as_admin(client, admin_token_headers).get(SUMMARY_URL).json()["data"]

        assert data[str(user.id)]["sign_in_locked"] is True


class TestResetTwoFactor:
    def test_removes_two_factor_and_signs_the_user_out(
        self,
        client: TestClient,
        admin_token_headers,
        db_session,
        user,
        enrolled,
        published,
    ):
        secret, _ = enrolled
        verify(client, request_ticket(client, "recoverme"), code_at(secret))
        user_cookies = dict(client.cookies)

        response = _as_admin(client, admin_token_headers).delete(
            _two_factor_url(user.id)
        )

        assert response.status_code == 204
        db_session.expire_all()
        assert db_session.query(UserTotp).filter_by(user_id=user.id).count() == 0
        assert db_session.query(UserBackupCode).filter_by(user_id=user.id).count() == 0

        client.headers.pop("Authorization")
        client.cookies.update(user_cookies)
        assert client.get(ME_URL).status_code == 401

    def test_user_signs_in_with_password_alone_afterwards(
        self, client: TestClient, admin_token_headers, user, enrolled, published
    ):
        _as_admin(client, admin_token_headers).delete(_two_factor_url(user.id))
        client.headers.pop("Authorization")

        body = login(client, "recoverme").json()

        assert "access_token" in body
        assert "mfa_required" not in body

    def test_audited_as_the_admin_and_the_user_is_notified(
        self,
        admin_client: TestClient,
        db_session,
        test_admin_user,
        user,
        enrolled,
        published,
    ):
        admin_client.delete(_two_factor_url(user.id))

        [row] = _activity(db_session, ActionType.TWO_FACTOR_RESET)
        assert row.user_id == test_admin_user.id
        assert row.entity_id == user.id
        assert [type(e) for e in published] == [TwoFactorDisabledEvent]
        assert published[0].user_id == user.id
        assert published[0].by_admin is True

    def test_user_without_two_factor_is_a_conflict(
        self, admin_client: TestClient, user, published
    ):
        response = admin_client.delete(_two_factor_url(user.id))

        assert response.status_code == 409
        assert response.json()["error_code"] == AuthErrorCode.TWO_FACTOR_NOT_ENABLED
        assert published == []

    def test_unknown_user(self, admin_client: TestClient):
        assert admin_client.delete(_two_factor_url(999999)).status_code == 404


class TestClearLockout:
    def test_password_lockout_from_any_address_is_lifted(
        self, client: TestClient, admin_token_headers, db_session, user, limiter_ceiling
    ):
        limiter_ceiling(login_throttle.by_username, 1)
        login(client, "recoverme", "wrong-pass1")
        assert login(client, "recoverme").status_code == 429

        response = _as_admin(client, admin_token_headers).delete(_lockout_url(user.id))
        client.headers.pop("Authorization")

        assert response.status_code == 204
        assert login(client, "recoverme").status_code == 200

    def test_code_lockout_is_lifted(
        self, client: TestClient, admin_token_headers, user, enrolled, limiter_ceiling
    ):
        limiter_ceiling(two_factor_service.mfa_verify_limiter, 1)
        verify(client, request_ticket(client, "recoverme"), "000000")
        assert (
            verify(client, request_ticket(client, "recoverme"), "000000").status_code
            == 429
        )

        _as_admin(client, admin_token_headers).delete(_lockout_url(user.id))
        client.headers.pop("Authorization")

        response = verify(client, request_ticket(client, "recoverme"), "000000")
        assert response.status_code == 401

    def test_other_users_stay_locked(
        self, client: TestClient, admin_token_headers, db_session, user, limiter_ceiling
    ):
        make_user(db_session, "neighbour")
        limiter_ceiling(login_throttle.by_username, 1)
        login(client, "neighbour", "wrong-pass1")

        _as_admin(client, admin_token_headers).delete(_lockout_url(user.id))
        client.headers.pop("Authorization")

        assert login(client, "neighbour").status_code == 429

    def test_audited_as_the_admin(
        self, admin_client: TestClient, db_session, test_admin_user, user
    ):
        admin_client.delete(_lockout_url(user.id))

        [row] = _activity(db_session, ActionType.SIGN_IN_LOCKOUT_CLEARED)
        assert row.user_id == test_admin_user.id
        assert row.entity_id == user.id

    def test_unknown_user(self, admin_client: TestClient):
        assert admin_client.delete(_lockout_url(999999)).status_code == 404


class TestLoginHistory:
    def test_includes_failed_sign_ins_newest_first(
        self, client: TestClient, admin_token_headers, user
    ):
        login(client, "recoverme")
        login(client, "recoverme", "wrong-pass1")

        items = (
            _as_admin(client, admin_token_headers)
            .get(_history_url(user.id))
            .json()["data"]["items"]
        )

        assert [(i["action"], i["failure_reason"]) for i in items] == [
            ("login_failed", LoginFailureReason.WRONG_PASSWORD),
            ("login", None),
        ]
