"""
Deleting a record cleans up its attached files.

Covers each record's own DELETE endpoint (#1272) and the deletes that bypass it
(#1277): admin single and bulk deletes, patient deletes and account deletes, where
the ORM cascade removes the records but nothing cascades to their files.

Local files move to trash and their EntityFile rows are removed. Paperless and
Papra documents stay in those services; only the link is removed.
"""

import io
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils.stored_files import resolve_stored_file
from app.crud.encounter import encounter as encounter_crud
from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.models.models import (
    EntityFile,
    LabResult,
    LabResultFile,
    Patient,
    get_utc_now,
)
from app.schemas.encounter import EncounterCreate
from app.schemas.medication import MedicationCreate
from app.schemas.patient import PatientCreate
from app.services.attachment_cleanup import (
    cleanup_attachments,
    find_patient_attachments,
)
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


def _create_owned_patient(db_session, owner_id):
    """A second patient of the owner, made the way patient management makes one."""
    record = Patient(
        owner_user_id=owner_id,
        user_id=owner_id,
        is_self_record=False,
        first_name="Family",
        last_name="Member",
        birth_date=date(2015, 1, 1),
    )
    db_session.add(record)
    db_session.commit()
    return record


def _create_lab_result(db_session, patient_id):
    record = LabResult(patient_id=patient_id, test_name="Panel", status="completed")
    db_session.add(record)
    db_session.commit()
    return record


def _legacy_lab_file(db_session, trash_dir, lab_result_id, content, stored=None):
    """A LabResultFile row; ``stored`` reuses an existing file instead of a new one."""
    if stored is None:
        stored = trash_dir.parent / "lab_result_files" / f"legacy_{lab_result_id}.txt"
        stored.parent.mkdir(parents=True, exist_ok=True)
        stored.write_bytes(content)
    record = LabResultFile(
        lab_result_id=lab_result_id,
        file_name=stored.name,
        file_path=str(stored),
        file_type="text/plain",
        uploaded_at=datetime.now(),
    )
    db_session.add(record)
    db_session.commit()
    return stored


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


class TestPatientDeleteFileCleanup:
    def test_patient_delete_cleans_up_files_of_all_its_records(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        doomed = _create_owned_patient(db_session, user_with_patient["user"].id)
        med = _create_medication(db_session, doomed.id)
        visit = encounter_crud.create(
            db_session,
            obj_in=EncounterCreate(
                reason="Checkup", date=date.today(), patient_id=doomed.id
            ),
        )
        lab = _create_lab_result(db_session, doomed.id)
        file_ids = [
            _upload(client, authenticated_headers, "medication", med.id, b"med"),
            _upload(client, authenticated_headers, "visit", visit.id, b"visit"),
            _upload(client, authenticated_headers, "lab-result", lab.id, b"lab"),
            _remote_file(db_session, "medication", med.id, "paperless"),
        ]
        legacy_path = _legacy_lab_file(db_session, trash, lab.id, b"legacy")
        sibling_med = _create_medication(db_session, user_with_patient["patient"].id)
        sibling_file = _upload(
            client, authenticated_headers, "medication", sibling_med.id, b"sibling"
        )

        resp = client.delete(
            f"/api/v1/patient-management/{doomed.id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert all(db_session.get(EntityFile, i) is None for i in file_ids)
        assert not legacy_path.exists()
        assert _trashed_contents(trash) == [b"lab", b"legacy", b"med", b"visit"]
        assert _stored_path(db_session, sibling_file).read_bytes() == b"sibling"

    def test_delete_by_non_owner_leaves_files(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        patient = user_with_patient["patient"]
        med = _create_medication(db_session, patient.id)
        file_id = _upload(client, authenticated_headers, "medication", med.id, b"mine")
        other = create_random_user(db_session)

        resp = client.delete(
            f"/api/v1/patient-management/{patient.id}",
            headers=create_user_token_headers(other["user"].username),
        )

        assert resp.status_code == 403
        db_session.expire_all()
        assert _stored_path(db_session, file_id).read_bytes() == b"mine"
        assert _trashed_contents(trash) == []


class TestAccountDeleteFileCleanup:
    def test_account_delete_cleans_up_files_of_every_owned_patient(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        test_admin_user,
        trash,
    ):
        med = _create_medication(db_session, user_with_patient["patient"].id)
        family = _create_owned_patient(db_session, user_with_patient["user"].id)
        family_med = _create_medication(db_session, family.id)
        file_ids = [
            _upload(client, authenticated_headers, "medication", med.id, b"med"),
            _upload(
                client, authenticated_headers, "medication", family_med.id, b"family"
            ),
        ]

        resp = client.delete("/api/v1/users/me", headers=authenticated_headers)

        assert resp.status_code == 200
        db_session.expire_all()
        assert all(db_session.get(EntityFile, i) is None for i in file_ids)
        assert _trashed_contents(trash) == [b"family", b"med"]


class TestAdminDeleteFileCleanup:
    def test_single_delete_cleans_up_only_that_records_files(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        admin_token_headers,
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

        resp = client.delete(
            f"/api/v1/admin/models/medication/{doomed.id}", headers=admin_token_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert db_session.get(EntityFile, doomed_file) is None
        assert _trashed_contents(trash) == [b"doomed"]
        assert _stored_path(db_session, kept_file).read_bytes() == b"kept"

    def test_failed_single_delete_leaves_files(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        admin_token_headers,
        trash,
        monkeypatch,
    ):
        med = _create_medication(db_session, user_with_patient["patient"].id)
        file_id = _upload(client, authenticated_headers, "medication", med.id, b"mine")

        def fail_delete(*args, **kwargs):
            raise RuntimeError("delete failed")

        monkeypatch.setattr(medication_crud, "delete", fail_delete)

        resp = client.delete(
            f"/api/v1/admin/models/medication/{med.id}", headers=admin_token_headers
        )

        assert resp.status_code == 500
        db_session.expire_all()
        assert _stored_path(db_session, file_id).read_bytes() == b"mine"
        assert _trashed_contents(trash) == []

    def test_user_delete_cleans_up_their_patients_files(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        admin_token_headers,
        trash,
    ):
        user = user_with_patient["user"]
        med = _create_medication(db_session, user_with_patient["patient"].id)
        family = _create_owned_patient(db_session, user.id)
        family_med = _create_medication(db_session, family.id)
        file_ids = [
            _upload(client, authenticated_headers, "medication", med.id, b"med"),
            _upload(
                client, authenticated_headers, "medication", family_med.id, b"family"
            ),
        ]

        resp = client.delete(
            f"/api/v1/admin/models/user/{user.id}", headers=admin_token_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert all(db_session.get(EntityFile, i) is None for i in file_ids)
        assert _trashed_contents(trash) == [b"family", b"med"]

    def test_file_record_delete_trashes_its_stored_file(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        admin_token_headers,
        trash,
    ):
        med = _create_medication(db_session, user_with_patient["patient"].id)
        file_id = _upload(client, authenticated_headers, "medication", med.id, b"med")

        resp = client.delete(
            f"/api/v1/admin/models/entity_file/{file_id}", headers=admin_token_headers
        )

        assert resp.status_code == 200
        assert _trashed_contents(trash) == [b"med"]

    def test_file_record_delete_keeps_a_file_its_copy_still_uses(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        admin_token_headers,
        trash,
    ):
        # A legacy lab result file copied to an EntityFile shares its stored file
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        file_id = _upload(client, authenticated_headers, "lab-result", lab.id, b"lab")
        _legacy_lab_file(
            db_session, trash, lab.id, b"", stored=_stored_path(db_session, file_id)
        )
        legacy_id = (
            db_session.query(LabResultFile.id)
            .filter(LabResultFile.lab_result_id == lab.id)
            .scalar()
        )

        resp = client.delete(
            f"/api/v1/admin/models/lab_result_file/{legacy_id}",
            headers=admin_token_headers,
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert _stored_path(db_session, file_id).read_bytes() == b"lab"
        assert _trashed_contents(trash) == []

    def test_bulk_delete_cleans_up_files_of_every_record(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        admin_token_headers,
        trash,
    ):
        patient_id = user_with_patient["patient"].id
        meds = [_create_medication(db_session, patient_id) for _ in range(2)]
        file_ids = [
            _upload(client, authenticated_headers, "medication", med.id, content)
            for med, content in zip(meds, (b"first", b"second"))
        ]

        resp = client.post(
            "/api/v1/admin/bulk/delete",
            headers=admin_token_headers,
            json={"model_name": "medication", "record_ids": [m.id for m in meds]},
        )

        assert resp.status_code == 200
        assert resp.json()["affected_records"] == 2
        db_session.expire_all()
        assert all(db_session.get(EntityFile, i) is None for i in file_ids)
        assert _trashed_contents(trash) == [b"first", b"second"]


class TestCleanupAttachments:
    def test_legacy_file_copied_to_an_entity_file_is_trashed_once(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        patient_id = user_with_patient["patient"].id
        lab = _create_lab_result(db_session, patient_id)
        file_id = _upload(client, authenticated_headers, "lab-result", lab.id, b"lab")
        _legacy_lab_file(
            db_session, trash, lab.id, b"", stored=_stored_path(db_session, file_id)
        )
        pending = find_patient_attachments(db_session, [patient_id])
        db_session.delete(lab)
        db_session.commit()

        stats = cleanup_attachments(db_session, pending, reason="test")

        assert stats == {"files_deleted": 1, "files_preserved": 0, "errors": 0}
        assert _trashed_contents(trash) == [b"lab"]
