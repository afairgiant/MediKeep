"""Regression tests for GHSA-876g-4mgh-cqhf (stored file path traversal).

File records must only ever be read, moved or deleted inside the upload and
trash directories, whatever path ends up in the database.
"""

import io
import json
import os
from datetime import date
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils import stored_files
from app.core.utils.stored_files import resolve_storage_path, resolve_stored_file
from app.crud.lab_result import lab_result as lab_result_crud
from app.models.models import EntityFile, LabResultFile
from app.schemas.lab_result import LabResultCreate
from app.services.export_service import ExportService
from app.services.file_management_service import FileManagementService

SECRET = b"outside-storage-secret"


@pytest.fixture
def storage(tmp_path, monkeypatch):
    """Point UPLOAD_DIR and TRASH_DIR at tmp_path/uploads and run from tmp_path."""
    uploads = tmp_path / "uploads"
    trash = uploads / "trash"
    trash.mkdir(parents=True)
    monkeypatch.setattr(settings, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(settings, "TRASH_DIR", trash)
    monkeypatch.chdir(tmp_path)
    return tmp_path


@pytest.fixture
def outside_file(tmp_path):
    secret = tmp_path / "outside" / "secret.txt"
    secret.parent.mkdir()
    secret.write_bytes(SECRET)
    return secret


@pytest.fixture
def lab_result(db_session: Session, user_with_patient):
    return lab_result_crud.create(
        db_session,
        obj_in=LabResultCreate(
            test_name="Panel",
            completed_date=date.today(),
            status="completed",
            patient_id=user_with_patient["patient"].id,
        ),
    )


def _poison(db_session, model, file_id, path):
    record = db_session.query(model).filter(model.id == file_id).one()
    record.file_path = str(path)
    db_session.commit()


class TestResolveStoragePath:
    @pytest.mark.parametrize(
        "path",
        [
            "uploads/files/lab-results/a.txt",
            "./uploads/a.txt",
            "uploads/trash/2026-01-01/a.txt",
            "uploads/files/../a.txt",
        ],
    )
    def test_accepts_paths_inside_storage(self, storage, path):
        assert resolve_storage_path(path) == (storage / path).resolve()

    def test_accepts_absolute_paths_inside_storage(self, storage):
        path = storage / "uploads" / "files" / "a.txt"
        assert resolve_storage_path(str(path)) == path.resolve()

    @pytest.mark.parametrize(
        "path",
        [
            None,
            "",
            "outside/secret.txt",
            "uploads/../outside/secret.txt",
            "uploads/files/../../outside/secret.txt",
            "uploads2/a.txt",
            "uploads",
            "uploads/trash",
            "uploads/a\x00.txt",
        ],
    )
    def test_rejects_paths_outside_storage(self, storage, path):
        assert resolve_storage_path(path) is None

    def test_rejects_absolute_path_outside_storage(self, storage, outside_file):
        assert resolve_storage_path(str(outside_file)) is None

    def test_rejects_symlink_leaving_storage(self, storage, outside_file):
        link = storage / "uploads" / "link.txt"
        try:
            os.symlink(outside_file, link)
        except (OSError, NotImplementedError):
            pytest.skip("Symlinks are not available on this system")
        assert resolve_storage_path(str(link)) is None


class TestResolveStoredFile:
    def test_logs_security_event_for_escaping_path(self, storage, outside_file):
        record = LabResultFile(id=7, file_path=str(outside_file))
        with patch.object(stored_files.security_logger, "warning") as warning:
            assert resolve_stored_file(record) is None
        extra = warning.call_args.kwargs["extra"]
        assert extra["event"] == "stored_file_path_rejected"
        assert extra["record_id"] == 7
        assert str(outside_file) not in str(warning.call_args)

    def test_logs_unknown_uri_schemes(self, storage):
        record = EntityFile(id=2, file_path="file:///etc/passwd")
        with patch.object(stored_files.security_logger, "warning") as warning:
            assert resolve_stored_file(record) is None
        warning.assert_called_once()

    def test_only_returns_existing_regular_files(self, storage):
        (storage / "uploads" / "files").mkdir()
        (storage / "uploads" / "files" / "a.txt").write_bytes(b"a")
        assert resolve_stored_file(EntityFile(id=1, file_path="uploads/files")) is None
        assert (
            resolve_stored_file(EntityFile(id=1, file_path="uploads/missing.txt"))
            is None
        )
        assert resolve_stored_file(EntityFile(id=1, file_path="uploads/files/a.txt"))

    @pytest.mark.parametrize("path", ["paperless://document/3", "papra://doc/3"])
    def test_remote_placeholders_are_not_security_events(self, storage, path):
        record = EntityFile(id=1, file_path=path)
        with patch.object(stored_files.security_logger, "warning") as warning:
            assert resolve_stored_file(record) is None
        warning.assert_not_called()


class TestTrashService:
    def test_move_to_trash_refuses_files_outside_storage(self, storage, outside_file):
        with pytest.raises(Exception, match="outside the storage directories"):
            FileManagementService().move_to_trash(str(outside_file))
        assert outside_file.read_bytes() == SECRET

    def test_move_to_trash_refuses_a_storage_folder(self, storage):
        (storage / "uploads" / "files").mkdir()
        with pytest.raises(Exception):
            FileManagementService().move_to_trash("uploads/files")
        assert (storage / "uploads" / "files").is_dir()

    def test_restore_ignores_original_path_outside_storage(self, storage, outside_file):
        trashed = storage / "uploads" / "trash" / "2026-01-01" / "note.txt"
        trashed.parent.mkdir()
        trashed.write_bytes(b"restored")
        trashed.with_suffix(".txt.meta").write_text(
            json.dumps({"original_path": str(outside_file)})
        )

        result = FileManagementService().restore_from_trash(str(trashed))

        assert Path(result["restored_path"]).parent == settings.UPLOAD_DIR
        assert outside_file.read_bytes() == SECRET

    @pytest.mark.parametrize("restore_to", ["outside/x.txt", "uploads2/x.txt"])
    def test_restore_refuses_restore_path_outside_storage(self, storage, restore_to):
        trashed = storage / "uploads" / "trash" / "2026-01-01" / "note.txt"
        trashed.parent.mkdir()
        trashed.write_bytes(b"restored")

        with pytest.raises(Exception, match="Invalid restore path"):
            FileManagementService().restore_from_trash(str(trashed), restore_to)
        assert trashed.exists()


class TestRemovedRoutes:
    def test_entity_file_status_route_is_gone(self, client, authenticated_headers):
        resp = client.put(
            "/api/v1/entity-files/files/1/status",
            headers=authenticated_headers,
            data={"actual_file_path": "/etc/passwd"},
        )
        assert resp.status_code in (404, 405)

    def test_entity_file_pending_route_is_gone(
        self, client, authenticated_headers, lab_result
    ):
        resp = client.post(
            f"/api/v1/entity-files/lab-result/{lab_result.id}/files/pending",
            headers=authenticated_headers,
            data={"file_name": "a.txt", "file_size": 1, "file_type": "text/plain"},
        )
        assert resp.status_code in (404, 405)

    def test_lab_result_file_create_route_is_gone(
        self, client, authenticated_headers, lab_result
    ):
        resp = client.post(
            "/api/v1/lab-result-files/",
            headers=authenticated_headers,
            json={
                "lab_result_id": lab_result.id,
                "file_name": "a.txt",
                "file_path": "/etc/passwd",
            },
        )
        assert resp.status_code == 405

    def test_lab_result_file_update_route_is_gone(self, client, authenticated_headers):
        resp = client.put(
            "/api/v1/lab-result-files/1",
            headers=authenticated_headers,
            json={"file_path": "/etc/passwd"},
        )
        assert resp.status_code == 405


class TestPoisonedEntityFile:
    @pytest.fixture
    def file_id(self, client, authenticated_headers, lab_result):
        resp = client.post(
            f"/api/v1/entity-files/lab-result/{lab_result.id}/files",
            headers=authenticated_headers,
            files={"file": ("note.txt", io.BytesIO(b"note"), "text/plain")},
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_normal_file_still_downloads(self, client, authenticated_headers, file_id):
        resp = client.get(
            f"/api/v1/entity-files/files/{file_id}/download",
            headers=authenticated_headers,
        )
        assert resp.status_code == 200
        assert resp.content == b"note"

    @pytest.mark.parametrize("endpoint", ["download", "view"])
    def test_read_is_refused(
        self, client, db_session, authenticated_headers, file_id, outside_file, endpoint
    ):
        _poison(db_session, EntityFile, file_id, outside_file)

        resp = client.get(
            f"/api/v1/entity-files/files/{file_id}/{endpoint}",
            headers=authenticated_headers,
        )

        assert resp.status_code == 404
        assert SECRET not in resp.content

    def test_delete_removes_record_but_not_the_outside_file(
        self, client, db_session, authenticated_headers, file_id, outside_file
    ):
        _poison(db_session, EntityFile, file_id, outside_file)

        resp = client.delete(
            f"/api/v1/entity-files/files/{file_id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        assert outside_file.read_bytes() == SECRET
        db_session.expire_all()
        assert db_session.get(EntityFile, file_id) is None


class TestPoisonedLabResultFile:
    @pytest.fixture
    def file_id(self, client, authenticated_headers, lab_result):
        resp = client.post(
            f"/api/v1/lab-result-files/upload/{lab_result.id}",
            headers=authenticated_headers,
            files={"file": ("note.txt", io.BytesIO(b"note"), "text/plain")},
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_normal_file_still_downloads(self, client, authenticated_headers, file_id):
        resp = client.get(
            f"/api/v1/lab-result-files/{file_id}/download",
            headers=authenticated_headers,
        )
        assert resp.status_code == 200
        assert resp.content == b"note"

    def test_download_is_refused(
        self, client, db_session, authenticated_headers, file_id, outside_file
    ):
        _poison(db_session, LabResultFile, file_id, outside_file)

        resp = client.get(
            f"/api/v1/lab-result-files/{file_id}/download",
            headers=authenticated_headers,
        )

        assert resp.status_code == 404
        assert SECRET not in resp.content

    def test_delete_leaves_outside_file(
        self, client, db_session, authenticated_headers, file_id, outside_file
    ):
        _poison(db_session, LabResultFile, file_id, outside_file)

        resp = client.delete(
            f"/api/v1/lab-result-files/{file_id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        assert outside_file.read_bytes() == SECRET

    def test_batch_delete_leaves_outside_file(
        self, client, db_session, authenticated_headers, file_id, outside_file
    ):
        _poison(db_session, LabResultFile, file_id, outside_file)

        resp = client.post(
            "/api/v1/lab-result-files/batch-operation",
            headers=authenticated_headers,
            json={"file_ids": [file_id], "operation": "delete"},
        )

        assert resp.status_code == 200
        assert outside_file.read_bytes() == SECRET

    def test_delete_all_removes_records_and_leaves_outside_file(
        self,
        client,
        db_session,
        authenticated_headers,
        lab_result,
        file_id,
        outside_file,
    ):
        _poison(db_session, LabResultFile, file_id, outside_file)

        resp = client.delete(
            f"/api/v1/lab-result-files/lab-result/{lab_result.id}/files",
            headers=authenticated_headers,
        )

        assert resp.status_code == 200
        assert resp.json()["deleted_records"] == 1
        assert outside_file.read_bytes() == SECRET

    def test_export_leaves_out_poisoned_file(
        self, db_session, user_with_patient, file_id, outside_file
    ):
        _poison(db_session, LabResultFile, file_id, outside_file)

        files = ExportService(db_session).get_lab_result_files(
            user_with_patient["user"].id, None, None
        )

        assert files == []


class TestAdminFilePathGuard:
    @pytest.fixture
    def file_id(self, client, authenticated_headers, lab_result):
        resp = client.post(
            f"/api/v1/entity-files/lab-result/{lab_result.id}/files",
            headers=authenticated_headers,
            files={"file": ("note.txt", io.BytesIO(b"note"), "text/plain")},
        )
        return resp.json()["id"]

    def _update(self, client, headers, file_id, data):
        return client.put(
            f"/api/v1/admin/models/entity_file/{file_id}", headers=headers, json=data
        )

    def test_rejects_path_outside_storage(
        self, client, db_session, admin_token_headers, file_id, outside_file
    ):
        resp = self._update(
            client, admin_token_headers, file_id, {"file_path": str(outside_file)}
        )

        assert resp.status_code == 400
        db_session.expire_all()
        assert db_session.get(EntityFile, file_id).file_path != str(outside_file)

    def test_allows_unchanged_path_with_other_edits(
        self, client, db_session, admin_token_headers, file_id
    ):
        current = db_session.get(EntityFile, file_id).file_path
        resp = self._update(
            client,
            admin_token_headers,
            file_id,
            {"file_path": current, "description": "edited"},
        )
        assert resp.status_code == 200

    @pytest.mark.parametrize(
        "path_under_uploads", [True, False], ids=["inside-uploads", "paperless"]
    )
    def test_allows_repair_inside_storage_or_remote_placeholder(
        self, client, admin_token_headers, file_id, path_under_uploads
    ):
        new_path = (
            str(Path(settings.UPLOAD_DIR) / "files" / "moved.txt")
            if path_under_uploads
            else "paperless://document/9"
        )
        resp = self._update(
            client, admin_token_headers, file_id, {"file_path": new_path}
        )
        assert resp.status_code == 200

    def test_create_rejects_path_outside_storage(
        self, client, admin_token_headers, lab_result, outside_file
    ):
        resp = client.post(
            "/api/v1/admin/models/lab_result_file/",
            headers=admin_token_headers,
            json={
                "lab_result_id": lab_result.id,
                "file_name": "secret.txt",
                "file_path": str(outside_file),
                "file_type": "text/plain",
            },
        )
        assert resp.status_code == 400
