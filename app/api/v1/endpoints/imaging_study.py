"""API endpoints for Imaging Studies."""

import time
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.core.http.error_handling import BusinessLogicException, handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access
from app.core.utils.stored_files import resolve_stored_file
from app.crud.encounter import encounter
from app.crud.imaging_study import imaging_study
from app.crud.procedure import procedure
from app.models.activity_log import EntityType
from app.models.imaging import ImagingStudy
from app.models.models import User
from app.schemas.imaging_study import (
    ImagingSeriesResponse,
    ImagingStudyResponse,
    ImagingStudyUpdate,
)
from app.services.attachment_cleanup import cleanup_attachments, find_record_attachments

router = APIRouter()

logger = get_logger(__name__, "app")

DICOM_MEDIA_TYPE = "application/dicom"

# The viewer fetches every image of a study, so image reads are logged once per window
FILE_ACCESS_LOG_WINDOW_SECONDS = 15 * 60
_FILE_ACCESS_LOG_MAX_ENTRIES = 10_000
_file_access_logged_at: Dict[Tuple[int, int], float] = {}


def _should_log_file_access(user_id: int, study_id: int) -> bool:
    """True for the first image read of a study by a user within the window.

    Per process: with several workers each logs its own first read.
    """
    now = time.monotonic()
    key = (user_id, study_id)
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
