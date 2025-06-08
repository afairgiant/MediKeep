from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any

from app.api import deps
from app.crud.patient import patient
from app.schemas.patient import Patient, PatientCreate, PatientUpdate

router = APIRouter()


@router.get("/me", response_model=Patient)
def get_my_patient_record(
    db: Session = Depends(deps.get_db), user_id: int = Depends(deps.get_current_user_id)
) -> Any:
    """
    Get current user's patient record.

    Returns the patient record with all basic information:
    - first_name, last_name
    - birthDate
    - gender
    - address
    """
    patient_record = patient.get_by_user_id(db, user_id=user_id)
    if not patient_record:
        raise HTTPException(status_code=404, detail="Patient record not found")
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
