from collections import defaultdict
from datetime import date as date_type
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access
from app.crud.immunization import immunization
from app.models.activity_log import EntityType
from app.models.clinical import Immunization
from app.models.models import User
from app.schemas.immunization import (
    ImmunizationCreate,
    ImmunizationHistoryItem,
    ImmunizationHistoryResponse,
    ImmunizationResponse,
    ImmunizationUpdate,
)
from app.services.vaccine_resolver import build_library_index, resolve_components

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
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
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
        current_user_patient_id=current_user_patient_id,
        current_user=current_user,
    )


@router.get("/", response_model=List[ImmunizationResponse])
def read_immunizations(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=10000, le=10000),
    vaccine_name: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(
        False, description="Match all tags (AND) vs any tag (OR)"
    ),
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
                    **filters,
                )
                immunizations = [
                    imm
                    for imm in all_immunizations
                    if vaccine_name.lower() in getattr(imm, "vaccine_name", "").lower()
                ]
                # Apply pagination after filtering
                immunizations = immunizations[skip : skip + limit]
            else:
                immunizations = immunization.get_multi_with_tag_filters(
                    db,
                    tags=tags,
                    tag_match_all=tag_match_all,
                    skip=skip,
                    limit=limit,
                    **filters,
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
            count=len(immunizations),
        )

        return immunizations


@router.get("/{immunization_id}", response_model=ImmunizationResponse)
def read_immunization(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    immunization_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get immunization by ID - only allows access to user's own immunizations.

    Note: Relations (patient, practitioner) not loaded to avoid serialization issues.
    Use practitioner_id to fetch practitioner details separately if needed.
    """
    with handle_database_errors(request=request):
        immunization_obj = immunization.get(db=db, id=immunization_id)
        handle_not_found(immunization_obj, "Immunization", request)
        verify_patient_ownership(
            immunization_obj,
            current_user_patient_id,
            "immunization",
            db=db,
            current_user=current_user,
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Immunization",
            record_id=immunization_id,
            patient_id=current_user_patient_id,
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
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
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
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.delete("/{immunization_id}")
def delete_immunization(
    *,
    immunization_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
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
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
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
            days=days,
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
            booster_due=is_due,
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
    limit: int = Query(default=10000, le=10000),
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
            count=len(immunizations),
        )

        return immunizations


@router.get(
    "/patient/{patient_id}/history",
    response_model=ImmunizationHistoryResponse,
)
def get_immunization_history(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Return immunizations for a patient enriched with disease components.

    Combined vaccines are expanded via the StandardizedVaccine library so the
    history can be presented either chronologically or grouped by disease. The
    ``diseases_index`` is pre-aggregated server-side so the client doesn't
    re-derive it on each render.
    """
    with handle_database_errors(request=request):
        query = db.query(Immunization).filter(Immunization.patient_id == patient_id)
        if start_date is not None:
            query = query.filter(Immunization.date_administered >= start_date)
        if end_date is not None:
            query = query.filter(Immunization.date_administered <= end_date)
        records = query.order_by(Immunization.date_administered.desc()).all()

        library_index = build_library_index(db)

        items: list[ImmunizationHistoryItem] = []
        diseases_index: dict[str, list[int]] = defaultdict(list)
        unmatched_count = 0
        backfilled = 0

        for record in records:
            components, matched, matched_vaccine = resolve_components(
                record, library_index
            )
            is_combined = bool(matched_vaccine and matched_vaccine.is_combined)

            # Opportunistic FK backfill: if the resolver matched by name (FK was
            # NULL) and we have a definite library row, persist the link so the
            # record stops reporting as "Unlinked" on future reads. Issue #864.
            if (
                matched
                and matched_vaccine is not None
                and record.standardized_vaccine_id is None
            ):
                record.standardized_vaccine_id = matched_vaccine.id
                backfilled += 1

            base = ImmunizationResponse.model_validate(record).model_dump()
            items.append(
                ImmunizationHistoryItem(
                    **base,
                    components=components,
                    is_combined=is_combined,
                    is_library_matched=matched,
                )
            )

            if matched:
                for disease in components:
                    diseases_index[disease].append(record.id)
            else:
                unmatched_count += 1

        if backfilled:
            db.commit()

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Immunization",
            patient_id=patient_id,
            count=len(items),
            unmatched_count=unmatched_count,
            backfilled_count=backfilled,
            event="immunization_history_read",
        )

        return ImmunizationHistoryResponse(
            items=items,
            diseases_index=dict(diseases_index),
            unmatched_count=unmatched_count,
        )
