from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.crud.procedure import procedure
from app.models.activity_log import EntityType
from app.schemas.procedure import (
    ProcedureCreate,
    ProcedureResponse,
    ProcedureUpdate,
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

    # Log the creation activity using centralized logging
    log_create(
        db=db,
        entity_type=EntityType.PROCEDURE,
        entity_obj=procedure_obj,
        user_id=current_user_id,
    )

    return procedure_obj


@router.get("/", response_model=List[ProcedureResponse])
def read_procedures(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None),
    practitioner_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """
    Retrieve procedures for the current user with optional filtering.
    """
    # Filter procedures by the user's patient_id (ignore any provided patient_id for security)
    if status:
        procedures = procedure.get_by_status(
            db, status=status, patient_id=current_user_patient_id
        )
    elif practitioner_id:
        procedures = procedure.get_by_practitioner(
            db,
            practitioner_id=practitioner_id,
            patient_id=current_user_patient_id,
            skip=skip,
            limit=limit,
        )
    else:
        procedures = procedure.get_by_patient(
            db, patient_id=current_user_patient_id, skip=skip, limit=limit
        )
    return procedures


@router.get("/{procedure_id}", response_model=ProcedureWithRelations)
def read_procedure(
    *,
    db: Session = Depends(deps.get_db),
    procedure_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """
    Get procedure by ID with related information - only allows access to user's own procedures.
    """
    procedure_obj = procedure.get_with_relations(
        db=db, record_id=procedure_id, relations=["patient", "practitioner", "condition"]
    )
    if not procedure_obj:
        raise HTTPException(status_code=404, detail="Procedure not found")

    # Security check: ensure the procedure belongs to the current user
    deps.verify_patient_record_access(
        getattr(procedure_obj, "patient_id"), current_user_patient_id, "procedure"
    )

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

    # Log the update activity using centralized logging
    log_update(
        db=db,
        entity_type=EntityType.PROCEDURE,
        entity_obj=procedure_obj,
        user_id=current_user_id,
    )

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

    # Log the deletion activity BEFORE deleting using centralized logging
    log_delete(
        db=db,
        entity_type=EntityType.PROCEDURE,
        entity_obj=procedure_obj,
        user_id=current_user_id,
    )

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
    patient_id: int = Depends(deps.verify_patient_access),
    days: int = Query(default=90, ge=1, le=365),
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
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """
    Get all procedures for a specific patient.
    """
    procedures = procedure.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return procedures
