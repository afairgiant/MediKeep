"""Regression tests for issue #1288: a failed audit write keeps the caller's work."""

import pytest
from sqlalchemy.orm import Session

import app.api.activity_logging as activity_logging
from app.api.activity_logging import log_crud_activity, safe_log_activity
from app.crud.activity_log import activity_log
from app.models.activity_log import ActionType, ActivityLog
from app.models.models import User

CHANGED_NAME = "Changed before audit"


def _persisted_name(db_session: Session, user: User) -> str:
    # Rolling back discards anything not committed, so what survives was persisted
    db_session.rollback()
    db_session.refresh(user)
    return user.full_name


def _audit_rows(db_session: Session, description: str) -> int:
    return (
        db_session.query(ActivityLog)
        .filter(ActivityLog.description == description)
        .count()
    )


def _invalid_log(**kwargs):
    kwargs["db"].add(ActivityLog(action=None, entity_type="user", description="bad"))
    kwargs["db"].flush()


def test_failed_description_keeps_pending_change(db_session, test_user, monkeypatch):
    def broken_description(*_args, **_kwargs):
        raise RuntimeError("description failed")

    monkeypatch.setattr(activity_logging, "get_entity_description", broken_description)
    test_user.full_name = CHANGED_NAME

    assert not log_crud_activity(
        db_session, ActionType.UPDATED, "user", test_user, test_user.id
    )

    assert test_user.full_name == CHANGED_NAME
    db_session.commit()
    assert _persisted_name(db_session, test_user) == CHANGED_NAME


def test_failed_audit_insert_keeps_pending_change(db_session, test_user, monkeypatch):
    monkeypatch.setattr(activity_log, "log_activity", _invalid_log)
    test_user.full_name = CHANGED_NAME

    assert not log_crud_activity(
        db_session, ActionType.UPDATED, "user", test_user, test_user.id
    )

    db_session.commit()
    assert _persisted_name(db_session, test_user) == CHANGED_NAME
    assert _audit_rows(db_session, "bad") == 0


def test_failed_commit_rolls_back_and_leaves_session_usable(
    db_session, test_user, monkeypatch
):
    original_name = test_user.full_name

    def failing_commit():
        raise RuntimeError("commit failed")

    monkeypatch.setattr(db_session, "commit", failing_commit)
    test_user.full_name = CHANGED_NAME

    assert not log_crud_activity(
        db_session,
        ActionType.UPDATED,
        "user",
        test_user,
        test_user.id,
        description="failed commit audit",
    )

    monkeypatch.undo()
    db_session.refresh(test_user)
    assert test_user.full_name == original_name
    assert _audit_rows(db_session, "failed commit audit") == 0


def test_failed_flush_of_pending_work_leaves_session_usable(db_session, test_user):
    db_session.add(User(username=None, email="invalid@test.com", password_hash="x"))

    assert not log_crud_activity(
        db_session,
        ActionType.UPDATED,
        "user",
        test_user,
        test_user.id,
        description="failed flush audit",
    )

    assert db_session.query(User).filter(User.id == test_user.id).count() == 1
    assert _audit_rows(db_session, "failed flush audit") == 0


def test_successful_log_commits_entry_and_pending_change(db_session, test_user):
    test_user.full_name = CHANGED_NAME

    assert log_crud_activity(
        db_session,
        ActionType.UPDATED,
        "user",
        test_user,
        test_user.id,
        description="committed audit",
    )

    assert _persisted_name(db_session, test_user) == CHANGED_NAME
    assert _audit_rows(db_session, "committed audit") == 1


@pytest.mark.parametrize("commit", [True, False])
def test_safe_log_activity_never_raises(db_session, test_user, monkeypatch, commit):
    def broken_log(*_args, **_kwargs):
        raise RuntimeError("logging failed")

    monkeypatch.setattr(activity_logging, "log_crud_activity", broken_log)
    test_user.full_name = CHANGED_NAME

    safe_log_activity(
        db_session, ActionType.UPDATED, "user", test_user, test_user.id, commit=commit
    )

    db_session.commit()
    assert _persisted_name(db_session, test_user) == CHANGED_NAME
