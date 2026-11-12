"""Exception text must not reach a client through a returned payload (issue #1200).

These paths build their response without raising an HTTPException from the
handler: they collect an error string and return or raise it later, or return a
dict directly. Each test makes the underlying operation fail with a recognisable
cause and checks it is absent from what the client receives and present in what
is logged.
"""

import io
import json
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import app.api.v1.endpoints.lab_result_file as lab_result_file_module
from app.api.v1.admin.dashboard import _log_check_failure
from app.api.v1.endpoints.export import ExportService
from app.crud.lab_result import lab_result as lab_result_crud
from app.crud.patient import patient as patient_crud
from app.schemas.lab_result import LabResultCreate
from app.schemas.patient import PatientCreate
from app.services.backup_service import BackupService
from app.services.restore_service import RestoreService
from tests.utils.log_output import persisted_entries
from tests.utils.user import create_random_user, create_user_token_headers

# Looks like what an attacker wants to read back from the server.
CAUSE = "CAUSE-DETAIL /srv/medikeep/uploads/jane_doe_hiv_panel.pdf SELECT * FROM users"


def _records_containing_cause(caplog):
    """Entries as app.log stores them that carry the cause (message or error field)."""
    return [
        entry
        for entry in persisted_entries(caplog)
        if CAUSE in entry["message"] or CAUSE in entry.get("error", "")
    ]


class TestBulkExportFailureDoesNotEchoTheCause:
    def test_every_scope_failing_returns_a_fixed_reason(
        self, authenticated_client, monkeypatch, caplog
    ):
        async def explode(self, *args, **kwargs):
            raise RuntimeError(CAUSE)

        monkeypatch.setattr(ExportService, "export_patient_data", explode)

        with caplog.at_level("WARNING"):
            response = authenticated_client.post(
                "/api/v1/export/bulk",
                json={"scopes": ["allergies", "conditions"], "format": "json"},
            )

        assert response.status_code == 400
        assert response.json()["message"].startswith("Export failed")
        assert CAUSE not in response.text
        assert "jane_doe" not in response.text
        assert _records_containing_cause(caplog)


class TestRestorePreviewDoesNotEchoTheCause:
    @pytest.mark.asyncio
    async def test_database_preview_failure(self, db_session, monkeypatch):
        service = RestoreService(db_session)

        async def explode(*args, **kwargs):
            raise RuntimeError(CAUSE)

        monkeypatch.setattr(service, "_get_database_stats", explode)

        preview = await service._preview_database_restore(Path("/backups/db.sql"))

        assert CAUSE not in json.dumps(preview)
        assert preview["affected_data"]["error"] == "Backup analysis failed"
        assert preview["warnings"]

    @pytest.mark.asyncio
    async def test_files_preview_failure(self, db_session):
        """A backup that cannot be opened: the ZIP error names the server path."""
        service = RestoreService(db_session)
        missing = Path("/srv/medikeep/backups/jane_doe_secret.zip")

        preview = await service._preview_files_restore(missing)

        assert "jane_doe_secret" not in json.dumps(preview)
        assert "/srv/medikeep" not in json.dumps(preview)
        assert preview["affected_data"]["error"] == "Backup analysis failed"

    @pytest.mark.asyncio
    async def test_unreadable_sql_backup(self, db_session):
        service = RestoreService(db_session)

        result = await service._analyze_sql_backup(Path("/srv/medikeep/secret.sql"))

        assert result == {"error": "Could not analyze the SQL backup"}


class TestDashboardHealthFailureDoesNotEchoTheCause:
    def test_helper_returns_fixed_text_and_logs_the_cause(self, caplog):
        with caplog.at_level("ERROR"):
            text = _log_check_failure(RuntimeError(CAUSE), "api")

        assert CAUSE not in text
        assert "server logs" in text
        # In the message, so it is in the persisted log file whatever the formatter does.
        assert any(CAUSE in record.getMessage() for record in caplog.records)


def _owner_with_uploaded_file(db_session: Session, client: TestClient):
    user_data = create_random_user(db_session)
    patient = patient_crud.create_for_user(
        db_session,
        user_id=user_data["user"].id,
        patient_data=PatientCreate(
            first_name="Owner",
            last_name="Tester",
            birth_date=date(1988, 3, 3),
            gender="M",
        ),
    )
    user_data["user"].active_patient_id = patient.id
    db_session.commit()
    db_session.refresh(user_data["user"])
    headers = create_user_token_headers(user_data["user"].username)
    lab_result = lab_result_crud.create(
        db_session,
        obj_in=LabResultCreate(
            test_name="Panel",
            completed_date=date.today(),
            status="completed",
            patient_id=patient.id,
        ),
    )
    upload = client.post(
        f"/api/v1/lab-result-files/upload/{lab_result.id}",
        headers=headers,
        files={"file": ("panel.txt", io.BytesIO(b"RESULT"), "text/plain")},
    )
    assert upload.status_code == 201
    return headers, lab_result.id


class TestLabResultFileDeleteDoesNotEchoTheCause:
    def test_failed_file_removal_is_logged_not_returned(
        self, db_session, client, monkeypatch, caplog
    ):
        headers, lab_result_id = _owner_with_uploaded_file(db_session, client)

        def explode(file_obj):
            raise OSError(CAUSE)

        monkeypatch.setattr(lab_result_file_module, "_remove_physical_file", explode)

        with caplog.at_level("ERROR"):
            response = client.delete(
                f"/api/v1/lab-result-files/lab-result/{lab_result_id}/files",
                headers=headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["errors"], "the failure should still be reported to the client"
        assert CAUSE not in response.text
        assert "jane_doe" not in response.text
        assert _records_containing_cause(caplog)

    def test_helper_adds_a_line_without_the_cause(self, caplog):
        errors: list = []
        user = type("User", (), {"id": 7})()

        with caplog.at_level("ERROR"):
            lab_result_file_module._record_file_failure(
                errors, "Error deleting file x.pdf", OSError(CAUSE), user
            )

        assert errors == ["Error deleting file x.pdf"]
        assert _records_containing_cause(caplog)


class TestBackupCleanupDoesNotEchoTheCause:
    """The admin clean-up endpoints return the service's `errors` list as is."""

    @pytest.mark.asyncio
    async def test_failed_orphan_deletion_is_logged_not_returned(
        self, db_session, tmp_path, monkeypatch, caplog
    ):
        orphan = tmp_path / "jane_doe_database_backup.sql"
        orphan.write_text("-- backup")
        service = BackupService(db_session)
        service.backup_dir = tmp_path

        def refuse(self, *args, **kwargs):
            raise PermissionError(f"{CAUSE} ({self})")

        with caplog.at_level("ERROR"):
            with monkeypatch.context() as scoped:
                scoped.setattr(Path, "unlink", refuse)
                result = await service.cleanup_orphaned_files()

        assert result["orphaned_deleted"] == 0
        # The file matches more than one glob pattern, so it can be reported twice.
        assert result["errors"]
        assert set(result["errors"]) == {
            "Failed to delete orphaned file jane_doe_database_backup.sql"
        }
        assert CAUSE not in json.dumps(result)
        assert str(tmp_path) not in json.dumps(result), "the server path stays out too"
        assert _records_containing_cause(caplog)
