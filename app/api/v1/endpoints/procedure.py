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
from app.crud.procedure import procedure
from app.models.activity_log import EntityType
from app.schemas.procedure import (
    ProcedureCreate,
    ProcedureResponse,
    ProcedureUpdate,
    ProcedureWithRelations,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=ProcedureResponse)
def create_procedure(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    procedure_in: ProcedureCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new procedure.
    """
    return handle_create_with_logging(
        db=db,
        crud_obj=procedure,
        obj_in=procedure_in,
        entity_type=EntityType.PROCEDURE,
        user_id=current_user_id,
        entity_name="Procedure",
        request=request,
    )


@router.get("/", response_model=List[ProcedureResponse])
def read_procedures(
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    practitioner_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve procedures for the current user or accessible patient.
    """

    # Filter procedures by the target patient_id
    with handle_database_errors(request=request):
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if status:
                filters["status"] = status
            if practitioner_id:
                filters["practitioner_id"] = practitioner_id
            procedures = procedure.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters
            )
        elif status:
            procedures = procedure.get_by_status(
                db, status=status, patient_id=target_patient_id
            )
        elif practitioner_id:
            procedures = procedure.get_by_practitioner(
                db,
                practitioner_id=practitioner_id,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
            )
        else:
            procedures = procedure.get_by_patient(
                db, patient_id=target_patient_id, skip=skip, limit=limit
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Procedure",
            patient_id=target_patient_id,
            count=len(procedures)
        )

        return procedures


@router.get("/{procedure_id}", response_model=ProcedureWithRelations)
def read_procedure(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    procedure_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get procedure by ID with related information - only allows access to user's own procedures.
    """
    with handle_database_errors(request=request):
        procedure_obj = procedure.get_with_relations(
            db=db, record_id=procedure_id, relations=["patient", "practitioner", "condition"]
        )
        handle_not_found(procedure_obj, "Procedure", request)
        verify_patient_ownership(procedure_obj, current_user_patient_id, "procedure")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Procedure",
            record_id=procedure_id,
            patient_id=current_user_patient_id
        )

        return procedure_obj


@router.put("/{procedure_id}", response_model=ProcedureResponse)
def update_procedure(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    procedure_id: int,
    procedure_in: ProcedureUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a procedure.
    """
    return handle_update_with_logging(
        db=db,
        crud_obj=procedure,
        entity_id=procedure_id,
        obj_in=procedure_in,
        entity_type=EntityType.PROCEDURE,
        user_id=current_user_id,
        entity_name="Procedure",
        request=request,
    )


@router.delete("/{procedure_id}")
def delete_procedure(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    procedure_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a procedure.
    """
    return handle_delete_with_logging(
        db=db,
        crud_obj=procedure,
        entity_id=procedure_id,
        entity_type=EntityType.PROCEDURE,
        user_id=current_user_id,
        entity_name="Procedure",
        request=request,
    )


@router.get("/scheduled", response_model=List[ProcedureResponse])
def get_scheduled_procedures(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all scheduled procedures, optionally filtered by patient.
    """
    with handle_database_errors(request=request):
        procedures = procedure.get_scheduled(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Procedure",
            patient_id=patient_id,
            count=len(procedures),
            status="scheduled"
        )

        return procedures


@router.get("/patient/{patient_id}/recent", response_model=List[ProcedureResponse])
def get_recent_procedures(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    days: int = Query(default=90, ge=1, le=365),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get recent procedures for a patient within specified days.
    """
    with handle_database_errors(request=request):
        procedures = procedure.get_recent(db, patient_id=patient_id, days=days)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Procedure",
            patient_id=patient_id,
            count=len(procedures),
            days=days
        )

        return procedures


@router.get(
    "/patients/{patient_id}/procedures/", response_model=List[ProcedureResponse]
)
def get_patient_procedures(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all procedures for a specific patient.
    """
    with handle_database_errors(request=request):
        procedures = procedure.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Procedure",
            patient_id=patient_id,
            count=len(procedures)
        )

        return procedures
