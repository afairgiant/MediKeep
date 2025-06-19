from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app.api import deps
from app.crud.allergy import allergy
from app.schemas.allergy import (
    AllergyCreate,
    AllergyUpdate,
    AllergyResponse,
    AllergyWithRelations,
)
from app.models.activity_log import ActivityLog
from app.models.models import get_utc_now

router = APIRouter()


@router.post("/", response_model=AllergyResponse)
def create_allergy(
    *,
    db: Session = Depends(deps.get_db),
    allergy_in: AllergyCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new allergy record.
    """
    allergy_obj = allergy.create(db=db, obj_in=allergy_in)
    
    # Log the creation activity
    try:
        description = f"New allergy: {getattr(allergy_obj, 'allergen', 'Unknown allergen')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=getattr(allergy_obj, 'patient_id', None),
            action="created",
            entity_type="allergy",
            entity_id=getattr(allergy_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception as e:
        # Don't fail the main operation if logging fails
        db.rollback()
        print(f"Error logging allergy creation activity: {e}")
    
    return allergy_obj


@router.get("/", response_model=List[AllergyResponse])
def read_allergies(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    allergen: Optional[str] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve allergies with optional filtering.
    """
    if patient_id and severity:
        allergies = allergy.get_by_severity(
            db, severity=severity, patient_id=patient_id
        )
    elif patient_id and allergen:
        allergies = allergy.get_by_allergen(
            db, allergen=allergen, patient_id=patient_id
        )
    elif patient_id:
        allergies = allergy.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )
    elif severity:
        allergies = allergy.get_by_severity(db, severity=severity)
    elif allergen:
        allergies = allergy.get_by_allergen(db, allergen=allergen)
    else:
        allergies = allergy.get_multi(db, skip=skip, limit=limit)
    return allergies


@router.get("/{allergy_id}", response_model=AllergyWithRelations)
def read_allergy(
    *,
    db: Session = Depends(deps.get_db),
    allergy_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get allergy by ID with related information.
    """
    allergy_obj = allergy.get_with_relations(db, allergy_id=allergy_id)
    if not allergy_obj:
        raise HTTPException(status_code=404, detail="Allergy not found")
    return allergy_obj


@router.put("/{allergy_id}", response_model=AllergyResponse)
def update_allergy(
    *,
    db: Session = Depends(deps.get_db),
    allergy_id: int,
    allergy_in: AllergyUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update an allergy record.
    """
    allergy_obj = allergy.get(db=db, id=allergy_id)
    if not allergy_obj:
        raise HTTPException(status_code=404, detail="Allergy not found")
    
    allergy_obj = allergy.update(db=db, db_obj=allergy_obj, obj_in=allergy_in)
    
    # Log the update activity
    try:
        description = f"Updated allergy: {getattr(allergy_obj, 'allergen', 'Unknown allergen')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=getattr(allergy_obj, 'patient_id', None),
            action="updated",
            entity_type="allergy",
            entity_id=getattr(allergy_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception as e:
        # Don't fail the main operation if logging fails
        db.rollback()
        print(f"Error logging allergy update activity: {e}")
    
    return allergy_obj


@router.delete("/{allergy_id}")
def delete_allergy(
    *,
    db: Session = Depends(deps.get_db),
    allergy_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
    ) -> Any:
    """
    Delete an allergy record.
    """
    allergy_obj = allergy.get(db=db, id=allergy_id)
    if not allergy_obj:
        raise HTTPException(status_code=404, detail="Allergy not found")
    
    # Log the deletion activity BEFORE deleting
    try:
        description = f"Deleted allergy: {getattr(allergy_obj, 'allergen', 'Unknown allergen')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=getattr(allergy_obj, 'patient_id', None),
            action="deleted",
            entity_type="allergy",
            entity_id=getattr(allergy_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception as e:
        # Don't fail the main operation if logging fails
        db.rollback()
        print(f"Error logging allergy deletion activity: {e}")
    
    allergy.delete(db=db, id=allergy_id)
    return {"message": "Allergy deleted successfully"}


@router.get("/patient/{patient_id}/active", response_model=List[AllergyResponse])
def get_active_allergies(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all active allergies for a patient.
    """
    allergies = allergy.get_active_allergies(db, patient_id=patient_id)
    return allergies


@router.get("/patient/{patient_id}/critical", response_model=List[AllergyResponse])
def get_critical_allergies(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get critical (severe and life-threatening) allergies for a patient.
    """
    allergies = allergy.get_critical_allergies(db, patient_id=patient_id)
    return allergies


@router.get("/patient/{patient_id}/check/{allergen}")
def check_allergen_conflict(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    allergen: str,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Check if a patient has any active allergies to a specific allergen.
    """
    has_allergy = allergy.check_allergen_conflict(
        db, patient_id=patient_id, allergen=allergen
    )
    return {"patient_id": patient_id, "allergen": allergen, "has_allergy": has_allergy}


@router.get("/patients/{patient_id}/allergies/", response_model=List[AllergyResponse])
def get_patient_allergies(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all allergies for a specific patient.
    """
    allergies = allergy.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return allergies
