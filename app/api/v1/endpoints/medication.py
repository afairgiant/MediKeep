from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app.api import deps
from app.crud.medication import medication
from app.schemas.medication import (
    MedicationCreate,
    MedicationUpdate,
    MedicationResponse,
)

router = APIRouter()


@router.post("/", response_model=MedicationResponse)
def create_medication(
    *,
    db: Session = Depends(deps.get_db),
    medication_in: MedicationCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new medication.
    """
    medication_obj = medication.create(db=db, obj_in=medication_in)
    return medication_obj


@router.get("/", response_model=List[MedicationResponse])
def read_medications(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    name: Optional[str] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve medications with optional filtering.
    """
    if name:
        medications = medication.get_by_name(db=db, name=name, skip=skip, limit=limit)
    else:
        medications = medication.get_multi(db, skip=skip, limit=limit)
    return medications


@router.get("/{medication_id}", response_model=MedicationResponse)
def read_medication(
    *,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get medication by ID.
    """
    medication_obj = medication.get(db=db, id=medication_id)
    if not medication_obj:
        raise HTTPException(status_code=404, detail="Medication not found")
    return medication_obj


@router.put("/{medication_id}", response_model=MedicationResponse)
def update_medication(
    *,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    medication_in: MedicationUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a medication.
    """
    medication_obj = medication.get(db=db, id=medication_id)
    if not medication_obj:
        raise HTTPException(status_code=404, detail="Medication not found")
    medication_obj = medication.update(
        db=db, db_obj=medication_obj, obj_in=medication_in
    )
    return medication_obj


@router.delete("/{medication_id}")
def delete_medication(
    *,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a medication.
    """
    medication_obj = medication.get(db=db, id=medication_id)
    if not medication_obj:
        raise HTTPException(status_code=404, detail="Medication not found")
    medication.delete(db=db, id=medication_id)
    return {"message": "Medication deleted successfully"}


@router.get("/patient/{patient_id}", response_model=List[MedicationResponse])
def read_patient_medications(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    active_only: bool = Query(False),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all medications for a specific patient.
    """
    if active_only:
        medications = medication.get_active_by_patient(db=db, patient_id=patient_id)
    else:
        medications = medication.get_by_patient(
            db=db, patient_id=patient_id, skip=skip, limit=limit
        )
    return medications
