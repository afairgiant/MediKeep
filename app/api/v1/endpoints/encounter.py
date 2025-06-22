from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.crud.encounter import encounter
from app.models.activity_log import EntityType
from app.schemas.encounter import (
    EncounterCreate,
    EncounterResponse,
    EncounterUpdate,
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

    # Log the creation activity using centralized logging
    log_create(
        db=db,
        entity_type=EntityType.ENCOUNTER,
        entity_obj=encounter_obj,
        user_id=current_user_id,
    )

    return encounter_obj


@router.get("/", response_model=List[EncounterResponse])
def read_encounters(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    practitioner_id: Optional[int] = Query(None),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """
    Retrieve encounters for the current user with optional filtering.
    """
    # Filter encounters by the user's patient_id (ignore any provided patient_id for security)
    if practitioner_id:
        encounters = encounter.get_by_practitioner(
            db,
            practitioner_id=practitioner_id,
            patient_id=current_user_patient_id,
            skip=skip,
            limit=limit,
        )
    else:
        encounters = encounter.get_by_patient(
            db, patient_id=current_user_patient_id, skip=skip, limit=limit
        )
    return encounters


@router.get("/{encounter_id}", response_model=EncounterWithRelations)
def read_encounter(
    *,
    db: Session = Depends(deps.get_db),
    encounter_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """
    Get encounter by ID with related information - only allows access to user's own encounters.
    """
    encounter_obj = encounter.get_with_relations(db, encounter_id=encounter_id)
    if not encounter_obj:
        raise HTTPException(status_code=404, detail="Encounter not found")

    # Security check: ensure the encounter belongs to the current user
    deps.verify_patient_record_access(
        getattr(encounter_obj, "patient_id"), current_user_patient_id, "encounter"
    )

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
        encounter_obj = encounter.update(
            db=db, db_obj=encounter_obj, obj_in=encounter_in
        )

    # Log the update activity using centralized logging
    log_update(
        db=db,
        entity_type=EntityType.ENCOUNTER,
        entity_obj=encounter_obj,
        user_id=current_user_id,
    )

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

        # Log the delete activity BEFORE deleting using centralized logging
    log_delete(
        db=db,
        entity_type=EntityType.ENCOUNTER,
        entity_obj=encounter_obj,
        user_id=current_user_id,
    )

    encounter.delete(db=db, id=encounter_id)

    return {"message": "Encounter deleted successfully"}


@router.get("/patient/{patient_id}/recent", response_model=List[EncounterResponse])
def get_recent_encounters(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    days: int = Query(default=30, ge=1, le=365),
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
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """
    Get all encounters for a specific patient.
    """
    encounters = encounter.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return encounters
