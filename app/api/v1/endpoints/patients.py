from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Any

from app.api import deps
from app.crud.patient import patient
from app.schemas.patient import Patient, PatientCreate, PatientUpdate
from app.core.logging_config import get_logger

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
    - address"""
    user_ip = request.client.host if request.client else "unknown"

    patient_record = patient.get_by_user_id(db, user_id=user_id)
    if not patient_record:
        logger.warning(
            f"Patient record not found for user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_not_found",
                "user_id": user_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    # Log successful patient record access
    patient_id = getattr(patient_record, "id", 0)

    logger.info(
        f"User {user_id} accessed their patient record",
        extra={
            "category": "app",
            "event": "patient_record_accessed",
            "user_id": user_id,
            "patient_id": patient_id,
            "ip": user_ip,
        },
    )

    return patient_record


@router.post("/me", response_model=Patient)
def create_my_patient_record(
    *,
    request: Request,
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
    user_ip = (
        request.client.host if request.client else "unknown"
    )  # Check if user already has a patient record
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if existing_patient:
        logger.warning(
            f"Attempt to create duplicate patient record for user {user_id}",
            extra={
                "category": "app",
                "event": "duplicate_patient_record_attempt",
                "user_id": user_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=400, detail="Patient record already exists")

    try:
        # Create patient record
        new_patient = patient.create_for_user(
            db, user_id=user_id, patient_data=patient_in
        )
        patient_id = getattr(new_patient, "id", None)

        # Log successful patient record creation
        logger.info(
            f"Patient record created successfully for user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_created",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
            },
        )

        return new_patient

    except Exception as e:
        # Log failed patient record creation
        logger.error(
            f"Failed to create patient record for user {user_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_record_creation_failed",
                "user_id": user_id,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise


@router.put("/me", response_model=Patient)
def update_my_patient_record(
    *,
    request: Request,
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
    user_ip = (
        request.client.host if request.client else "unknown"
    )  # Get existing patient record for audit
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if not existing_patient:
        logger.warning(
            f"Patient record not found for update by user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_update_not_found",
                "user_id": user_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    patient_id = getattr(existing_patient, "id", None)

    try:
        updated_patient = patient.update_for_user(
            db, user_id=user_id, patient_data=patient_in
        )

        # Log successful patient record update
        logger.info(
            f"Patient record updated successfully for user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_updated",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
            },
        )

        return updated_patient

    except Exception as e:
        # Log failed patient record update
        logger.error(
            f"Failed to update patient record for user {user_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_record_update_failed",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise


@router.delete("/me")
def delete_my_patient_record(
    request: Request,
    db: Session = Depends(deps.get_db),
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete current user's patient record.

    Warning: This will also delete all associated medical records:
    - medications, encounters, lab_results
    - immunizations, conditions, procedures, treatments
    """
    user_ip = (
        request.client.host if request.client else "unknown"
    )  # Get existing patient record for audit
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if not existing_patient:
        logger.warning(
            f"Patient record not found for deletion by user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_delete_not_found",
                "user_id": user_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    patient_id = getattr(existing_patient, "id", None)

    try:
        patient.delete_for_user(db, user_id=user_id)

        # Log successful patient record deletion
        logger.info(
            f"Patient record deleted successfully for user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_deleted",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
            },
        )

        return {"message": "Patient record deleted successfully"}

    except Exception as e:
        # Log failed patient record deletion
        logger.error(
            f"Failed to delete patient record for user {user_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_record_deletion_failed",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise


@router.get("/current", response_model=Patient)
def get_current_patient_record(
    request: Request,
    db: Session = Depends(deps.get_db),
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get current user's patient record (alias for /me endpoint).
    """
    return get_my_patient_record(request, db, user_id)
