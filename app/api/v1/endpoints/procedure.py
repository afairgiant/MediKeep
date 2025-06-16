from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app.api import deps
from app.crud.procedure import procedure
from app.schemas.procedure import (
    ProcedureCreate,
    ProcedureUpdate,
    ProcedureResponse,
    ProcedureWithRelations,
)

router = APIRouter()


@router.post("/", response_model=ProcedureResponse)
def create_procedure(
    *,
    db: Session = Depends(deps.get_db),
    procedure_in: ProcedureCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new procedure.
    """
    procedure_obj = procedure.create(db=db, obj_in=procedure_in)
    return procedure_obj


@router.get("/", response_model=List[ProcedureResponse])
def read_procedures(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    practitioner_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve procedures with optional filtering.
    """
    if patient_id and status:
        procedures = procedure.get_by_status(db, status=status, patient_id=patient_id)
    elif patient_id:
        procedures = procedure.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )
    elif practitioner_id:
        procedures = procedure.get_by_practitioner(
            db, practitioner_id=practitioner_id, skip=skip, limit=limit
        )
    elif status:
        procedures = procedure.get_by_status(db, status=status)
    else:
        procedures = procedure.get_multi(db, skip=skip, limit=limit)
    return procedures


@router.get("/{procedure_id}", response_model=ProcedureWithRelations)
def read_procedure(
    *,
    db: Session = Depends(deps.get_db),
    procedure_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get procedure by ID with related information.
    """
    procedure_obj = procedure.get_with_relations(db, procedure_id=procedure_id)
    if not procedure_obj:
        raise HTTPException(status_code=404, detail="Procedure not found")
    return procedure_obj


@router.put("/{procedure_id}", response_model=ProcedureResponse)
def update_procedure(
    *,
    db: Session = Depends(deps.get_db),
    procedure_id: int,
    procedure_in: ProcedureUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a procedure.
    """
    procedure_obj = procedure.get(db=db, id=procedure_id)
    if not procedure_obj:
        raise HTTPException(status_code=404, detail="Procedure not found")
    procedure_obj = procedure.update(db=db, db_obj=procedure_obj, obj_in=procedure_in)
    return procedure_obj


@router.delete("/{procedure_id}")
def delete_procedure(
    *,
    db: Session = Depends(deps.get_db),
    procedure_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a procedure.
    """
    procedure_obj = procedure.get(db=db, id=procedure_id)
    if not procedure_obj:
        raise HTTPException(status_code=404, detail="Procedure not found")
    procedure.delete(db=db, id=procedure_id)
    return {"message": "Procedure deleted successfully"}


@router.get("/scheduled", response_model=List[ProcedureResponse])
def get_scheduled_procedures(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all scheduled procedures, optionally filtered by patient.
    """
    procedures = procedure.get_scheduled(db, patient_id=patient_id)
    return procedures


@router.get("/patient/{patient_id}/recent", response_model=List[ProcedureResponse])
def get_recent_procedures(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    days: int = Query(default=90, ge=1, le=365),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get recent procedures for a patient within specified days.
    """
    procedures = procedure.get_recent(db, patient_id=patient_id, days=days)
    return procedures


@router.get(
    "/patients/{patient_id}/procedures/", response_model=List[ProcedureResponse]
)
def get_patient_procedures(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all procedures for a specific patient.
    """
    procedures = procedure.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return procedures
