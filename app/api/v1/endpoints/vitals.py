from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Any, List, Optional
from datetime import datetime

from app.api import deps
from app.crud.vitals import vitals
from app.schemas.vitals import (
    VitalsCreate,
    VitalsUpdate,
    VitalsResponse,
    VitalsStats
)
from app.core.logging_config import get_logger

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=VitalsResponse)
def create_vitals(
    vitals_in: VitalsCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new vitals reading.
    """
    auth_header = request.headers.get("authorization")
    logger.info(f"🔍 VITALS ENDPOINT: Authorization header = {auth_header}")

    user_ip = request.client.host if request.client else "unknown"

    try:
        # Use create_with_bmi to automatically calculate BMI if weight and height provided
        vitals_obj = vitals.create_with_bmi(db=db, obj_in=vitals_in)
        vitals_id = getattr(vitals_obj, "id", None)
        patient_id = getattr(vitals_obj, "patient_id", None)

        # Log successful vitals creation
        logger.info(
            "Vitals reading created successfully",
            extra={
                "category": "app",
                "event": "vitals_created",
                "user_id": current_user_id,
                "patient_id": patient_id,
                "vitals_id": vitals_id,
                "ip": user_ip,
            },
        )

        return vitals_obj

    except Exception as e:
        # Log failed vitals creation
        patient_id_input = getattr(vitals_in, "patient_id", None)
        logger.error(
            f"Failed to create vitals reading: {str(e)}",
            extra={
                "category": "app",
                "event": "vitals_creation_failed",
                "user_id": current_user_id,
                "patient_id": patient_id_input,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise


@router.get("/", response_model=List[VitalsResponse])
def read_vitals(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve vitals readings.
    """
    vitals_list = vitals.get_multi(db, skip=skip, limit=limit)
    return vitals_list


@router.get("/{vitals_id}", response_model=VitalsResponse)
def read_vitals_by_id(
    *,
    db: Session = Depends(deps.get_db),
    vitals_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get vitals reading by ID.
    """
    vitals_obj = vitals.get(db=db, id=vitals_id)
    if not vitals_obj:
        raise HTTPException(status_code=404, detail="Vitals reading not found")
    return vitals_obj


@router.put("/{vitals_id}", response_model=VitalsResponse)
def update_vitals(
    *,
    db: Session = Depends(deps.get_db),
    vitals_id: int,
    vitals_in: VitalsUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update vitals reading.
    """
    vitals_obj = vitals.get(db=db, id=vitals_id)
    if not vitals_obj:
        raise HTTPException(status_code=404, detail="Vitals reading not found")
    
    # If weight and height are being updated, recalculate BMI
    update_data = vitals_in.dict(exclude_unset=True)
    current_weight = update_data.get("weight", vitals_obj.weight)
    current_height = update_data.get("height", vitals_obj.height)
    
    if current_weight and current_height:
        bmi = vitals.calculate_bmi(current_weight, current_height)
        update_data["bmi"] = bmi
    
    vitals_obj = vitals.update(db=db, db_obj=vitals_obj, obj_in=update_data)
    return vitals_obj


@router.delete("/{vitals_id}")
def delete_vitals(
    *,
    db: Session = Depends(deps.get_db),
    vitals_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a vitals reading.
    """
    vitals_obj = vitals.get(db=db, id=vitals_id)
    if not vitals_obj:
        raise HTTPException(status_code=404, detail="Vitals reading not found")
    db.delete(vitals_obj)
    db.commit()
    return {"message": "Vitals reading deleted successfully"}


@router.get("/patient/{patient_id}", response_model=List[VitalsResponse])
def read_patient_vitals(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    vital_type: Optional[str] = Query(None, description="Filter by vital type: blood_pressure, heart_rate, temperature, weight, oxygen_saturation, blood_glucose"),
    days: Optional[int] = Query(None, description="Get readings from last N days"),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all vitals readings for a specific patient.
    """
    if days:
        # Get recent readings
        vitals_list = vitals.get_recent_readings(db=db, patient_id=patient_id, days=days)
    elif vital_type:
        # Get by specific vital type
        vitals_list = vitals.get_by_vital_type(
            db=db, patient_id=patient_id, vital_type=vital_type, skip=skip, limit=limit
        )
    else:
        # Get all readings for patient
        vitals_list = vitals.get_by_patient(
            db=db, patient_id=patient_id, skip=skip, limit=limit
        )
    
    return vitals_list


@router.get("/patient/{patient_id}/latest", response_model=VitalsResponse)
def read_patient_latest_vitals(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get the most recent vitals reading for a patient.
    """
    latest_vitals = vitals.get_latest_by_patient(db=db, patient_id=patient_id)
    if not latest_vitals:
        raise HTTPException(status_code=404, detail="No vitals readings found for this patient")
    return latest_vitals


@router.get("/patient/{patient_id}/stats", response_model=VitalsStats)
def read_patient_vitals_stats(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get vitals statistics for a patient.
    """
    stats = vitals.get_vitals_stats(db=db, patient_id=patient_id)
    return stats


@router.get("/patient/{patient_id}/date-range", response_model=List[VitalsResponse])
def read_patient_vitals_date_range(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    start_date: datetime = Query(..., description="Start date for the range"),
    end_date: datetime = Query(..., description="End date for the range"),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get vitals readings for a patient within a specific date range.
    """
    vitals_list = vitals.get_by_patient_date_range(
        db=db,
        patient_id=patient_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )
    return vitals_list


@router.post("/patient/{patient_id}/vitals/", response_model=VitalsResponse)
def create_patient_vitals(
    patient_id: int,
    vitals_in: VitalsCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Create a new vitals reading for a specific patient"""
    # Ensure the patient_id in the URL matches the one in the request body
    if vitals_in.patient_id != patient_id:
        raise HTTPException(
            status_code=400,
            detail="Patient ID in URL does not match patient ID in request body"
        )
    
    return create_vitals(
        vitals_in=vitals_in,
        request=request,
        db=db,
        current_user_id=current_user_id
    )
