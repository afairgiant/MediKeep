from pathlib import Path
from typing import Any, Optional, Type
import traceback

from fastapi import APIRouter, Request, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, DatabaseError

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.core.utils.datetime_utils import get_timezone_info
from app.core.logging.config import get_logger
from app.core.http.error_handling import (
    NotFoundException,
    handle_database_errors,
    DatabaseException
)
from app.core.constants import LAB_TEST_COMPONENT_LIMITS

logger = get_logger(__name__, "app")

router = APIRouter(prefix="/utils", tags=["utils"])


@router.get("/timezone-info")
def timezone_info():
    """Get facility timezone information."""
    return get_timezone_info()


def handle_not_found(obj: Any, entity_name: str, request: Optional[Request] = None) -> None:
    """
    Standard 404 error handler for entities.

    Args:
        obj: The database object (None if not found)
        entity_name: Name of the entity type (e.g., "Medication", "Condition")
        request: Request object for error context

    Raises:
        NotFoundException: 404 error if object is None
    """
    if not obj:
        raise NotFoundException(
            resource=entity_name,
            message=f"{entity_name} not found",
            request=request
        )


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
    obj: Any,
    current_user_patient_id: int,
    entity_name: str,
    db: Optional[Session] = None,
    current_user: Optional[Any] = None,
    permission: str = 'view',
) -> None:
    """
    Verify that a medical record belongs to a patient accessible by the current user.

    Supports multi-patient scenarios where users can have multiple patients.

    Args:
        obj: The database object to check
        current_user_patient_id: Current user's patient ID (for backward compatibility)
        entity_name: Name of the entity type for error messages
        db: Database session (optional, for multi-patient access checking)
        current_user: Current user object (optional, for multi-patient access checking)
        permission: Required permission level ('view', 'edit', 'full')

    Raises:
        HTTPException: 404 if object doesn't belong to user or user doesn't have access
    """
    patient_id = getattr(obj, "patient_id", None)
    deps.verify_patient_record_access(
        record_patient_id=patient_id,
        current_user_patient_id=current_user_patient_id,
        record_type=entity_name.lower(),
        db=db,
        current_user=current_user,
        permission=permission,
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

    with handle_database_errors(request=request):
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


def handle_update_with_logging(
    db: Session,
    crud_obj: Any,
    entity_id: int,
    obj_in: Any,
    entity_type: Any,
    user_id: int,
    entity_name: str,
    request: Optional[Request] = None,
    current_user_patient_id: int = None,
    current_user: Any = None,
    permission: str = 'edit',
) -> Any:
    """
    Handle entity update with standardized logging and ownership verification.

    Args:
        db: Database session
        crud_obj: CRUD object for the entity
        entity_id: ID of entity to update
        obj_in: Update data
        entity_type: EntityType enum value
        user_id: Current user ID
        entity_name: Name of entity type for logging
        request: Request object for additional logging
        current_user_patient_id: Current user's patient ID (for ownership verification)
        current_user: Current user object (for multi-patient access verification)
        permission: Required permission level (default: 'edit')

    Returns:
        Updated entity object

    Raises:
        HTTPException: If entity not found, user lacks permission, or update fails
    """
    user_ip = request.client.host if request and request.client else "unknown"

    with handle_database_errors(request=request):
        # Get existing entity
        entity_obj = crud_obj.get(db=db, id=entity_id)
        handle_not_found(entity_obj, entity_name, request)

        # SECURITY FIX: Verify user has permission to update this record
        if current_user_patient_id is not None:
            verify_patient_ownership(
                obj=entity_obj,
                current_user_patient_id=current_user_patient_id,
                entity_name=entity_name,
                db=db,
                current_user=current_user,
                permission=permission,
            )

        patient_id = getattr(entity_obj, "patient_id", None)

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


def handle_delete_with_logging(
    db: Session,
    crud_obj: Any,
    entity_id: int,
    entity_type: Any,
    user_id: int,
    entity_name: str,
    request: Optional[Request] = None,
    current_user_patient_id: int = None,
    current_user: Any = None,
    permission: str = 'edit',
) -> dict[str, str]:
    """
    Handle entity deletion with standardized logging and ownership verification.

    Args:
        db: Database session
        crud_obj: CRUD object for the entity
        entity_id: ID of entity to delete
        entity_type: EntityType enum value
        user_id: Current user ID
        entity_name: Name of entity type for logging
        request: Request object for additional logging
        current_user_patient_id: Current user's patient ID (for ownership verification)
        current_user: Current user object (for multi-patient access verification)
        permission: Required permission level (default: 'edit')

    Returns:
        Success response dict

    Raises:
        HTTPException: If entity not found, user lacks permission, or deletion fails
    """
    user_ip = request.client.host if request and request.client else "unknown"

    # Get existing entity
    entity_obj = crud_obj.get(db=db, id=entity_id)
    handle_not_found(entity_obj, entity_name)

    # SECURITY FIX: Verify user has permission to delete this record
    if current_user_patient_id is not None:
        verify_patient_ownership(
            obj=entity_obj,
            current_user_patient_id=current_user_patient_id,
            entity_name=entity_name,
            db=db,
            current_user=current_user,
            permission=permission,
        )

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


def ensure_directory_with_permissions(directory: Path, directory_name: str = "directory") -> None:
    """
    Ensure directory exists with proper error handling for Docker bind mount permission issues.
    
    Args:
        directory: Path object for the directory to create
        directory_name: Human-readable name for error messages
        
    Raises:
        HTTPException: If directory cannot be created due to permissions or other errors
    """
    try:
        directory.mkdir(parents=True, exist_ok=True)
        logger.info(f"Ensured {directory_name} directory exists: {directory}")
    except PermissionError as e:
        error_msg = (
            f"Permission denied creating {directory_name} directory: {directory}. "
            "This may be a Docker bind mount permission issue. "
            "Please ensure the container has write permissions to the directory."
        )
        logger.error(f"Permission error: {str(e)}")
        raise DatabaseException(
            message=error_msg,
            request=None,
        )
    except OSError as e:
        error_msg = f"Failed to create {directory_name} directory"
        logger.error(f"OS error creating directory: {str(e)}")
        raise DatabaseException(
            message=error_msg,
            request=None,
        )


def sanitize_error_for_client(error: Exception, operation_context: str = "operation") -> str:
    """
    Sanitize error messages for client responses to prevent information disclosure.
    
    This function strips internal details like stack traces, database schema information,
    file paths, and other sensitive system details from error messages.
    
    Args:
        error: The exception that occurred
        operation_context: Brief description of the operation that failed (for logging)
        
    Returns:
        A safe, generic error message suitable for client responses
    """
    # Map specific exception types to safe, generic error messages
    error_type = type(error).__name__
    
    # Database-related errors - never expose schema details
    if isinstance(error, (SQLAlchemyError, IntegrityError, DatabaseError)):
        return "A database error occurred. Please try again later."
    
    # Permission/authentication errors - keep generic
    if "permission" in str(error).lower() or "access" in str(error).lower():
        return "Access denied."
    
    # Authentication-related errors - don't reveal specifics
    if any(keyword in str(error).lower() for keyword in ["auth", "token", "login", "credential"]):
        return "Authentication failed."
    
    # Connection/network errors - keep minimal
    if any(keyword in str(error).lower() for keyword in ["connection", "network", "timeout", "refused"]):
        return "Service temporarily unavailable. Please try again later."
    
    # Validation errors - can be more specific but still safe
    if "validation" in str(error).lower() or "invalid" in str(error).lower():
        return "Invalid input provided."
    
    # File/IO errors - don't expose paths
    if isinstance(error, (IOError, OSError, FileNotFoundError, PermissionError)):
        return "File operation failed."
    
    # Default safe message for any other errors
    return f"An error occurred during {operation_context}. Please try again later."


def log_and_sanitize_error(
    logger_instance: Any,
    error: Exception, 
    operation_context: str,
    user_id: Optional[int] = None,
    extra_context: Optional[dict] = None
) -> str:
    """
    Log the full error details server-side and return a sanitized message for the client.
    
    This function ensures that:
    1. Full error details (including stack traces) are logged server-side for debugging
    2. Only safe, sanitized error messages are returned to clients
    3. No internal system details are exposed to clients
    
    Args:
        logger_instance: Logger to use for server-side error logging
        error: The exception that occurred
        operation_context: Brief description of what operation failed
        user_id: ID of the user (if available) for correlation
        extra_context: Additional context data for logging
        
    Returns:
        Sanitized error message safe for client responses
    """
    # Prepare extra logging context
    log_context = {
        "error_type": type(error).__name__,
        "operation": operation_context,
    }
    
    if user_id:
        log_context["user_id"] = user_id
        
    if extra_context:
        log_context.update(extra_context)
    
    # Log full error details server-side (including stack trace for debugging)
    logger_instance.error(
        f"Error during {operation_context}: {str(error)}",
        extra=log_context,
        exc_info=True  # This includes the full stack trace in server logs
    )
    
    # Return sanitized message for client
    return sanitize_error_for_client(error, operation_context)


def create_sanitized_http_exception(
    error: Exception,
    operation_context: str,
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    logger_instance: Optional[Any] = None,
    user_id: Optional[int] = None,
    extra_context: Optional[dict] = None
) -> HTTPException:
    """
    Create an HTTPException with a sanitized error message that doesn't expose internal details.
    
    This function handles the complete flow of:
    1. Logging the full error details server-side
    2. Creating a safe HTTPException for the client
    3. Ensuring no sensitive information is leaked
    
    Args:
        error: The original exception
        operation_context: Description of the operation that failed
        status_code: HTTP status code to return
        logger_instance: Logger for server-side logging (uses default if None)
        user_id: User ID for correlation (if available)
        extra_context: Additional context for logging
        
    Returns:
        HTTPException with sanitized error message
    """
    # Use provided logger or fall back to module logger
    log_instance = logger_instance or logger
    
    # Log error and get sanitized message
    sanitized_message = log_and_sanitize_error(
        log_instance, 
        error, 
        operation_context, 
        user_id, 
        extra_context
    )
    
    return HTTPException(
        status_code=status_code,
        detail=sanitized_message
    )


def validate_search_input(query: str, max_length: int = None) -> str:
    """
    Validate and sanitize search input to prevent injection attacks and excessive queries.

    Args:
        query: The search query string
        max_length: Maximum allowed length for search queries (defaults to constant)

    Returns:
        Sanitized search query

    Raises:
        HTTPException: If query is invalid or potentially malicious
    """
    if max_length is None:
        max_length = LAB_TEST_COMPONENT_LIMITS["MAX_SEARCH_QUERY_LENGTH"]
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty"
        )

    # Remove leading/trailing whitespace and trailing punctuation
    query = query.strip().rstrip(',;:')

    # Check length
    if len(query) > max_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Search query too long. Maximum {max_length} characters allowed."
        )

    # Check for minimum length
    if len(query) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 1 character long"
        )

    # Remove or replace potentially problematic characters
    # Allow alphanumeric, spaces, hyphens, underscores, periods, commas, parentheses, forward slashes, percent signs
    import re
    if not re.match(r'^[a-zA-Z0-9\s\-_.,()\/\%]+$', query):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, periods, commas, parentheses, forward slashes, and percent signs are allowed."
        )

    # Note: We allow % in test names (e.g., "% Free Testosterone") since we use parameterized queries
    # Only prevent excessive underscores which could be used for SQL LIKE wildcards
    if query.count('_') > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query contains too many underscore characters"
        )

    return query