from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
)
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.crud.practice import practice
from app.models.activity_log import EntityType
from app.models.models import Practitioner as PractitionerModel
from app.schemas.practice import (
    Practice,
    PracticeCreate,
    PracticeSummary,
    PracticeUpdate,
    PracticeWithPractitioners,
)

router = APIRouter()

logger = get_logger(__name__, "app")


@router.post("/", response_model=Practice)
def create_practice(
    *,
    practice_in: PracticeCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new practice."""
    return handle_create_with_logging(
        db=db,
        crud_obj=practice,
        obj_in=practice_in,
        entity_type=EntityType.PRACTICE,
        user_id=current_user_id,
        entity_name="Practice",
        request=request,
    )


@router.get("/", response_model=list[PracticeWithPractitioners])
def read_practices(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=10000, le=10000),
    search: str = Query(None, min_length=1),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve practices with optional search and practitioner counts."""
    with handle_database_errors(request=request):
        if search:
            practices = practice.search_by_name(db, name=search, skip=skip, limit=limit)
        else:
            practices = practice.get_multi(db, skip=skip, limit=limit)

        practice_ids = [p.id for p in practices]
        count_map = {}
        if practice_ids:
            counts = (
                db.query(
                    PractitionerModel.practice_id,
                    func.count(PractitionerModel.id).label("cnt"),
                )
                .filter(PractitionerModel.practice_id.in_(practice_ids))
                .group_by(PractitionerModel.practice_id)
                .all()
            )
            count_map = {row.practice_id: row.cnt for row in counts}

        for p in practices:
            p.practitioner_count = count_map.get(p.id, 0)

        return practices


@router.get("/summary", response_model=list[PracticeSummary])
def read_practices_summary(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all practices as lightweight summaries for dropdowns."""
    with handle_database_errors(request=request):
        return practice.get_all_practices_summary(db)


@router.get("/search/by-name", response_model=list[Practice])
def search_practices_by_name(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    name: str = Query(..., min_length=1),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Search practices by name."""
    with handle_database_errors(request=request):
        return practice.search_by_name(db, name=name)


@router.get("/{practice_id}", response_model=PracticeWithPractitioners)
def read_practice(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    practice_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get practice by ID with practitioner count."""
    with handle_database_errors(request=request):
        practice_obj = practice.get_with_practitioners(db, practice_id=practice_id)
        handle_not_found(practice_obj, "Practice", request)
        practice_obj.practitioner_count = (
            len(practice_obj.practitioners) if practice_obj.practitioners else 0
        )
        return practice_obj


@router.put("/{practice_id}", response_model=Practice)
def update_practice(
    *,
    practice_id: int,
    practice_in: PracticeUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a practice."""
    return handle_update_with_logging(
        db=db,
        crud_obj=practice,
        entity_id=practice_id,
        obj_in=practice_in,
        entity_type=EntityType.PRACTICE,
        user_id=current_user_id,
        entity_name="Practice",
        request=request,
    )


@router.delete("/{practice_id}")
def delete_practice(
    *,
    practice_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a practice. Only allowed when no practitioners are linked."""
    with handle_database_errors(request=request):
        count = practice.get_practitioner_count(db, practice_id)
        if count > 0:
            raise HTTPException(
                status_code=409,
                detail="Cannot delete practice with active practitioners",
            )

    return handle_delete_with_logging(
        db=db,
        crud_obj=practice,
        entity_id=practice_id,
        entity_type=EntityType.PRACTICE,
        user_id=current_user_id,
        entity_name="Practice",
        request=request,
    )
