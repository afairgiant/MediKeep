from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.crud.allergy import allergy
from app.models.activity_log import EntityType
from app.schemas.allergy import (
    AllergyCreate,
    AllergyResponse,
    AllergyUpdate,
    AllergyWithRelations,
)

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

    # Log the creation activity using centralized logging
    log_create(
        db=db,
        entity_type=EntityType.ALLERGY,
        entity_obj=allergy_obj,
        user_id=current_user_id,
    )

    return allergy_obj


@router.get("/", response_model=List[AllergyResponse])
def read_allergies(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    allergen: Optional[str] = Query(None),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """
    Retrieve allergies for the current user with optional filtering.
    """
    # Filter allergies by the user's patient_id (ignore any provided patient_id for security)
    if severity:
        allergies = allergy.get_by_severity(
            db, severity=severity, patient_id=current_user_patient_id
        )
    elif allergen:
        allergies = allergy.get_by_allergen(
            db, allergen=allergen, patient_id=current_user_patient_id
        )
    else:
        allergies = allergy.get_by_patient(
            db, patient_id=current_user_patient_id, skip=skip, limit=limit
        )
    return allergies


@router.get("/{allergy_id}", response_model=AllergyWithRelations)
def read_allergy(
    *,
    db: Session = Depends(deps.get_db),
    allergy_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """
    Get allergy by ID with related information - only allows access to user's own allergies.
    """
    # Get allergy and verify it belongs to the user
    allergy_obj = allergy.get_with_relations(db, allergy_id=allergy_id)
    if not allergy_obj:
        raise HTTPException(status_code=404, detail="Allergy not found")

    # Security check: ensure the allergy belongs to the current user
    deps.verify_patient_record_access(
        getattr(allergy_obj, "patient_id"), current_user_patient_id, "allergy"
    )

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

    # Log the update activity using centralized logging
    log_update(
        db=db,
        entity_type=EntityType.ALLERGY,
        entity_obj=allergy_obj,
        user_id=current_user_id,
    )

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

    # Log the deletion activity BEFORE deleting (using centralized logging)
    log_delete(
        db=db,
        entity_type=EntityType.ALLERGY,
        entity_obj=allergy_obj,
        user_id=current_user_id,
    )

    allergy.delete(db=db, id=allergy_id)
    return {"message": "Allergy deleted successfully"}


@router.get("/patient/{patient_id}/active", response_model=List[AllergyResponse])
def get_active_allergies(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
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
    patient_id: int = Depends(deps.verify_patient_access),
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
    patient_id: int = Depends(deps.verify_patient_access),
    allergen: str,
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
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """
    Get all allergies for a specific patient.
    """
    allergies = allergy.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return allergies
