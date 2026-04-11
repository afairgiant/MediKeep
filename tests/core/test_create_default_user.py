"""
Tests for app.core.database.database.create_default_user().

Covers fresh-install creation, the no-op path when admins already exist, and
the new WARNING-only paths added to avoid auto-healing operator-intentional
demotions.
"""

import logging

from sqlalchemy.orm import Session

from app.core.database.database import create_default_user
from app.crud.user import user as user_crud
from app.models.models import User
from app.schemas.user import UserCreate


def _seed_user(db: Session, *, username: str, role: str) -> User:
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


def _find_record(caplog, *, event: str):
    for record in caplog.records:
        if getattr(record, "event", None) == event:
            return record
    return None


class TestCreateDefaultUser:
    def test_noop_when_admin_exists(self, db_session: Session, caplog):
        alice = _seed_user(db_session, username="alice", role="admin")
        db_session.commit()

        initial_user_count = db_session.query(User).count()

        with caplog.at_level(logging.WARNING):
            create_default_user()

        db_session.expire_all()
        assert db_session.query(User).count() == initial_user_count
        alice_refreshed = db_session.query(User).filter(User.id == alice.id).one()
        assert alice_refreshed.role == "admin"
        # No warn-level records for our new events
        assert _find_record(caplog, event="admin_user_demoted_no_other_admins") is None
        assert _find_record(caplog, event="no_admin_users_detected") is None

    def test_creates_default_admin_on_fresh_install(self, db_session: Session):
        """Regression: empty DB still triggers default admin creation."""
        assert db_session.query(User).count() == 0

        create_default_user()

        db_session.expire_all()
        created = db_session.query(User).filter(User.username == "admin").first()
        assert created is not None
        assert created.role == "admin"
        assert created.must_change_password is True

    def test_warns_without_promoting_when_admin_user_demoted(
        self, db_session: Session, caplog
    ):
        """The reporting user's scenario: 'admin' exists but with role='user'."""
        seeded = _seed_user(db_session, username="admin", role="user")
        original_password_hash = seeded.password_hash
        db_session.commit()

        with caplog.at_level(logging.WARNING):
            create_default_user()

        db_session.expire_all()
        refreshed = db_session.query(User).filter(User.id == seeded.id).one()
        assert refreshed.role == "user"  # NOT auto-promoted
        assert refreshed.password_hash == original_password_hash

        record = _find_record(caplog, event="admin_user_demoted_no_other_admins")
        assert record is not None, (
            "Expected admin_user_demoted_no_other_admins warning, got records: "
            f"{[getattr(r, 'event', None) for r in caplog.records]}"
        )
        assert record.levelno == logging.WARNING
        assert "create_emergency_admin.py" in record.getMessage()
        assert "--username admin" in record.getMessage()

    def test_warns_without_creating_when_users_exist_but_no_admin_named_user(
        self, db_session: Session, caplog
    ):
        """Users exist but neither an admin nor an 'admin'-named row exist."""
        _seed_user(db_session, username="bob", role="user")
        db_session.commit()

        with caplog.at_level(logging.WARNING):
            create_default_user()

        db_session.expire_all()
        # Still exactly one user (bob), no new admin created
        assert db_session.query(User).count() == 1
        assert db_session.query(User).filter(User.username == "admin").first() is None

        record = _find_record(caplog, event="no_admin_users_detected")
        assert record is not None, (
            "Expected no_admin_users_detected warning, got records: "
            f"{[getattr(r, 'event', None) for r in caplog.records]}"
        )
        assert record.levelno == logging.WARNING
        assert "create_emergency_admin.py" in record.getMessage()
        assert "--promote" in record.getMessage()
