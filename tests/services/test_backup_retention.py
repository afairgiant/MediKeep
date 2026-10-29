"""Tests for the backup retention rule shared by clean-up and its preview."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.backup_service import partition_for_retention, retention_cutoff

NOW = datetime(2026, 10, 29, 12, 0)
CUTOFF = NOW - timedelta(days=7)


def _backup(days_old, status="created"):
    return SimpleNamespace(created_at=NOW - timedelta(days=days_old), status=status)


class TestPartitionForRetention:
    def test_keeps_min_count_newest_even_when_old(self):
        backups = [_backup(10), _backup(20), _backup(30)]

        protected, deletable = partition_for_retention(backups, 2, CUTOFF)

        assert protected == backups[:2]
        assert deletable == [backups[2]]

    def test_keeps_backups_inside_retention_window(self):
        backups = [_backup(1), _backup(2), _backup(3)]

        protected, deletable = partition_for_retention(backups, 1, CUTOFF)

        assert protected == [backups[0]]
        assert deletable == []

    def test_failed_backups_do_not_count_toward_minimum(self):
        """Repeated failures must not crowd out the last good backups."""
        failed = [_backup(days, status="failed") for days in (8, 9, 10)]
        good = [_backup(11), _backup(12)]

        protected, deletable = partition_for_retention(failed + good, 2, CUTOFF)

        assert protected == good
        assert deletable == failed

    def test_recent_failed_backup_is_kept_until_cutoff(self):
        recent_failed = _backup(1, status="failed")
        backups = [recent_failed, _backup(10)]

        protected, deletable = partition_for_retention(backups, 1, CUTOFF)

        assert recent_failed not in protected
        assert recent_failed not in deletable

    def test_zero_minimum_protects_nothing(self):
        backups = [_backup(10), _backup(1)]

        protected, deletable = partition_for_retention(backups, 0, CUTOFF)

        assert protected == []
        assert deletable == [backups[0]]

    def test_empty(self):
        assert partition_for_retention([], 5, CUTOFF) == ([], [])


class TestRetentionCutoff:
    def test_is_naive_utc_like_created_at(self):
        """A local-time cutoff deletes backups early on hosts east of UTC."""
        expected = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)

        cutoff = retention_cutoff(7)

        assert cutoff.tzinfo is None
        assert abs(cutoff - expected) < timedelta(seconds=5)
