"""
Deleting a record cleans up its attached files (#1272).

Local files move to trash and their EntityFile rows are removed. Paperless and
Papra documents stay in those services; only the link is removed.
"""

import io
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils.stored_files import resolve_stored_file
from app.crud.encounter import encounter as encounter_crud
from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.models.models import EntityFile, get_utc_now
from app.schemas.encounter import EncounterCreate
from app.schemas.medication import MedicationCreate
from app.schemas.patient import PatientCreate
from app.services.generic_entity_file_service import GenericEntityFileService
from tests.utils.user import create_random_user, create_user_token_headers


@pytest.fixture
def trash(tmp_path, monkeypatch):
    """Point UPLOAD_DIR and TRASH_DIR at tmp_path and return the trash folder."""
    uploads = tmp_path / "uploads"
    trash_dir = uploads / "trash"
    trash_dir.mkdir(parents=True)
    monkeypatch.setattr(settings, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(settings, "TRASH_DIR", trash_dir)
    monkeypatch.chdir(tmp_path)
    return trash_dir


def _create_medication(db_session, patient_id):
    return medication_crud.create(
        db_session,
        obj_in=MedicationCreate(
            medication_name="Test Med",
            dosage="100mg",
            status="active",
            patient_id=patient_id,
        ),
    )


def _upload(client, headers, entity_type, entity_id, content):
    resp = client.post(
        f"/api/v1/entity-files/{entity_type}/{entity_id}/files",
        headers=headers,
        files={"file": ("note.txt", io.BytesIO(content), "text/plain")},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _stored_path(db_session, file_id):
    path = resolve_stored_file(db_session.get(EntityFile, file_id))
    assert path is not None
    return path


def _trashed_contents(trash_dir):
    """Contents of the trashed .txt uploads (skips the trash's metadata files)."""
    return sorted(p.read_bytes() for p in trash_dir.rglob("*.txt"))


def _remote_file(db_session, entity_type, entity_id, backend):
    record = EntityFile(
        entity_type=entity_type,
        entity_id=entity_id,
        file_name="report.pdf",
        file_path=f"{backend}://",
        file_type="application/pdf",
        file_size=1024,
        uploaded_at=get_utc_now(),
        storage_backend=backend,
        sync_status="synced",
        **{f"{backend}_document_id": "42"},
    )
    db_session.add(record)
    db_session.commit()
    return record.id


class TestRecordDeleteFileCleanup:
    def test_medication_delete_trashes_only_its_own_files(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        patient_id = user_with_patient["patient"].id
        doomed = _create_medication(db_session, patient_id)
        kept = _create_medication(db_session, patient_id)
        doomed_file = _upload(
            client, authenticated_headers, "medication", doomed.id, b"doomed"
        )
        kept_file = _upload(
            client, authenticated_headers, "medication", kept.id, b"kept"
        )
        doomed_path = _stored_path(db_session, doomed_file)
        kept_path = _stored_path(db_session, kept_file)

        resp = client.delete(
            f"/api/v1/medications/{doomed.id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert db_session.get(EntityFile, doomed_file) is None
        assert not doomed_path.exists()
        assert _trashed_contents(trash) == [b"doomed"]
        assert db_session.get(EntityFile, kept_file) is not None
        assert kept_path.read_bytes() == b"kept"

    def test_encounter_delete_cleans_up_visit_and_encounter_files(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        # The visit pages upload as "visit"; the API also accepts "encounter".
        visit = encounter_crud.create(
            db_session,
            obj_in=EncounterCreate(
                reason="Checkup",
                date=date.today(),
                patient_id=user_with_patient["patient"].id,
            ),
        )
        file_ids = [
            _upload(client, authenticated_headers, "visit", visit.id, b"as-visit"),
            _upload(
                client, authenticated_headers, "encounter", visit.id, b"as-encounter"
            ),
        ]

        resp = client.delete(
            f"/api/v1/encounters/{visit.id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert all(db_session.get(EntityFile, i) is None for i in file_ids)
        assert _trashed_contents(trash) == [b"as-encounter", b"as-visit"]

    def test_delete_without_access_leaves_files(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        med = _create_medication(db_session, user_with_patient["patient"].id)
        file_id = _upload(client, authenticated_headers, "medication", med.id, b"mine")
        path = _stored_path(db_session, file_id)

        other = create_random_user(db_session)
        other_patient = patient_crud.create_for_user(
            db_session,
            user_id=other["user"].id,
            patient_data=PatientCreate(
                first_name="Other",
                last_name="User",
                birth_date=date(1990, 1, 1),
                gender="F",
            ),
        )
        other["user"].active_patient_id = other_patient.id
        db_session.commit()

        resp = client.delete(
            f"/api/v1/medications/{med.id}",
            headers=create_user_token_headers(other["user"].username),
        )

        assert resp.status_code == 404
        db_session.expire_all()
        assert db_session.get(EntityFile, file_id) is not None
        assert path.read_bytes() == b"mine"
        assert _trashed_contents(trash) == []


class TestCleanupEntityFilesOnDeletion:
    def test_remote_documents_are_unlinked_not_trashed(self, db_session, trash):
        file_ids = [
            _remote_file(db_session, "medication", 7, "paperless"),
            _remote_file(db_session, "medication", 7, "papra"),
        ]

        stats = GenericEntityFileService().cleanup_entity_files_on_deletion(
            db=db_session, entity_type="medication", entity_id=7
        )

        assert stats == {"files_deleted": 0, "files_preserved": 2, "errors": 0}
        db_session.expire_all()
        assert all(db_session.get(EntityFile, i) is None for i in file_ids)
        assert _trashed_contents(trash) == []
