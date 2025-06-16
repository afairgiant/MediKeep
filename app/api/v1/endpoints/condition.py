from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app.api import deps
from app.crud.condition import condition
from app.schemas.condition import (
    ConditionCreate,
    ConditionUpdate,
    ConditionResponse,
    ConditionWithRelations,
)

router = APIRouter()


@router.post("/", response_model=ConditionResponse)
def create_condition(
    *,
    db: Session = Depends(deps.get_db),
    condition_in: ConditionCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new condition.
    """
    condition_obj = condition.create(db=db, obj_in=condition_in)
    return condition_obj


@router.get("/", response_model=List[ConditionResponse])
def read_conditions(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve conditions with optional filtering.
    """
    if patient_id and status:
        conditions = condition.get_by_status(db, status=status, patient_id=patient_id)
    elif patient_id:
        conditions = condition.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )
    elif status:
        conditions = condition.get_by_status(db, status=status)
    else:
        conditions = condition.get_multi(db, skip=skip, limit=limit)
    return conditions


@router.get("/{condition_id}", response_model=ConditionWithRelations)
def read_condition(
    *,
    db: Session = Depends(deps.get_db),
    condition_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get condition by ID with related information.
    """
    condition_obj = condition.get_with_relations(db, condition_id=condition_id)
    if not condition_obj:
        raise HTTPException(status_code=404, detail="Condition not found")
    return condition_obj


@router.put("/{condition_id}", response_model=ConditionResponse)
def update_condition(
    *,
    db: Session = Depends(deps.get_db),
    condition_id: int,
    condition_in: ConditionUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a condition.
    """
    condition_obj = condition.get(db=db, id=condition_id)
    if not condition_obj:
        raise HTTPException(status_code=404, detail="Condition not found")
    condition_obj = condition.update(db=db, db_obj=condition_obj, obj_in=condition_in)
    return condition_obj


@router.put("/{condition_id}/", response_model=ConditionResponse)
def update_condition_with_slash(
    *,
    db: Session = Depends(deps.get_db),
    condition_id: int,
    condition_in: ConditionUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a condition (with trailing slash for compatibility).

    TODO: TEMPORARY FIX - Remove this duplicate route after investigating why
    the frontend is adding trailing slashes to conditions URLs but not to
    procedures URLs. The root cause needs to be identified and fixed in the
    frontend URL construction or middleware configuration.
    """
    condition_obj = condition.get(db=db, id=condition_id)
    if not condition_obj:
        raise HTTPException(status_code=404, detail="Condition not found")
    condition_obj = condition.update(db=db, db_obj=condition_obj, obj_in=condition_in)
    return condition_obj


@router.delete("/{condition_id}")
def delete_condition(
    *,
    db: Session = Depends(deps.get_db),
    condition_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a condition.
    """
    condition_obj = condition.get(db=db, id=condition_id)
    if not condition_obj:
        raise HTTPException(status_code=404, detail="Condition not found")
    condition.delete(db=db, id=condition_id)
    return {"message": "Condition deleted successfully"}


@router.get("/patient/{patient_id}/active", response_model=List[ConditionResponse])
def get_active_conditions(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all active conditions for a patient.
    """
    conditions = condition.get_active_conditions(db, patient_id=patient_id)
    return conditions


@router.get(
    "/patients/{patient_id}/conditions/", response_model=List[ConditionResponse]
)
def get_patient_conditions(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all conditions for a specific patient.
    """
    conditions = condition.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return conditions
