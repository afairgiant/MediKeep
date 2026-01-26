"""
API endpoints for InjuryType entity.

InjuryType represents reusable injury types that populate the dropdown.
Users can select existing types or create new ones.
System types cannot be deleted.
"""
from typing import Any, List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import NotFoundException, BusinessLogicException
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access, log_security_event
from app.api.v1.endpoints.utils import handle_create_with_logging
from app.crud.injury_type import injury_type
from app.models.activity_log import EntityType
from app.schemas.injury_type import (
    InjuryTypeCreate,
    InjuryTypeResponse,
    InjuryTypeDropdownOption,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.get("/", response_model=List[InjuryTypeResponse])
def get_all_injury_types(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get all injury types for dropdown.
    Returns both system-defined and user-created types.
    """
    with handle_database_errors(request=request):
        types = injury_type.get_all(db)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "InjuryType",
            count=len(types)
        )

        return types


@router.get("/dropdown", response_model=List[InjuryTypeDropdownOption])
def get_injury_types_for_dropdown(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get injury types formatted for dropdown selection.
    Minimal response with just id, name, and is_system flag.
    """
    with handle_database_errors(request=request):
        types = injury_type.get_all(db)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "InjuryType",
            count=len(types)
        )

        return types


@router.post("/", response_model=InjuryTypeResponse)
def create_injury_type(
    *,
    injury_type_in: InjuryTypeCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create a new user-defined injury type.
    System types can only be created via database migration.
    """
    with handle_database_errors(request=request):
        # Check if name already exists
        existing = injury_type.get_by_name(db, name=injury_type_in.name)
        if existing:
            raise BusinessLogicException(
                message=f"An injury type with the name '{injury_type_in.name}' already exists",
                request=request
            )

        return handle_create_with_logging(
            db=db,
            crud_obj=injury_type,
            obj_in=injury_type_in,
            entity_type=EntityType.INJURY_TYPE,
            user_id=current_user_id,
            entity_name="InjuryType",
            request=request,
        )


@router.get("/{injury_type_id}", response_model=InjuryTypeResponse)
def get_injury_type(
    *,
    injury_type_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get a specific injury type by ID."""
    with handle_database_errors(request=request):
        db_type = injury_type.get(db, id=injury_type_id)
        if not db_type:
            raise NotFoundException(
                resource="InjuryType",
                message=f"Injury type with ID {injury_type_id} not found",
                request=request
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "InjuryType",
            record_id=injury_type_id
        )

        return db_type


@router.delete("/{injury_type_id}")
def delete_injury_type(
    *,
    injury_type_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a user-created injury type.
    System types (is_system=True) cannot be deleted.
    """
    with handle_database_errors(request=request):
        # Check if type exists
        db_type = injury_type.get(db, id=injury_type_id)
        if not db_type:
            raise NotFoundException(
                resource="InjuryType",
                message=f"Injury type with ID {injury_type_id} not found",
                request=request
            )

        # Check if it's a system type
        if db_type.is_system:
            log_security_event(
                logger,
                "delete_system_injury_type_attempt",
                request,
                f"User attempted to delete system injury type {injury_type_id}",
                user_id=current_user_id
            )
            raise BusinessLogicException(
                message="Cannot delete system-defined injury types",
                request=request
            )

        # Check if any injuries reference this type
        from app.crud.injury import injury as injury_crud
        injuries_with_type = injury_crud.get_by_type(db, patient_id=0, injury_type_id=injury_type_id)
        # Note: The above query won't work well for global check, let's do a direct query
        from app.models.models import Injury
        injuries_count = db.query(Injury).filter(Injury.injury_type_id == injury_type_id).count()

        if injuries_count > 0:
            raise BusinessLogicException(
                message=f"Cannot delete injury type that is referenced by {injuries_count} injuries",
                request=request
            )

        # Delete the type
        injury_type.remove(db, id=injury_type_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "delete",
            "InjuryType",
            record_id=injury_type_id
        )

        return {"message": "Injury type deleted successfully"}
