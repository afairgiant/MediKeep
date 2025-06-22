from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.crud.practitioner import practitioner
from app.models.activity_log import EntityType
from app.schemas.practitioner import (
    Practitioner,
    PractitionerCreate,
    PractitionerUpdate,
)

router = APIRouter()


@router.post("/", response_model=Practitioner)
def create_practitioner(
    *,
    db: Session = Depends(deps.get_db),
    practitioner_in: PractitionerCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new practitioner.
    """
    practitioner_obj = practitioner.create(db=db, obj_in=practitioner_in)

    # Log the creation activity using centralized logging
    log_create(
        db=db,
        entity_type=EntityType.PRACTITIONER,
        entity_obj=practitioner_obj,
        user_id=current_user_id,
    )

    return practitioner_obj


@router.get("/", response_model=List[Practitioner])
def read_practitioners(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    specialty: Optional[str] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve practitioners with optional filtering by specialty.
    """
    if specialty:
        practitioners = practitioner.get_by_specialty(
            db, specialty=specialty, skip=skip, limit=limit
        )
    else:
        practitioners = practitioner.get_multi(db, skip=skip, limit=limit)
    return practitioners


@router.get("/{practitioner_id}", response_model=Practitioner)
def read_practitioner(
    *,
    db: Session = Depends(deps.get_db),
    practitioner_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get practitioner by ID.
    """
    practitioner_obj = practitioner.get(db=db, id=practitioner_id)
    if not practitioner_obj:
        raise HTTPException(status_code=404, detail="Practitioner not found")
    return practitioner_obj


@router.put("/{practitioner_id}", response_model=Practitioner)
def update_practitioner(
    *,
    db: Session = Depends(deps.get_db),
    practitioner_id: int,
    practitioner_in: PractitionerUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a practitioner.
    """
    practitioner_obj = practitioner.get(db=db, id=practitioner_id)
    if not practitioner_obj:
        raise HTTPException(status_code=404, detail="Practitioner not found")
    practitioner_obj = practitioner.update(
        db=db, db_obj=practitioner_obj, obj_in=practitioner_in
    )

    # Log the update activity using centralized logging
    log_update(
        db=db,
        entity_type=EntityType.PRACTITIONER,
        entity_obj=practitioner_obj,
        user_id=current_user_id,
    )

    return practitioner_obj


@router.delete("/{practitioner_id}")
def delete_practitioner(
    *,
    db: Session = Depends(deps.get_db),
    practitioner_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a practitioner.
    """
    practitioner_obj = practitioner.get(db=db, id=practitioner_id)
    if not practitioner_obj:
        raise HTTPException(status_code=404, detail="Practitioner not found")

    # Log the deletion activity BEFORE deleting using centralized logging
    log_delete(
        db=db,
        entity_type=EntityType.PRACTITIONER,
        entity_obj=practitioner_obj,
        user_id=current_user_id,
    )

    practitioner.delete(db=db, id=practitioner_id)

    return {"message": "Practitioner deleted successfully"}


@router.get("/search/by-name", response_model=List[Practitioner])
def search_practitioners_by_name(
    *,
    db: Session = Depends(deps.get_db),
    name: str = Query(..., min_length=2),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Search practitioners by name.
    """
    practitioners = practitioner.search_by_name(db, name=name)
    return practitioners
