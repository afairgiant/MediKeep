"""Tests for the backup size the schedule preview bases its disk estimate on."""

from datetime import datetime, timedelta

from app.models.models import BackupRecord
from app.services.backup_service import BackupService

NOW = datetime(2026, 10, 29, 12, 0)


def _add(db, backup_type, status, size, hours_old):
    db.add(
        BackupRecord(
            backup_type=backup_type,
            status=status,
            file_path=f"/backups/{backup_type}_{hours_old}.zip",
            size_bytes=size,
            created_at=NOW - timedelta(hours=hours_old),
        )
    )
    db.commit()


class TestLatestFullBackupSize:
    def test_none_without_backups(self, db_session):
        assert BackupService(db_session).latest_full_backup_size() is None

    def test_newest_usable_full_backup(self, db_session):
        _add(db_session, "full", "created", 100, hours_old=48)
        _add(db_session, "full", "verified", 200, hours_old=24)

        assert BackupService(db_session).latest_full_backup_size() == 200

    def test_ignores_other_types_and_failed_backups(self, db_session):
        """A schedule makes full backups; failed records have no real size."""
        _add(db_session, "full", "created", 100, hours_old=48)
        _add(db_session, "database", "created", 5, hours_old=2)
        _add(db_session, "full", "failed", 0, hours_old=1)

        assert BackupService(db_session).latest_full_backup_size() == 100
