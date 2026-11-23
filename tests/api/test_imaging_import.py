"""Imaging import, import-job and move endpoints."""

from datetime import date
from pathlib import Path

import pytest
from sqlalchemy.orm import sessionmaker

from app.api.v1.endpoints import imaging_study as imaging_endpoints
from app.core.config import settings
from app.core.utils.rate_limit import SlidingWindowRateLimiter
from app.models.clinical import Encounter
from app.models.imaging import ImagingInstance, ImagingStudy
from app.models.patient import Patient
from app.services import imaging_import_jobs
from app.services.imaging_import_service import IMAGING_WRITE_LOCK, SkipReason
from app.services.imaging_storage import import_staging_root, study_directory
from tests.utils.dicom import STUDY_UID, compression_bomb, dicom_bytes, zip_bytes
from tests.utils.user import (
    create_random_user,
    create_user_token_headers,
    share_patient,
)

IMPORT_URL = "/api/v1/imaging-studies/import"
URL = "/api/v1/imaging-studies"


class _InlineExecutor:
    """Runs a submitted job before submit returns, so tests see the finished job."""

    def submit(self, fn, *args):
        fn(*args)


pytestmark = pytest.mark.usefixtures("isolated_uploads")


def _limit_imports(monkeypatch, max_requests: int) -> None:
    monkeypatch.setattr(
        imaging_endpoints,
        "_import_limiter",
        SlidingWindowRateLimiter(max_requests=max_requests, window_seconds=3600),
    )


@pytest.fixture(autouse=True)
def inline_jobs(db_session, monkeypatch):
    registry = imaging_import_jobs.ImportJobRegistry(
        session_factory=sessionmaker(bind=db_session.get_bind()),
        executor=_InlineExecutor(),
    )
    monkeypatch.setattr(imaging_endpoints, "import_jobs", registry)
    _limit_imports(monkeypatch, 10)
    return registry


def _import(client, headers, data: bytes, filename="cd.zip", **params):
    return client.post(
        IMPORT_URL,
        params={"filename": filename, **params},
        content=data,
        headers={**headers, "Content-Type": "application/octet-stream"},
    )


def _no_staging_left() -> bool:
    root = import_staging_root()
    return not root.exists() or not any(root.iterdir())


def _move(client, headers, study_id, target_id):
    return client.post(
        f"{URL}/{study_id}/move",
        json={"target_patient_id": target_id},
        headers=headers,
    )


def _second_patient(db, owner):
    """Another family member owned by owner, so fully accessible to them."""
    holder = create_random_user(db)
    patient = Patient(
        user_id=holder["user"].id,
        owner_user_id=owner.id,
        first_name="Sibling",
        last_name="User",
        birth_date=date(2012, 6, 1),
        gender="F",
    )
    db.add(patient)
    db.commit()
    return patient


class TestImport:
    def test_zip_import_completes_with_summary(
        self, client, db_session, user_with_patient, authenticated_headers
    ):
        data = zip_bytes(
            {
                "DICOMDIR": dicom_bytes(sop_uid="1.9", image=False),
                "IMG/1": dicom_bytes(instance_number=1),
                "IMG/2": dicom_bytes(instance_number=2),
            }
        )

        response = _import(client, authenticated_headers, data)

        assert response.status_code == 202
        job = response.json()
        assert job["status"] == "completed"
        assert job["patient_id"] == user_with_patient["patient"].id
        assert (job["processed_files"], job["total_files"]) == (3, 3)
        summary = job["summary"]
        assert summary["instances_added"] == 2
        assert summary["skipped"] == [
            {"name": "DICOMDIR", "reason": SkipReason.IGNORED}
        ]
        assert summary["studies"][0]["created"] is True
        assert summary["studies"][0]["patient_mismatch"] is False

        polled = client.get(
            f"{IMPORT_URL}/{job['job_id']}", headers=authenticated_headers
        )
        assert polled.json() == job
        listed = client.get(f"{URL}/", headers=authenticated_headers).json()
        assert [s["instance_count"] for s in listed] == [2]
        assert _no_staging_left()

    def test_single_file_and_mismatch_flag(self, client, authenticated_headers):
        data = dicom_bytes(patient_name="Other^Person", birth_date="20100101")

        job = _import(client, authenticated_headers, data, "image.dcm").json()

        assert job["summary"]["studies"][0]["patient_mismatch"] is True

    def test_job_is_private_to_its_user(
        self, client, db_session, authenticated_headers
    ):
        job = _import(client, authenticated_headers, dicom_bytes(), "a.dcm").json()
        other = create_random_user(db_session)

        response = client.get(
            f"{IMPORT_URL}/{job['job_id']}",
            headers=create_user_token_headers(other["user"].username),
        )

        assert response.status_code == 404

    def test_unknown_job_is_404(self, client, authenticated_headers):
        response = client.get(f"{IMPORT_URL}/nope", headers=authenticated_headers)
        assert response.status_code == 404

    @pytest.mark.parametrize(
        "filename, data",
        [
            ("notes.pdf", b"%PDF"),
            ("scan.dcm", b""),
            ("scan.dcm", b"not dicom at all"),
            ("cd.zip", compression_bomb()),
        ],
    )
    def test_rejected_uploads_leave_nothing_behind(
        self, client, authenticated_headers, filename, data
    ):
        response = _import(client, authenticated_headers, data, filename)

        assert response.status_code == 400
        assert _no_staging_left()

    def test_upload_over_the_limit_is_413(
        self, client, authenticated_headers, monkeypatch
    ):
        monkeypatch.setattr(settings, "IMAGING_MAX_UPLOAD_SIZE", 100)

        response = _import(client, authenticated_headers, dicom_bytes(), "a.dcm")

        assert response.status_code == 413
        assert _no_staging_left()

    def test_streamed_upload_over_the_limit_is_413(
        self, client, authenticated_headers, monkeypatch
    ):
        monkeypatch.setattr(settings, "IMAGING_MAX_UPLOAD_SIZE", 100)

        def chunks():
            for _ in range(10):
                yield b"\x00" * 50

        response = client.post(
            IMPORT_URL,
            params={"filename": "a.dcm"},
            content=chunks(),
            headers=authenticated_headers,
        )

        assert response.status_code == 413
        assert _no_staging_left()

    def test_rate_limited(self, client, authenticated_headers, monkeypatch):
        _limit_imports(monkeypatch, 1)

        first = _import(client, authenticated_headers, dicom_bytes(), "a.dcm")
        second = _import(client, authenticated_headers, dicom_bytes(), "a.dcm")

        assert first.status_code == 202
        assert second.status_code == 429
        assert second.headers["X-Error-Code"] == "imaging_import_rate_limited"
        assert "Retry-After" in second.headers

    def test_rejected_upload_does_not_use_up_the_limit(
        self, client, authenticated_headers, monkeypatch
    ):
        _limit_imports(monkeypatch, 1)

        rejected = _import(client, authenticated_headers, b"not dicom", "a.dcm")
        accepted = _import(client, authenticated_headers, dicom_bytes(), "a.dcm")

        assert rejected.status_code == 400
        assert accepted.status_code == 202

    def test_failed_job_reports_a_safe_error(
        self, client, authenticated_headers, monkeypatch
    ):
        def _boom(*args, **kwargs):
            raise RuntimeError("internal detail /srv/path")

        monkeypatch.setattr(imaging_import_jobs, "import_dicom_upload", _boom)

        job = _import(client, authenticated_headers, dicom_bytes(), "a.dcm").json()

        assert job["status"] == "failed"
        assert job["error"] == imaging_import_jobs.GENERIC_FAILURE_MESSAGE


class TestImportAccess:
    def test_view_only_share_cannot_import(self, client, db_session, user_with_patient):
        patient = user_with_patient["patient"]
        _, headers = share_patient(
            db_session, user_with_patient["user"], patient.id, "view"
        )

        response = _import(
            client, headers, dicom_bytes(), "a.dcm", patient_id=patient.id
        )

        assert response.status_code == 403

    def test_edit_share_can_import(self, client, db_session, user_with_patient):
        patient = user_with_patient["patient"]
        _, headers = share_patient(
            db_session, user_with_patient["user"], patient.id, "edit"
        )

        response = _import(
            client, headers, dicom_bytes(), "a.dcm", patient_id=patient.id
        )

        assert response.status_code == 202
        assert response.json()["patient_id"] == patient.id

    def test_unrelated_patient_is_refused(
        self, client, db_session, authenticated_headers
    ):
        stranger = create_random_user(db_session)
        other_patient = _second_patient(db_session, stranger["user"])

        response = _import(
            client,
            authenticated_headers,
            dicom_bytes(),
            "a.dcm",
            patient_id=other_patient.id,
        )

        assert response.status_code == 403


class TestMove:
    @pytest.fixture
    def imported(self, client, db_session, authenticated_headers):
        data = zip_bytes({"1": dicom_bytes(), "2": dicom_bytes(instance_number=2)})
        job = _import(client, authenticated_headers, data).json()
        return db_session.get(ImagingStudy, job["summary"]["studies"][0]["study_id"])

    def test_moves_rows_and_files_and_clears_links(
        self, client, db_session, user_with_patient, authenticated_headers, imported
    ):
        owner = user_with_patient["user"]
        source = user_with_patient["patient"]
        sibling = _second_patient(db_session, owner)
        encounter = Encounter(
            patient_id=source.id, reason="Visit", date=date(2026, 1, 15)
        )
        db_session.add(encounter)
        db_session.flush()
        imported.encounter_id = encounter.id
        db_session.commit()

        response = _move(client, authenticated_headers, imported.id, sibling.id)

        assert response.status_code == 200
        body = response.json()
        assert body["patient_id"] == sibling.id
        assert body["encounter_id"] is None
        assert not study_directory(source.id, STUDY_UID).exists()
        db_session.expire_all()
        for instance in db_session.query(ImagingInstance).all():
            path = Path(instance.file_path)
            assert path.is_file()
            assert path.is_relative_to(study_directory(sibling.id, STUDY_UID))

        file_response = client.get(
            f"{URL}/{imported.id}/instances/{instance.id}/file",
            headers=authenticated_headers,
        )
        assert file_response.status_code == 200

    def test_same_patient_is_400(
        self, client, user_with_patient, authenticated_headers, imported
    ):
        response = _move(
            client,
            authenticated_headers,
            imported.id,
            user_with_patient["patient"].id,
        )
        assert response.status_code == 400

    def test_target_without_edit_access_is_403(
        self, client, db_session, authenticated_headers, imported
    ):
        stranger = create_random_user(db_session)
        target = _second_patient(db_session, stranger["user"])

        response = _move(client, authenticated_headers, imported.id, target.id)

        assert response.status_code == 403
        db_session.refresh(imported)
        assert imported.patient_id != target.id

    def test_view_only_on_source_is_404(
        self, client, db_session, user_with_patient, imported
    ):
        viewer, headers = share_patient(
            db_session, user_with_patient["user"], imported.patient_id, "view"
        )
        own = _second_patient(db_session, viewer)

        response = _move(client, headers, imported.id, own.id)

        # Edits by view-only users are refused as not found, like the other endpoints
        assert response.status_code == 404

    def test_target_already_has_the_study_is_409(
        self, client, db_session, user_with_patient, authenticated_headers, imported
    ):
        sibling = _second_patient(db_session, user_with_patient["user"])
        _import(
            client,
            authenticated_headers,
            dicom_bytes(),
            "a.dcm",
            patient_id=sibling.id,
        )

        response = _move(client, authenticated_headers, imported.id, sibling.id)

        assert response.status_code == 409

    def test_running_import_is_409(
        self, client, db_session, user_with_patient, authenticated_headers, imported
    ):
        sibling = _second_patient(db_session, user_with_patient["user"])

        with IMAGING_WRITE_LOCK:
            response = _move(client, authenticated_headers, imported.id, sibling.id)

        assert response.status_code == 409


class TestDeleteDuringImport:
    def test_running_import_is_409_and_keeps_the_study(
        self, client, db_session, authenticated_headers
    ):
        job = _import(client, authenticated_headers, dicom_bytes(), "a.dcm").json()
        study_id = job["summary"]["studies"][0]["study_id"]

        with IMAGING_WRITE_LOCK:
            response = client.delete(f"{URL}/{study_id}", headers=authenticated_headers)

        assert response.status_code == 409
        assert db_session.get(ImagingStudy, study_id) is not None
