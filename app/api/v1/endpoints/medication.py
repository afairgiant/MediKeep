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
from app.core.logging_config import get_logger

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=MedicationResponse)
def create_medication(
    medication_in: MedicationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new medication.
    """
    # Debug logging to see what headers we receive - REMOVE THIS LATER
    auth_header = request.headers.get("authorization")
    logger.info(f"🔍 MEDICATION ENDPOINT: Authorization header = {auth_header}")

    user_ip = request.client.host if request.client else "unknown"

    try:
        medication_obj = medication.create(db=db, obj_in=medication_in)
        medication_id = getattr(medication_obj, "id", None)
        patient_id = getattr(medication_obj, "patient_id", None)

        # Log successful medication creation
        logger.info(
            "Medication created successfully",
            extra={
                "category": "app",
                "event": "medication_created",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "medication_id": medication_id,
                "ip": user_ip,
            },
        )

        return medication_obj

    except Exception as e:
        # Log failed medication creation
        patient_id_input = getattr(medication_in, "patient_id", None)
        logger.error(
            f"Failed to create medication: {str(e)}",
            extra={
                "category": "app",
                "event": "medication_creation_failed",
                "user_id": current_user_id,
                "patient_id": patient_id_input,
                "ip": user_ip,
                "error": str(e),
            },
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
    user_ip = request.client.host if request.client else "unknown"

    medication_obj = medication.get(db=db, id=medication_id)
    if not medication_obj:
        logger.warning(
            f"Medication not found for update: {medication_id}",
            extra={
                "category": "app",
                "event": "medication_update_not_found",
                "user_id": current_user_id,
                "medication_id": medication_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Medication not found")

    patient_id = getattr(medication_obj, "patient_id", None)

    try:
        updated_medication = medication.update(
            db=db, db_obj=medication_obj, obj_in=medication_in
        )

        # Log successful medication update
        logger.info(
            f"Medication updated successfully: {medication_id}",
            extra={
                "category": "app",
                "event": "medication_updated",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "medication_id": medication_id,
                "ip": user_ip,
            },
        )

        return updated_medication

    except Exception as e:
        # Log failed medication update
        logger.error(
            f"Failed to update medication {medication_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "medication_update_failed",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "medication_id": medication_id,
                "ip": user_ip,
                "error": str(e),
            },
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
    user_ip = request.client.host if request.client else "unknown"

    medication_obj = medication.get(db=db, id=medication_id)

    if not medication_obj:
        logger.warning(
            f"Medication not found for deletion: {medication_id}",
            extra={
                "category": "app",
                "event": "medication_delete_not_found",
                "user_id": current_user_id,
                "medication_id": medication_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Medication not found")

    patient_id = getattr(medication_obj, "patient_id", None)

    try:
        medication.delete(db=db, id=medication_id)

        # Log successful medication deletion
        logger.info(
            f"Medication deleted successfully: {medication_id}",
            extra={
                "category": "app",
                "event": "medication_deleted",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "medication_id": medication_id,
                "ip": user_ip,
            },
        )

        return {"message": "Medication deleted successfully"}

    except Exception as e:
        # Log failed medication deletion
        logger.error(
            f"Failed to delete medication {medication_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "medication_deletion_failed",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "medication_id": medication_id,
                "ip": user_ip,
                "error": str(e),
            },
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
