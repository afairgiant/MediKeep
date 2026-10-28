"""Failed sign-ins in the activity log, and the security notifications sign-in sends."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.events.security_events import (
    BackupCodeUsedEvent,
    SessionsRevokedEvent,
    TwoFactorDisabledEvent,
    TwoFactorFailuresEvent,
)
from app.models.activity_log import ActionType, ActivityLog, LoginFailureReason
from app.services import two_factor_service
from app.services.login_throttle import login_throttle
from tests.utils.two_factor import (
    PASSWORD,
    code_at,
    enroll,
    login,
    make_user,
    request_ticket,
    verify,
)

DISABLE_URL = "/api/v1/users/me/two-factor/disable"
REVOKE_URL = "/api/v1/users/me/sessions/revoke-others"
ACTIVITY_URL = "/api/v1/admin/activity-log"
PUBLISHERS = (
    "app.api.v1.endpoints.two_factor.publish_from_thread",
    "app.api.v1.endpoints.users.publish_from_thread",
    "app.api.v1.admin.user_management.publish_from_thread",
)


@pytest.fixture
def user(db_session: Session):
    return make_user(db_session, "audited")


@pytest.fixture
def enrolled(db_session: Session, user):
    return enroll(db_session, user)


@pytest.fixture
def published():
    """Events the endpoints publish, in order."""
    events = []
    patchers = [patch(target, side_effect=events.append) for target in PUBLISHERS]
    for patcher in patchers:
        patcher.start()
    yield events
    for patcher in patchers:
        patcher.stop()


def _failures(db: Session) -> list[ActivityLog]:
    db.expire_all()
    return (
        db.query(ActivityLog)
        .filter(ActivityLog.action == ActionType.LOGIN_FAILED)
        .order_by(ActivityLog.id)
        .all()
    )


def _reasons(db: Session) -> list[str]:
    return [row.failure_reason for row in _failures(db)]


class TestPasswordFailures:
    def test_wrong_password(self, client: TestClient, db_session, user):
        login(client, "audited", "wrong-pass1")

        [row] = _failures(db_session)
        assert row.user_id == user.id
        assert row.entity_id == user.id
        assert row.event_metadata == {
            "reason": LoginFailureReason.WRONG_PASSWORD,
            "method": "password",
        }
        assert row.ip_address

    def test_unknown_username_is_not_stored(self, client: TestClient, db_session):
        login(client, "Hunter2-typed-in-the-wrong-box", "wrong-pass1")

        [row] = _failures(db_session)
        assert row.user_id is None
        assert row.entity_id is None
        assert row.failure_reason == LoginFailureReason.UNKNOWN_USER
        assert "Hunter2" not in row.description
        assert "Hunter2" not in str(row.event_metadata)

    def test_deactivated_account(self, client: TestClient, db_session, user):
        user.is_active = False
        db_session.commit()

        assert login(client, "audited").status_code == 401

        assert _reasons(db_session) == [LoginFailureReason.DEACTIVATED]

    def test_success_writes_no_failure(self, client: TestClient, db_session, user):
        assert login(client, "audited").status_code == 200

        assert _failures(db_session) == []

    def test_lockout_writes_one_locked_row_then_nothing(
        self, client: TestClient, db_session, user, limiter_ceiling
    ):
        limiter_ceiling(login_throttle.by_username, 2)

        for _ in range(4):
            login(client, "audited", "wrong-pass1")

        assert _reasons(db_session) == [
            LoginFailureReason.WRONG_PASSWORD,
            LoginFailureReason.WRONG_PASSWORD,
            LoginFailureReason.LOCKED,
        ]


class TestCodeFailures:
    def test_wrong_code(self, client: TestClient, db_session, user, enrolled):
        verify(client, request_ticket(client, "audited"), "000000")

        [row] = _failures(db_session)
        assert row.user_id == user.id
        assert row.event_metadata == {
            "reason": LoginFailureReason.WRONG_CODE,
            "method": "totp",
        }

    def test_reused_code(self, client: TestClient, db_session, enrolled):
        secret, _ = enrolled
        code = code_at(secret)
        assert (
            verify(client, request_ticket(client, "audited"), code).status_code == 200
        )

        verify(client, request_ticket(client, "audited"), code)

        assert _reasons(db_session) == [LoginFailureReason.CODE_REUSED]

    def test_wrong_backup_code_is_recorded_with_its_method(
        self, client: TestClient, db_session, enrolled
    ):
        verify(client, request_ticket(client, "audited"), "AAAA-AAAA", "backup_code")

        [row] = _failures(db_session)
        assert row.event_metadata["method"] == "backup_code"

    def test_lock_writes_a_locked_row_and_alerts_the_user_once(
        self, client: TestClient, db_session, user, enrolled, limiter_ceiling, published
    ):
        limiter_ceiling(two_factor_service.mfa_verify_limiter, 2)

        for _ in range(3):
            verify(client, request_ticket(client, "audited"), "000000")

        assert _reasons(db_session) == [
            LoginFailureReason.WRONG_CODE,
            LoginFailureReason.WRONG_CODE,
            LoginFailureReason.LOCKED,
        ]
        assert [type(e) for e in published] == [TwoFactorFailuresEvent]
        assert published[0].user_id == user.id

    def test_a_single_wrong_code_sends_no_alert(
        self, client: TestClient, enrolled, published
    ):
        verify(client, request_ticket(client, "audited"), "000000")

        assert published == []


class TestNotifications:
    def test_backup_code_sign_in(self, client: TestClient, user, enrolled, published):
        _, codes = enrolled

        response = verify(
            client, request_ticket(client, "audited"), codes[0], "backup_code"
        )

        assert response.status_code == 200
        [event] = published
        assert isinstance(event, BackupCodeUsedEvent)
        assert event.user_id == user.id
        assert event.codes_remaining == len(codes) - 1

    def test_authenticator_sign_in_sends_nothing(
        self, client: TestClient, enrolled, published
    ):
        secret, _ = enrolled

        verify(client, request_ticket(client, "audited"), code_at(secret))

        assert published == []

    def test_turning_two_factor_off(
        self, client: TestClient, user, enrolled, published
    ):
        secret, _ = enrolled
        verify(client, request_ticket(client, "audited"), code_at(secret))

        response = client.post(
            DISABLE_URL,
            json={"current_password": PASSWORD, "code": code_at(secret, 1)},
        )

        assert response.status_code == 200
        [event] = published
        assert isinstance(event, TwoFactorDisabledEvent)
        assert event.user_id == user.id
        assert event.by_admin is False

    def test_signing_out_other_devices(self, client: TestClient, user, published):
        login(client, "audited")

        assert client.post(REVOKE_URL).status_code == 200

        assert [type(e) for e in published] == [SessionsRevokedEvent]
        assert published[0].user_id == user.id


class TestAdminActivityLog:
    def test_failed_sign_ins_carry_their_reason(
        self, client: TestClient, admin_token_headers, user
    ):
        login(client, "audited", "wrong-pass1")
        login(client, "nobody-by-that-name", "wrong-pass1")
        client.cookies.clear()
        client.headers.update(admin_token_headers)

        items = client.get(ACTIVITY_URL, params={"action": "login_failed"}).json()[
            "items"
        ]

        assert [(i["username"], i["failure_reason"]) for i in items] == [
            ("Unknown user", LoginFailureReason.UNKNOWN_USER),
            ("audited", LoginFailureReason.WRONG_PASSWORD),
        ]

    def test_other_entries_have_no_failure_reason(
        self, client: TestClient, admin_token_headers, user
    ):
        login(client, "audited")
        client.cookies.clear()
        client.headers.update(admin_token_headers)

        items = client.get(ACTIVITY_URL, params={"action": "login"}).json()["items"]

        assert items and all(i["failure_reason"] is None for i in items)

    def test_filters_offer_failed_sign_ins(self, admin_client: TestClient):
        actions = admin_client.get(f"{ACTIVITY_URL}/filters").json()["actions"]

        assert "login_failed" in [a["value"] for a in actions]
