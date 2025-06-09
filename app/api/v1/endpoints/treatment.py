from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
from app.core.medical_audit import medical_auditor

router = APIRouter()


@router.post("/", response_model=TreatmentResponse)
def create_treatment(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    treatment_in: TreatmentCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new treatment.
    """
    client_ip = request.client.host if request.client else "unknown"

    try:
        treatment_obj = treatment.create(db=db, obj_in=treatment_in)
        treatment_id = getattr(treatment_obj, "id", None)
        patient_id = getattr(treatment_obj, "patient_id", None)

        # Log successful treatment creation
        if patient_id and treatment_id:
            medical_auditor.log_treatment_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                treatment_id=int(treatment_id),
                action="create",
                ip_address=client_ip,
                treatment_data=treatment_in.dict(),
                success=True,
            )

        return treatment_obj

    except Exception as e:
        # Log failed treatment creation
        patient_id_input = getattr(treatment_in, "patient_id", None)
        if patient_id_input:
            medical_auditor.log_treatment_operation(
                user_id=current_user_id,
                patient_id=int(patient_id_input),
                treatment_id=None,
                action="create",
                ip_address=client_ip,
                treatment_data=treatment_in.dict(),
                success=False,
                error_message=str(e),
            )
        raise


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
    request: Request,
    db: Session = Depends(deps.get_db),
    treatment_id: int,
    treatment_in: TreatmentUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a treatment.
    """
    client_ip = request.client.host if request.client else "unknown"

    treatment_obj = treatment.get(db=db, id=treatment_id)
    if not treatment_obj:
        # Log failed treatment access
        medical_auditor.log_treatment_operation(
            user_id=current_user_id,
            patient_id=0,  # Unknown patient since treatment not found
            treatment_id=treatment_id,
            action="update",
            ip_address=client_ip,
            success=False,
            error_message="Treatment not found",
        )
        raise HTTPException(status_code=404, detail="Treatment not found")

    # Get previous values for audit
    previous_data = {
        "treatment_type": getattr(treatment_obj, "treatment_type", None),
        "status": getattr(treatment_obj, "status", None),
        "start_date": str(getattr(treatment_obj, "start_date", None)),
        "end_date": str(getattr(treatment_obj, "end_date", None)),
    }
    patient_id = getattr(treatment_obj, "patient_id", None)

    try:
        updated_treatment = treatment.update(
            db=db, db_obj=treatment_obj, obj_in=treatment_in
        )

        # Log successful treatment update
        if patient_id:
            medical_auditor.log_treatment_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                treatment_id=treatment_id,
                action="update",
                ip_address=client_ip,
                treatment_data=treatment_in.dict(exclude_unset=True),
                previous_data=previous_data,
                success=True,
            )

        return updated_treatment

    except Exception as e:
        # Log failed treatment update
        if patient_id:
            medical_auditor.log_treatment_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                treatment_id=treatment_id,
                action="update",
                ip_address=client_ip,
                treatment_data=treatment_in.dict(exclude_unset=True),
                previous_data=previous_data,
                success=False,
                error_message=str(e),
            )
        raise


@router.delete("/{treatment_id}")
def delete_treatment(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    treatment_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a treatment.
    """
    client_ip = request.client.host if request.client else "unknown"

    treatment_obj = treatment.get(db=db, id=treatment_id)
    if not treatment_obj:
        # Log failed treatment access
        medical_auditor.log_treatment_operation(
            user_id=current_user_id,
            patient_id=0,  # Unknown patient since treatment not found
            treatment_id=treatment_id,
            action="delete",
            ip_address=client_ip,
            success=False,
            error_message="Treatment not found",
        )
        raise HTTPException(status_code=404, detail="Treatment not found")

    # Get treatment data for audit before deletion
    patient_id = getattr(treatment_obj, "patient_id", None)
    treatment_data = {
        "treatment_type": getattr(treatment_obj, "treatment_type", None),
        "status": getattr(treatment_obj, "status", None),
        "start_date": str(getattr(treatment_obj, "start_date", None)),
        "end_date": str(getattr(treatment_obj, "end_date", None)),
    }

    try:
        treatment.delete(db=db, id=treatment_id)

        # Log successful treatment deletion
        if patient_id:
            medical_auditor.log_treatment_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                treatment_id=treatment_id,
                action="delete",
                ip_address=client_ip,
                previous_data=treatment_data,
                success=True,
            )

        return {"message": "Treatment deleted successfully"}

    except Exception as e:
        # Log failed treatment deletion
        if patient_id:
            medical_auditor.log_treatment_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                treatment_id=treatment_id,
                action="delete",
                ip_address=client_ip,
                previous_data=treatment_data,
                success=False,
                error_message=str(e),
            )
        raise


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
