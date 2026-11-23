"""Import job registry on its real background thread, plus job retention."""

import time

import pytest
from sqlalchemy.orm import sessionmaker

from app.services import imaging_import_jobs
from app.services.imaging_import_jobs import ImportJobRegistry, ImportJobStatus
from app.services.imaging_import_service import IMAGING_WRITE_LOCK
from app.services.imaging_storage import create_import_staging_dir
from tests.utils.dicom import dicom_bytes, write
from tests.utils.user import create_random_user

pytestmark = pytest.mark.usefixtures("isolated_uploads")


@pytest.fixture
def registry(db_session):
    registry = ImportJobRegistry(
        session_factory=sessionmaker(bind=db_session.get_bind())
    )
    yield registry
    registry.executor.shutdown(wait=True)


def _submit(registry, user_id, patient_id, data=None):
    work_dir = create_import_staging_dir()
    upload = write(work_dir / "upload", data or dicom_bytes())
    job = registry.submit(
        user_id=user_id,
        patient_id=patient_id,
        upload_path=upload,
        original_name="a.dcm",
        work_dir=work_dir,
    )
    return job, work_dir


def test_job_runs_in_the_background_and_cleans_up(registry, test_user, test_patient):
    job, work_dir = _submit(registry, test_user.id, test_patient.id)
    registry.executor.shutdown(wait=True)

    assert job.status == ImportJobStatus.COMPLETED
    assert job.summary.instances_added == 1
    assert (job.processed_files, job.total_files) == (1, 1)
    assert not work_dir.exists()
    assert registry.get(job.id, test_user.id) is job
    assert registry.get(job.id, test_user.id + 1) is None


def test_missing_patient_fails_with_a_message(registry, test_user):
    job, _ = _submit(registry, test_user.id, 999_999)
    registry.executor.shutdown(wait=True)

    assert job.status == ImportJobStatus.FAILED
    assert job.error == "The patient no longer exists"


def test_finished_jobs_expire(registry, test_user, test_patient, monkeypatch):
    job, _ = _submit(registry, test_user.id, test_patient.id)
    registry.executor.shutdown(wait=True)
    monkeypatch.setattr(imaging_import_jobs, "JOB_RETENTION_SECONDS", -1)

    assert registry.get(job.id, test_user.id) is None


def test_job_fails_when_edit_access_was_revoked_while_queued(
    registry, db_session, test_patient
):
    outsider = create_random_user(db_session)["user"]

    job, _ = _submit(registry, outsider.id, test_patient.id)
    registry.executor.shutdown(wait=True)

    assert job.status == ImportJobStatus.FAILED
    assert job.error == "You no longer have permission to edit this patient"
    assert job.summary is None


def test_shutdown_cancels_queued_jobs(registry, test_user, test_patient):
    with IMAGING_WRITE_LOCK:
        running, _ = _submit(registry, test_user.id, test_patient.id)
        queued, queued_dir = _submit(registry, test_user.id, test_patient.id)
        # The worker must have taken the first job, so only the second is cancelled
        deadline = time.monotonic() + 5
        while registry.executor._work_queue.qsize() > 1:
            assert time.monotonic() < deadline
            time.sleep(0.01)
        registry.shutdown()
    registry.executor.shutdown(wait=True)

    assert running.status == ImportJobStatus.COMPLETED
    assert queued.status == ImportJobStatus.QUEUED
    # Startup removes the cancelled job's staging directory
    assert queued_dir.exists()
