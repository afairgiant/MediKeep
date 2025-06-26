from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.crud.immunization import immunization
from app.models.activity_log import EntityType
from app.schemas.immunization import (
    ImmunizationCreate,
    ImmunizationResponse,
    ImmunizationUpdate,
    ImmunizationWithRelations,
)

router = APIRouter()


@router.post("/", response_model=ImmunizationResponse)
def create_immunization(
    *,
    db: Session = Depends(deps.get_db),
    immunization_in: ImmunizationCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new immunization record.
    """
    immunization_obj = immunization.create(db=db, obj_in=immunization_in)

    # Log the creation activity using centralized logging
    log_create(
        db=db,
        entity_type=EntityType.IMMUNIZATION,
        entity_obj=immunization_obj,
        user_id=current_user_id,
    )

    return immunization_obj


@router.get("/", response_model=List[ImmunizationResponse])
def read_immunizations(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    vaccine_name: Optional[str] = Query(None),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """
    Retrieve immunizations for the current user with optional filtering.
    """
    # Filter immunizations by the user's patient_id (ignore any provided patient_id for security)
    if vaccine_name:
        immunizations = immunization.get_by_vaccine(
            db, vaccine_name=vaccine_name, patient_id=current_user_patient_id
        )
    else:
        immunizations = immunization.get_by_patient(
            db, patient_id=current_user_patient_id, skip=skip, limit=limit
        )
    return immunizations


@router.get("/{immunization_id}", response_model=ImmunizationWithRelations)
def read_immunization(
    *,
    db: Session = Depends(deps.get_db),
    immunization_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """
    Get immunization by ID with related information - only allows access to user's own immunizations.
    """
    # Get immunization and verify it belongs to the user
    immunization_obj = immunization.get_with_relations(
        db=db, record_id=immunization_id, relations=["patient", "practitioner"]
    )
    if not immunization_obj:
        raise HTTPException(status_code=404, detail="Immunization not found")

    # Security check: ensure the immunization belongs to the current user
    deps.verify_patient_record_access(
        getattr(immunization_obj, "patient_id"), current_user_patient_id, "immunization"
    )

    return immunization_obj


@router.put("/{immunization_id}", response_model=ImmunizationResponse)
def update_immunization(
    *,
    db: Session = Depends(deps.get_db),
    immunization_id: int,
    immunization_in: ImmunizationUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update an immunization record.
    """
    immunization_obj = immunization.get(db=db, id=immunization_id)
    if not immunization_obj:
        raise HTTPException(status_code=404, detail="Immunization not found")

    immunization_obj = immunization.update(
        db=db, db_obj=immunization_obj, obj_in=immunization_in
    )

    # Log the update activity using centralized logging
    log_update(
        db=db,
        entity_type=EntityType.IMMUNIZATION,
        entity_obj=immunization_obj,
        user_id=current_user_id,
    )

    return immunization_obj


@router.delete("/{immunization_id}")
def delete_immunization(
    *,
    db: Session = Depends(deps.get_db),
    immunization_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete an immunization record.
    """
    immunization_obj = immunization.get(db=db, id=immunization_id)
    if not immunization_obj:
        raise HTTPException(status_code=404, detail="Immunization not found")

    # Log the deletion activity BEFORE deleting using centralized logging
    log_delete(
        db=db,
        entity_type=EntityType.IMMUNIZATION,
        entity_obj=immunization_obj,
        user_id=current_user_id,
    )

    immunization.delete(db=db, id=immunization_id)
    return {"message": "Immunization deleted successfully"}


@router.get("/patient/{patient_id}/recent", response_model=List[ImmunizationResponse])
def get_recent_immunizations(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    days: int = Query(default=365, ge=1, le=3650),
) -> Any:
    """
    Get recent immunizations for a patient within specified days.
    """
    immunizations = immunization.get_recent_immunizations(
        db, patient_id=patient_id, days=days
    )
    return immunizations


@router.get("/patient/{patient_id}/booster-check/{vaccine_name}")
def check_booster_due(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    vaccine_name: str,
    months_interval: int = Query(default=12, ge=1, le=120),
) -> Any:
    """
    Check if a patient is due for a booster shot.
    """
    is_due = immunization.get_due_for_booster(
        db,
        patient_id=patient_id,
        vaccine_name=vaccine_name,
        months_interval=months_interval,
    )
    return {
        "patient_id": patient_id,
        "vaccine_name": vaccine_name,
        "booster_due": is_due,
    }


@router.get(
    "/patient/{patient_id}/immunizations/", response_model=List[ImmunizationResponse]
)
def get_patient_immunizations(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """
    Get all immunizations for a specific patient.
    """
    immunizations = immunization.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return immunizations
