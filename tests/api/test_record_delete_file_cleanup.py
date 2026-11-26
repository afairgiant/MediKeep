"""
Deleting a record cleans up its attached files.

Covers each record's own DELETE endpoint (#1272) and the deletes that bypass it
(#1277): admin single and bulk deletes, patient deletes and account deletes, where
the ORM cascade removes the records but nothing cascades to their files.

Local files move to trash and their EntityFile rows are removed. Paperless and
Papra documents stay in those services; only the link is removed.
"""

import io
import os
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils.stored_files import resolve_stored_file
from app.crud.encounter import encounter as encounter_crud
from app.crud.lab_result_file import lab_result_file as lab_result_file_crud
from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.models.models import (
    EntityFile,
    ImagingStudy,
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
    find_record_attachments,
)
from app.services.file_management_service import (
    FileManagementService,
    _metadata_path,
)
from app.services.generic_entity_file_service import GenericEntityFileService
from app.services.imaging_storage import study_directory
from app.services.user_deletion_service import UserDeletionService
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


def _imaging_study_dir(db_session, patient_id, study_uid="1.2.3"):
    """An imaging study row with one stored file; returns its directory."""
    db_session.add(
        ImagingStudy(
            patient_id=patient_id,
            study_instance_uid=study_uid,
            series_count=0,
            instance_count=0,
            total_size=0,
        )
    )
    db_session.commit()
    directory = study_directory(patient_id, study_uid)
    directory.mkdir(parents=True)
    (directory / "image.dcm").write_bytes(b"dicom")
    return directory


class TestImagingStudyFileCleanup:
    """Imaging study folders move to trash, each as one entry, with their patient."""

    def test_patient_delete_removes_its_imaging_folders_only(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        doomed = _create_owned_patient(db_session, user_with_patient["user"].id)
        doomed_dir = _imaging_study_dir(db_session, doomed.id)
        kept_dir = _imaging_study_dir(db_session, user_with_patient["patient"].id)

        resp = client.delete(
            f"/api/v1/patient-management/{doomed.id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        assert not doomed_dir.exists()
        assert kept_dir.is_dir()
        assert [p.read_bytes() for p in trash.rglob("*.dcm")] == [b"dicom"]

    def test_patient_delete_by_non_owner_keeps_imaging_folders(
        self, client: TestClient, db_session: Session, user_with_patient, trash
    ):
        patient = user_with_patient["patient"]
        directory = _imaging_study_dir(db_session, patient.id)
        other = create_random_user(db_session)

        resp = client.delete(
            f"/api/v1/patient-management/{patient.id}",
            headers=create_user_token_headers(other["user"].username),
        )

        assert resp.status_code == 403
        assert directory.is_dir()

    def test_account_delete_removes_imaging_folders_of_owned_patients(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        test_admin_user,
        trash,
    ):
        family = _create_owned_patient(db_session, user_with_patient["user"].id)
        own_dir = _imaging_study_dir(db_session, user_with_patient["patient"].id)
        family_dir = _imaging_study_dir(db_session, family.id, "4.5.6")

        resp = client.delete("/api/v1/users/me", headers=authenticated_headers)

        assert resp.status_code == 200
        assert not own_dir.exists()
        assert not family_dir.exists()

    def test_admin_patient_delete_removes_imaging_folders(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        admin_token_headers,
        trash,
    ):
        family = _create_owned_patient(db_session, user_with_patient["user"].id)
        directory = _imaging_study_dir(db_session, family.id)

        resp = client.delete(
            f"/api/v1/admin/models/patient/{family.id}", headers=admin_token_headers
        )

        assert resp.status_code == 200
        assert not directory.exists()

    def test_record_lookup_covers_imaging_studies(
        self, db_session: Session, user_with_patient, trash
    ):
        patient_id = user_with_patient["patient"].id
        doomed_dir = _imaging_study_dir(db_session, patient_id)
        kept_dir = _imaging_study_dir(db_session, patient_id, "4.5.6")
        study = (
            db_session.query(ImagingStudy).filter_by(study_instance_uid="1.2.3").one()
        )

        pending = find_record_attachments(db_session, ImagingStudy, [study.id])
        db_session.delete(study)
        db_session.commit()
        stats = cleanup_attachments(db_session, pending, reason="test")

        assert stats["errors"] == 0
        assert not doomed_dir.exists()
        assert kept_dir.is_dir()

    def test_failed_folder_removal_is_counted_as_an_error(
        self, db_session: Session, user_with_patient, trash, monkeypatch
    ):
        patient_id = user_with_patient["patient"].id
        directory = _imaging_study_dir(db_session, patient_id)
        pending = find_patient_attachments(db_session, [patient_id])

        def locked(*args, **kwargs):
            raise PermissionError("file in use")

        monkeypatch.setattr(
            "app.services.imaging_storage.file_management_service.move_directory_to_trash",
            locked,
        )
        stats = cleanup_attachments(db_session, pending, reason="test")

        assert stats["errors"] == 1
        assert directory.is_dir()


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

    def test_account_delete_keeps_files_of_a_patient_transferred_away_meanwhile(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        test_admin_user,
        trash,
        monkeypatch,
    ):
        family = _create_owned_patient(db_session, user_with_patient["user"].id)
        family_med = _create_medication(db_session, family.id)
        file_id = _upload(
            client, authenticated_headers, "medication", family_med.id, b"family"
        )
        new_owner_id = create_random_user(db_session)["user"].id
        validate = UserDeletionService._validate_deletion_allowed

        def transfer_then_validate(self, db, user_id):
            # An admin transfer that commits while the account delete is starting
            db.query(Patient).filter(Patient.id == family.id).update(
                {"user_id": new_owner_id, "owner_user_id": new_owner_id}
            )
            db.commit()
            return validate(self, db, user_id)

        monkeypatch.setattr(
            UserDeletionService, "_validate_deletion_allowed", transfer_then_validate
        )

        resp = client.delete("/api/v1/users/me", headers=authenticated_headers)

        assert resp.status_code == 200
        db_session.expire_all()
        assert db_session.get(Patient, family.id) is not None
        assert _stored_path(db_session, file_id).read_bytes() == b"family"
        assert _trashed_contents(trash) == []


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

    def test_record_delete_keeps_a_legacy_file_another_record_uses(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        admin_token_headers,
        trash,
    ):
        # An admin can point a file row at another record's stored file, and may
        # write the path differently (relative here, absolute on the legacy row)
        patient_id = user_with_patient["patient"].id
        doomed = _create_lab_result(db_session, patient_id)
        stored = _legacy_lab_file(db_session, trash, doomed.id, b"shared")
        kept = _create_medication(db_session, patient_id)
        kept_file = _upload(client, authenticated_headers, "medication", kept.id, b"")
        db_session.get(EntityFile, kept_file).file_path = os.path.relpath(stored)
        db_session.commit()

        resp = client.delete(
            f"/api/v1/admin/models/lab_result/{doomed.id}", headers=admin_token_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert db_session.get(LabResult, doomed.id) is None
        assert stored.read_bytes() == b"shared"
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

    def test_shared_file_check_handles_more_names_than_one_sqlite_query_allows(
        self, db_session: Session, user_with_patient, trash
    ):
        # SQLite rejects an OR of about 1000 file name matches in one query
        patient_id = user_with_patient["patient"].id
        lab = _create_lab_result(db_session, patient_id)
        folder = trash.parent / "lab_result_files"
        folder.mkdir()
        stored = []
        for i in range(1000):
            path = folder / f"legacy_{i:04}.txt"
            path.write_bytes(b"")
            stored.append(path)
        db_session.add_all(
            LabResultFile(
                lab_result_id=lab.id,
                file_name=path.name,
                file_path=str(path),
                file_type="text/plain",
                uploaded_at=datetime.now(),
            )
            for path in stored
        )
        # Another record's row uses the last name, which falls in the last batch
        db_session.add(
            EntityFile(
                entity_type="medication",
                entity_id=_create_medication(db_session, patient_id).id,
                file_name="shared.txt",
                file_path=str(stored[-1]),
                file_type="text/plain",
                file_size=0,
                uploaded_at=get_utc_now(),
                storage_backend="local",
            )
        )
        db_session.commit()

        pending = find_record_attachments(db_session, LabResult, [lab.id])

        assert sorted(pending.local_paths) == stored[:-1]


def _share_stored_file(db_session, file_id, stored):
    """Point an EntityFile row at another row's stored file, as an admin edit can.

    Uses the relative form of the path, so matching must compare resolved paths.
    """
    db_session.get(EntityFile, file_id).file_path = os.path.relpath(stored)
    db_session.commit()


def _legacy_file_ids(db_session, lab_result_id):
    return [
        file_id
        for (file_id,) in db_session.query(LabResultFile.id).filter(
            LabResultFile.lab_result_id == lab_result_id
        )
    ]


@pytest.fixture
def trash_fails_once(monkeypatch):
    """The first move to trash fails; later moves succeed."""
    original = FileManagementService.move_to_trash
    calls = []

    def flaky(self, file_path, reason=None):
        calls.append(file_path)
        if len(calls) == 1:
            raise OSError("first move fails")
        return original(self, file_path, reason=reason)

    monkeypatch.setattr(FileManagementService, "move_to_trash", flaky)


class TestSharedStoredFiles:
    """A stored file stays in place while another file row still points to it (#1296)."""

    def test_record_delete_keeps_a_file_another_record_still_uses(
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
            client, authenticated_headers, "medication", doomed.id, b"shared"
        )
        kept_file = _upload(client, authenticated_headers, "medication", kept.id, b"")
        stored = _stored_path(db_session, doomed_file)
        _share_stored_file(db_session, kept_file, stored)

        resp = client.delete(
            f"/api/v1/medications/{doomed.id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert db_session.get(EntityFile, doomed_file) is None
        assert stored.read_bytes() == b"shared"
        assert _trashed_contents(trash) == []

    def test_rows_of_one_delete_sharing_a_file_trash_it_once(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        med = _create_medication(db_session, user_with_patient["patient"].id)
        first = _upload(client, authenticated_headers, "medication", med.id, b"first")
        second = _upload(client, authenticated_headers, "medication", med.id, b"")
        _share_stored_file(db_session, second, _stored_path(db_session, first))

        stats = GenericEntityFileService().cleanup_entity_files_on_deletion(
            db=db_session, entity_type="medication", entity_id=med.id
        )

        assert stats == {"files_deleted": 1, "files_preserved": 0, "errors": 0}
        db_session.expire_all()
        assert db_session.get(EntityFile, first) is None
        assert db_session.get(EntityFile, second) is None
        assert _trashed_contents(trash) == [b"first"]

    def test_file_delete_keeps_a_file_another_record_still_uses(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        patient_id = user_with_patient["patient"].id
        meds = [_create_medication(db_session, patient_id) for _ in range(2)]
        doomed_file = _upload(
            client, authenticated_headers, "medication", meds[0].id, b"shared"
        )
        kept_file = _upload(
            client, authenticated_headers, "medication", meds[1].id, b""
        )
        stored = _stored_path(db_session, doomed_file)
        _share_stored_file(db_session, kept_file, stored)

        resp = client.delete(
            f"/api/v1/entity-files/files/{doomed_file}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert db_session.get(EntityFile, doomed_file) is None
        assert stored.read_bytes() == b"shared"
        assert _trashed_contents(trash) == []

    def test_deleting_a_migrated_file_also_removes_its_legacy_row(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        # Left behind, the legacy row would be copied back by the startup migration
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        file_id = _upload(client, authenticated_headers, "lab-result", lab.id, b"lab")
        _legacy_lab_file(
            db_session, trash, lab.id, b"", stored=_stored_path(db_session, file_id)
        )

        resp = client.delete(
            f"/api/v1/entity-files/files/{file_id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert db_session.get(EntityFile, file_id) is None
        assert _legacy_file_ids(db_session, lab.id) == []
        assert _trashed_contents(trash) == [b"lab"]

    def test_deleting_a_migrated_file_keeps_another_lab_results_legacy_row(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        patient_id = user_with_patient["patient"].id
        lab = _create_lab_result(db_session, patient_id)
        other_lab = _create_lab_result(db_session, patient_id)
        file_id = _upload(client, authenticated_headers, "lab-result", lab.id, b"lab")
        stored = _stored_path(db_session, file_id)
        _legacy_lab_file(db_session, trash, other_lab.id, b"", stored=stored)

        resp = client.delete(
            f"/api/v1/entity-files/files/{file_id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert len(_legacy_file_ids(db_session, other_lab.id)) == 1
        assert stored.read_bytes() == b"lab"
        assert _trashed_contents(trash) == []

    def test_lab_result_delete_trashes_a_migrated_file_once(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        # Both rows go in this delete, so neither may keep the file for the other
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        file_id = _upload(client, authenticated_headers, "lab-result", lab.id, b"lab")
        _legacy_lab_file(
            db_session, trash, lab.id, b"", stored=_stored_path(db_session, file_id)
        )

        resp = client.delete(
            f"/api/v1/lab-results/{lab.id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        assert resp.json()["files_deleted"] == 1
        db_session.expire_all()
        assert db_session.get(EntityFile, file_id) is None
        assert _legacy_file_ids(db_session, lab.id) == []
        assert _trashed_contents(trash) == [b"lab"]

    def test_legacy_file_delete_keeps_the_file_its_copy_uses(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        file_id = _upload(client, authenticated_headers, "lab-result", lab.id, b"lab")
        stored = _stored_path(db_session, file_id)
        _legacy_lab_file(db_session, trash, lab.id, b"", stored=stored)
        (legacy_id,) = _legacy_file_ids(db_session, lab.id)

        resp = client.delete(
            f"/api/v1/lab-result-files/{legacy_id}", headers=authenticated_headers
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert _legacy_file_ids(db_session, lab.id) == []
        assert stored.read_bytes() == b"lab"


class TestLegacyLabResultFileDeletes:
    """Legacy lab result file deletes move the stored file to trash and never leave it
    behind without a record (#1296)."""

    @pytest.fixture
    def legacy_file(self, db_session: Session, user_with_patient, trash):
        """(lab result id, legacy file id, stored path) of a file no other row uses."""
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        stored = _legacy_lab_file(db_session, trash, lab.id, b"legacy")
        (legacy_id,) = _legacy_file_ids(db_session, lab.id)
        return lab.id, legacy_id, stored

    @pytest.fixture
    def failing_trash(self, monkeypatch):
        def explode(self, file_path, reason=None):
            raise OSError("disk detail")

        # On the class: undoing a patch on the shared instance would leave the
        # original method on it, hiding later class patches from it
        monkeypatch.setattr(FileManagementService, "move_to_trash", explode)

    @pytest.mark.parametrize(
        "url",
        [
            "/api/v1/lab-result-files/{file_id}",
            "/api/v1/lab-results/{lab_id}/files/{file_id}",
        ],
    )
    def test_delete_moves_the_file_to_trash(
        self,
        url,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        legacy_file,
        trash,
    ):
        lab_id, legacy_id, stored = legacy_file

        resp = client.delete(
            url.format(lab_id=lab_id, file_id=legacy_id),
            headers=authenticated_headers,
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert _legacy_file_ids(db_session, lab_id) == []
        assert not stored.exists()
        assert _trashed_contents(trash) == [b"legacy"]

    def test_lab_result_file_delete_keeps_the_file_its_copy_uses(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        file_id = _upload(client, authenticated_headers, "lab-result", lab.id, b"lab")
        stored = _stored_path(db_session, file_id)
        _legacy_lab_file(db_session, trash, lab.id, b"", stored=stored)
        (legacy_id,) = _legacy_file_ids(db_session, lab.id)

        resp = client.delete(
            f"/api/v1/lab-results/{lab.id}/files/{legacy_id}",
            headers=authenticated_headers,
        )

        assert resp.status_code == 200
        db_session.expire_all()
        assert _legacy_file_ids(db_session, lab.id) == []
        assert stored.read_bytes() == b"lab"
        assert _trashed_contents(trash) == []

    def test_failed_move_keeps_the_record(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        legacy_file,
        failing_trash,
    ):
        lab_id, legacy_id, stored = legacy_file

        resp = client.delete(
            f"/api/v1/lab-result-files/{legacy_id}", headers=authenticated_headers
        )

        assert resp.status_code == 500
        assert "disk detail" not in resp.text
        db_session.expire_all()
        assert _legacy_file_ids(db_session, lab_id) == [legacy_id]
        assert stored.read_bytes() == b"legacy"

    def test_failed_move_in_a_batch_keeps_the_record(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        legacy_file,
        failing_trash,
    ):
        lab_id, legacy_id, stored = legacy_file

        resp = client.post(
            "/api/v1/lab-result-files/batch-operation",
            headers=authenticated_headers,
            json={"file_ids": [legacy_id], "operation": "delete"},
        )

        assert resp.status_code == 200
        assert resp.json()["results"] == []
        assert resp.json()["errors"]
        db_session.expire_all()
        assert _legacy_file_ids(db_session, lab_id) == [legacy_id]
        assert stored.read_bytes() == b"legacy"

    def test_failed_move_in_delete_all_keeps_the_record(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        legacy_file,
        trash,
        trash_fails_once,
    ):
        """Each file moves at most once, so a later attempt cannot delete the row
        after the failure was already reported."""
        lab_id, legacy_id, stored = legacy_file

        resp = client.delete(
            f"/api/v1/lab-result-files/lab-result/{lab_id}/files",
            headers=authenticated_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["deleted_records"] == 0
        assert body["deleted_physical_files"] == 0
        assert len(body["errors"]) == 1
        db_session.expire_all()
        assert _legacy_file_ids(db_session, lab_id) == [legacy_id]
        assert stored.read_bytes() == b"legacy"
        assert _trashed_contents(trash) == []


class TestFailedMovesKeepSharedFiles:
    """A row whose file fails to move stays, so it still uses that file (#1296)."""

    def test_record_delete_keeps_a_file_a_failed_row_still_uses(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
        trash_fails_once,
    ):
        med = _create_medication(db_session, user_with_patient["patient"].id)
        first = _upload(client, authenticated_headers, "medication", med.id, b"first")
        second = _upload(client, authenticated_headers, "medication", med.id, b"")
        stored = _stored_path(db_session, first)
        _share_stored_file(db_session, second, stored)

        stats = GenericEntityFileService().cleanup_entity_files_on_deletion(
            db=db_session, entity_type="medication", entity_id=med.id
        )

        assert stats == {"files_deleted": 0, "files_preserved": 0, "errors": 1}
        db_session.expire_all()
        remaining = [db_session.get(EntityFile, i) for i in (first, second)]
        assert sum(record is not None for record in remaining) == 1
        assert stored.read_bytes() == b"first"
        assert _trashed_contents(trash) == []

    def test_lab_result_files_delete_keeps_a_file_a_failed_row_still_uses(
        self, db_session: Session, user_with_patient, trash, trash_fails_once
    ):
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        stored = _legacy_lab_file(db_session, trash, lab.id, b"legacy")
        _legacy_lab_file(db_session, trash, lab.id, b"", stored=stored)

        deleted = lab_result_file_crud.delete_by_lab_result(
            db_session, lab_result_id=lab.id
        )

        assert deleted == 1
        db_session.expire_all()
        assert len(_legacy_file_ids(db_session, lab.id)) == 1
        assert stored.read_bytes() == b"legacy"
        assert _trashed_contents(trash) == []

    def test_failed_metadata_write_leaves_the_file_in_place(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
        monkeypatch,
    ):
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        stored = _legacy_lab_file(db_session, trash, lab.id, b"legacy")
        (legacy_id,) = _legacy_file_ids(db_session, lab.id)

        def fail(*args, **kwargs):
            raise OSError("disk full")

        monkeypatch.setattr(
            "app.services.file_management_service._write_metadata", fail
        )

        resp = client.delete(
            f"/api/v1/lab-result-files/{legacy_id}", headers=authenticated_headers
        )

        assert resp.status_code == 500
        db_session.expire_all()
        assert _legacy_file_ids(db_session, lab.id) == [legacy_id]
        assert stored.read_bytes() == b"legacy"
        assert not any(path.is_file() for path in trash.rglob("*"))

    def test_failed_metadata_cleanup_still_moves_the_file_back(
        self,
        client: TestClient,
        db_session: Session,
        authenticated_headers,
        user_with_patient,
        trash,
    ):
        lab = _create_lab_result(db_session, user_with_patient["patient"].id)
        stored = _legacy_lab_file(db_session, trash, lab.id, b"legacy")
        (legacy_id,) = _legacy_file_ids(db_session, lab.id)
        # A directory where the metadata goes: writing it fails, and so does
        # removing it afterwards
        daily_trash = FileManagementService()._daily_trash_dir()
        _metadata_path(daily_trash / stored.name).mkdir()

        resp = client.delete(
            f"/api/v1/lab-result-files/{legacy_id}", headers=authenticated_headers
        )

        assert resp.status_code == 500
        db_session.expire_all()
        assert _legacy_file_ids(db_session, lab.id) == [legacy_id]
        assert stored.read_bytes() == b"legacy"
        assert not any(path.is_file() for path in trash.rglob("*"))
