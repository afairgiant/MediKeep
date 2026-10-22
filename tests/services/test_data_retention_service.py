"""Retention cleanup for activity logs and notification history."""

from datetime import timedelta

import pytest

from app.core.config import settings
from app.models.activity_log import ActionType, ActivityLog, EntityType
from app.models.base import get_utc_now
from app.models.notifications import NotificationHistory
from app.services.data_retention_service import purge_older_than, run_data_retention


@pytest.fixture(autouse=True)
def restore_retention():
    snapshot = (
        settings.ACTIVITY_LOG_RETENTION_DAYS,
        settings.NOTIFICATION_HISTORY_RETENTION_DAYS,
    )
    yield
    (
        settings.ACTIVITY_LOG_RETENTION_DAYS,
        settings.NOTIFICATION_HISTORY_RETENTION_DAYS,
    ) = snapshot


def _activity(db, days_old, entity_type=EntityType.MEDICATION):
    db.add(
        ActivityLog(
            action=ActionType.UPDATED,
            entity_type=entity_type,
            description="test",
            timestamp=get_utc_now() - timedelta(days=days_old),
        )
    )


def _notification(db, days_old):
    db.add(
        NotificationHistory(
            event_type="test_event",
            title="test",
            status="sent",
            created_at=get_utc_now() - timedelta(days=days_old),
        )
    )


def _maintenance_entries(db):
    return (
        db.query(ActivityLog)
        .filter(ActivityLog.action == ActionType.MAINTENANCE_COMPLETED)
        .all()
    )


class TestRunDataRetention:
    def test_zero_keeps_everything(self, db_session):
        settings.ACTIVITY_LOG_RETENTION_DAYS = 0
        settings.NOTIFICATION_HISTORY_RETENTION_DAYS = 0
        _activity(db_session, 4000)
        _notification(db_session, 4000)
        db_session.commit()

        result = run_data_retention(db_session)

        assert result == {"activity_logs": 0, "notification_history": 0}
        assert db_session.query(ActivityLog).count() == 1
        assert db_session.query(NotificationHistory).count() == 1

    def test_removes_only_rows_past_the_cutoff(self, db_session):
        settings.ACTIVITY_LOG_RETENTION_DAYS = 30
        settings.NOTIFICATION_HISTORY_RETENTION_DAYS = 10
        for days in (5, 29, 31, 400):
            _activity(db_session, days)
        for days in (1, 9, 11, 100):
            _notification(db_session, days)
        db_session.commit()

        result = run_data_retention(db_session)

        assert result == {"activity_logs": 2, "notification_history": 2}
        assert db_session.query(NotificationHistory).count() == 2

    def test_sign_in_events_follow_the_same_setting(self, db_session):
        settings.ACTIVITY_LOG_RETENTION_DAYS = 30
        _activity(db_session, 60, entity_type=EntityType.USER)
        db_session.commit()

        assert run_data_retention(db_session)["activity_logs"] == 1

    def test_each_table_uses_its_own_setting(self, db_session):
        settings.ACTIVITY_LOG_RETENTION_DAYS = 0
        settings.NOTIFICATION_HISTORY_RETENTION_DAYS = 10
        _activity(db_session, 400)
        _notification(db_session, 400)
        db_session.commit()

        result = run_data_retention(db_session)

        assert result == {"activity_logs": 0, "notification_history": 1}

    def test_records_that_activity_was_removed(self, db_session):
        settings.ACTIVITY_LOG_RETENTION_DAYS = 30
        _activity(db_session, 60)
        _activity(db_session, 90)
        db_session.commit()

        run_data_retention(db_session)

        (entry,) = _maintenance_entries(db_session)
        assert entry.entity_type == EntityType.SYSTEM
        assert entry.event_metadata["deleted"] == 2
        assert db_session.query(ActivityLog).count() == 1

    def test_no_record_when_nothing_removed(self, db_session):
        settings.ACTIVITY_LOG_RETENTION_DAYS = 30
        _activity(db_session, 1)
        db_session.commit()

        run_data_retention(db_session)

        assert _maintenance_entries(db_session) == []


class TestPurgeOlderThan:
    def test_deletes_across_several_batches(self, db_session):
        for _ in range(7):
            _notification(db_session, 50)
        _notification(db_session, 1)
        db_session.commit()

        deleted = purge_older_than(
            db_session,
            NotificationHistory,
            NotificationHistory.created_at,
            get_utc_now() - timedelta(days=10),
            batch_size=3,
        )

        assert deleted == 7
        assert db_session.query(NotificationHistory).count() == 1

    def test_nothing_to_delete(self, db_session):
        deleted = purge_older_than(
            db_session,
            ActivityLog,
            ActivityLog.timestamp,
            get_utc_now(),
        )

        assert deleted == 0
