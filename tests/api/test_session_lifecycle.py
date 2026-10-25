"""Session tokens: their claims, the typ check, and ending sessions by session_version."""

import time
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils.security import create_access_token, decode_access_token
from app.crud.user import user as user_crud
from app.models.activity_log import ActionType, ActivityLog
from app.models.models import User
from app.schemas.user import UserCreate

LOGIN_URL = "/api/v1/auth/login"
CHANGE_PASSWORD_URL = "/api/v1/auth/change-password"
PROTECTED_URL = "/api/v1/users/me/preferences"
# Query-param auth lives here; a token that passes auth reaches the handler and 404s
FLEXIBLE_AUTH_URL = "/api/v1/entity-files/files/999999/view"
PASSWORD = "Password123"


def _make_user(db: Session, username: str = "sessionuser", role: str = "user") -> User:
    return user_crud.create(
        db,
        obj_in=UserCreate(
            username=username,
            email=f"{username}@example.com",
            password=PASSWORD,
            full_name="Session User",
            role=role,
        ),
    )


def _login(client: TestClient, username: str, password: str = PASSWORD):
    return client.post(LOGIN_URL, data={"username": username, "password": password})


def _token(username: str, **claims) -> str:
    return create_access_token(data={"sub": username, **claims})


def _with_header(client: TestClient, token: str):
    client.cookies.clear()
    return client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})


def _with_cookie(client: TestClient, token: str):
    client.cookies.clear()
    client.cookies.set(settings.AUTH_COOKIE_NAME, token)
    response = client.get(PROTECTED_URL)
    client.cookies.clear()
    return response


def _with_query(client: TestClient, token: str):
    client.cookies.clear()
    return client.get(FLEXIBLE_AUTH_URL, params={"token": token})


ALL_AUTH_PATHS = [_with_header, _with_cookie, _with_query]


class TestIssuedClaims:
    def test_password_login_token_carries_type_version_and_name(
        self, client: TestClient, db_session: Session
    ):
        _make_user(db_session)

        response = _login(client, "sessionuser")

        assert response.status_code == 200
        claims = decode_access_token(response.json()["access_token"])
        assert claims["typ"] == "access"
        assert claims["sv"] == 0
        assert claims["full_name"] == "Session User"

    def test_token_reflects_current_session_version(
        self, client: TestClient, db_session: Session
    ):
        user = _make_user(db_session)
        user.session_version = 4
        db_session.commit()

        claims = decode_access_token(
            _login(client, "sessionuser").json()["access_token"]
        )

        assert claims["sv"] == 4


class TestLoginParity:
    """Password and SSO logins share one completion path; their sessions must match."""

    BASE_KEYS = {
        "access_token",
        "token_type",
        "session_timeout_minutes",
        "must_change_password",
    }

    def _sso_login(self, client: TestClient, user: User):
        with patch(
            "app.api.v1.endpoints.sso.sso_service.complete_authentication",
            new=AsyncMock(return_value={"user": user, "is_new_user": False}),
        ):
            return client.post(
                "/api/v1/auth/sso/callback", json={"code": "c", "state": "s"}
            )

    def test_body_claims_and_cookie_match(
        self, client: TestClient, db_session: Session
    ):
        password_user = _make_user(db_session)
        sso_user = _make_user(db_session, username="ssosession")

        password_response = _login(client, password_user.username)
        client.cookies.clear()
        sso_response = self._sso_login(client, sso_user)

        assert password_response.status_code == sso_response.status_code == 200
        password_body, sso_body = password_response.json(), sso_response.json()
        assert self.BASE_KEYS <= password_body.keys()
        assert self.BASE_KEYS <= sso_body.keys()
        assert {"user", "is_new_user", "return_url"} <= sso_body.keys()

        password_claims = decode_access_token(password_body["access_token"])
        sso_claims = decode_access_token(sso_body["access_token"])
        assert set(password_claims) == set(sso_claims)
        assert sso_claims["typ"] == "access"
        assert sso_claims["full_name"] == "Session User"

        def cookie_attributes(response):
            header = response.headers["set-cookie"].split(";", 1)[1]
            return sorted(part.strip().lower() for part in header.split(";"))

        assert cookie_attributes(password_response) == cookie_attributes(sso_response)

    def test_login_activity_records_the_method(
        self, client: TestClient, db_session: Session
    ):
        _make_user(db_session)

        _login(client, "sessionuser")

        entry = (
            db_session.query(ActivityLog)
            .filter(ActivityLog.action == ActionType.LOGIN)
            .order_by(ActivityLog.id.desc())
            .first()
        )
        assert entry.event_metadata["method"] == "password"


class TestTokenType:
    @pytest.mark.parametrize("send", ALL_AUTH_PATHS)
    def test_non_session_type_is_rejected(
        self, client: TestClient, db_session: Session, send
    ):
        _make_user(db_session)

        response = send(client, _token("sessionuser", typ="mfa_pending"))

        assert response.status_code == 401

    @pytest.mark.parametrize("send", ALL_AUTH_PATHS)
    def test_access_type_is_accepted(
        self, client: TestClient, db_session: Session, send
    ):
        _make_user(db_session)

        response = send(client, _token("sessionuser", typ="access"))

        assert response.status_code != 401

    def test_token_without_type_is_accepted(
        self, client: TestClient, db_session: Session
    ):
        """Sessions issued before the typ claim existed must survive the upgrade."""
        _make_user(db_session)

        assert _with_header(client, _token("sessionuser")).status_code == 200

    def test_token_with_audience_is_rejected(
        self, client: TestClient, db_session: Session
    ):
        _make_user(db_session)
        now = int(time.time())
        token = jwt.encode(
            {"sub": "sessionuser", "aud": "medikeep:mfa", "exp": now + 300},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

        assert _with_header(client, token).status_code == 401


class TestSessionVersion:
    @pytest.mark.parametrize("send", ALL_AUTH_PATHS)
    def test_stale_version_is_rejected(
        self, client: TestClient, db_session: Session, send
    ):
        user = _make_user(db_session)
        token = _token("sessionuser", sv=0)
        user.session_version = 1
        db_session.commit()

        assert send(client, token).status_code == 401

    def test_token_without_version_counts_as_zero(
        self, client: TestClient, db_session: Session
    ):
        user = _make_user(db_session)
        token = _token("sessionuser")
        assert _with_header(client, token).status_code == 200

        user.session_version = 1
        db_session.commit()

        assert _with_header(client, token).status_code == 401

    @pytest.mark.parametrize("send", ALL_AUTH_PATHS)
    def test_deactivated_user_token_is_rejected(
        self, client: TestClient, db_session: Session, send
    ):
        user = _make_user(db_session)
        token = _token("sessionuser")
        user.is_active = False
        db_session.commit()

        assert send(client, token).status_code == 401


class TestPasswordChange:
    def test_keeps_current_session_and_ends_others(
        self, client: TestClient, db_session: Session
    ):
        _make_user(db_session)
        other_device = _login(client, "sessionuser").json()["access_token"]
        client.cookies.clear()
        assert _login(client, "sessionuser").status_code == 200

        response = client.post(
            CHANGE_PASSWORD_URL,
            json={"currentPassword": PASSWORD, "newPassword": "NewPassword456"},
        )

        assert response.status_code == 200
        assert settings.AUTH_COOKIE_NAME in response.cookies
        assert client.get(PROTECTED_URL).status_code == 200
        assert _with_header(client, other_device).status_code == 401

    def test_failed_change_ends_nothing(self, client: TestClient, db_session: Session):
        user = _make_user(db_session)
        token = _login(client, "sessionuser").json()["access_token"]

        response = client.post(
            CHANGE_PASSWORD_URL,
            json={
                "currentPassword": "wrong-password1",
                "newPassword": "NewPassword456",
            },
        )

        assert response.status_code == 401
        db_session.refresh(user)
        assert user.session_version == 0
        assert _with_header(client, token).status_code == 200

    def test_forced_change_leaves_a_working_session(
        self, client: TestClient, db_session: Session
    ):
        user = _make_user(db_session)
        user.must_change_password = True
        db_session.commit()
        assert _login(client, "sessionuser").json()["must_change_password"] is True
        assert client.get(PROTECTED_URL).status_code == 403

        response = client.post(
            CHANGE_PASSWORD_URL,
            json={"currentPassword": PASSWORD, "newPassword": "NewPassword456"},
        )

        assert response.status_code == 200
        assert client.get(PROTECTED_URL).status_code == 200


class TestAdminActions:
    @pytest.fixture
    def cookie_admin_client(
        self, client: TestClient, db_session: Session
    ) -> TestClient:
        _make_user(db_session, username="sessionadmin", role="admin")
        assert _login(client, "sessionadmin").status_code == 200
        return client

    def test_password_reset_ends_target_sessions(
        self, cookie_admin_client: TestClient, db_session: Session
    ):
        target = _make_user(db_session)
        target_token = _token("sessionuser", sv=0)

        response = cookie_admin_client.post(
            f"/api/v1/admin/models/users/{target.id}/reset-password",
            json={"new_password": "ResetPassword789"},
        )

        assert response.status_code == 200
        assert _with_header(cookie_admin_client, target_token).status_code == 401

    def test_resetting_own_password_keeps_admin_session(
        self, cookie_admin_client: TestClient, db_session: Session
    ):
        admin = user_crud.get_by_username(db_session, username="sessionadmin")

        response = cookie_admin_client.post(
            f"/api/v1/admin/models/users/{admin.id}/reset-password",
            json={"new_password": "ResetPassword789"},
        )

        assert response.status_code == 200
        assert cookie_admin_client.get(PROTECTED_URL).status_code == 200

    def test_deactivation_ends_sessions_so_reactivation_does_not_revive_them(
        self, cookie_admin_client: TestClient, db_session: Session
    ):
        target = _make_user(db_session)
        target_token = _token("sessionuser", sv=0)

        deactivate = cookie_admin_client.put(
            f"/api/v1/admin/models/user/{target.id}", json={"is_active": False}
        )
        reactivate = cookie_admin_client.put(
            f"/api/v1/admin/models/user/{target.id}", json={"is_active": True}
        )

        assert deactivate.status_code == 200
        assert reactivate.status_code == 200
        assert _with_header(cookie_admin_client, target_token).status_code == 401

    def test_other_user_edits_do_not_end_sessions(
        self, cookie_admin_client: TestClient, db_session: Session
    ):
        target = _make_user(db_session)
        target_token = _token("sessionuser", sv=0)

        response = cookie_admin_client.put(
            f"/api/v1/admin/models/user/{target.id}", json={"full_name": "Renamed"}
        )

        assert response.status_code == 200
        assert _with_header(cookie_admin_client, target_token).status_code == 200


class TestDeactivationAtCrudLayer:
    """Every write path, including bulk admin updates, goes through user_crud.update."""

    def test_deactivating_raises_session_version(self, db_session: Session):
        user = _make_user(db_session)

        user_crud.update(db_session, db_obj=user, obj_in={"is_active": False})

        assert user.session_version == 1

    def test_already_inactive_or_unrelated_update_leaves_it(self, db_session: Session):
        user = _make_user(db_session)
        user_crud.update(db_session, db_obj=user, obj_in={"full_name": "Renamed"})
        user_crud.update(db_session, db_obj=user, obj_in={"is_active": False})
        user_crud.update(db_session, db_obj=user, obj_in={"is_active": False})

        assert user.session_version == 1


class TestSessionVersionIsServerOwned:
    @pytest.fixture
    def cookie_admin_client(
        self, client: TestClient, db_session: Session
    ) -> TestClient:
        _make_user(db_session, username="ownedadmin", role="admin")
        assert _login(client, "ownedadmin").status_code == 200
        return client

    def test_admin_form_echoing_a_stale_version_does_not_revive_sessions(
        self, cookie_admin_client: TestClient, db_session: Session
    ):
        target = _make_user(db_session)
        stale_token = _token("sessionuser", sv=0)
        target.session_version = 1
        db_session.commit()

        response = cookie_admin_client.put(
            f"/api/v1/admin/models/user/{target.id}",
            json={"full_name": "Renamed", "session_version": 0},
        )

        assert response.status_code == 200
        db_session.refresh(target)
        assert target.session_version == 1
        assert _with_header(cookie_admin_client, stale_token).status_code == 401

    def test_deactivation_with_echoed_version_still_ends_sessions(
        self, cookie_admin_client: TestClient, db_session: Session
    ):
        target = _make_user(db_session)
        old_token = _token("sessionuser", sv=0)

        cookie_admin_client.put(
            f"/api/v1/admin/models/user/{target.id}",
            json={"is_active": False, "session_version": 0},
        )
        cookie_admin_client.put(
            f"/api/v1/admin/models/user/{target.id}",
            json={"is_active": True, "session_version": 0},
        )

        assert _with_header(cookie_admin_client, old_token).status_code == 401


class TestReissueFailure:
    def test_password_change_still_succeeds_when_the_new_cookie_cannot_be_issued(
        self, client: TestClient, db_session: Session
    ):
        user = _make_user(db_session)
        assert _login(client, "sessionuser").status_code == 200

        with patch(
            "app.services.auth_session._session_timing",
            side_effect=RuntimeError("preferences unavailable"),
        ):
            response = client.post(
                CHANGE_PASSWORD_URL,
                json={"currentPassword": PASSWORD, "newPassword": "NewPassword456"},
            )

        assert response.status_code == 200
        db_session.refresh(user)
        assert user.session_version == 1
