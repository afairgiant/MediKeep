"""Tests for the status BackupService.verify_backup records."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.backup_service import USABLE_BACKUP_STATUSES, BackupService


@pytest.fixture
def backup_file(tmp_path):
    path = tmp_path / "full_backup.zip"
    path.write_bytes(b"backup contents")
    return path


def _verify(record):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = record
    service = BackupService(db)
    return service, db


def _record(path, status, size=None, checksum=None):
    return SimpleNamespace(
        id=1,
        file_path=str(path),
        size_bytes=size if size is not None else path.stat().st_size,
        checksum=checksum,
        status=status,
    )


class TestVerifyBackupStatus:
    @pytest.mark.asyncio
    async def test_success_marks_backup_verified(self, backup_file):
        record = _record(backup_file, "created")
        service, db = _verify(record)

        result = await service.verify_backup(1)

        assert result["verified"] is True
        assert record.status == "verified"
        assert record.status in USABLE_BACKUP_STATUSES
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("earlier", ["missing", "checksum_failed", "corrupted"])
    async def test_success_clears_an_earlier_failed_check(self, backup_file, earlier):
        """A backup that passes again must count toward the minimum again."""
        record = _record(backup_file, earlier)
        service, _ = _verify(record)

        await service.verify_backup(1)

        assert record.status == "verified"

    @pytest.mark.asyncio
    async def test_success_keeps_uploaded_label(self, backup_file):
        record = _record(backup_file, "uploaded")
        service, db = _verify(record)

        result = await service.verify_backup(1)

        assert record.status == "uploaded"
        assert result["status_updated"] is None
        db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_size_mismatch_is_recorded(self, backup_file):
        record = _record(backup_file, "created", size=1)
        service, _ = _verify(record)

        result = await service.verify_backup(1)

        assert result["verified"] is False
        assert record.status == "size_mismatch"
