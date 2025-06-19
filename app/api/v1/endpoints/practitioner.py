from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app.api import deps
from app.crud.practitioner import practitioner
from app.schemas.practitioner import (
    PractitionerCreate,
    PractitionerUpdate,
    Practitioner,
)
from app.models.activity_log import ActivityLog
from app.models.models import get_utc_now

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
    
    # Log the creation activity
    try:
        description = f"New practitioner: {getattr(practitioner_obj, 'name', 'Unknown practitioner')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=None,  # Practitioners are not patient-specific
            action="created",
            entity_type="practitioner",
            entity_id=getattr(practitioner_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass
    
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
    
    # Log the update activity
    try:
        description = f"Updated practitioner: {getattr(practitioner_obj, 'name', 'Unknown practitioner')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=None,  # Practitioners are not patient-specific
            action="updated",
            entity_type="practitioner",
            entity_id=getattr(practitioner_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass
    
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
    
    # Store name before deletion for logging
    practitioner_name = getattr(practitioner_obj, 'name', 'Unknown practitioner')
    
    practitioner.delete(db=db, id=practitioner_id)
    
    # Log the delete activity
    try:
        description = f"Deleted practitioner: {practitioner_name}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=None,  # Practitioners are not patient-specific
            action="deleted",
            entity_type="practitioner",
            entity_id=practitioner_id,
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass
    
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
