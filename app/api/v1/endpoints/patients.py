from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Any

from app.api import deps
from app.crud.patient import patient
from app.schemas.patient import Patient, PatientCreate, PatientUpdate
from app.core.logging_config import get_logger, log_medical_access

router = APIRouter()

# Initialize loggers
logger = get_logger(__name__, "app")
medical_logger = get_logger(__name__, "medical")


@router.get("/me", response_model=Patient)
def get_my_patient_record(
    request: Request,
    db: Session = Depends(deps.get_db),
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get current user's patient record.

    Returns the patient record with all basic information:
    - first_name, last_name
    - birthDate
    - gender
    - address
    """
    client_ip = request.client.host if request.client else "unknown"

    patient_record = patient.get_by_user_id(db, user_id=user_id)
    if not patient_record:
        logger.warning(
            f"Patient record not found for user {user_id}",
            extra={
                "category": "medical",
                "event": "patient_record_not_found",
                "user_id": user_id,
                "ip": client_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Patient record not found")
    # Log successful patient record access
    patient_id = getattr(patient_record, "id", 0)
    log_medical_access(
        medical_logger,
        event="patient_record_accessed",
        user_id=user_id,
        patient_id=patient_id,
        ip_address=client_ip,
        message=f"User {user_id} accessed their patient record",
    )

    return patient_record


@router.post("/me", response_model=Patient)
def create_my_patient_record(
    *,
    db: Session = Depends(deps.get_db),
    patient_in: PatientCreate,
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create patient record for current user.

    Required fields:
    - first_name
    - last_name
    - birthDate (YYYY-MM-DD format)
    - gender
    - address
    """
    # Check if user already has a patient record
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if existing_patient:
        raise HTTPException(status_code=400, detail="Patient record already exists")

    # Create patient record
    new_patient = patient.create_for_user(db, user_id=user_id, patient_data=patient_in)
    return new_patient


@router.put("/me", response_model=Patient)
def update_my_patient_record(
    *,
    db: Session = Depends(deps.get_db),
    patient_in: PatientUpdate,
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update current user's patient record.

    All fields are optional for updates:
    - first_name
    - last_name
    - birthDate
    - gender
    - address
    """
    updated_patient = patient.update_for_user(
        db, user_id=user_id, patient_data=patient_in
    )
    if not updated_patient:
        raise HTTPException(status_code=404, detail="Patient record not found")
    return updated_patient


@router.delete("/me")
def delete_my_patient_record(
    db: Session = Depends(deps.get_db), user_id: int = Depends(deps.get_current_user_id)
) -> Any:
    """
    Delete current user's patient record.

    Warning: This will also delete all associated medical records:
    - medications, encounters, lab_results
    - immunizations, conditions, procedures, treatments
    """
    deleted_patient = patient.delete_for_user(db, user_id=user_id)
    if not deleted_patient:
        raise HTTPException(status_code=404, detail="Patient record not found")

    return {"message": "Patient record deleted successfully"}
