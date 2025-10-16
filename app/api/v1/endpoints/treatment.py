from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.error_handling import (
    handle_database_errors
)
from app.core.logging_config import get_logger
from app.core.logging_constants import LogFields
from app.core.logging_helpers import log_data_access
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.treatment import treatment
from app.models.activity_log import EntityType
from app.schemas.treatment import (
    TreatmentCreate,
    TreatmentResponse,
    TreatmentUpdate,
    TreatmentWithRelations,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=TreatmentResponse)
def create_treatment(
    *,
    treatment_in: TreatmentCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new treatment."""
    return handle_create_with_logging(
        db=db,
        crud_obj=treatment,
        obj_in=treatment_in,
        entity_type=EntityType.TREATMENT,
        user_id=current_user_id,
        entity_name="Treatment",
        request=request,
    )


# @router.get("/", response_model=List[TreatmentWithRelations])
@router.get("/", response_model=List[TreatmentResponse])
def read_treatments(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    condition_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve treatments for the current user or accessible patient."""

    with handle_database_errors(request=request):
        # Filter treatments by the target patient_id
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if status:
                filters["status"] = status
            if condition_id:
                filters["condition_id"] = condition_id
            treatments = treatment.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters
            )
        elif status:
            treatments = treatment.get_by_status(
                db,
                status=status,
                patient_id=target_patient_id,
            )
        elif condition_id:
            treatments = treatment.get_by_condition(
                db,
                condition_id=condition_id,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
            )
        else:
            treatments = treatment.get_by_patient(
                db,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            patient_id=target_patient_id,
            count=len(treatments)
        )

        return treatments


@router.get("/{treatment_id}", response_model=TreatmentWithRelations)
def read_treatment(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    treatment_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get treatment by ID with related information - only allows access to user's own treatments."""
    with handle_database_errors(request=request):
        treatment_obj = treatment.get_with_relations(
            db=db,
            record_id=treatment_id,
            relations=["patient", "practitioner", "condition"],
        )
        handle_not_found(treatment_obj, "Treatment", request)
        verify_patient_ownership(treatment_obj, current_user_patient_id, "treatment")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            record_id=treatment_id,
            patient_id=current_user_patient_id
        )

        return treatment_obj


@router.put("/{treatment_id}", response_model=TreatmentResponse)
def update_treatment(
    *,
    treatment_id: int,
    treatment_in: TreatmentUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a treatment."""
    return handle_update_with_logging(
        db=db,
        crud_obj=treatment,
        entity_id=treatment_id,
        obj_in=treatment_in,
        entity_type=EntityType.TREATMENT,
        user_id=current_user_id,
        entity_name="Treatment",
        request=request,
    )


@router.delete("/{treatment_id}")
def delete_treatment(
    *,
    treatment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a treatment."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=treatment,
        entity_id=treatment_id,
        entity_type=EntityType.TREATMENT,
        user_id=current_user_id,
        entity_name="Treatment",
        request=request,
    )


@router.get("/patient/{patient_id}/active", response_model=List[TreatmentResponse])
def get_active_treatments(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all active treatments for a patient."""
    with handle_database_errors(request=request):
        treatments = treatment.get_active_treatments(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            patient_id=patient_id,
            count=len(treatments),
            status="active"
        )

        return treatments


@router.get("/ongoing", response_model=List[TreatmentResponse])
def get_ongoing_treatments(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get treatments that are currently ongoing."""
    with handle_database_errors(request=request):
        treatments = treatment.get_ongoing(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            patient_id=patient_id,
            count=len(treatments),
            status="ongoing"
        )

        return treatments


@router.get(
    "/patients/{patient_id}/treatments/", response_model=List[TreatmentResponse]
)
def get_patient_treatments(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all treatments for a specific patient."""
    with handle_database_errors(request=request):
        treatments = treatment.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            patient_id=patient_id,
            count=len(treatments)
        )

        return treatments
