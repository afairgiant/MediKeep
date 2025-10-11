from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import BusinessLogicException, NotFoundException
from app.core.error_handling import handle_database_errors
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.vitals import vitals
from app.models.activity_log import EntityType
from app.schemas.vitals import VitalsCreate, VitalsResponse, VitalsStats, VitalsUpdate

router = APIRouter()


@router.post("/", response_model=VitalsResponse)
def create_vitals(
    *,
    vitals_in: VitalsCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new vitals reading."""
    return handle_create_with_logging(
        db=db,
        crud_obj=vitals,
        obj_in=vitals_in,
        entity_type=EntityType.VITALS,
        user_id=current_user_id,
        entity_name="Vitals",
        request=request,
    )


@router.get("/", response_model=List[VitalsResponse])
def read_vitals(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Retrieve vitals readings for the current user or specified patient (Phase 1 support)."""
    
    with handle_database_errors(request=request):
        vitals_list = vitals.get_by_patient(
            db=db, patient_id=target_patient_id, skip=skip, limit=limit
        )
        return vitals_list


@router.get("/stats", response_model=VitalsStats)
def read_current_user_vitals_stats(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None, description="Patient ID for Phase 1 patient switching"),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get vitals statistics for the current user or specified patient (Phase 1 support)."""
    
    with handle_database_errors(request=request):
        # Phase 1 support: Use patient_id if provided, otherwise fall back to user's own patient
        if patient_id is not None:
            target_patient_id = patient_id
        else:
            target_patient_id = deps.get_current_user_patient_id(db, current_user_id)
        
        stats = vitals.get_vitals_stats(db=db, patient_id=target_patient_id)
        return stats


@router.get("/{vitals_id}", response_model=VitalsResponse)
def read_vitals_by_id(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    vitals_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Get vitals reading by ID with related information - only allows access to user's own vitals."""
    with handle_database_errors(request=request):
        vitals_obj = vitals.get_with_relations(
            db=db, record_id=vitals_id, relations=["patient", "practitioner"]
        )
        handle_not_found(vitals_obj, "Vitals reading", request)
        verify_patient_ownership(vitals_obj, current_user_patient_id, "vitals")
        return vitals_obj


@router.put("/{vitals_id}", response_model=VitalsResponse)
def update_vitals(
    *,
    vitals_id: int,
    vitals_in: VitalsUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update vitals reading."""
    return handle_update_with_logging(
        db=db,
        crud_obj=vitals,
        entity_id=vitals_id,
        obj_in=vitals_in,
        entity_type=EntityType.VITALS,
        user_id=current_user_id,
        entity_name="Vitals",
        request=request,
    )


@router.delete("/{vitals_id}")
def delete_vitals(
    *,
    vitals_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a vitals reading."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=vitals,
        entity_id=vitals_id,
        entity_type=EntityType.VITALS,
        user_id=current_user_id,
        entity_name="Vitals",
        request=request,
    )


@router.get("/patient/{patient_id}", response_model=List[VitalsResponse])
def read_patient_vitals(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    vital_type: Optional[str] = Query(
        None,
        description="Filter by vital type: blood_pressure, heart_rate, temperature, weight, oxygen_saturation, blood_glucose",
    ),
    days: Optional[int] = Query(None, description="Get readings from last N days"),
) -> Any:
    """Get all vitals readings for a specific patient."""
    with handle_database_errors(request=request):
        if days:
            # Get recent readings
            vitals_list = vitals.get_recent_readings(
                db=db, patient_id=patient_id, days=days
            )
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
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
) -> Any:
    """Get the most recent vitals reading for a patient."""
    with handle_database_errors(request=request):
        latest_vitals = vitals.get_latest_by_patient(db=db, patient_id=patient_id)
        if not latest_vitals:
            raise NotFoundException(
                resource="Vitals",
                message="No vitals readings found for this patient",
                request=request
            )
        return latest_vitals


@router.get("/patient/{patient_id}/stats", response_model=VitalsStats)
def read_patient_vitals_stats(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
) -> Any:
    """Get vitals statistics for a patient."""
    with handle_database_errors(request=request):
        stats = vitals.get_vitals_stats(db=db, patient_id=patient_id)
        return stats


@router.get("/patient/{patient_id}/date-range", response_model=List[VitalsResponse])
def read_patient_vitals_date_range(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    start_date: datetime = Query(..., description="Start date for the range"),
    end_date: datetime = Query(..., description="End date for the range"),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """Get vitals readings for a patient within a specific date range."""
    with handle_database_errors(request=request):
        vitals_list = vitals.get_by_patient_date_range(
            db=db,
            patient_id=patient_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
        return vitals_list


@router.post("/patient/{patient_id}/vitals/", response_model=VitalsResponse)
def create_patient_vitals(
    *,
    vitals_in: VitalsCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create a new vitals reading for a specific patient."""
    # Ensure the patient_id in the URL matches the one in the request body
    if vitals_in.patient_id != patient_id:
        raise BusinessLogicException(
            message="Patient ID in URL does not match patient ID in request body",
            request=request
        )

    return create_vitals(
        vitals_in=vitals_in, request=request, db=db, current_user_id=current_user_id
    )
