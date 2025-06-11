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
from app.core.logging_config import get_logger

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


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
    user_ip = request.client.host if request.client else "unknown"

    try:
        treatment_obj = treatment.create(db=db, obj_in=treatment_in)
        treatment_id = getattr(treatment_obj, "id", None)
        patient_id = getattr(treatment_obj, "patient_id", None)

        # Log successful treatment creation
        logger.info(
            "Treatment created successfully",
            extra={
                "category": "app",
                "event": "treatment_created",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "treatment_id": treatment_id,
                "ip": user_ip,
            },
        )

        return treatment_obj

    except Exception as e:
        # Log failed treatment creation
        patient_id_input = getattr(treatment_in, "patient_id", None)
        logger.error(
            f"Failed to create treatment: {str(e)}",
            extra={
                "category": "app",
                "event": "treatment_creation_failed",
                "user_id": current_user_id,
                "patient_id": patient_id_input,
                "ip": user_ip,
                "error": str(e),
            },
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
    user_ip = request.client.host if request.client else "unknown"

    treatment_obj = treatment.get(db=db, id=treatment_id)
    if not treatment_obj:
        logger.warning(
            f"Treatment not found for update: {treatment_id}",
            extra={
                "category": "app",
                "event": "treatment_update_not_found",
                "user_id": current_user_id,
                "treatment_id": treatment_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Treatment not found")

    patient_id = getattr(treatment_obj, "patient_id", None)

    try:
        updated_treatment = treatment.update(
            db=db, db_obj=treatment_obj, obj_in=treatment_in
        )

        # Log successful treatment update
        logger.info(
            f"Treatment updated successfully: {treatment_id}",
            extra={
                "category": "app",
                "event": "treatment_updated",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "treatment_id": treatment_id,
                "ip": user_ip,
            },
        )

        return updated_treatment

    except Exception as e:
        # Log failed treatment update
        logger.error(
            f"Failed to update treatment {treatment_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "treatment_update_failed",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "treatment_id": treatment_id,
                "ip": user_ip,
                "error": str(e),
            },
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
    user_ip = request.client.host if request.client else "unknown"

    treatment_obj = treatment.get(db=db, id=treatment_id)

    if not treatment_obj:
        logger.warning(
            f"Treatment not found for deletion: {treatment_id}",
            extra={
                "category": "app",
                "event": "treatment_delete_not_found",
                "user_id": current_user_id,
                "treatment_id": treatment_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Treatment not found")

    patient_id = getattr(treatment_obj, "patient_id", None)

    try:
        treatment.delete(db=db, id=treatment_id)

        # Log successful treatment deletion
        logger.info(
            f"Treatment deleted successfully: {treatment_id}",
            extra={
                "category": "app",
                "event": "treatment_deleted",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "treatment_id": treatment_id,
                "ip": user_ip,
            },
        )

        return {"message": "Treatment deleted successfully"}

    except Exception as e:
        # Log failed treatment deletion
        logger.error(
            f"Failed to delete treatment {treatment_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "treatment_deletion_failed",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "treatment_id": treatment_id,
                "ip": user_ip,
                "error": str(e),
            },
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
