from typing import Any, Optional, Type

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.core.datetime_utils import get_timezone_info
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")

router = APIRouter(prefix="/utils", tags=["utils"])


@router.get("/timezone-info")
def timezone_info():
    """Get facility timezone information."""
    return get_timezone_info()


def handle_not_found(obj: Any, entity_name: str) -> None:
    """
    Standard 404 error handler for entities.

    Args:
        obj: The database object (None if not found)
        entity_name: Name of the entity type (e.g., "Medication", "Condition")

    Raises:
        HTTPException: 404 error if object is None
    """
    if not obj:
        raise HTTPException(status_code=404, detail=f"{entity_name} not found")


def create_success_response(entity_name: str) -> dict[str, str]:
    """
    Standard success response for delete operations.

    Args:
        entity_name: Name of the entity type (e.g., "Medication", "Condition")

    Returns:
        Dict with success message
    """
    return {"message": f"{entity_name} deleted successfully"}


def verify_patient_ownership(
    obj: Any, current_user_patient_id: int, entity_name: str
) -> None:
    """
    Verify that a medical record belongs to the current user.

    Args:
        obj: The database object to check
        current_user_patient_id: Current user's patient ID
        entity_name: Name of the entity type for error messages

    Raises:
        HTTPException: 404 if object doesn't belong to user
    """
    patient_id = getattr(obj, "patient_id", None)
    deps.verify_patient_record_access(
        patient_id, current_user_patient_id, entity_name.lower()
    )


def handle_entity_operation_logging(
    operation: str,
    entity_name: str,
    entity_id: Optional[int],
    patient_id: Optional[int],
    user_id: int,
    user_ip: str,
    success: bool = True,
    error: Optional[str] = None,
) -> None:
    """
    Centralized logging for entity operations.

    Args:
        operation: Type of operation (created, updated, deleted)
        entity_name: Name of entity type
        entity_id: ID of the entity
        patient_id: ID of the patient
        user_id: ID of the user performing operation
        user_ip: IP address of the user
        success: Whether operation was successful
        error: Error message if operation failed
    """
    entity_lower = entity_name.lower()
    event_type = f"{entity_lower}_{operation}"

    if not success:
        event_type += "_failed"

    extra_data = {
        "category": "app",
        "event": event_type,
        "user_id": user_id,
        "patient_id": patient_id,
        f"{entity_lower}_id": entity_id,
        "ip": user_ip,
    }

    if error:
        extra_data["error"] = error

    message = f"{entity_name} {operation} {'successfully' if success else 'failed'}"
    if entity_id:
        message += f": {entity_id}"
    if error:
        message += f" - {error}"

    if success:
        logger.info(message, extra=extra_data)
    else:
        logger.error(message, extra=extra_data)


def handle_create_with_logging(
    db: Session,
    crud_obj: Any,
    obj_in: Any,
    entity_type: Any,
    user_id: int,
    entity_name: str,
    request: Optional[Request] = None,
) -> Any:
    """
    Handle entity creation with standardized logging.

    Args:
        db: Database session
        crud_obj: CRUD object for the entity
        obj_in: Input data for creation
        entity_type: EntityType enum value
        user_id: Current user ID
        entity_name: Name of entity type for logging
        request: Request object for additional logging

    Returns:
        Created entity object

    Raises:
        HTTPException: If creation fails
    """
    user_ip = request.client.host if request and request.client else "unknown"

    try:
        entity_obj = crud_obj.create(db=db, obj_in=obj_in)
        entity_id = getattr(entity_obj, "id", None)
        patient_id = getattr(entity_obj, "patient_id", None)

        # Log successful creation
        handle_entity_operation_logging(
            operation="created",
            entity_name=entity_name,
            entity_id=entity_id,
            patient_id=patient_id,
            user_id=user_id,
            user_ip=user_ip,
            success=True,
        )

        # Log activity using centralized logging
        log_create(
            db=db,
            entity_type=entity_type,
            entity_obj=entity_obj,
            user_id=user_id,
            request=request,
        )

        return entity_obj

    except Exception as e:
        # Log failed creation
        patient_id_input = getattr(obj_in, "patient_id", None)
        handle_entity_operation_logging(
            operation="created",
            entity_name=entity_name,
            entity_id=None,
            patient_id=patient_id_input,
            user_id=user_id,
            user_ip=user_ip,
            success=False,
            error=str(e),
        )
        raise


def handle_update_with_logging(
    db: Session,
    crud_obj: Any,
    entity_id: int,
    obj_in: Any,
    entity_type: Any,
    user_id: int,
    entity_name: str,
    request: Optional[Request] = None,
) -> Any:
    """
    Handle entity update with standardized logging.

    Args:
        db: Database session
        crud_obj: CRUD object for the entity
        entity_id: ID of entity to update
        obj_in: Update data
        entity_type: EntityType enum value
        user_id: Current user ID
        entity_name: Name of entity type for logging
        request: Request object for additional logging

    Returns:
        Updated entity object

    Raises:
        HTTPException: If entity not found or update fails
    """
    user_ip = request.client.host if request and request.client else "unknown"

    # Get existing entity
    entity_obj = crud_obj.get(db=db, id=entity_id)
    handle_not_found(entity_obj, entity_name)

    patient_id = getattr(entity_obj, "patient_id", None)

    try:
        updated_entity = crud_obj.update(db=db, db_obj=entity_obj, obj_in=obj_in)

        # Log successful update
        handle_entity_operation_logging(
            operation="updated",
            entity_name=entity_name,
            entity_id=entity_id,
            patient_id=patient_id,
            user_id=user_id,
            user_ip=user_ip,
            success=True,
        )

        # Log activity using centralized logging
        log_update(
            db=db,
            entity_type=entity_type,
            entity_obj=updated_entity,
            user_id=user_id,
            request=request,
        )

        return updated_entity

    except Exception as e:
        # Log failed update
        handle_entity_operation_logging(
            operation="updated",
            entity_name=entity_name,
            entity_id=entity_id,
            patient_id=patient_id,
            user_id=user_id,
            user_ip=user_ip,
            success=False,
            error=str(e),
        )
        raise


def handle_delete_with_logging(
    db: Session,
    crud_obj: Any,
    entity_id: int,
    entity_type: Any,
    user_id: int,
    entity_name: str,
    request: Optional[Request] = None,
) -> dict[str, str]:
    """
    Handle entity deletion with standardized logging.

    Args:
        db: Database session
        crud_obj: CRUD object for the entity
        entity_id: ID of entity to delete
        entity_type: EntityType enum value
        user_id: Current user ID
        entity_name: Name of entity type for logging
        request: Request object for additional logging

    Returns:
        Success response dict

    Raises:
        HTTPException: If entity not found or deletion fails
    """
    user_ip = request.client.host if request and request.client else "unknown"

    # Get existing entity
    entity_obj = crud_obj.get(db=db, id=entity_id)
    handle_not_found(entity_obj, entity_name)

    patient_id = getattr(entity_obj, "patient_id", None)

    try:
        # Log activity BEFORE deleting
        log_delete(
            db=db,
            entity_type=entity_type,
            entity_obj=entity_obj,
            user_id=user_id,
            request=request,
        )

        crud_obj.delete(db=db, id=entity_id)

        # Log successful deletion
        handle_entity_operation_logging(
            operation="deleted",
            entity_name=entity_name,
            entity_id=entity_id,
            patient_id=patient_id,
            user_id=user_id,
            user_ip=user_ip,
            success=True,
        )

        return create_success_response(entity_name)

    except Exception as e:
        # Log failed deletion
        handle_entity_operation_logging(
            operation="deleted",
            entity_name=entity_name,
            entity_id=entity_id,
            patient_id=patient_id,
            user_id=user_id,
            user_ip=user_ip,
            success=False,
            error=str(e),
        )
        raise
