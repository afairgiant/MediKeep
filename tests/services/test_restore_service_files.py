"""Tests for how files and full restores replace the uploads directory (#1259)."""

import errno
import os
import zipfile
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import settings
from app.services import restore_service as restore_module
from app.services.backup_service import BackupService
from app.services.restore_service import RestoreService
from tests.utils.log_output import records_with_event

OLD_FILES = {
    "existing.pdf": b"old",
    "photos/patient.jpg": b"old-photo",
    "photos/trash/not-the-trash.jpg": b"user folder named trash",
}
TRASH_FILE = "trash/deleted.pdf"


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    """An uploads directory that behaves like a mount point: it cannot be removed."""
    upload_dir = tmp_path / "uploads"
    for relative, content in {**OLD_FILES, TRASH_FILE: b"soft-deleted"}.items():
        path = upload_dir / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    monkeypatch.setattr(settings, "TRASH_DIR", upload_dir / "trash")

    real_rmdir = os.rmdir

    def rmdir(path, *args, **kwargs):
        if Path(path).resolve() == upload_dir.resolve():
            raise OSError(errno.EBUSY, "Device or resource busy", str(path))
        return real_rmdir(path, *args, **kwargs)

    monkeypatch.setattr(os, "rmdir", rmdir)
    return upload_dir


@pytest.fixture
def service(uploads, tmp_path):
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    svc = RestoreService(MagicMock())
    svc.upload_dir = uploads
    svc.backup_dir = backup_dir
    svc._restore_database = AsyncMock(return_value={"restored_size": 0})
    return svc


def _zip(path: Path, members: dict, compression=zipfile.ZIP_DEFLATED) -> Path:
    with zipfile.ZipFile(path, "w", compression) as zipf:
        for name, content in members.items():
            zipf.writestr(name, content)
    return path


def _corrupted_zip(path: Path, members: dict) -> Path:
    """A ZIP whose central directory is intact but whose member data fails its CRC."""
    _zip(path, members, zipfile.ZIP_STORED)
    path.write_bytes(path.read_bytes().replace(b"intact-content", b"damaged-conten"))
    return path


def _archive_members(kind, files):
    members = {f"uploads/{k}": v for k, v in files.items()}
    if kind == "full":
        members.update({"database.sql": "-- dump", "backup_manifest.json": "{}"})
    return members


def _backup(tmp_path, kind, files):
    return _zip(tmp_path / f"{kind}.zip", _archive_members(kind, files))


def _contents(upload_dir: Path) -> dict:
    return {
        p.relative_to(upload_dir).as_posix(): p.read_bytes()
        for p in upload_dir.rglob("*")
        if p.is_file()
    }


def _working_dirs(upload_dir: Path) -> list:
    return [p for p in upload_dir.iterdir() if p.name.startswith(".restore-")]


def _assert_untouched(upload_dir: Path):
    contents = _contents(upload_dir)
    for relative, content in {**OLD_FILES, TRASH_FILE: b"soft-deleted"}.items():
        assert contents[relative] == content
    assert not _working_dirs(upload_dir)


async def _restore(service, kind, backup):
    if kind == "full":
        return await service._restore_full_backup(backup)
    return await service._restore_files(backup)


@pytest.mark.parametrize("kind", ["full", "files"])
class TestRestoreReplacesUploadsInPlace:
    @pytest.mark.asyncio
    async def test_replaces_contents_of_mounted_directory(
        self, service, uploads, tmp_path, kind
    ):
        backup = _backup(tmp_path, kind, {"restored.pdf": "new", "a/b.txt": "nested"})

        result = await _restore(service, kind, backup)

        assert result["success"] is True
        count_key = "files_restored" if kind == "full" else "restored_files"
        assert result[count_key] == 2
        contents = _contents(uploads)
        assert contents["restored.pdf"] == b"new"
        assert contents["a/b.txt"] == b"nested"
        for relative in OLD_FILES:
            assert relative not in contents

    @pytest.mark.asyncio
    async def test_keeps_trash_directory(self, service, uploads, tmp_path, kind):
        backup = _backup(
            tmp_path, kind, {"restored.pdf": "new", "trash/from-archive.pdf": "x"}
        )

        await _restore(service, kind, backup)

        contents = _contents(uploads)
        assert contents[TRASH_FILE] == b"soft-deleted"
        assert "trash/from-archive.pdf" not in contents

    @pytest.mark.asyncio
    async def test_keeps_nested_trash_directory(
        self, service, uploads, tmp_path, kind, monkeypatch
    ):
        monkeypatch.setattr(settings, "TRASH_DIR", uploads / "photos" / "trash")

        await _restore(service, kind, _backup(tmp_path, kind, {"photos/new.jpg": "n"}))

        contents = _contents(uploads)
        assert contents["photos/trash/not-the-trash.jpg"] == b"user folder named trash"
        assert contents["photos/new.jpg"] == b"n"
        assert "photos/patient.jpg" not in contents

    @pytest.mark.asyncio
    async def test_leaves_no_working_directories_behind(
        self, service, uploads, tmp_path, kind
    ):
        await _restore(service, kind, _backup(tmp_path, kind, {"restored.pdf": "new"}))

        assert not _working_dirs(uploads)
        assert not list(uploads.parent.glob("uploads_backup_*"))

    @pytest.mark.asyncio
    async def test_path_escaping_uploads_is_rejected_before_anything_changes(
        self, service, uploads, tmp_path, kind
    ):
        backup = _backup(tmp_path, kind, {"../escaped.txt": "x"})

        with pytest.raises(Exception, match="Unsafe path"):
            await _restore(service, kind, backup)

        _assert_untouched(uploads)
        assert not (uploads.parent / "escaped.txt").exists()
        service._restore_database.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_corrupt_archive_is_rejected_before_anything_changes(
        self, service, uploads, tmp_path, kind
    ):
        backup = _corrupted_zip(
            tmp_path / f"{kind}.zip",
            _archive_members(kind, {"restored.pdf": "intact-content"}),
        )

        with pytest.raises(Exception, match="CRC"):
            await _restore(service, kind, backup)

        _assert_untouched(uploads)
        service._restore_database.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_member_that_cannot_be_written_changes_nothing(
        self, service, uploads, tmp_path, kind
    ):
        backup = _backup(tmp_path, kind, {"a": "file", "a/b": "file below a file"})

        with pytest.raises(Exception):
            await _restore(service, kind, backup)

        _assert_untouched(uploads)
        service._restore_database.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_failed_swap_keeps_previous_files(
        self, service, uploads, tmp_path, kind
    ):
        backup = _backup(tmp_path, kind, {"restored.pdf": "new"})
        real_move = restore_module._move_contents

        def fail_moving_staged_files_in(source, *args, **kwargs):
            if source.name.startswith(".restore-staging-"):
                raise PermissionError("file is locked")
            return real_move(source, *args, **kwargs)

        with patch.object(
            restore_module, "_move_contents", fail_moving_staged_files_in
        ):
            with pytest.raises(Exception, match="previous files are in"):
                await _restore(service, kind, backup)

        (previous,) = [
            p for p in _working_dirs(uploads) if p.name.startswith(".restore-previous-")
        ]
        held = _contents(previous)
        for relative, content in OLD_FILES.items():
            assert held[relative] == content


class TestFullRestore:
    @pytest.mark.asyncio
    async def test_backup_without_uploads_leaves_files_alone(
        self, service, uploads, tmp_path
    ):
        result = await service._restore_full_backup(_backup(tmp_path, "full", {}))

        assert result["files_restored"] == 0
        _assert_untouched(uploads)
        service._restore_database.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_missing_database_dump_changes_nothing(
        self, service, uploads, tmp_path
    ):
        backup = _zip(tmp_path / "full.zip", {"uploads/restored.pdf": "new"})

        with pytest.raises(Exception, match="Database backup not found"):
            await service._restore_full_backup(backup)

        _assert_untouched(uploads)

    @pytest.mark.asyncio
    async def test_database_failure_leaves_files_alone(
        self, service, uploads, tmp_path
    ):
        service._restore_database.side_effect = Exception("psql failed")

        with pytest.raises(Exception, match="psql failed"):
            await service._restore_full_backup(
                _backup(tmp_path, "full", {"restored.pdf": "new"})
            )

        _assert_untouched(uploads)

    @pytest.mark.asyncio
    async def test_temporary_dump_is_removed(self, service, tmp_path):
        await service._restore_full_backup(_backup(tmp_path, "full", {}))

        assert not list(service.backup_dir.glob("temp_restore_*.sql"))


class TestFilesRestore:
    @pytest.mark.asyncio
    async def test_archive_without_uploads_prefix_still_restores(
        self, service, uploads, tmp_path
    ):
        backup = _zip(tmp_path / "files.zip", {"restored.pdf": "new"})

        result = await service._restore_files(backup)

        assert result["restored_files"] == 1
        assert _contents(uploads)["restored.pdf"] == b"new"


class TestBackupExclusionRule:
    @pytest.fixture
    def files_backup(self, tmp_path, monkeypatch):
        db = MagicMock()
        db.add.side_effect = lambda record: setattr(
            record, "created_at", datetime.now()
        )
        backup_service = BackupService(db)
        backup_service.backup_dir = tmp_path / "backups"

        async def _create(upload_dir: Path) -> list:
            monkeypatch.setattr(settings, "UPLOAD_DIR", upload_dir)
            monkeypatch.setattr(settings, "TRASH_DIR", upload_dir / "trash")
            result = await backup_service.create_files_backup("test")
            with zipfile.ZipFile(result["file_path"]) as zipf:
                return sorted(zipf.namelist())

        return _create

    @staticmethod
    def _seed(upload_dir: Path, *relatives: str):
        for relative in relatives:
            path = upload_dir / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"x")

    @pytest.mark.asyncio
    async def test_parent_directory_named_trash_does_not_empty_the_backup(
        self, tmp_path, files_backup
    ):
        upload_dir = tmp_path / "trash" / "uploads"
        self._seed(upload_dir, "kept.pdf", "trash/deleted.pdf")

        assert await files_backup(upload_dir) == ["uploads/kept.pdf"]

    @pytest.mark.asyncio
    async def test_only_the_configured_trash_and_restore_work_dirs_are_skipped(
        self, tmp_path, files_backup
    ):
        upload_dir = tmp_path / "uploads"
        self._seed(
            upload_dir,
            "photos/trash/user.jpg",
            "trash/deleted.pdf",
            ".restore-staging-1/leftover.pdf",
        )

        assert await files_backup(upload_dir) == ["uploads/photos/trash/user.jpg"]


class TestExecuteRestore:
    BACKUP_ID = 42

    @pytest.fixture
    def run_execute(self, service, tmp_path):
        backup = _backup(tmp_path, "full", {"restored.pdf": "new"})
        service.db.query.return_value.filter.return_value.first.return_value = (
            SimpleNamespace(backup_type="full", file_path=str(backup))
        )
        token = f"restore_{self.BACKUP_ID}_{datetime.now().strftime('%Y%m%d')}"

        async def _run(safety_backup: Path):
            backup_service = MagicMock()
            backup_service.create_full_backup = AsyncMock(
                return_value={"id": 7, "file_path": str(safety_backup)}
            )
            with patch.object(
                restore_module, "BackupService", return_value=backup_service
            ):
                return await service.execute_restore(self.BACKUP_ID, token)

        return _run

    @pytest.fixture
    def good_safety_backup(self, tmp_path):
        return _zip(tmp_path / "safety.zip", {"database.sql": "-- dump"})

    @pytest.mark.asyncio
    async def test_truncated_safety_backup_aborts_restore(
        self, service, uploads, tmp_path, run_execute, good_safety_backup
    ):
        good_safety_backup.write_bytes(good_safety_backup.read_bytes()[:-30])

        with pytest.raises(Exception, match="cannot be opened"):
            await run_execute(good_safety_backup)

        _assert_untouched(uploads)
        service._restore_database.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_safety_backup_without_database_aborts_restore(
        self, service, uploads, tmp_path, run_execute
    ):
        safety = _zip(tmp_path / "safety.zip", {"uploads/a.pdf": "x"})

        with pytest.raises(Exception, match="no database.sql"):
            await run_execute(safety)

        _assert_untouched(uploads)

    @pytest.mark.asyncio
    async def test_readable_safety_backup_proceeds(
        self, run_execute, good_safety_backup
    ):
        result = await run_execute(good_safety_backup)

        assert result["success"] is True
        assert result["safety_backup_id"] == 7

    @pytest.mark.asyncio
    async def test_failure_before_any_change_gives_no_rollback_hint(
        self, service, run_execute, good_safety_backup, caplog
    ):
        service._restore_database.side_effect = Exception("connection refused")

        with caplog.at_level("ERROR"), pytest.raises(Exception):
            await run_execute(good_safety_backup)

        assert not records_with_event(caplog, "restore_incomplete")

    @pytest.mark.asyncio
    async def test_failure_after_changes_names_the_safety_backup(
        self, service, run_execute, good_safety_backup, caplog
    ):
        def change_then_fail(_staging):
            service._data_changed = True
            raise RuntimeError("swap failed")

        with patch.object(
            service, "_swap_in_staged_uploads", side_effect=change_then_fail
        ):
            with caplog.at_level("ERROR"), pytest.raises(Exception):
                await run_execute(good_safety_backup)

        (hint,) = records_with_event(caplog, "restore_incomplete")
        assert "safety backup 7" in hint.getMessage()
