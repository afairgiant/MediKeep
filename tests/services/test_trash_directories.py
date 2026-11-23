"""Directories moved to trash as one entry: listing, restore and permanent delete."""

import os
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app.core.config import settings
from app.services.file_management_service import FileManagementService

PERMANENT_DELETE_URL = "/api/v1/admin/trash/permanently-delete"
RESTORE_URL = "/api/v1/admin/trash/restore"


@pytest.fixture
def storage(tmp_path, monkeypatch):
    uploads = tmp_path / "uploads"
    trash = uploads / "trash"
    trash.mkdir(parents=True)
    monkeypatch.setattr(settings, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(settings, "TRASH_DIR", trash)
    return uploads


def _study_dir(uploads: Path, name: str = "1.2.3") -> Path:
    directory = uploads / "imaging" / "7" / name
    (directory / "1.2.3.4").mkdir(parents=True)
    (directory / "1.2.3.4" / "a.dcm").write_bytes(b"a" * 10)
    (directory / "1.2.3.4" / "b.dcm").write_bytes(b"b" * 5)
    return directory


def _trash(uploads: Path, name: str = "1.2.3") -> Path:
    return FileManagementService().move_directory_to_trash(
        str(_study_dir(uploads, name)), trash_name=f"imaging_7_{name}", reason="test"
    )


class TestMoveDirectoryToTrash:
    def test_moves_directory_with_metadata(self, storage):
        source = storage / "imaging" / "7" / "1.2.3"
        trashed = _trash(storage)

        assert not source.exists()
        assert (trashed / "1.2.3.4" / "a.dcm").read_bytes() == b"a" * 10
        assert trashed.parent.parent == settings.TRASH_DIR
        assert FileManagementService().is_trashed_directory(trashed)

    def test_same_name_twice_gets_a_counter(self, storage):
        first = _trash(storage)
        second = _trash(storage)

        assert first != second
        assert second.name == "imaging_7_1.2.3_1"

    def test_refuses_directory_outside_storage(self, storage, tmp_path):
        outside = tmp_path / "outside"
        outside.mkdir()

        with pytest.raises(ValueError):
            FileManagementService().move_directory_to_trash(str(outside), "x")
        assert outside.exists()

    @pytest.mark.parametrize("name", ["../escape", "a/b", "..", ""])
    def test_refuses_names_that_are_paths(self, storage, name):
        source = _study_dir(storage)

        with pytest.raises(ValueError):
            FileManagementService().move_directory_to_trash(str(source), name)
        assert source.exists()


class TestTrashListingAndRestore:
    def test_listing_shows_directory_once_with_total_size(self, storage):
        trashed = _trash(storage)

        contents = FileManagementService().list_trash_contents()

        assert len(contents) == 1
        assert contents[0]["trash_path"] == str(trashed)
        assert contents[0]["size_bytes"] == 15
        assert contents[0]["reason"] == "test"

    def test_restore_returns_directory_to_original_place(self, storage):
        trashed = _trash(storage)

        result = FileManagementService().restore_from_trash(str(trashed))

        restored = Path(result["restored_path"])
        assert restored == (storage / "imaging" / "7" / "1.2.3").resolve()
        assert (restored / "1.2.3.4" / "b.dcm").exists()
        assert FileManagementService().list_trash_contents() == []

    def test_restore_conflict_keeps_uid_dots(self, storage):
        trashed = _trash(storage)
        _study_dir(storage)  # a re-import recreated the folder meanwhile

        result = FileManagementService().restore_from_trash(str(trashed))

        assert Path(result["restored_path"]).name == "1.2.3_restored_1"

    def test_restore_refuses_a_plain_trash_folder(self, storage):
        _trash(storage)
        day_folder = next(settings.TRASH_DIR.iterdir())

        with pytest.raises(Exception):
            FileManagementService().restore_from_trash(str(day_folder))
        assert day_folder.is_dir()


class TestPermanentDeleteEndpoint:
    def test_deletes_trashed_directory_and_metadata(self, storage, admin_client):
        trashed = _trash(storage)

        response = admin_client.delete(
            PERMANENT_DELETE_URL, params={"trash_path": str(trashed)}
        )

        assert response.status_code == 200
        assert not trashed.exists()
        assert not trashed.with_suffix(trashed.suffix + ".meta").exists()

    def test_refuses_the_trash_root_and_day_folders(self, storage, admin_client):
        trashed = _trash(storage)

        for folder in (settings.TRASH_DIR, trashed.parent):
            response = admin_client.delete(
                PERMANENT_DELETE_URL, params={"trash_path": str(folder)}
            )
            assert response.status_code == 400

        assert trashed.is_dir()

    def test_refuses_a_sibling_folder_sharing_the_trash_prefix(
        self, storage, admin_client
    ):
        sibling = settings.TRASH_DIR.parent / f"{settings.TRASH_DIR.name}_old"
        sibling.mkdir()
        victim = sibling / "keep.txt"
        victim.write_bytes(b"keep")

        response = admin_client.delete(
            PERMANENT_DELETE_URL, params={"trash_path": str(victim)}
        )

        assert response.status_code == 400
        assert victim.exists()


class TestMoveDirectoryRollback:
    def test_failed_metadata_write_moves_directory_back(self, storage, monkeypatch):
        source = _study_dir(storage)

        def _fail(*args, **kwargs):
            raise OSError("disk full")

        monkeypatch.setattr(
            "app.services.file_management_service._write_metadata", _fail
        )

        with pytest.raises(OSError, match="disk full"):
            FileManagementService().move_directory_to_trash(str(source), "imaging_7_x")

        assert (source / "1.2.3.4" / "a.dcm").read_bytes() == b"a" * 10
        assert not any(settings.TRASH_DIR.rglob("imaging_7_x*"))


class TestTrashRetention:
    def _age(self, path: Path, days: int) -> None:
        old = (datetime.now() - timedelta(days=days)).timestamp()
        for p in [path, *path.rglob("*")]:
            os.utime(p, (old, old))

    def test_new_entry_with_old_files_is_kept(self, storage):
        source = _study_dir(storage)
        self._age(source, settings.TRASH_RETENTION_DAYS + 30)
        trashed = FileManagementService().move_directory_to_trash(
            str(source), trash_name="imaging_7_1.2.3"
        )

        stats = FileManagementService().cleanup_old_trash()

        assert stats == {"deleted_files": 0, "deleted_dirs": 0}
        assert (trashed / "1.2.3.4" / "a.dcm").exists()
        assert FileManagementService().is_trashed_directory(trashed)

    def test_expired_day_folder_is_removed_whole(self, storage):
        trashed = _trash(storage)
        expired = settings.TRASH_DIR / (
            datetime.now() - timedelta(days=settings.TRASH_RETENTION_DAYS + 1)
        ).strftime("%Y-%m-%d")
        trashed.parent.rename(expired)

        stats = FileManagementService().cleanup_old_trash()

        assert stats == {"deleted_files": 3, "deleted_dirs": 1}
        assert not expired.exists()

    def test_old_file_outside_day_folders_is_removed(self, storage):
        stray = settings.TRASH_DIR / "legacy" / "old.pdf"
        stray.parent.mkdir()
        stray.write_bytes(b"x")
        self._age(stray, settings.TRASH_RETENTION_DAYS + 1)

        stats = FileManagementService().cleanup_old_trash()

        assert stats["deleted_files"] == 1
        assert not stray.exists()


class TestTrashedDirectorySize:
    def test_listing_uses_the_size_recorded_at_trash_time(self, storage):
        trashed = _trash(storage)
        (trashed / "1.2.3.4" / "a.dcm").unlink()  # the walk would now say 5

        [entry] = FileManagementService().list_trash_contents()

        assert entry["size_bytes"] == 15
