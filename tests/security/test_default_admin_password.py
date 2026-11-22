"""Initial admin creation requires an explicit password."""

import pytest

from app.core.database import database
from app.models.models import User


@pytest.mark.parametrize("password", ["", "   "])
def test_missing_password_refuses_initial_admin(db_session, monkeypatch, password):
    monkeypatch.setattr(database, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)
    monkeypatch.setattr(database.settings, "ADMIN_DEFAULT_PASSWORD", password)
    with pytest.raises(ValueError, match="Set ADMIN_DEFAULT_PASSWORD"):
        database.create_default_user()
    assert db_session.query(User).count() == 0


def test_explicit_password_creates_initial_admin(db_session, monkeypatch):
    monkeypatch.setattr(database, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)
    monkeypatch.setattr(
        database.settings, "ADMIN_DEFAULT_PASSWORD", "ExplicitRecovery123"
    )
    database.create_default_user()
    admin = db_session.query(User).one()
    assert admin.username == "admin"
    assert admin.must_change_password is True


def test_existing_admin_does_not_require_bootstrap_password(
    db_session, test_admin_user, monkeypatch
):
    monkeypatch.setattr(database, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)
    monkeypatch.setattr(database.settings, "ADMIN_DEFAULT_PASSWORD", "")
    database.create_default_user()
    assert db_session.query(User).count() == 1
