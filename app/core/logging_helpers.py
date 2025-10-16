"""
Convenience wrappers for consistent application logging.

This module makes it easy to follow logging standards without boilerplate.
Encourages proper structured logging with LogFields constants.

Usage:
    from app.core.logging_helpers import log_endpoint_access, log_endpoint_error

    log_endpoint_access(logger, request, user_id, "patient_record_accessed", patient_id=123)
    log_endpoint_error(logger, request, "Failed to fetch records", error, user_id=user_id)
"""

import logging
from typing import Optional, Any, Dict
from fastapi import Request

from app.core.logging_constants import LogFields


def log_endpoint_access(
    logger: logging.Logger,
    request: Request,
    user_id: int,
    event: str,
    *,
    patient_id: Optional[int] = None,
    message: Optional[str] = None,
    **kwargs
) -> None:
    """
    Log successful endpoint access with standard fields.

    Use this for successful operations that should be tracked.

    Args:
        logger: Logger instance
        request: FastAPI request object
        user_id: ID of the user making the request
        event: Event name (snake_case, e.g., "patient_record_accessed")
        patient_id: Optional patient ID if relevant
        message: Optional custom message (generated if not provided)
        **kwargs: Additional fields to log

    Example:
        log_endpoint_access(
            logger, request, user_id, "medication_created",
            patient_id=patient_id,
            medication_id=medication.id
        )
    """
    extra = {
        LogFields.CATEGORY: "app",
        LogFields.EVENT: event,
        LogFields.USER_ID: user_id,
        LogFields.IP: request.client.host if request.client else "unknown",
    }

    if patient_id:
        extra[LogFields.PATIENT_ID] = patient_id

    # Add any additional fields
    extra.update(kwargs)

    # Generate message if not provided
    if not message:
        message = f"User {user_id} - {event.replace('_', ' ')}"

    logger.info(message, extra=extra)


def log_endpoint_error(
    logger: logging.Logger,
    request: Request,
    message: str,
    error: Exception,
    *,
    user_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    **kwargs
) -> None:
    """
    Log endpoint errors with standard fields.

    Use this for exceptions and errors in endpoints.

    Args:
        logger: Logger instance
        request: FastAPI request object
        message: Error description
        error: The exception that was raised
        user_id: Optional user ID if known
        patient_id: Optional patient ID if relevant
        **kwargs: Additional fields to log

    Example:
        try:
            patient = patient.get(db, id=patient_id)
        except Exception as e:
            log_endpoint_error(
                logger, request, "Failed to fetch patient record",
                e, user_id=user_id, patient_id=patient_id
            )
            raise
    """
    extra = {
        LogFields.CATEGORY: "app",
        LogFields.EVENT: "endpoint_error",
        LogFields.ERROR: str(error),
        LogFields.IP: request.client.host if request.client else "unknown",
    }

    if user_id:
        extra[LogFields.USER_ID] = user_id

    if patient_id:
        extra[LogFields.PATIENT_ID] = patient_id

    # Add request details
    extra["method"] = request.method
    extra["path"] = request.url.path

    # Add any additional fields
    extra.update(kwargs)

    logger.error(message, extra=extra)


def log_security_event(
    logger: logging.Logger,
    event: str,
    request: Request,
    message: str,
    *,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    **kwargs
) -> None:
    """
    Log security-related events.

    Use this for authentication failures, suspicious activity, etc.

    Args:
        logger: Logger instance
        event: Event name (e.g., "login_failed", "invalid_token")
        request: FastAPI request object
        message: Security event description
        user_id: Optional user ID if known
        username: Optional username if relevant
        **kwargs: Additional fields to log

    Example:
        log_security_event(
            logger, "login_failed", request,
            "Invalid credentials provided",
            username=form_data.username,
            reason="invalid_password"
        )
    """
    extra = {
        LogFields.CATEGORY: "security",
        LogFields.EVENT: event,
        LogFields.IP: request.client.host if request.client else "unknown",
    }

    if user_id:
        extra[LogFields.USER_ID] = user_id

    if username:
        extra["username"] = username

    # Add any additional fields
    extra.update(kwargs)

    logger.warning(message, extra=extra)


def log_data_access(
    logger: logging.Logger,
    request: Request,
    user_id: int,
    operation: str,
    model: str,
    *,
    record_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    count: Optional[int] = None,
    **kwargs
) -> None:
    """
    Log data access operations (CRUD).

    Use this for database operations that should be audited.

    Args:
        logger: Logger instance
        request: FastAPI request object
        user_id: ID of the user
        operation: Operation type (create, read, update, delete)
        model: Model name (e.g., "Medication", "Patient")
        record_id: Optional record ID
        patient_id: Optional patient ID
        count: Optional count for list operations
        **kwargs: Additional fields to log

    Example:
        log_data_access(
            logger, request, user_id, "create", "Medication",
            record_id=medication.id,
            patient_id=patient_id
        )
    """
    extra = {
        LogFields.CATEGORY: "app",
        LogFields.EVENT: f"{model.lower()}_{operation}",
        LogFields.USER_ID: user_id,
        LogFields.OPERATION: operation,
        LogFields.MODEL: model,
        LogFields.IP: request.client.host if request.client else "unknown",
    }

    if record_id:
        extra[LogFields.RECORD_ID] = record_id

    if patient_id:
        extra[LogFields.PATIENT_ID] = patient_id

    if count is not None:
        extra[LogFields.COUNT] = count

    # Add any additional fields
    extra.update(kwargs)

    message = f"{operation.capitalize()} {model}"
    if record_id:
        message += f" (ID: {record_id})"
    if count is not None:
        message += f" - {count} records"

    logger.info(message, extra=extra)


def log_performance(
    logger: logging.Logger,
    operation: str,
    duration_ms: int,
    *,
    threshold_ms: int = 1000,
    user_id: Optional[int] = None,
    **kwargs
) -> None:
    """
    Log performance metrics for slow operations.

    Only logs if duration exceeds threshold.

    Args:
        logger: Logger instance
        operation: Operation description
        duration_ms: Duration in milliseconds
        threshold_ms: Threshold to trigger logging (default: 1000ms)
        user_id: Optional user ID
        **kwargs: Additional fields to log

    Example:
        start = time.time()
        results = expensive_query()
        duration_ms = int((time.time() - start) * 1000)
        log_performance(
            logger, "patient_list_query", duration_ms,
            user_id=user_id,
            record_count=len(results)
        )
    """
    if duration_ms <= threshold_ms:
        return  # Don't log if under threshold

    extra = {
        LogFields.CATEGORY: "app",
        LogFields.EVENT: f"slow_operation_{operation}",
        LogFields.DURATION: duration_ms,
        "threshold_ms": threshold_ms,
    }

    if user_id:
        extra[LogFields.USER_ID] = user_id

    # Add any additional fields
    extra.update(kwargs)

    logger.warning(
        f"Slow operation: {operation} took {duration_ms}ms (threshold: {threshold_ms}ms)",
        extra=extra
    )


def log_validation_error(
    logger: logging.Logger,
    request: Request,
    error_details: Any,
    *,
    user_id: Optional[int] = None,
    **kwargs
) -> None:
    """
    Log validation errors from user input.

    Args:
        logger: Logger instance
        request: FastAPI request object
        error_details: Validation error details (from Pydantic, etc.)
        user_id: Optional user ID
        **kwargs: Additional fields to log

    Example:
        except ValidationError as e:
            log_validation_error(logger, request, e.errors(), user_id=user_id)
            raise HTTPException(400, detail="Invalid input")
    """
    extra = {
        LogFields.CATEGORY: "app",
        LogFields.EVENT: "validation_error",
        LogFields.IP: request.client.host if request.client else "unknown",
        "method": request.method,
        "path": request.url.path,
    }

    if user_id:
        extra[LogFields.USER_ID] = user_id

    # Add error details (truncate if too long)
    error_str = str(error_details)[:500]
    extra["validation_errors"] = error_str

    # Add any additional fields
    extra.update(kwargs)

    logger.warning("Input validation failed", extra=extra)


def log_external_service(
    logger: logging.Logger,
    service: str,
    operation: str,
    success: bool,
    *,
    duration_ms: Optional[int] = None,
    error: Optional[str] = None,
    **kwargs
) -> None:
    """
    Log external service interactions (Paperless, etc.).

    Args:
        logger: Logger instance
        service: Service name (e.g., "paperless", "backup_service")
        operation: Operation description
        success: Whether the operation succeeded
        duration_ms: Optional duration in milliseconds
        error: Optional error message if failed
        **kwargs: Additional fields to log

    Example:
        log_external_service(
            logger, "paperless", "document_upload",
            success=True,
            duration_ms=1250,
            document_id=doc_id
        )
    """
    extra = {
        LogFields.CATEGORY: "app",
        LogFields.EVENT: f"{service}_{operation}",
        LogFields.STATUS: "success" if success else "failure",
        "service": service,
    }

    if duration_ms:
        extra[LogFields.DURATION] = duration_ms

    if error:
        extra[LogFields.ERROR] = error

    # Add any additional fields
    extra.update(kwargs)

    level = logging.INFO if success else logging.ERROR
    message = f"{service} {operation}: {'success' if success else 'failed'}"
    if error:
        message += f" - {error}"

    logger.log(level, message, extra=extra)


def log_debug(
    logger: logging.Logger,
    message: str,
    **kwargs
) -> None:
    """
    Log debug information with consistent format.

    Use sparingly - debug logs should be removed before production.

    Args:
        logger: Logger instance
        message: Debug message
        **kwargs: Additional fields to log

    Example:
        log_debug(logger, "Processing batch", batch_size=len(items), step="validation")
    """
    extra = {
        LogFields.CATEGORY: "app",
    }
    extra.update(kwargs)

    logger.debug(message, extra=extra)
