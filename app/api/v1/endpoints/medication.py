from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app.api import deps
from app.crud.medication import medication
from app.schemas.medication import (
    MedicationCreate,
    MedicationUpdate,
    MedicationResponse,
)
from app.core.medical_audit import medical_auditor

router = APIRouter()


@router.post("/", response_model=MedicationResponse)
def create_medication(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    medication_in: MedicationCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new medication.
    """
    client_ip = request.client.host if request.client else "unknown"

    try:
        medication_obj = medication.create(db=db, obj_in=medication_in)
        medication_id = getattr(medication_obj, "id", None)
        patient_id = getattr(medication_obj, "patient_id", None)

        # Log successful medication creation
        if patient_id and medication_id:
            medical_auditor.log_medication_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                medication_id=int(medication_id),
                action="create",
                ip_address=client_ip,
                medication_data=medication_in.dict(),
                success=True,
            )

        return medication_obj

    except Exception as e:
        # Log failed medication creation
        patient_id_input = getattr(medication_in, "patient_id", None)
        if patient_id_input:
            medical_auditor.log_medication_operation(
                user_id=current_user_id,
                patient_id=int(patient_id_input),
                medication_id=None,
                action="create",
                ip_address=client_ip,
                medication_data=medication_in.dict(),
                success=False,
                error_message=str(e),
            )
        raise


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
    request: Request,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    medication_in: MedicationUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a medication.
    """
    client_ip = request.client.host if request.client else "unknown"

    medication_obj = medication.get(db=db, id=medication_id)
    if not medication_obj:
        # Log failed medication access
        medical_auditor.log_medication_operation(
            user_id=current_user_id,
            patient_id=0,  # Unknown patient since medication not found
            medication_id=medication_id,
            action="update",
            ip_address=client_ip,
            success=False,
            error_message="Medication not found",
        )
        raise HTTPException(status_code=404, detail="Medication not found")

    # Get previous values for audit
    previous_data = {
        "medication_name": getattr(medication_obj, "medication_name", None),
        "dosage": getattr(medication_obj, "dosage", None),
        "frequency": getattr(medication_obj, "frequency", None),
        "status": getattr(medication_obj, "status", None),
    }
    patient_id = getattr(medication_obj, "patient_id", None)

    try:
        updated_medication = medication.update(
            db=db, db_obj=medication_obj, obj_in=medication_in
        )

        # Log successful medication update
        if patient_id:
            medical_auditor.log_medication_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                medication_id=medication_id,
                action="update",
                ip_address=client_ip,
                medication_data=medication_in.dict(exclude_unset=True),
                previous_data=previous_data,
                success=True,
            )

        return updated_medication

    except Exception as e:
        # Log failed medication update
        if patient_id:
            medical_auditor.log_medication_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                medication_id=medication_id,
                action="update",
                ip_address=client_ip,
                medication_data=medication_in.dict(exclude_unset=True),
                previous_data=previous_data,
                success=False,
                error_message=str(e),
            )
        raise


@router.delete("/{medication_id}")
def delete_medication(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a medication.
    """
    client_ip = request.client.host if request.client else "unknown"

    medication_obj = medication.get(db=db, id=medication_id)
    if not medication_obj:
        # Log failed medication access
        medical_auditor.log_medication_operation(
            user_id=current_user_id,
            patient_id=0,  # Unknown patient since medication not found
            medication_id=medication_id,
            action="delete",
            ip_address=client_ip,
            success=False,
            error_message="Medication not found",
        )
        raise HTTPException(status_code=404, detail="Medication not found")

    # Get medication data for audit before deletion
    patient_id = getattr(medication_obj, "patient_id", None)
    medication_data = {
        "medication_name": getattr(medication_obj, "medication_name", None),
        "dosage": getattr(medication_obj, "dosage", None),
        "frequency": getattr(medication_obj, "frequency", None),
        "status": getattr(medication_obj, "status", None),
    }

    try:
        medication.delete(db=db, id=medication_id)

        # Log successful medication deletion
        if patient_id:
            medical_auditor.log_medication_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                medication_id=medication_id,
                action="delete",
                ip_address=client_ip,
                previous_data=medication_data,
                success=True,
            )

        return {"message": "Medication deleted successfully"}

    except Exception as e:
        # Log failed medication deletion
        if patient_id:
            medical_auditor.log_medication_operation(
                user_id=current_user_id,
                patient_id=int(patient_id),
                medication_id=medication_id,
                action="delete",
                ip_address=client_ip,
                previous_data=medication_data,
                success=False,
                error_message=str(e),
            )
        raise


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
