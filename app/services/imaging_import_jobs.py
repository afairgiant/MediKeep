"""Background imaging import jobs, kept in process memory.

The server runs a single worker process, so one registry sees every job. Jobs do not
survive a restart; startup removes their leftover staging directories.
"""

import shutil
import threading
import time
import uuid
from concurrent.futures import Executor, ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Optional

from sqlalchemy.orm import Session

from app.core.database.advisory_lock import UPLOADS_RESTORE_LOCK_KEY, try_advisory_lock
from app.core.database.database import SessionLocal
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.models.models import Patient, User
from app.services.imaging_import_service import (
    IMAGING_WRITE_LOCK,
    ImagingImportError,
    ImportSummary,
    import_dicom_upload,
)
from app.services.patient_access import PatientAccessService

logger = get_logger(__name__, "app")

# Finished jobs stay pollable this long, so a client that reconnects can still read the result
JOB_RETENTION_SECONDS = 60 * 60
GENERIC_FAILURE_MESSAGE = "The import failed. No images from this upload were saved."
RESTORE_RUNNING_MESSAGE = (
    "A backup restore is running. Try the import again when it finishes."
)


class ImportJobStatus:
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ImportJob:
    id: str
    user_id: int
    patient_id: int
    status: str = ImportJobStatus.QUEUED
    total_files: int = 0
    processed_files: int = 0
    summary: Optional[ImportSummary] = None
    error: Optional[str] = None
    finished_at: Optional[float] = None


class ImportJobRegistry:
    """Runs imports one at a time in a background thread and tracks their progress."""

    def __init__(
        self,
        session_factory: Callable[[], Session] = SessionLocal,
        executor: Optional[Executor] = None,
    ):
        self.session_factory = session_factory
        self.executor = executor or ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="imaging-import"
        )
        self._jobs: Dict[str, ImportJob] = {}
        self._lock = threading.Lock()

    def submit(
        self,
        *,
        user_id: int,
        patient_id: int,
        upload_path: Path,
        original_name: str,
        work_dir: Path,
    ) -> ImportJob:
        """Queue an import. Once this returns, the job owns work_dir and removes it."""
        job = ImportJob(id=uuid.uuid4().hex, user_id=user_id, patient_id=patient_id)
        with self._lock:
            self._prune()
            self._jobs[job.id] = job
        try:
            self.executor.submit(self._run, job, upload_path, original_name, work_dir)
        except RuntimeError:  # the executor is shutting down
            with self._lock:
                self._jobs.pop(job.id, None)
            raise
        return job

    def get(self, job_id: str, user_id: int) -> Optional[ImportJob]:
        """The job, only for the user who started it."""
        with self._lock:
            self._prune()
            job = self._jobs.get(job_id)
        return job if job is not None and job.user_id == user_id else None

    def shutdown(self) -> None:
        """Cancel queued jobs; a running import is left to finish."""
        self.executor.shutdown(wait=False, cancel_futures=True)

    def _prune(self) -> None:
        cutoff = time.monotonic() - JOB_RETENTION_SECONDS
        for job_id in [
            job_id
            for job_id, job in self._jobs.items()
            if job.finished_at is not None and job.finished_at < cutoff
        ]:
            del self._jobs[job_id]

    def _run(
        self, job: ImportJob, upload_path: Path, original_name: str, work_dir: Path
    ) -> None:
        try:
            with IMAGING_WRITE_LOCK:
                job.status = ImportJobStatus.RUNNING
                self._import(job, upload_path, original_name, work_dir)
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)
            job.finished_at = time.monotonic()

    def _import(
        self, job: ImportJob, upload_path: Path, original_name: str, work_dir: Path
    ) -> None:
        def progress(done: int, total: int) -> None:
            job.processed_files, job.total_files = done, total

        db = self.session_factory()
        try:
            # A restore replaces the uploads directory, so it must not run mid-import
            with try_advisory_lock(
                db.get_bind(),
                UPLOADS_RESTORE_LOCK_KEY,
                shared=True,
                release_failed_event="imaging_import_lock_release_failed",
            ) as acquired:
                if not acquired:
                    raise ImagingImportError(RESTORE_RUNNING_MESSAGE)
                patient = db.get(Patient, job.patient_id)
                if patient is None:
                    raise ImagingImportError("The patient no longer exists")
                # Access can be revoked while the job waits in the queue
                user = db.get(User, job.user_id)
                if user is None or not PatientAccessService(db).can_access_patient(
                    user, patient, "edit"
                ):
                    raise ImagingImportError(
                        "You no longer have permission to edit this patient"
                    )
                job.summary = import_dicom_upload(
                    db,
                    patient=patient,
                    user_id=job.user_id,
                    upload_path=upload_path,
                    original_name=original_name,
                    work_dir=work_dir,
                    on_progress=progress,
                )
                job.status = ImportJobStatus.COMPLETED
                logger.info(
                    "Imaging import completed",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: "imaging_import_completed",
                        LogFields.USER_ID: job.user_id,
                        LogFields.PATIENT_ID: job.patient_id,
                        "job_id": job.id,
                        "studies": len(job.summary.studies),
                        "instances_added": job.summary.instances_added,
                        "skipped": job.summary.skipped_count,
                    },
                )
        except ImagingImportError as exc:
            job.status, job.error = ImportJobStatus.FAILED, str(exc)
        except Exception as exc:
            job.status, job.error = ImportJobStatus.FAILED, GENERIC_FAILURE_MESSAGE
            logger.error(
                "Imaging import failed",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "imaging_import_failed",
                    LogFields.USER_ID: job.user_id,
                    LogFields.PATIENT_ID: job.patient_id,
                    LogFields.ERROR: type(exc).__name__,
                    "job_id": job.id,
                },
            )
        finally:
            db.close()


import_jobs = ImportJobRegistry()
