from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import NotFoundException, ForbiddenException, BusinessLogicException
from app.core.error_handling import handle_database_errors
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.core.logging_config import get_logger
from app.core.logging_constants import LogFields
from app.core.logging_helpers import log_data_access
from app.crud.allergy import allergy
from app.models.activity_log import EntityType
from app.schemas.allergy import (
    AllergyCreate,
    AllergyResponse,
    AllergyUpdate,
    AllergyWithRelations,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=AllergyResponse)
def create_allergy(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    allergy_in: AllergyCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new allergy record.
    """
    return handle_create_with_logging(
        db=db,
        crud_obj=allergy,
        obj_in=allergy_in,
        entity_type=EntityType.ALLERGY,
        user_id=current_user_id,
        entity_name="Allergy",
        request=request,
    )


@router.get("/", response_model=List[AllergyResponse])
def read_allergies(
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    severity: Optional[str] = Query(None),
    allergen: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve allergies for the current user or accessible patient.
    """

    # Filter allergies by the target patient_id
    with handle_database_errors(request=request):
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if severity:
                filters["severity"] = severity
            allergies = allergy.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters
            )
            # Apply allergen filter manually if both tags and allergen are specified
            if allergen:
                allergies = [
                    allrg for allrg in allergies
                    if allergen.lower() in getattr(allrg, "allergen", "").lower()
                ]
        elif severity:
            allergies = allergy.get_by_severity(
                db, severity=severity, patient_id=target_patient_id
            )
        elif allergen:
            allergies = allergy.get_by_allergen(
                db, allergen=allergen, patient_id=target_patient_id
            )
        else:
            allergies = allergy.get_by_patient(
                db, patient_id=target_patient_id, skip=skip, limit=limit
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Allergy",
            patient_id=target_patient_id,
            count=len(allergies)
        )

        return allergies


@router.get("/{allergy_id}", response_model=AllergyWithRelations)
def read_allergy(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    allergy_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get allergy by ID with related information - only allows access to user's own allergies.
    """
    # Get allergy and verify it belongs to the user
    with handle_database_errors(request=request):
        allergy_obj = allergy.get_with_relations(
            db=db, record_id=allergy_id, relations=["patient", "medication"]
        )
        handle_not_found(allergy_obj, "Allergy", request)
        verify_patient_ownership(allergy_obj, current_user_patient_id, "allergy")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Allergy",
            record_id=allergy_id,
            patient_id=current_user_patient_id
        )

        return allergy_obj


@router.put("/{allergy_id}", response_model=AllergyResponse)
def update_allergy(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    allergy_id: int,
    allergy_in: AllergyUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update an allergy record.
    """
    return handle_update_with_logging(
        db=db,
        crud_obj=allergy,
        entity_id=allergy_id,
        obj_in=allergy_in,
        entity_type=EntityType.ALLERGY,
        user_id=current_user_id,
        entity_name="Allergy",
        request=request,
    )


@router.delete("/{allergy_id}")
def delete_allergy(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    allergy_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete an allergy record.
    """
    return handle_delete_with_logging(
        db=db,
        crud_obj=allergy,
        entity_id=allergy_id,
        entity_type=EntityType.ALLERGY,
        user_id=current_user_id,
        entity_name="Allergy",
        request=request,
    )


@router.get("/patient/{patient_id}/active", response_model=List[AllergyResponse])
def get_active_allergies(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all active allergies for a patient.
    """
    with handle_database_errors(request=request):
        allergies = allergy.get_active_allergies(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Allergy",
            patient_id=patient_id,
            count=len(allergies)
        )

        return allergies


@router.get("/patient/{patient_id}/critical", response_model=List[AllergyResponse])
def get_critical_allergies(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get critical (severe and life-threatening) allergies for a patient.
    """
    with handle_database_errors(request=request):
        allergies = allergy.get_critical_allergies(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Allergy",
            patient_id=patient_id,
            count=len(allergies)
        )

        return allergies


@router.get("/patient/{patient_id}/check/{allergen}")
def check_allergen_conflict(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    allergen: str,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Check if a patient has any active allergies to a specific allergen.
    """
    with handle_database_errors(request=request):
        has_allergy = allergy.check_allergen_conflict(
            db, patient_id=patient_id, allergen=allergen
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Allergy",
            patient_id=patient_id,
            allergen=allergen,
            has_conflict=has_allergy
        )

        return {"patient_id": patient_id, "allergen": allergen, "has_allergy": has_allergy}


@router.get("/patients/{patient_id}/allergies/", response_model=List[AllergyResponse])
def get_patient_allergies(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all allergies for a specific patient.
    """
    with handle_database_errors(request=request):
        allergies = allergy.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Allergy",
            patient_id=patient_id,
            count=len(allergies)
        )

        return allergies
