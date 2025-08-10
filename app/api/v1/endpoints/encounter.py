from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.error_handling import (
    handle_database_errors
)
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
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
    encounter_in: EncounterCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new encounter."""
    return handle_create_with_logging(
        db=db,
        crud_obj=encounter,
        obj_in=encounter_in,
        entity_type=EntityType.ENCOUNTER,
        user_id=current_user_id,
        entity_name="Encounter",
        request=request,
    )


@router.get("/", response_model=List[EncounterResponse])
def read_encounters(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    practitioner_id: Optional[int] = Query(None),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Retrieve encounters for the current user or specified patient (Phase 1 support)."""
    
    # Filter encounters by the verified accessible patient_id
    with handle_database_errors(request=request):
        if practitioner_id:
            encounters = encounter.get_by_practitioner(
                db,
                practitioner_id=practitioner_id,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
            )
        else:
            encounters = encounter.get_by_patient(
                db, patient_id=target_patient_id, skip=skip, limit=limit
            )
        return encounters


@router.get("/{encounter_id}", response_model=EncounterWithRelations)
def read_encounter(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    encounter_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Get encounter by ID with related information - only allows access to user's own encounters."""
    with handle_database_errors(request=request):
        encounter_obj = encounter.get_with_relations(
            db=db, record_id=encounter_id, relations=["patient", "practitioner", "condition"]
        )
        handle_not_found(encounter_obj, "Encounter", request)
        verify_patient_ownership(encounter_obj, current_user_patient_id, "encounter")
        return encounter_obj


@router.put("/{encounter_id}", response_model=EncounterResponse)
def update_encounter(
    *,
    encounter_id: int,
    encounter_in: EncounterUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update an encounter."""
    return handle_update_with_logging(
        db=db,
        crud_obj=encounter,
        entity_id=encounter_id,
        obj_in=encounter_in,
        entity_type=EntityType.ENCOUNTER,
        user_id=current_user_id,
        entity_name="Encounter",
        request=request,
    )


@router.delete("/{encounter_id}")
def delete_encounter(
    *,
    encounter_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete an encounter."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=encounter,
        entity_id=encounter_id,
        entity_type=EntityType.ENCOUNTER,
        user_id=current_user_id,
        entity_name="Encounter",
        request=request,
    )


@router.get("/patient/{patient_id}/recent", response_model=List[EncounterResponse])
def get_recent_encounters(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    days: int = Query(default=30, ge=1, le=365),
) -> Any:
    """Get recent encounters for a patient within specified days."""
    with handle_database_errors(request=request):
        encounters = encounter.get_recent(db, patient_id=patient_id, days=days)
        return encounters


@router.get(
    "/patients/{patient_id}/encounters/", response_model=List[EncounterResponse]
)
def get_patient_encounters(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """Get all encounters for a specific patient."""
    with handle_database_errors(request=request):
        encounters = encounter.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )
        return encounters
