"""
Tests for app/scripts/create_emergency_admin.py.

Covers the new --promote branch added to recover from the "default admin
got demoted" scenario, plus regression coverage for existing create-path
behavior.
"""

from sqlalchemy.orm import Session

from app.crud.user import user as user_crud
from app.models.activity_log import ActionType, ActivityLog, EntityType
from app.models.models import User
from app.schemas.user import UserCreate
from app.scripts.create_emergency_admin import create_emergency_admin


def _seed_user(db: Session, *, username: str, role: str) -> User:
    """Seed a user with the given role via the real CRUD (no mocks)."""
    return user_crud.create(
        db,
        obj_in=UserCreate(
            username=username,
            email=f"{username}@example.com",
            password="OriginalPass123",
            full_name=f"Test {username}",
            role=role,
        ),
    )


def _reload(db: Session, user_obj: User) -> User:
    """Expire the local session cache and re-fetch the user to see external commits."""
    db.expire_all()
    refreshed = db.query(User).filter(User.id == user_obj.id).one()
    return refreshed


class TestPromotionPath:
    def test_promotes_existing_non_admin_when_no_admins_exist(
        self, db_session: Session
    ):
        """The reporting user's exact scenario: only user is 'admin' with role='user'."""
        seeded = _seed_user(db_session, username="admin", role="user")
        original_password_hash = seeded.password_hash
        original_must_change_password = seeded.must_change_password
        original_id = seeded.id
        db_session.commit()  # make seeded row visible across engines

        result = create_emergency_admin(username="admin", password="ignored")

        assert result is True
        refreshed = _reload(db_session, seeded)
        assert refreshed.role == "admin"
        assert refreshed.password_hash == original_password_hash
        assert refreshed.must_change_password == original_must_change_password
        assert refreshed.id == original_id

    def test_promotes_existing_non_admin_with_promote_flag_when_admins_exist(
        self, db_session: Session
    ):
        alice = _seed_user(db_session, username="alice", role="admin")
        bob = _seed_user(db_session, username="bob", role="user")
        db_session.commit()

        result = create_emergency_admin(username="bob", promote=True)

        assert result is True
        bob_refreshed = _reload(db_session, bob)
        alice_refreshed = _reload(db_session, alice)
        assert bob_refreshed.role == "admin"
        assert alice_refreshed.role == "admin"  # unchanged

    def test_refuses_to_promote_without_flag_when_admins_exist(
        self, db_session: Session
    ):
        _seed_user(db_session, username="alice", role="admin")
        bob = _seed_user(db_session, username="bob", role="user")
        db_session.commit()

        result = create_emergency_admin(username="bob", promote=False)

        assert result is False
        bob_refreshed = _reload(db_session, bob)
        assert bob_refreshed.role == "user"  # unchanged

    def test_noop_when_user_is_already_admin(self, db_session: Session):
        alice = _seed_user(db_session, username="alice", role="admin")
        db_session.commit()

        result = create_emergency_admin(username="alice", promote=True)

        assert result is False
        alice_refreshed = _reload(db_session, alice)
        assert alice_refreshed.role == "admin"

    def test_promote_flag_refuses_when_target_user_does_not_exist(
        self, db_session: Session
    ):
        """Passing --promote against a username that doesn't exist is a user error, not a fallthrough to create."""
        _seed_user(db_session, username="alice", role="admin")
        db_session.commit()

        result = create_emergency_admin(username="ghost", promote=True)

        assert result is False
        assert db_session.query(User).filter(User.username == "ghost").first() is None


class TestCreationPath:
    def test_creates_new_admin_when_username_available_and_no_admins(
        self, db_session: Session
    ):
        """Regression for the original fresh-creation path."""
        result = create_emergency_admin(username="rescue", password="Rescue123")

        assert result is True
        db_session.expire_all()
        created = db_session.query(User).filter(User.username == "rescue").first()
        assert created is not None
        assert created.role == "admin"

    def test_refuses_to_create_when_admins_exist_without_force(
        self, db_session: Session
    ):
        _seed_user(db_session, username="alice", role="admin")
        db_session.commit()

        result = create_emergency_admin(username="new_admin", password="Password123")

        assert result is False
        db_session.expire_all()
        assert (
            db_session.query(User).filter(User.username == "new_admin").first() is None
        )


class TestActivityLogging:
    """
    Verify that successful promote/create operations write a row to the
    ActivityLog table so the action shows up in the admin activity log UI.
    """

    def test_promotion_writes_activity_log_row(self, db_session: Session):
        seeded = _seed_user(db_session, username="admin", role="user")
        db_session.commit()

        result = create_emergency_admin(username="admin", password="ignored")
        assert result is True

        db_session.expire_all()
        log_row = (
            db_session.query(ActivityLog)
            .filter(
                ActivityLog.entity_type == EntityType.USER,
                ActivityLog.entity_id == seeded.id,
                ActivityLog.action == ActionType.UPDATED,
            )
            .order_by(ActivityLog.id.desc())
            .first()
        )
        assert log_row is not None, "Expected an ActivityLog row for the promotion"
        assert "promoted" in log_row.description.lower()
        assert "emergency_admin" in log_row.description.lower()
        assert log_row.event_metadata is not None
        assert log_row.event_metadata.get("source") == "emergency_admin_script"
        assert log_row.event_metadata.get("previous_role") == "user"
        assert log_row.event_metadata.get("new_role") == "admin"

    def test_creation_writes_activity_log_row(self, db_session: Session):
        result = create_emergency_admin(username="rescue", password="Rescue123")
        assert result is True

        db_session.expire_all()
        created = db_session.query(User).filter(User.username == "rescue").one()
        log_row = (
            db_session.query(ActivityLog)
            .filter(
                ActivityLog.entity_type == EntityType.USER,
                ActivityLog.entity_id == created.id,
                ActivityLog.action == ActionType.CREATED,
            )
            .order_by(ActivityLog.id.desc())
            .first()
        )
        assert log_row is not None, "Expected an ActivityLog row for the creation"
        assert "emergency_admin" in log_row.description.lower()
        assert log_row.event_metadata is not None
        # Activity log metadata values are stringified by the sanitizer, and
        # any key containing "password" is redacted — so we check source/role
        # directly and only confirm must_change_password appears (as [REDACTED]).
        assert log_row.event_metadata.get("source") == "emergency_admin_script"
        assert log_row.event_metadata.get("role") == "admin"
        assert "must_change_password" in log_row.event_metadata
