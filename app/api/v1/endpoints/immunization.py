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
from app.crud.immunization import immunization
from app.models.activity_log import EntityType
from app.schemas.immunization import (
    ImmunizationCreate,
    ImmunizationResponse,
    ImmunizationUpdate,
    ImmunizationWithRelations,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=ImmunizationResponse)
def create_immunization(
    *,
    immunization_in: ImmunizationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new immunization record."""
    return handle_create_with_logging(
        db=db,
        crud_obj=immunization,
        obj_in=immunization_in,
        entity_type=EntityType.IMMUNIZATION,
        user_id=current_user_id,
        entity_name="Immunization",
        request=request,
    )


@router.get("/", response_model=List[ImmunizationResponse])
def read_immunizations(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    vaccine_name: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve immunizations for the current user or accessible patient."""

    # Filter immunizations by the target patient_id
    with handle_database_errors(request=request):
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if vaccine_name:
                # Note: get_multi_with_tag_filters doesn't support search, so we'll filter manually
                all_immunizations = immunization.get_multi_with_tag_filters(
                    db,
                    tags=tags,
                    tag_match_all=tag_match_all,
                    skip=0,
                    limit=1000,  # Get more to filter manually
                    **filters
                )
                immunizations = [
                    imm for imm in all_immunizations
                    if vaccine_name.lower() in getattr(imm, "vaccine_name", "").lower()
                ]
                # Apply pagination after filtering
                immunizations = immunizations[skip:skip + limit]
            else:
                immunizations = immunization.get_multi_with_tag_filters(
                    db,
                    tags=tags,
                    tag_match_all=tag_match_all,
                    skip=skip,
                    limit=limit,
                    **filters
                )
        elif vaccine_name:
            immunizations = immunization.get_by_vaccine(
                db, vaccine_name=vaccine_name, patient_id=target_patient_id
            )
        else:
            immunizations = immunization.get_by_patient(
                db, patient_id=target_patient_id, skip=skip, limit=limit
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Immunization",
            patient_id=target_patient_id,
            count=len(immunizations)
        )

        return immunizations


@router.get("/{immunization_id}", response_model=ImmunizationWithRelations)
def read_immunization(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    immunization_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get immunization by ID with related information - only allows access to user's own immunizations."""
    with handle_database_errors(request=request):
        immunization_obj = immunization.get_with_relations(
            db=db, record_id=immunization_id, relations=["patient", "practitioner"]
        )
        handle_not_found(immunization_obj, "Immunization", request)
        verify_patient_ownership(immunization_obj, current_user_patient_id, "immunization")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Immunization",
            record_id=immunization_id,
            patient_id=current_user_patient_id
        )

        return immunization_obj


@router.put("/{immunization_id}", response_model=ImmunizationResponse)
def update_immunization(
    *,
    immunization_id: int,
    immunization_in: ImmunizationUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update an immunization record."""
    return handle_update_with_logging(
        db=db,
        crud_obj=immunization,
        entity_id=immunization_id,
        obj_in=immunization_in,
        entity_type=EntityType.IMMUNIZATION,
        user_id=current_user_id,
        entity_name="Immunization",
        request=request,
    )


@router.delete("/{immunization_id}")
def delete_immunization(
    *,
    immunization_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete an immunization record."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=immunization,
        entity_id=immunization_id,
        entity_type=EntityType.IMMUNIZATION,
        user_id=current_user_id,
        entity_name="Immunization",
        request=request,
    )


@router.get("/patient/{patient_id}/recent", response_model=List[ImmunizationResponse])
def get_recent_immunizations(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    days: int = Query(default=365, ge=1, le=3650),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get recent immunizations for a patient within specified days."""
    with handle_database_errors(request=request):
        immunizations = immunization.get_recent_immunizations(
            db, patient_id=patient_id, days=days
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Immunization",
            patient_id=patient_id,
            count=len(immunizations),
            days=days
        )

        return immunizations


@router.get("/patient/{patient_id}/booster-check/{vaccine_name}")
def check_booster_due(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    vaccine_name: str,
    months_interval: int = Query(default=12, ge=1, le=120),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Check if a patient is due for a booster shot."""
    with handle_database_errors(request=request):
        is_due = immunization.get_due_for_booster(
            db,
            patient_id=patient_id,
            vaccine_name=vaccine_name,
            months_interval=months_interval,
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Immunization",
            patient_id=patient_id,
            vaccine_name=vaccine_name,
            booster_due=is_due
        )

        return {
            "patient_id": patient_id,
            "vaccine_name": vaccine_name,
            "booster_due": is_due,
        }


@router.get(
    "/patient/{patient_id}/immunizations/", response_model=List[ImmunizationResponse]
)
def get_patient_immunizations(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all immunizations for a specific patient."""
    with handle_database_errors(request=request):
        immunizations = immunization.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Immunization",
            patient_id=patient_id,
            count=len(immunizations)
        )

        return immunizations
