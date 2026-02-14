from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
)
from app.crud.practice import practice
from app.models.activity_log import EntityType
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


@router.get("/", response_model=List[Practice])
def read_practices(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    search: str = Query(None, min_length=1),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve practices with optional search."""
    with handle_database_errors(request=request):
        if search:
            practices = practice.search_by_name(
                db, name=search, skip=skip, limit=limit
            )
        else:
            practices = practice.get_multi(db, skip=skip, limit=limit)
        return practices


@router.get("/summary", response_model=List[PracticeSummary])
def read_practices_summary(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all practices as lightweight summaries for dropdowns."""
    with handle_database_errors(request=request):
        return practice.get_all_practices_summary(db)


@router.get("/search/by-name", response_model=List[Practice])
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
        # Add practitioner count
        practice_obj.practitioner_count = len(practice_obj.practitioners) if practice_obj.practitioners else 0
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
    """Delete a practice. Nullifies practitioner practice_id references."""
    with handle_database_errors(request=request):
        # First nullify all practitioner references
        from app.crud.practitioner import practitioner as practitioner_crud
        practitioners = practitioner_crud.get_by_practice(db, practice_id=practice_id)
        for p in practitioners:
            p.practice_id = None
        db.flush()

    return handle_delete_with_logging(
        db=db,
        crud_obj=practice,
        entity_id=practice_id,
        entity_type=EntityType.PRACTICE,
        user_id=current_user_id,
        entity_name="Practice",
        request=request,
    )
