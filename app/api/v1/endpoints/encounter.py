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
from app.core.http.error_handling import (
    BusinessLogicException,
    handle_database_errors,
)
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access
from app.crud.encounter import encounter, encounter_lab_result
from app.crud.lab_result import lab_result
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.encounter import (
    EncounterCreate,
    EncounterLabResultBulkCreate,
    EncounterLabResultCreate,
    EncounterLabResultResponse,
    EncounterLabResultUpdate,
    EncounterLabResultWithDetails,
    EncounterResponse,
    EncounterUpdate,
    EncounterWithRelations,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=EncounterResponse)
def create_encounter(
    *,
    encounter_in: EncounterCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Create new encounter."""
    return handle_create_with_logging(
        db=db,
        crud_obj=encounter,
        obj_in=encounter_in,
        entity_type=EntityType.ENCOUNTER,
        user_id=current_user_id,
        entity_name="Encounter",
        request=request,
        current_user_patient_id=current_user_patient_id,
        current_user=current_user,
    )


@router.get("/", response_model=List[EncounterResponse])
def read_encounters(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=10000, le=10000),
    practitioner_id: Optional[int] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(
        False, description="Match all tags (AND) vs any tag (OR)"
    ),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve encounters for the current user or specified patient (Phase 1 support)."""

    # Filter encounters by the verified accessible patient_id
    with handle_database_errors(request=request):
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if practitioner_id:
                filters["practitioner_id"] = practitioner_id
            encounters = encounter.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters,
            )
        elif practitioner_id:
            encounters = encounter.get_by_practitioner(
                db,
                practitioner_id=practitioner_id,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
            )
        else:
            encounters = encounter.get_by_patient(
                db, patient_id=target_patient_id, skip=skip, limit=limit
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Encounter",
            patient_id=target_patient_id,
            count=len(encounters),
        )

        return encounters


@router.get("/{encounter_id}", response_model=EncounterWithRelations)
def read_encounter(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    encounter_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get encounter by ID with related information - only allows access to user's own encounters."""
    with handle_database_errors(request=request):
        encounter_obj = encounter.get_with_relations(
            db=db,
            record_id=encounter_id,
            relations=["patient", "practitioner", "condition"],
        )
        handle_not_found(encounter_obj, "Encounter", request)
        verify_patient_ownership(
            encounter_obj,
            current_user_patient_id,
            "encounter",
            db=db,
            current_user=current_user,
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Encounter",
            record_id=encounter_id,
            patient_id=current_user_patient_id,
        )

        return encounter_obj


@router.put("/{encounter_id}", response_model=EncounterResponse)
def update_encounter(
    *,
    encounter_id: int,
    encounter_in: EncounterUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update an encounter."""
    return handle_update_with_logging(
        db=db,
        crud_obj=encounter,
        entity_id=encounter_id,
        obj_in=encounter_in,
        entity_type=EntityType.ENCOUNTER,
        user_id=current_user_id,
        entity_name="Encounter",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.delete("/{encounter_id}")
def delete_encounter(
    *,
    encounter_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete an encounter."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=encounter,
        entity_id=encounter_id,
        entity_type=EntityType.ENCOUNTER,
        user_id=current_user_id,
        entity_name="Encounter",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.get("/patient/{patient_id}/recent", response_model=List[EncounterResponse])
def get_recent_encounters(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get recent encounters for a patient within specified days."""
    with handle_database_errors(request=request):
        encounters = encounter.get_recent(db, patient_id=patient_id, days=days)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Encounter",
            patient_id=patient_id,
            count=len(encounters),
            days=days,
        )

        return encounters


@router.get(
    "/patients/{patient_id}/encounters/", response_model=List[EncounterResponse]
)
def get_patient_encounters(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=10000, le=10000),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all encounters for a specific patient."""
    with handle_database_errors(request=request):
        encounters = encounter.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Encounter",
            patient_id=patient_id,
            count=len(encounters),
        )

        return encounters


# Encounter - Lab Result Relationship Endpoints


@router.get(
    "/{encounter_id}/lab-results",
    response_model=List[EncounterLabResultWithDetails],
)
def get_encounter_lab_results(
    *,
    request: Request,
    encounter_id: int,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get all lab result relationships for a specific encounter."""
    with handle_database_errors(request=request):
        db_encounter = encounter.get(db, id=encounter_id)
        handle_not_found(db_encounter, "Encounter", request)
        verify_patient_ownership(
            db_encounter,
            current_user_patient_id,
            "encounter",
            db=db,
            current_user=current_user,
        )

        results = encounter_lab_result.get_by_encounter_with_details(
            db, encounter_id=encounter_id
        )

        enhanced = []
        for rel, lab in results:
            enhanced.append(
                {
                    "id": rel.id,
                    "encounter_id": rel.encounter_id,
                    "lab_result_id": rel.lab_result_id,
                    "purpose": rel.purpose,
                    "relevance_note": rel.relevance_note,
                    "created_at": rel.created_at,
                    "updated_at": rel.updated_at,
                    "lab_result_name": lab.test_name,
                    "lab_result_date": lab.ordered_date,
                    "lab_result_status": lab.status,
                    "encounter_reason": db_encounter.reason,
                    "encounter_date": db_encounter.date,
                }
            )
        return enhanced


@router.post(
    "/{encounter_id}/lab-results",
    response_model=EncounterLabResultResponse,
)
def create_encounter_lab_result(
    *,
    request: Request,
    encounter_id: int,
    link_in: EncounterLabResultCreate,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Link a lab result to an encounter."""
    with handle_database_errors(request=request):
        db_encounter = encounter.get(db, id=encounter_id)
        handle_not_found(db_encounter, "Encounter", request)
        verify_patient_ownership(
            db_encounter,
            current_user_patient_id,
            "encounter",
            db=db,
            current_user=current_user,
            permission="edit",
        )

        db_lab = lab_result.get(db, id=link_in.lab_result_id)
        handle_not_found(db_lab, "Lab result", request)

        if db_lab.patient_id != db_encounter.patient_id:
            raise BusinessLogicException(
                message="Cannot link lab result that doesn't belong to the same patient",
                request=request,
            )

        existing = encounter_lab_result.get_by_encounter_and_lab_result(
            db, encounter_id=encounter_id, lab_result_id=link_in.lab_result_id
        )
        if existing:
            raise BusinessLogicException(
                message="This lab result is already linked to this encounter",
                request=request,
            )

        from app.models.models import EncounterLabResult as ELRModel

        obj = ELRModel(
            encounter_id=encounter_id,
            lab_result_id=link_in.lab_result_id,
            purpose=link_in.purpose,
            relevance_note=link_in.relevance_note,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj


@router.post(
    "/{encounter_id}/lab-results/bulk",
    response_model=List[EncounterLabResultResponse],
)
def bulk_create_encounter_lab_results(
    *,
    request: Request,
    encounter_id: int,
    bulk_in: EncounterLabResultBulkCreate,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Bulk link lab results to an encounter."""
    with handle_database_errors(request=request):
        db_encounter = encounter.get(db, id=encounter_id)
        handle_not_found(db_encounter, "Encounter", request)
        verify_patient_ownership(
            db_encounter,
            current_user_patient_id,
            "encounter",
            db=db,
            current_user=current_user,
            permission="edit",
        )

        for lr_id in bulk_in.lab_result_ids:
            db_lab = lab_result.get(db, id=lr_id)
            handle_not_found(db_lab, "Lab result", request)
            if db_lab.patient_id != db_encounter.patient_id:
                raise BusinessLogicException(
                    message=f"Lab result {lr_id} doesn't belong to the same patient",
                    request=request,
                )

        created = encounter_lab_result.create_bulk(
            db,
            encounter_id=encounter_id,
            lab_result_ids=bulk_in.lab_result_ids,
            purpose=bulk_in.purpose,
            relevance_note=bulk_in.relevance_note,
        )
        return created


@router.put(
    "/{encounter_id}/lab-results/{relationship_id}",
    response_model=EncounterLabResultResponse,
)
def update_encounter_lab_result(
    *,
    request: Request,
    encounter_id: int,
    relationship_id: int,
    link_in: EncounterLabResultUpdate,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Update an encounter-lab result relationship."""
    with handle_database_errors(request=request):
        db_encounter = encounter.get(db, id=encounter_id)
        handle_not_found(db_encounter, "Encounter", request)
        verify_patient_ownership(
            db_encounter,
            current_user_patient_id,
            "encounter",
            db=db,
            current_user=current_user,
            permission="edit",
        )

        relationship = encounter_lab_result.get(db, id=relationship_id)
        handle_not_found(relationship, "Encounter lab result relationship", request)

        if relationship.encounter_id != encounter_id:
            raise BusinessLogicException(
                message="Relationship does not belong to this encounter",
                request=request,
            )

        updated = encounter_lab_result.update(db, db_obj=relationship, obj_in=link_in)
        return updated


@router.delete("/{encounter_id}/lab-results/{relationship_id}")
def delete_encounter_lab_result(
    *,
    request: Request,
    encounter_id: int,
    relationship_id: int,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Unlink a lab result from an encounter."""
    with handle_database_errors(request=request):
        db_encounter = encounter.get(db, id=encounter_id)
        handle_not_found(db_encounter, "Encounter", request)
        verify_patient_ownership(
            db_encounter,
            current_user_patient_id,
            "encounter",
            db=db,
            current_user=current_user,
            permission="edit",
        )

        relationship = encounter_lab_result.get(db, id=relationship_id)
        handle_not_found(relationship, "Encounter lab result relationship", request)

        if relationship.encounter_id != encounter_id:
            raise BusinessLogicException(
                message="Relationship does not belong to this encounter",
                request=request,
            )

        encounter_lab_result.delete(db, id=relationship_id)
        return {"message": "Encounter lab result relationship deleted successfully"}
