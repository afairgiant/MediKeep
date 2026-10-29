"""Remember this device: skipping the second sign-in step, revocation, and settings."""

from datetime import timedelta
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud.user import user as user_crud
from app.models.activity_log import ActionType, ActivityLog
from app.models.base import get_utc_now
from app.models.mfa import TrustedDevice
from app.services import trusted_device_service, two_factor_service
from app.services.user_deletion_service import UserDeletionService
from tests.utils.migrations import run_migration
from tests.utils.two_factor import (
    LOGIN_URL,
    PASSWORD,
    VERIFY_URL,
    code_at,
    enroll,
    make_user,
)

MIGRATION = "20261028_1000_f4b8d2e6a913_add_trusted_devices.py"
ME_URL = "/api/v1/users/me"
DEVICES_URL = "/api/v1/users/me/two-factor/trusted-devices"
REVOKE_OTHERS_URL = "/api/v1/users/me/sessions/revoke-others"


@pytest.fixture
def user(db_session: Session):
    return make_user(db_session, "rememberme")


@pytest.fixture
def enrolled(db_session: Session, user):
    return enroll(db_session, user)


def _password(client: TestClient, username: str = "rememberme", password=PASSWORD):
    """Password sign-in that keeps any device cookie but no session."""
    client.cookies.delete(settings.AUTH_COOKIE_NAME)
    return client.post(LOGIN_URL, data={"username": username, "password": password})


def _sign_in_remembering(
    client: TestClient, secret: str, steps: int = 0, username: str = "rememberme"
):
    """Full sign-in that asks to remember the device; returns the verify response."""
    ticket = _password(client, username).json()["mfa_ticket"]
    return client.post(
        VERIFY_URL,
        json={
            "mfa_ticket": ticket,
            "code": code_at(secret, steps),
            "method": "totp",
            "remember_device": True,
        },
    )


@pytest.fixture
def remembered(client: TestClient, enrolled):
    secret, _ = enrolled
    assert _sign_in_remembering(client, secret).status_code == 200
    return secret


def _cookie(user) -> str:
    return trusted_device_service.cookie_name(user)


def _devices(db: Session, user) -> list[TrustedDevice]:
    db.expire_all()
    return db.query(TrustedDevice).filter(TrustedDevice.user_id == user.id).all()


class TestRemembering:
    def test_challenge_offers_the_configured_days(self, client: TestClient, enrolled):
        assert _password(client).json()["remember_device_days"] == 30

        with patch.object(settings, "TWO_FACTOR_REMEMBER_DAYS", 0):
            assert _password(client).json()["remember_device_days"] == 0

    def test_verify_sets_a_per_user_device_cookie(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        response = _sign_in_remembering(client, secret)

        assert response.status_code == 200
        header = next(
            h
            for h in response.headers.get_list("set-cookie")
            if h.startswith(f"{_cookie(user)}=")
        )
        attributes = header.split("; ")
        assert "HttpOnly" in attributes
        assert f"Path={settings.AUTH_COOKIE_PATH}" in attributes
        assert "Max-Age=2592000" in attributes
        assert _cookie(user).endswith(f"_{user.id}")
        [device] = _devices(db_session, user)
        assert device.token_hash != response.cookies.get(_cookie(user))
        assert device.session_version == user.session_version

    def test_without_the_flag_nothing_is_remembered(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        ticket = _password(client).json()["mfa_ticket"]

        response = client.post(
            VERIFY_URL,
            json={"mfa_ticket": ticket, "code": code_at(secret), "method": "totp"},
        )

        assert response.status_code == 200
        assert _cookie(user) not in response.cookies
        assert _devices(db_session, user) == []

    def test_turned_off_by_operator_nothing_is_remembered(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        with patch.object(settings, "TWO_FACTOR_REMEMBER_DAYS", 0):
            response = _sign_in_remembering(client, secret)

        assert response.status_code == 200
        assert _devices(db_session, user) == []

    def test_remembering_again_replaces_this_browsers_device(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        _sign_in_remembering(client, secret)
        [first] = _devices(db_session, user)
        first_hash = first.token_hash
        # Older than a shortened setting, so the next sign-in asks for a code again
        first.created_at = get_utc_now() - timedelta(days=8)
        db_session.commit()

        with patch.object(settings, "TWO_FACTOR_REMEMBER_DAYS", 7):
            assert _sign_in_remembering(client, secret, steps=1).status_code == 200

        [second] = _devices(db_session, user)
        assert second.token_hash != first_hash

    def test_a_failure_to_remember_never_fails_the_sign_in(
        self, client: TestClient, db_session, user, enrolled
    ):
        secret, _ = enrolled
        with patch.object(
            trusted_device_service, "_delete_dead", side_effect=RuntimeError
        ):
            response = _sign_in_remembering(client, secret)

        assert response.status_code == 200
        assert _cookie(user) not in response.cookies
        assert _devices(db_session, user) == []


class TestSkippingTheStep:
    def test_remembered_browser_signs_in_with_the_password_alone(
        self, client: TestClient, db_session, user, remembered
    ):
        response = _password(client)

        assert response.status_code == 200
        assert "access_token" in response.json()
        assert client.get(ME_URL).status_code == 200
        entry = (
            db_session.query(ActivityLog)
            .filter(ActivityLog.action == ActionType.LOGIN)
            .order_by(ActivityLog.id.desc())
            .first()
        )
        assert entry.event_metadata["method"] == "trusted_device"
        [device] = _devices(db_session, user)
        assert device.last_used_at is not None

    def test_wrong_password_is_still_refused(self, client: TestClient, remembered):
        assert _password(client, password="wrong-pass1").status_code == 401

    def test_other_browser_still_gets_the_step(self, client: TestClient, remembered):
        client.cookies.clear()

        assert _password(client).json()["mfa_required"] is True

    def test_cookie_does_not_skip_for_another_user(
        self, client: TestClient, db_session, user, remembered
    ):
        other = make_user(db_session, "otheruser")
        enroll(db_session, other)
        # Even under the other user's cookie name, the token is not theirs
        client.cookies.set(_cookie(other), client.cookies.get(_cookie(user)))

        assert _password(client, "otheruser").json()["mfa_required"] is True

    def test_people_sharing_a_browser_each_stay_remembered(
        self, client: TestClient, db_session, user, remembered
    ):
        other_secret, _ = enroll(db_session, make_user(db_session, "otheruser"))
        assert (
            _sign_in_remembering(client, other_secret, username="otheruser").status_code
            == 200
        )

        assert "access_token" in _password(client).json()
        assert "access_token" in _password(client, "otheruser").json()

    def test_expired_device_gets_the_step(
        self, client: TestClient, db_session, user, remembered
    ):
        [device] = _devices(db_session, user)
        device.expires_at = get_utc_now() - timedelta(minutes=1)
        db_session.commit()

        assert _password(client).json()["mfa_required"] is True

    def test_shortened_setting_applies_to_earlier_devices(
        self, client: TestClient, db_session, user, remembered
    ):
        [device] = _devices(db_session, user)
        device.created_at = get_utc_now() - timedelta(days=8)
        db_session.commit()

        with patch.object(settings, "TWO_FACTOR_REMEMBER_DAYS", 7):
            assert _password(client).json()["mfa_required"] is True

    def test_turned_off_by_operator_gets_the_step(self, client: TestClient, remembered):
        with patch.object(settings, "TWO_FACTOR_REMEMBER_DAYS", 0):
            assert _password(client).json()["mfa_required"] is True

    @pytest.mark.parametrize("where", ["header", "cookie"])
    def test_device_cookie_is_not_a_session(
        self, client: TestClient, user, remembered, where
    ):
        token = client.cookies.get(_cookie(user))
        client.cookies.clear()

        if where == "header":
            response = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
        else:
            client.cookies.set(settings.AUTH_COOKIE_NAME, token)
            response = client.get(ME_URL)

        assert response.status_code == 401


class TestRevocation:
    def test_ending_sessions_ends_trust(
        self, client: TestClient, db_session, user, remembered
    ):
        user_crud.commit_ending_sessions(db_session, user)

        assert _password(client).json()["mfa_required"] is True

    def test_signing_out_other_devices_ends_trust(self, client: TestClient, remembered):
        assert client.post(REVOKE_OTHERS_URL).status_code == 200

        assert _password(client).json()["mfa_required"] is True

    def test_password_change_ends_trust(
        self, client: TestClient, db_session, user, remembered
    ):
        user_crud.update_password_by_user(
            db_session, user_obj=user, new_password="NewPassword456"
        )

        response = _password(client, password="NewPassword456")

        assert response.json()["mfa_required"] is True

    def test_deactivation_ends_trust(
        self, client: TestClient, db_session, user, remembered
    ):
        user_crud.update(db_session, db_obj=user, obj_in={"is_active": False})
        user_crud.update(db_session, db_obj=user, obj_in={"is_active": True})

        assert _password(client).json()["mfa_required"] is True

    def test_turning_two_factor_off_deletes_devices(
        self, client: TestClient, db_session, user, remembered
    ):
        two_factor_service.remove_all(db_session, user)

        assert _devices(db_session, user) == []

    def test_account_deletion_deletes_devices(self, db_session, user, remembered):
        # The service refuses to delete the last account
        make_user(db_session, "keeper")
        user_id = user.id
        stats = UserDeletionService().delete_user_account(db_session, user_id)

        assert stats["deleted_records"]["trusted_devices"] == 1
        assert (
            db_session.query(TrustedDevice)
            .filter(TrustedDevice.user_id == user_id)
            .count()
            == 0
        )


class TestSettings:
    def test_lists_live_devices(self, client: TestClient, remembered):
        response = client.get(DEVICES_URL)

        assert response.status_code == 200
        [device] = response.json()
        assert set(device) == {
            "id",
            "user_agent",
            "created_at",
            "last_used_at",
            "expires_at",
        }
        assert device["user_agent"] == "testclient"

    def test_list_leaves_out_dead_devices(
        self, client: TestClient, db_session, user, remembered
    ):
        [device] = _devices(db_session, user)
        device.session_version = user.session_version - 1
        db_session.add(
            TrustedDevice(
                user_id=user.id,
                token_hash="0" * 64,
                session_version=user.session_version,
                expires_at=get_utc_now() - timedelta(minutes=1),
            )
        )
        db_session.commit()

        assert client.get(DEVICES_URL).json() == []

    def test_shortened_setting_shortens_the_listed_expiry(
        self, client: TestClient, db_session, user, remembered
    ):
        [device] = _devices(db_session, user)
        device.created_at = get_utc_now() - timedelta(days=2)
        db_session.commit()

        with patch.object(settings, "TWO_FACTOR_REMEMBER_DAYS", 7):
            [listed] = client.get(DEVICES_URL).json()

        expected = device.created_at + timedelta(days=7)
        assert listed["expires_at"].startswith(expected.isoformat()[:19])

    def test_remembering_prunes_dead_devices(
        self, client: TestClient, db_session, user, remembered
    ):
        db_session.add(
            TrustedDevice(
                user_id=user.id,
                token_hash="0" * 64,
                session_version=user.session_version,
                expires_at=get_utc_now() - timedelta(minutes=1),
            )
        )
        db_session.commit()
        client.cookies.delete(_cookie(user))

        assert _sign_in_remembering(client, remembered, steps=1).status_code == 200

        assert "0" * 64 not in {d.token_hash for d in _devices(db_session, user)}
        assert len(_devices(db_session, user)) == 2

    def test_forget_one_device(self, client: TestClient, db_session, user, remembered):
        [device] = _devices(db_session, user)

        assert client.delete(f"{DEVICES_URL}/{device.id}").status_code == 204
        assert _devices(db_session, user) == []
        assert _password(client).json()["mfa_required"] is True

    def test_cannot_forget_another_users_device(
        self, client: TestClient, db_session, user, remembered
    ):
        [device] = _devices(db_session, user)
        other = make_user(db_session, "otheruser")
        other_secret, _ = enroll(db_session, other)
        client.cookies.clear()
        ticket = _password(client, "otheruser").json()["mfa_ticket"]
        client.post(
            VERIFY_URL,
            json={
                "mfa_ticket": ticket,
                "code": code_at(other_secret),
                "method": "totp",
            },
        )

        response = client.delete(f"{DEVICES_URL}/{device.id}")

        assert response.status_code == 404
        assert len(_devices(db_session, user)) == 1

    def test_forget_all_devices(self, client: TestClient, db_session, user, remembered):
        assert client.delete(DEVICES_URL).status_code == 204
        assert _devices(db_session, user) == []

    def test_requires_a_session(self, client: TestClient):
        client.cookies.clear()

        assert client.get(DEVICES_URL).status_code == 401


class TestMigration:
    def test_upgrade_creates_the_table_and_downgrade_removes_it(self):
        engine = sa.create_engine("sqlite://")
        with engine.begin() as conn:
            conn.execute(sa.text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))

        run_migration(engine, MIGRATION, "upgrade")

        inspector = sa.inspect(engine)
        assert {c["name"] for c in inspector.get_columns("trusted_devices")} == {
            "id",
            "user_id",
            "token_hash",
            "user_agent",
            "session_version",
            "expires_at",
            "last_used_at",
            "created_at",
            "updated_at",
        }
        assert "idx_trusted_devices_user_id" in {
            i["name"] for i in inspector.get_indexes("trusted_devices")
        }
        [fk] = inspector.get_foreign_keys("trusted_devices")
        assert fk["referred_table"] == "users"
        assert fk["options"].get("ondelete") == "CASCADE"

        run_migration(engine, MIGRATION, "downgrade")

        assert "trusted_devices" not in sa.inspect(engine).get_table_names()


class TestConfig:
    @pytest.mark.parametrize("days", [-1, 366])
    def test_out_of_range_days_are_rejected(self, days, monkeypatch):
        monkeypatch.setattr(settings, "TWO_FACTOR_REMEMBER_DAYS", days)

        with pytest.raises(ValueError, match="TWO_FACTOR_REMEMBER_DAYS"):
            settings.validate_two_factor_config()

    @pytest.mark.parametrize("days", [0, 365])
    def test_boundaries_are_accepted(self, days, monkeypatch):
        monkeypatch.setattr(settings, "TWO_FACTOR_REMEMBER_DAYS", days)

        settings.validate_two_factor_config()
