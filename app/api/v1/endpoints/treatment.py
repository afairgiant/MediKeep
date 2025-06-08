from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app.api import deps
from app.crud.treatment import treatment
from app.schemas.treatment import (
    TreatmentCreate,
    TreatmentUpdate,
    TreatmentResponse,
    TreatmentWithRelations,
)

router = APIRouter()


@router.post("/", response_model=TreatmentResponse)
def create_treatment(
    *,
    db: Session = Depends(deps.get_db),
    treatment_in: TreatmentCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new treatment.
    """
    treatment_obj = treatment.create(db=db, obj_in=treatment_in)
    return treatment_obj


@router.get("/", response_model=List[TreatmentResponse])
def read_treatments(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    condition_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve treatments with optional filtering.
    """
    if patient_id and status:
        treatments = treatment.get_by_status(db, status=status, patient_id=patient_id)
    elif patient_id:
        treatments = treatment.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )
    elif condition_id:
        treatments = treatment.get_by_condition(
            db, condition_id=condition_id, skip=skip, limit=limit
        )
    elif status:
        treatments = treatment.get_by_status(db, status=status)
    else:
        treatments = treatment.get_multi(db, skip=skip, limit=limit)
    return treatments


@router.get("/{treatment_id}", response_model=TreatmentWithRelations)
def read_treatment(
    *,
    db: Session = Depends(deps.get_db),
    treatment_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get treatment by ID with related information.
    """
    treatment_obj = treatment.get_with_relations(db, treatment_id=treatment_id)
    if not treatment_obj:
        raise HTTPException(status_code=404, detail="Treatment not found")
    return treatment_obj


@router.put("/{treatment_id}", response_model=TreatmentResponse)
def update_treatment(
    *,
    db: Session = Depends(deps.get_db),
    treatment_id: int,
    treatment_in: TreatmentUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a treatment.
    """
    treatment_obj = treatment.get(db=db, id=treatment_id)
    if not treatment_obj:
        raise HTTPException(status_code=404, detail="Treatment not found")
    treatment_obj = treatment.update(db=db, db_obj=treatment_obj, obj_in=treatment_in)
    return treatment_obj


@router.delete("/{treatment_id}")
def delete_treatment(
    *,
    db: Session = Depends(deps.get_db),
    treatment_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a treatment.
    """
    treatment_obj = treatment.get(db=db, id=treatment_id)
    if not treatment_obj:
        raise HTTPException(status_code=404, detail="Treatment not found")
    treatment.delete(db=db, id=treatment_id)
    return {"message": "Treatment deleted successfully"}


@router.get("/patient/{patient_id}/active", response_model=List[TreatmentResponse])
def get_active_treatments(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all active treatments for a patient.
    """
    treatments = treatment.get_active_treatments(db, patient_id=patient_id)
    return treatments


@router.get("/ongoing", response_model=List[TreatmentResponse])
def get_ongoing_treatments(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get treatments that are currently ongoing.
    """
    treatments = treatment.get_ongoing(db, patient_id=patient_id)
    return treatments
