from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app.api import deps
from app.crud.encounter import encounter
from app.schemas.encounter import (
    EncounterCreate,
    EncounterUpdate,
    EncounterResponse,
    EncounterWithRelations,
)
from app.models.activity_log import ActivityLog
from app.models.models import get_utc_now

router = APIRouter()


@router.post("/", response_model=EncounterResponse)
def create_encounter(
    *,
    db: Session = Depends(deps.get_db),
    encounter_in: EncounterCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new encounter.
    """
    encounter_obj = encounter.create(db=db, obj_in=encounter_in)

    # Log the creation activity
    try:
        description = f"New encounter: {getattr(encounter_obj, 'reason', 'Unknown encounter')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=getattr(encounter_obj, 'patient_id', None),
            action="created",
            entity_type="encounter",
            entity_id=getattr(encounter_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception as e:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass

    return encounter_obj


@router.get("/", response_model=List[EncounterResponse])
def read_encounters(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    practitioner_id: Optional[int] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve encounters for the current user with optional filtering.
    """
    # Get current user's patient record
    from app.crud.patient import patient
    patient_record = patient.get_by_user_id(db, user_id=current_user_id)
    if not patient_record:
        raise HTTPException(status_code=404, detail="Patient record not found")
    
    user_patient_id = getattr(patient_record, "id")
    
    # Filter encounters by the user's patient_id (ignore any provided patient_id for security)
    if practitioner_id:
        encounters = encounter.get_by_practitioner(
            db, practitioner_id=practitioner_id, skip=skip, limit=limit
        )
        # Further filter by user's patient_id
        encounters = [enc for enc in encounters if getattr(enc, 'patient_id') == user_patient_id]
    else:
        encounters = encounter.get_by_patient(db, patient_id=user_patient_id, skip=skip, limit=limit)
    return encounters


@router.get("/{encounter_id}", response_model=EncounterWithRelations)
def read_encounter(
    *,
    db: Session = Depends(deps.get_db),
    encounter_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get encounter by ID with related information.
    """
    encounter_obj = encounter.get_with_relations(db, encounter_id=encounter_id)
    if not encounter_obj:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter_obj


@router.put("/{encounter_id}", response_model=EncounterResponse)
def update_encounter(
    *,
    db: Session = Depends(deps.get_db),
    encounter_id: int,
    encounter_in: EncounterUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update an encounter.
    """
    encounter_obj = encounter.get(db=db, id=encounter_id)
    if not encounter_obj:
        raise HTTPException(status_code=404, detail="Encounter not found")
    encounter_obj = encounter.update(db=db, db_obj=encounter_obj, obj_in=encounter_in)
    
    # Log the update activity
    try:
        description = f"Updated encounter: {getattr(encounter_obj, 'reason', 'Unknown encounter')}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=getattr(encounter_obj, 'patient_id', None),
            action="updated",
            entity_type="encounter",
            entity_id=getattr(encounter_obj, 'id', 0),
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception as e:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass
    
    return encounter_obj


@router.delete("/{encounter_id}")
def delete_encounter(
    *,
    db: Session = Depends(deps.get_db),
    encounter_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete an encounter.
    """
    encounter_obj = encounter.get(db=db, id=encounter_id)
    if not encounter_obj:
        raise HTTPException(status_code=404, detail="Encounter not found")
    
    # Store name before deletion for logging
    encounter_name = getattr(encounter_obj, 'reason', 'Unknown encounter')
    encounter_patient_id = getattr(encounter_obj, 'patient_id', None)
    
    encounter.delete(db=db, id=encounter_id)
    
    # Log the delete activity
    try:
        description = f"Deleted encounter: {encounter_name}"
        activity_log = ActivityLog(
            user_id=current_user_id,
            patient_id=encounter_patient_id,
            action="deleted",
            entity_type="encounter",
            entity_id=encounter_id,
            description=description,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception:
        # Don't fail the main operation if logging fails
        db.rollback()
        pass
    
    return {"message": "Encounter deleted successfully"}


@router.get("/patient/{patient_id}/recent", response_model=List[EncounterResponse])
def get_recent_encounters(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get recent encounters for a patient within specified days.
    """
    encounters = encounter.get_recent(db, patient_id=patient_id, days=days)
    return encounters


@router.get(
    "/patients/{patient_id}/encounters/", response_model=List[EncounterResponse]
)
def get_patient_encounters(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all encounters for a specific patient.
    """
    encounters = encounter.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return encounters
