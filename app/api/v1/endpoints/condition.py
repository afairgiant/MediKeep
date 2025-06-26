from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.condition import condition
from app.models.activity_log import EntityType
from app.schemas.condition import (
    ConditionCreate,
    ConditionResponse,
    ConditionUpdate,
    ConditionWithRelations,
)

router = APIRouter()


@router.post("/", response_model=ConditionResponse)
def create_condition(
    *,
    condition_in: ConditionCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new condition."""
    return handle_create_with_logging(
        db=db,
        crud_obj=condition,
        obj_in=condition_in,
        entity_type=EntityType.CONDITION,
        user_id=current_user_id,
        entity_name="Condition",
        request=request,
    )


@router.get("/", response_model=List[ConditionResponse])
def read_conditions(
    *,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Retrieve conditions for the current user with optional filtering."""
    # Filter conditions by the user's patient_id (ignore any provided patient_id for security)
    if status:
        conditions = condition.get_by_status(
            db, status=status, patient_id=current_user_patient_id
        )
    else:
        conditions = condition.get_by_patient(
            db, patient_id=current_user_patient_id, skip=skip, limit=limit
        )
    return conditions


@router.get("/{condition_id}", response_model=ConditionWithRelations)
def read_condition(
    *,
    db: Session = Depends(deps.get_db),
    condition_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Get condition by ID with related information - only allows access to user's own conditions."""
    # Get condition and verify it belongs to the user
    condition_obj = condition.get_with_relations(
        db=db, record_id=condition_id, relations=["patient", "practitioner"]
    )
    handle_not_found(condition_obj, "Condition")
    verify_patient_ownership(condition_obj, current_user_patient_id, "condition")
    return condition_obj


@router.put("/{condition_id}", response_model=ConditionResponse)
def update_condition(
    *,
    condition_id: int,
    condition_in: ConditionUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a condition."""
    return handle_update_with_logging(
        db=db,
        crud_obj=condition,
        entity_id=condition_id,
        obj_in=condition_in,
        entity_type=EntityType.CONDITION,
        user_id=current_user_id,
        entity_name="Condition",
        request=request,
    )


@router.delete("/{condition_id}")
def delete_condition(
    *,
    condition_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a condition."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=condition,
        entity_id=condition_id,
        entity_type=EntityType.CONDITION,
        user_id=current_user_id,
        entity_name="Condition",
        request=request,
    )


@router.get("/patient/{patient_id}/active", response_model=List[ConditionResponse])
def get_active_conditions(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
) -> Any:
    """Get all active conditions for a patient."""
    conditions = condition.get_active_conditions(db, patient_id=patient_id)
    return conditions


@router.get(
    "/patients/{patient_id}/conditions/", response_model=List[ConditionResponse]
)
def get_patient_conditions(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """Get all conditions for a specific patient."""
    conditions = condition.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return conditions
