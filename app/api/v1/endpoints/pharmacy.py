from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, List

from app.api import deps
from app.crud.pharmacy import pharmacy
from app.schemas.pharmacy import (
    PharmacyCreate,
    PharmacyUpdate,
    Pharmacy,
)
from app.models.activity_log import ActivityLog
from app.models.models import get_utc_now

router = APIRouter()


@router.post("/", response_model=Pharmacy)
def create_pharmacy(
    *,
    db: Session = Depends(deps.get_db),
    pharmacy_in: PharmacyCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new pharmacy.
    """
    pharmacy_obj = pharmacy.create(db=db, obj_in=pharmacy_in)
    
    # Log the creation activity
    try:
        description = f"New pharmacy: {getattr(pharmacy_obj, 'name', 'Unknown pharmacy')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=None,  # Pharmacies are not patient-specific
            action="created",
            entity_type="pharmacy",
            entity_id=getattr(pharmacy_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass
    
    return pharmacy_obj


@router.get("/", response_model=List[Pharmacy])
def read_pharmacies(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve pharmacies.
    """
    pharmacies = pharmacy.get_multi(db, skip=skip, limit=limit)
    return pharmacies


@router.get("/{id}", response_model=Pharmacy)
def read_pharmacy(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get pharmacy by ID.
    """
    pharmacy_obj = pharmacy.get(db=db, id=id)
    if not pharmacy_obj:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return pharmacy_obj


@router.put("/{id}", response_model=Pharmacy)
def update_pharmacy(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    pharmacy_in: PharmacyUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a pharmacy.
    """
    pharmacy_obj = pharmacy.get(db=db, id=id)
    if not pharmacy_obj:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    pharmacy_obj = pharmacy.update(db=db, db_obj=pharmacy_obj, obj_in=pharmacy_in)
    
    # Log the update activity
    try:
        description = f"Updated pharmacy: {getattr(pharmacy_obj, 'name', 'Unknown pharmacy')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=None,  # Pharmacies are not patient-specific
            action="updated",
            entity_type="pharmacy",
            entity_id=getattr(pharmacy_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass
    
    return pharmacy_obj


@router.delete("/{id}")
def delete_pharmacy(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a pharmacy.
    """
    pharmacy_obj = pharmacy.get(db=db, id=id)
    if not pharmacy_obj:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    pharmacy.delete(db=db, id=id)
    
    # Log the deletion activity
    try:
        description = f"Deleted pharmacy: {getattr(pharmacy_obj, 'name', 'Unknown pharmacy')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=None,  # Pharmacies are not patient-specific
            action="deleted",
            entity_type="pharmacy",
            entity_id=getattr(pharmacy_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass
    
    return {"ok": True}
