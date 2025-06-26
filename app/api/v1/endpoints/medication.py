from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.medication import medication
from app.models.activity_log import EntityType
from app.schemas.medication import (
    MedicationCreate,
    MedicationResponse,
    MedicationResponseWithNested,
    MedicationUpdate,
)

router = APIRouter()


@router.post("/", response_model=MedicationResponseWithNested)
def create_medication(
    *,
    medication_in: MedicationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new medication."""
    medication_obj = handle_create_with_logging(
        db=db,
        crud_obj=medication,
        obj_in=medication_in,
        entity_type=EntityType.MEDICATION,
        user_id=current_user_id,
        entity_name="Medication",
        request=request,
    )

    # Return with relationships loaded
    medication_id = getattr(medication_obj, "id", None)
    if medication_id:
        return medication.get_with_relations(
            db=db, record_id=medication_id, relations=["practitioner", "pharmacy"]
        )
    return medication_obj


@router.get("/", response_model=List[MedicationResponseWithNested])
def read_medications(
    *,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    name: Optional[str] = Query(None),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Retrieve medications for the current user with optional filtering."""
    medications = medication.get_by_patient(
        db=db,
        patient_id=current_user_patient_id,
        skip=skip,
        limit=limit,
        load_relations=["practitioner", "pharmacy"],
    )

    # Apply name filter if provided
    if name:
        medications = [
            med
            for med in medications
            if name.lower() in getattr(med, "medication_name", "").lower()
        ]

    return medications


@router.get("/{medication_id}", response_model=MedicationResponseWithNested)
def read_medication(
    *,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Get medication by ID - only allows access to user's own medications."""
    medication_obj = medication.get_with_relations(
        db=db, record_id=medication_id, relations=["practitioner", "pharmacy"]
    )
    handle_not_found(medication_obj, "Medication")
    verify_patient_ownership(medication_obj, current_user_patient_id, "medication")
    return medication_obj


@router.put("/{medication_id}", response_model=MedicationResponseWithNested)
def update_medication(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    medication_in: MedicationUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a medication."""
    updated_medication = handle_update_with_logging(
        db=db,
        crud_obj=medication,
        entity_id=medication_id,
        obj_in=medication_in,
        entity_type=EntityType.MEDICATION,
        user_id=current_user_id,
        entity_name="Medication",
        request=request,
    )

    # Return with relationships loaded
    return medication.get_with_relations(
        db=db, record_id=medication_id, relations=["practitioner", "pharmacy"]
    )


@router.delete("/{medication_id}")
def delete_medication(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a medication."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=medication,
        entity_id=medication_id,
        entity_type=EntityType.MEDICATION,
        user_id=current_user_id,
        entity_name="Medication",
        request=request,
    )


@router.get("/patient/{patient_id}", response_model=List[MedicationResponseWithNested])
def read_patient_medications(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    active_only: bool = Query(False),
) -> Any:
    """Get all medications for a specific patient."""
    if active_only:
        medications = medication.get_active_by_patient(db=db, patient_id=patient_id)
    else:
        medications = medication.get_by_patient(
            db=db,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            load_relations=["practitioner", "pharmacy"],
        )
    return medications
