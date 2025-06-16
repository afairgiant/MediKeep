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
    Retrieve encounters with optional filtering.
    """
    if patient_id:
        encounters = encounter.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )
    elif practitioner_id:
        encounters = encounter.get_by_practitioner(
            db, practitioner_id=practitioner_id, skip=skip, limit=limit
        )
    else:
        encounters = encounter.get_multi(db, skip=skip, limit=limit)
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
    encounter.delete(db=db, id=encounter_id)
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
