"""API endpoints for Imaging Studies."""

import shutil
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_update
from app.api.v1.endpoints.utils import (
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.core.config import settings
from app.core.http.error_handling import (
    BusinessLogicException,
    ConflictException,
    handle_database_errors,
)
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access, log_endpoint_access
from app.core.utils.rate_limit import SlidingWindowRateLimiter
from app.core.utils.stored_files import resolve_stored_file
from app.crud.encounter import encounter
from app.crud.imaging_study import imaging_study
from app.crud.procedure import procedure
from app.models.activity_log import EntityType
from app.models.imaging import ImagingStudy
from app.models.models import User
from app.schemas.imaging_study import (
    ImagingImportJobResponse,
    ImagingImportSummary,
    ImagingSeriesResponse,
    ImagingStudyMove,
    ImagingStudyResponse,
    ImagingStudyUpdate,
)
from app.services.attachment_cleanup import cleanup_attachments, find_record_attachments
from app.services.imaging_import_jobs import ImportJob, import_jobs
from app.services.imaging_import_service import (
    IMAGING_WRITE_LOCK,
    ImagingImportError,
    StudyConflictError,
    move_study,
    validate_upload,
)
from app.services.imaging_storage import create_import_staging_dir

router = APIRouter()

logger = get_logger(__name__, "app")

DICOM_MEDIA_TYPE = "application/dicom"
IMPORT_FILE_EXTENSIONS = {".zip", ".dcm", ".dicom"}
# Network chunks are small; batching them keeps thread hops per upload low
_UPLOAD_WRITE_SIZE = 4 * 1024 * 1024
_import_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=3600)

# The viewer fetches every image of a study, so image reads are logged once per window
FILE_ACCESS_LOG_WINDOW_SECONDS = 15 * 60
_FILE_ACCESS_LOG_MAX_ENTRIES = 10_000
_file_access_logged_at: Dict[Tuple[int, int], float] = {}
_file_access_log_lock = threading.Lock()


def _should_log_file_access(user_id: int, study_id: int) -> bool:
    """True for the first image read of a study by a user within the window.

    Per process: with several workers each logs its own first read.
    """
    now = time.monotonic()
    key = (user_id, study_id)
    # Sync endpoints run on threadpool threads; pruning must not race inserts
    with _file_access_log_lock:
        last = _file_access_logged_at.get(key)
        if last is not None and now - last < FILE_ACCESS_LOG_WINDOW_SECONDS:
            return False
        if len(_file_access_logged_at) >= _FILE_ACCESS_LOG_MAX_ENTRIES:
            cutoff = now - FILE_ACCESS_LOG_WINDOW_SECONDS
            for stale in [k for k, t in _file_access_logged_at.items() if t < cutoff]:
                del _file_access_logged_at[stale]
            if len(_file_access_logged_at) >= _FILE_ACCESS_LOG_MAX_ENTRIES:
                _file_access_logged_at.clear()
        _file_access_logged_at[key] = now
        return True


def _get_accessible_study(
    db: Session,
    study_id: int,
    current_user_patient_id: int,
    current_user: User,
    request: Request,
    permission: str = "view",
):
    study = imaging_study.get(db, id=study_id)
    handle_not_found(study, "ImagingStudy", request)
    verify_patient_ownership(
        study,
        current_user_patient_id,
        "imaging study",
        db=db,
        current_user=current_user,
        permission=permission,
    )
    return study


def _lock_study_row(db: Session, study_id: int) -> None:
    """Lock the study's row until the transaction ends and reload it if loaded.

    A move and an edit of one study then run one after the other.
    """
    db.query(ImagingStudy).filter(
        ImagingStudy.id == study_id
    ).with_for_update().populate_existing().first()


def _verify_links_belong_to_patient(
    db: Session, patient_id: int, update: ImagingStudyUpdate, request: Request
) -> None:
    """Procedure and encounter links must point at the study's own patient."""
    for crud_obj, field, label in (
        (procedure, "procedure_id", "procedure"),
        (encounter, "encounter_id", "encounter"),
    ):
        linked_id = getattr(update, field)
        if linked_id is None:
            continue
        linked = crud_obj.get(db, id=linked_id)
        if linked is None or linked.patient_id != patient_id:
            raise BusinessLogicException(
                message=f"Cannot link a {label} that doesn't belong to the same patient",
                request=request,
            )


def _job_response(job: ImportJob) -> ImagingImportJobResponse:
    return ImagingImportJobResponse(
        job_id=job.id,
        status=job.status,
        patient_id=job.patient_id,
        total_files=job.total_files,
        processed_files=job.processed_files,
        summary=(
            ImagingImportSummary.model_validate(job.summary) if job.summary else None
        ),
        error=job.error,
    )


@contextmanager
def _imaging_write_lock_or_409(request: Request) -> Iterator[None]:
    """Hold IMAGING_WRITE_LOCK for the block; 409 if an import holds it."""
    if not IMAGING_WRITE_LOCK.acquire(blocking=False):
        raise ConflictException(
            message="An imaging import is running. Try again when it finishes.",
            request=request,
        )
    try:
        yield
    finally:
        IMAGING_WRITE_LOCK.release()


def _upload_too_large() -> HTTPException:
    limit_mb = settings.IMAGING_MAX_UPLOAD_SIZE // (1024 * 1024)
    return HTTPException(
        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
        detail=f"The upload exceeds the {limit_mb} MB imaging upload limit",
    )


async def _receive_upload(request: Request, target: Path, max_bytes: int) -> int:
    """Stream the request body to target; raises 413 as soon as it passes max_bytes."""
    received = 0
    buffer = bytearray()
    async with aiofiles.open(target, "wb") as out:
        async for chunk in request.stream():
            received += len(chunk)
            if received > max_bytes:
                raise _upload_too_large()
            buffer += chunk
            if len(buffer) >= _UPLOAD_WRITE_SIZE:
                await out.write(bytes(buffer))
                buffer.clear()
        if buffer:
            await out.write(bytes(buffer))
    return received


@router.post(
    "/import",
    response_model=ImagingImportJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def import_imaging_files(
    *,
    request: Request,
    filename: str = Query(..., min_length=1, max_length=255),
    patient_id: Optional[int] = Query(None, gt=0),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Start importing a .dcm file or a ZIP sent as the raw request body.

    Returns the queued job; poll GET /import/{job_id} for progress and the summary.
    """
    if not _import_limiter.is_allowed(current_user.id):
        raise _import_limiter.too_many_requests(
            current_user.id, "Too many imaging imports.", "imaging_import_rate_limited"
        )
    # Only queued imports count toward the limit, so a rejected upload can be retried
    try:
        return await _queue_import(request, filename, patient_id, db, current_user)
    except BaseException:
        _import_limiter.release(current_user.id)
        raise


async def _queue_import(
    request: Request,
    filename: str,
    patient_id: Optional[int],
    db: Session,
    current_user: User,
) -> ImagingImportJobResponse:
    if Path(filename).suffix.lower() not in IMPORT_FILE_EXTENSIONS:
        raise BusinessLogicException(
            message="Upload a .dcm file or a .zip archive", request=request
        )
    max_bytes = settings.IMAGING_MAX_UPLOAD_SIZE
    try:
        declared = int(request.headers.get("content-length", "0"))
    except ValueError:
        declared = 0
    if declared > max_bytes:
        raise _upload_too_large()

    target_patient_id = await run_in_threadpool(
        _resolve_import_patient, db, current_user, patient_id
    )
    user_id = current_user.id
    # Ending the transaction frees the pooled connection for the length of the upload
    await run_in_threadpool(db.commit)

    work_dir = await run_in_threadpool(create_import_staging_dir)
    try:
        upload_path = work_dir / "upload"
        size = await _receive_upload(request, upload_path, max_bytes)
        if size == 0:
            raise BusinessLogicException(message="The upload is empty", request=request)
        try:
            await run_in_threadpool(validate_upload, upload_path)
        except ImagingImportError as exc:
            raise BusinessLogicException(message=str(exc), request=request) from exc
        job = import_jobs.submit(
            user_id=user_id,
            patient_id=target_patient_id,
            upload_path=upload_path,
            original_name=filename,
            work_dir=work_dir,
        )
    except BaseException:
        await run_in_threadpool(shutil.rmtree, work_dir, ignore_errors=True)
        raise

    log_endpoint_access(
        logger,
        request,
        user_id,
        "imaging_import_queued",
        patient_id=target_patient_id,
        message="Imaging import queued",
        job_id=job.id,
        size_bytes=size,
    )
    return _job_response(job)


def _resolve_import_patient(
    db: Session, current_user: User, patient_id: Optional[int]
) -> int:
    """The patient to import into, which the user must be able to edit."""
    if patient_id is None:
        patient_id = deps.get_current_user_patient_id(db, current_user.id)
    return deps.verify_patient_access(
        patient_id, db, current_user, required_permission="edit"
    )


@router.get("/import/{job_id}", response_model=ImagingImportJobResponse)
def read_import_job(
    *,
    job_id: str,
    request: Request,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Progress and, once finished, the summary or error of an import job."""
    job = import_jobs.get(job_id, current_user.id)
    handle_not_found(job, "ImagingImportJob", request)
    return _job_response(job)


@router.get("/", response_model=List[ImagingStudyResponse])
def read_imaging_studies(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(
        False, description="Match all tags (AND) vs any tag (OR)"
    ),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Imaging studies for the current or an accessible patient, newest first."""
    with handle_database_errors(request=request):
        studies = imaging_study.get_by_patient(
            db,
            patient_id=target_patient_id,
            skip=skip,
            limit=limit,
            tags=tags,
            tag_match_all=tag_match_all,
        )
        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "ImagingStudy",
            patient_id=target_patient_id,
            count=len(studies),
        )
        return studies


@router.get("/{study_id}", response_model=ImagingStudyResponse)
def read_imaging_study(
    *,
    study_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get an imaging study by ID."""
    with handle_database_errors(request=request):
        study = _get_accessible_study(
            db, study_id, current_user_patient_id, current_user, request
        )
        log_data_access(
            logger,
            request,
            current_user.id,
            "read",
            "ImagingStudy",
            record_id=study_id,
            patient_id=study.patient_id,
        )
        return study


@router.get("/{study_id}/series", response_model=List[ImagingSeriesResponse])
def read_imaging_study_series(
    *,
    study_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Series of a study with their image IDs, for the viewer."""
    with handle_database_errors(request=request):
        study = _get_accessible_study(
            db, study_id, current_user_patient_id, current_user, request
        )
        series = imaging_study.get_series_with_instances(db, study_id=study.id)
        log_data_access(
            logger,
            request,
            current_user.id,
            "read",
            "ImagingSeries",
            record_id=study_id,
            patient_id=study.patient_id,
            count=len(series),
        )
        return series


@router.get("/{study_id}/instances/{instance_id}/file")
def read_imaging_instance_file(
    *,
    study_id: int,
    instance_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Raw DICOM bytes of one image."""
    with handle_database_errors(request=request):
        row = imaging_study.get_instance_with_patient(
            db, study_id=study_id, instance_id=instance_id
        )
        handle_not_found(row, "ImagingInstance", request)
        instance, patient_id = row
        deps.verify_patient_record_access(
            record_patient_id=patient_id,
            current_user_patient_id=None,
            record_type="imaging study",
            db=db,
            current_user=current_user,
        )
        path = resolve_stored_file(instance)
        handle_not_found(path, "ImagingInstance", request)
        if _should_log_file_access(current_user.id, study_id):
            log_data_access(
                logger,
                request,
                current_user.id,
                "read",
                "ImagingInstanceFile",
                record_id=study_id,
                patient_id=patient_id,
            )

    return FileResponse(
        path=path,
        media_type=DICOM_MEDIA_TYPE,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.put("/{study_id}", response_model=ImagingStudyResponse)
def update_imaging_study(
    *,
    study_id: int,
    study_in: ImagingStudyUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update the user-editable fields of an imaging study."""
    # Without the lock a move could clear the links after they were checked
    with handle_database_errors(request=request):
        _lock_study_row(db, study_id)
    return handle_update_with_logging(
        db=db,
        crud_obj=imaging_study,
        entity_id=study_id,
        obj_in=study_in,
        entity_type=EntityType.IMAGING_STUDY,
        user_id=current_user_id,
        entity_name="ImagingStudy",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
        before_update=lambda study: _verify_links_belong_to_patient(
            db, study.patient_id, study_in, request
        ),
    )


@router.delete("/{study_id}")
def delete_imaging_study(
    *,
    study_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete an imaging study and move its files to trash."""
    with _imaging_write_lock_or_409(request):
        # Found before the delete, while the row still names the study's folder
        pending = find_record_attachments(db, ImagingStudy, [study_id])
        result = handle_delete_with_logging(
            db=db,
            crud_obj=imaging_study,
            entity_id=study_id,
            entity_type=EntityType.IMAGING_STUDY,
            user_id=current_user_id,
            entity_name="ImagingStudy",
            request=request,
            current_user=current_user,
            current_user_patient_id=current_user_patient_id,
        )
        cleanup_attachments(db, pending, reason=f"imaging study {study_id} deletion")
    return result


@router.post("/{study_id}/move", response_model=ImagingStudyResponse)
def move_imaging_study(
    *,
    study_id: int,
    move_in: ImagingStudyMove,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Move a study to another patient the user can edit, clearing its links."""
    # Locked before the study is read, so access is checked against its current owner
    with handle_database_errors(request=request), _imaging_write_lock_or_409(request):
        _lock_study_row(db, study_id)
        study = _get_accessible_study(
            db,
            study_id,
            current_user_patient_id,
            current_user,
            request,
            permission="edit",
        )
        target_patient_id = move_in.target_patient_id
        if target_patient_id == study.patient_id:
            raise BusinessLogicException(
                message="The study already belongs to this patient", request=request
            )
        deps.verify_patient_access(
            target_patient_id, db, current_user, required_permission="edit"
        )
        try:
            move_study(db, study, target_patient_id)
        except StudyConflictError as exc:
            raise ConflictException(message=str(exc), request=request) from exc

        db.refresh(study)
        log_update(db, EntityType.IMAGING_STUDY, study, current_user.id, request)
        log_endpoint_access(
            logger,
            request,
            current_user.id,
            "imaging_study_moved",
            patient_id=target_patient_id,
            message="Imaging study moved to another patient",
            record_id=study_id,
        )
        return study
