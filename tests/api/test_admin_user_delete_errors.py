"""Admin user delete maps expected service errors to 400 (issue #1289).

``UserDeletionService.delete_user_account`` raises ``ValueError`` for expected
conditions (lock contention, user not found, last user/admin). The admin
``DELETE /admin/models/user/{id}`` handler must turn those into a 400 with the
service's message instead of a generic 500, and must leave the last-user and
last-admin decisions to the service.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.constants import get_admin_roles_filter
from app.crud.user import user as user_crud
from app.models.activity_log import ActivityLog
from app.models.models import User
from app.schemas.user import UserCreate
from app.services.user_deletion_service import UserDeletionService

DELETE_URL = "/api/v1/admin/models/user/{user_id}"

LOCK_MESSAGE = (
    "User account is currently being modified by another process. Please try again."
)
LAST_ADMIN_MESSAGE = (
    "Cannot delete the last remaining admin user in the system. "
    "Please create another admin user first."
)


def _make_user(db_session: Session, username: str, role: str) -> User:
    # UserCreate lowercases the role and rejects "administrator", so set the
    # stored spelling directly, as a row written by other means would have it.
    user = user_crud.create(
        db_session,
        obj_in=UserCreate(
            username=username,
            email=f"{username}@example.com",
            password="password12345",
            full_name=username.title(),
            role="user",
        ),
    )
    user.role = role
    db_session.commit()
    return user


def _deleted_activity_count(db_session: Session) -> int:
    return db_session.query(ActivityLog).filter(ActivityLog.action == "deleted").count()


class TestServiceValueErrorMapsTo400:
    @pytest.mark.parametrize(
        "message",
        [
            LOCK_MESSAGE,
            "User with ID 1 not found",
            LAST_ADMIN_MESSAGE,
        ],
        ids=["lock-contention", "user-not-found", "last-admin"],
    )
    def test_service_value_error_returns_400_with_message(
        self,
        admin_client: TestClient,
        db_session: Session,
        test_admin_user: User,
        monkeypatch,
        message,
    ):
        target = _make_user(db_session, "target", "user")

        def _refuse(self, db, user_id):
            raise ValueError(message)

        monkeypatch.setattr(UserDeletionService, "_validate_deletion_allowed", _refuse)

        response = admin_client.delete(DELETE_URL.format(user_id=target.id))

        assert response.status_code == 400
        assert message in response.json()["message"]
        # The refused delete leaves the user and writes no audit entry
        assert db_session.get(User, target.id) is not None
        assert _deleted_activity_count(db_session) == 0

    def test_unexpected_error_is_still_500(
        self,
        admin_client: TestClient,
        db_session: Session,
        test_admin_user: User,
        monkeypatch,
    ):
        target = _make_user(db_session, "target", "user")

        def _boom(self, db, user_id):
            raise RuntimeError("database exploded")

        monkeypatch.setattr(UserDeletionService, "_validate_deletion_allowed", _boom)

        response = admin_client.delete(DELETE_URL.format(user_id=target.id))

        assert response.status_code == 500
        assert "exploded" not in response.text


class TestAdminRoleChecksLiveInService:
    @pytest.mark.parametrize("role", get_admin_roles_filter())
    def test_admin_role_spelling_outside_handler_list_can_be_deleted(
        self,
        admin_client: TestClient,
        db_session: Session,
        test_admin_user: User,
        role,
    ):
        """Another admin exists, so deleting a role from the shared filter works.

        The handler used to count admins against its own four spellings, which
        omit e.g. "ADMIN", and wrongly refused with "last remaining admin".
        """
        target = _make_user(db_session, "otheradmin", role)

        response = admin_client.delete(DELETE_URL.format(user_id=target.id))

        assert response.status_code == 200
        db_session.expire_all()
        assert db_session.get(User, target.id) is None

    @pytest.mark.parametrize("role", get_admin_roles_filter())
    def test_service_refuses_last_admin_for_every_filter_role(
        self, db_session: Session, role
    ):
        _make_user(db_session, "regular", "user")
        last_admin = _make_user(db_session, "lastadmin", role)

        with pytest.raises(ValueError, match="last remaining admin"):
            UserDeletionService().delete_user_account(db_session, user_id=last_admin.id)

    def test_deleting_yourself_is_still_refused(
        self, admin_client: TestClient, db_session: Session, test_admin_user: User
    ):
        _make_user(db_session, "another", "user")

        response = admin_client.delete(DELETE_URL.format(user_id=test_admin_user.id))

        assert response.status_code == 400
        assert "own user account" in response.json()["message"]
