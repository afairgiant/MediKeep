"""
Comprehensive global error handling system for the Medical Records Management System.

This module provides a centralized error handling system using the APIException library,
with custom exception classes for different error types, database error handling,
and integration with our structured logging system.
"""

import traceback
from typing import Dict, Any, Optional, List
from contextlib import contextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import (
    IntegrityError,
    DatabaseError,
    DisconnectionError,
    OperationalError,
    SQLAlchemyError
)
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_500_INTERNAL_SERVER_ERROR,
    HTTP_503_SERVICE_UNAVAILABLE
)

from api_exception import APIException, register_exception_handlers
from app.core.response_models import ExceptionCode, ExceptionStatus, ResponseModel
from app.core.logging_config import get_logger

# Initialize logger for error handling
logger = get_logger(__name__, "app")


class MedicalRecordsAPIException(APIException):
    """
    Custom APIException subclass for Medical Records system with enhanced logging.
    
    This class extends the base APIException to integrate with our structured logging
    system and provide better context for medical records specific errors.
    """
    
    def __init__(self, 
                 error_code,
                 http_status_code: int = 400,
                 status: ExceptionStatus = ExceptionStatus.FAIL,
                 message: str = None,
                 description: str = None,
                 request: Optional[Request] = None,
                 context: Optional[Dict[str, Any]] = None,
                 headers: Optional[Dict[str, str]] = None):
        """
        Initialize with enhanced logging and context.
        
        Args:
            error_code: Exception code definition
            http_status_code: HTTP status code
            status: Exception status (fail, error, warning)
            message: Custom error message
            description: Detailed error description
            request: FastAPI request object for logging context
            context: Additional context data for logging
            headers: Optional HTTP headers to include in the response
        """
        super().__init__(error_code, http_status_code, status, message, description)
        
        # Store headers for FastAPI to use
        self.headers = headers
        
        # Enhanced logging with medical records context
        self._log_enhanced_exception(request, context)
    
    def _log_enhanced_exception(self, request: Optional[Request] = None, context: Optional[Dict[str, Any]] = None):
        """
        Enhanced logging with request context and structured data.
        """
        extra_data = {
            "category": "app",
            "event": "api_exception",
            "error_code": self.error_code,
            "http_status": self.http_status_code,
            "status": self.status.value if hasattr(self.status, 'value') else str(self.status)
        }
        
        if request:
            extra_data.update({
                "ip": request.client.host if request.client else "unknown",
                "method": request.method,
                "url_path": str(request.url.path),
                "user_agent": request.headers.get("user-agent", "unknown")
            })
        
        if context:
            extra_data.update(context)
        
        # Use appropriate log level based on HTTP status
        if self.http_status_code >= 500:
            logger.error(f"Server Error: {self.message}", extra=extra_data)
        elif self.http_status_code >= 400:
            logger.warning(f"Client Error: {self.message}", extra=extra_data)
        else:
            logger.info(f"Exception: {self.message}", extra=extra_data)


# Custom exception classes for different error categories

class ValidationException(MedicalRecordsAPIException):
    """Exception for validation errors (422)."""
    def __init__(self, message: str = None, description: str = None, validation_errors: List[str] = None, **kwargs):
        super().__init__(
            error_code=ExceptionCode.VALIDATION_ERROR,
            http_status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            status=ExceptionStatus.FAIL,
            message=message or "Validation failed",
            description=description or "One or more fields failed validation",
            **kwargs
        )
        self.validation_errors = validation_errors or []


class UnauthorizedException(MedicalRecordsAPIException):
    """Exception for unauthorized access (401)."""
    def __init__(self, message: str = None, description: str = None, **kwargs):
        super().__init__(
            error_code=ExceptionCode.UNAUTHORIZED,
            http_status_code=HTTP_401_UNAUTHORIZED,
            status=ExceptionStatus.FAIL,
            message=message or "Authentication required",
            description=description or "You must be authenticated to access this resource",
            **kwargs
        )


class ForbiddenException(MedicalRecordsAPIException):
    """Exception for forbidden access (403)."""
    def __init__(self, message: str = None, description: str = None, **kwargs):
        super().__init__(
            error_code=ExceptionCode.FORBIDDEN,
            http_status_code=HTTP_403_FORBIDDEN,
            status=ExceptionStatus.FAIL,
            message=message or "Access denied",
            description=description or "You do not have permission to access this resource",
            **kwargs
        )


class NotFoundException(MedicalRecordsAPIException):
    """Exception for resource not found (404)."""
    def __init__(self, resource: str = None, message: str = None, description: str = None, **kwargs):
        default_message = f"{resource} not found" if resource else "Resource not found"
        default_description = f"The requested {resource.lower()} does not exist" if resource else "The requested resource does not exist"
        
        super().__init__(
            error_code=ExceptionCode.NOT_FOUND,
            http_status_code=HTTP_404_NOT_FOUND,
            status=ExceptionStatus.FAIL,
            message=message or default_message,
            description=description or default_description,
            **kwargs
        )


class ConflictException(MedicalRecordsAPIException):
    """Exception for resource conflicts (409)."""
    def __init__(self, message: str = None, description: str = None, **kwargs):
        super().__init__(
            error_code=ExceptionCode.CONFLICT,
            http_status_code=HTTP_409_CONFLICT,
            status=ExceptionStatus.FAIL,
            message=message or "Resource conflict",
            description=description or "The request conflicts with the current state of the resource",
            **kwargs
        )


class DatabaseException(MedicalRecordsAPIException):
    """Exception for database errors (500)."""
    def __init__(self, message: str = None, description: str = None, original_error: Exception = None, **kwargs):
        super().__init__(
            error_code=ExceptionCode.DATABASE_ERROR,
            http_status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            status=ExceptionStatus.FAIL,
            message=message or "Database operation failed",
            description=description or "An error occurred while accessing the database",
            **kwargs
        )
        self.original_error = original_error


class BusinessLogicException(MedicalRecordsAPIException):
    """Exception for business logic violations (400)."""
    def __init__(self, message: str = None, description: str = None, **kwargs):
        super().__init__(
            error_code=ExceptionCode.BUSINESS_LOGIC_ERROR,
            http_status_code=HTTP_400_BAD_REQUEST,
            status=ExceptionStatus.FAIL,
            message=message or "Business rule violation",
            description=description or "The operation violates business rules",
            **kwargs
        )


class ServiceUnavailableException(MedicalRecordsAPIException):
    """Exception for service unavailable (503)."""
    def __init__(self, message: str = None, description: str = None, **kwargs):
        super().__init__(
            error_code=ExceptionCode.SERVICE_UNAVAILABLE,
            http_status_code=HTTP_503_SERVICE_UNAVAILABLE,
            status=ExceptionStatus.FAIL,
            message=message or "Service temporarily unavailable",
            description=description or "The service is temporarily unavailable, please try again later",
            **kwargs
        )


@contextmanager
def handle_database_errors(request: Optional[Request] = None, context: Optional[Dict[str, Any]] = None):
    """
    Context manager for handling database errors with proper logging and exception conversion.
    
    Usage:
        with handle_database_errors(request=request, context={"operation": "create_patient"}):
            # database operation
            db.add(patient)
            db.commit()
    """
    try:
        yield
    except IntegrityError as e:
        error_context = {"db_error_type": "integrity_error", "original_error": str(e)}
        if context:
            error_context.update(context)
            
        # Check for common integrity constraint violations
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        
        if "UNIQUE constraint failed" in error_msg or "duplicate key" in error_msg:
            raise ConflictException(
                message="Duplicate entry detected",
                description="A record with the same identifier already exists",
                request=request,
                context=error_context
            ) from e
        elif "FOREIGN KEY constraint failed" in error_msg:
            raise BusinessLogicException(
                message="Invalid reference",
                description="The operation references a non-existent record",
                request=request,
                context=error_context
            ) from e
        else:
            raise DatabaseException(
                message="Data integrity violation",
                description="The operation violates database constraints",
                request=request,
                context=error_context,
                original_error=e
            ) from e
            
    except (DisconnectionError, OperationalError) as e:
        error_context = {"db_error_type": "connection_error", "original_error": str(e)}
        if context:
            error_context.update(context)
            
        raise ServiceUnavailableException(
            message="Database connection error",
            description="Unable to connect to the database, please try again later",
            request=request,
            context=error_context
        ) from e
        
    except SQLAlchemyError as e:
        error_context = {"db_error_type": "general_db_error", "original_error": str(e)}
        if context:
            error_context.update(context)
            
        raise DatabaseException(
            message="Database operation failed",
            description="An unexpected database error occurred",
            request=request,
            context=error_context,
            original_error=e
        ) from e


def create_enhanced_validation_error_handler():
    """
    Create an enhanced validation error handler that maintains our detailed error messages
    while using the APIException framework.
    """
    async def enhanced_validation_exception_handler(request: Request, exc: RequestValidationError):
        """
        Enhanced handler for Pydantic validation errors (422) with detailed feedback.
        Maintains the same detailed error processing as the original handler.
        """
        user_ip = request.client.host if request.client else "unknown"
        
        # Log the validation error with structured logging
        logger.warning(
            f"Validation error on {request.method} {request.url.path}",
            extra={
                "category": "app",
                "event": "validation_error",
                "ip": user_ip,
                "validation_errors": exc.errors(),
                "url_path": str(request.url.path),
                "method": request.method,
                "error_count": len(exc.errors())
            }
        )

        # DEBUG: Print validation errors to console
        print(f"DEBUG VALIDATION ERRORS: {exc.errors()}")
        
        # Create user-friendly error messages (same logic as original)
        detailed_errors = []
        for error in exc.errors():
            field = error.get('loc')[-1] if error.get('loc') else 'unknown'
            msg = error.get('msg', 'Invalid value')
            
            # Make common validation errors more user-friendly
            if 'ensure this value is greater than' in msg:
                detailed_errors.append(f"{field}: Value must be greater than the minimum allowed")
            elif 'ensure this value is less than' in msg:
                detailed_errors.append(f"{field}: Value exceeds the maximum allowed")
            elif 'field required' in msg:
                detailed_errors.append(f"{field}: This field is required")
            elif 'string too short' in msg:
                detailed_errors.append(f"{field}: Value is too short")
            elif 'string too long' in msg:
                detailed_errors.append(f"{field}: Value is too long")
            else:
                detailed_errors.append(f"{field}: {msg}")
        
        # Create ValidationException with our enhanced error details
        validation_exception = ValidationException(
            message="Validation failed",
            description=f"Input validation failed for {len(detailed_errors)} field(s)",
            validation_errors=detailed_errors,
            request=request,
            context={"field_count": len(detailed_errors)}
        )
        
        # Return standardized error response
        return JSONResponse(
            status_code=validation_exception.http_status_code,
            content=validation_exception.to_response_model().model_dump(exclude_none=False)
        )
    
    return enhanced_validation_exception_handler


def create_fallback_exception_handler():
    """
    Create a fallback exception handler for unhandled exceptions with enhanced logging.
    """
    async def fallback_exception_handler(request: Request, exc: Exception):
        """
        Fallback handler for unhandled exceptions with detailed logging.
        """
        user_ip = request.client.host if request.client else "unknown"
        tb = traceback.format_exc()
        
        # Log comprehensive error information
        logger.error(
            f"Unhandled exception on {request.method} {request.url.path}",
            extra={
                "category": "app", 
                "event": "unhandled_exception",
                "ip": user_ip,
                "url_path": str(request.url.path),
                "method": request.method,
                "exception_type": type(exc).__name__,
                "exception_message": str(exc),
                "traceback": tb,
                "user_agent": request.headers.get("user-agent", "unknown")
            }
        )
        
        # Create internal server error response
        internal_error = MedicalRecordsAPIException(
            error_code=ExceptionCode.INTERNAL_SERVER_ERROR,
            http_status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            status=ExceptionStatus.FAIL,
            message="An unexpected error occurred",
            description="The server encountered an unexpected error. Please try again later.",
            request=request,
            context={
                "exception_type": type(exc).__name__,
                "has_traceback": True
            }
        )
        
        return JSONResponse(
            status_code=internal_error.http_status_code,
            content=internal_error.to_response_model().model_dump(exclude_none=False)
        )
    
    return fallback_exception_handler


def setup_error_handling(app: FastAPI):
    """
    Setup comprehensive error handling for the FastAPI application.
    
    This function replaces the current basic validation error handler with a 
    comprehensive APIException-based system that handles all error types.
    
    Args:
        app: FastAPI application instance
    """
    
    # Register APIException handlers with our custom configuration
    register_exception_handlers(
        app,
        use_response_model=True,
        use_fallback_middleware=False  # We'll use our custom handlers
    )
    
    # Replace default validation error handler with our enhanced version
    app.add_exception_handler(RequestValidationError, create_enhanced_validation_error_handler())
    
    # Add fallback handler for any unhandled exceptions
    app.add_exception_handler(Exception, create_fallback_exception_handler())
    
    # Add specific handler for standard HTTPException to maintain compatibility
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """
        Handler for standard FastAPI HTTPExceptions.
        Converts them to our standardized response format.
        """
        # Determine appropriate error code based on status code
        if exc.status_code == 400:
            error_code = ExceptionCode.BAD_REQUEST
        elif exc.status_code == 401:
            error_code = ExceptionCode.UNAUTHORIZED
        elif exc.status_code == 403:
            error_code = ExceptionCode.FORBIDDEN
        elif exc.status_code == 404:
            error_code = ExceptionCode.NOT_FOUND
        elif exc.status_code == 409:
            error_code = ExceptionCode.CONFLICT
        else:
            error_code = ExceptionCode.INTERNAL_SERVER_ERROR
        
        # Log the HTTP exception
        logger.warning(
            f"HTTP Exception {exc.status_code} on {request.method} {request.url.path}",
            extra={
                "category": "app",
                "event": "http_exception", 
                "ip": request.client.host if request.client else "unknown",
                "url_path": str(request.url.path),
                "method": request.method,
                "status_code": exc.status_code,
                "detail": exc.detail
            }
        )
        
        # Convert to our standardized format
        api_exception = MedicalRecordsAPIException(
            error_code=error_code,
            http_status_code=exc.status_code,
            status=ExceptionStatus.FAIL,
            message=exc.detail if isinstance(exc.detail, str) else "HTTP Error",
            description=f"HTTP {exc.status_code} error occurred",
            request=request
        )
        
        return JSONResponse(
            status_code=api_exception.http_status_code,
            content=api_exception.to_response_model().model_dump(exclude_none=False)
        )
    
    logger.info(
        "Comprehensive error handling system initialized",
        extra={
            "category": "app",
            "event": "error_handling_setup",
            "handlers": [
                "APIException", 
                "RequestValidationError",
                "HTTPException", 
                "Exception (fallback)"
            ]
        }
    )


# Convenience functions for common error scenarios

def raise_not_found(resource: str, identifier: str = None, request: Request = None):
    """
    Convenience function to raise a not found exception with consistent messaging.
    
    Args:
        resource: Type of resource (e.g., "Patient", "Record")
        identifier: Optional identifier of the resource
        request: Optional request object for logging context
    """
    message = f"{resource} not found"
    description = f"The requested {resource.lower()}"
    if identifier:
        description += f" with identifier '{identifier}'"
    description += " does not exist"
    
    raise NotFoundException(
        resource=resource,
        message=message,
        description=description,
        request=request,
        context={"resource_type": resource, "identifier": identifier}
    )


def raise_validation_error(field: str, message: str, request: Request = None):
    """
    Convenience function to raise validation errors for specific fields.
    
    Args:
        field: Field name that failed validation
        message: Error message
        request: Optional request object for logging context
    """
    raise ValidationException(
        message=f"Validation failed for field '{field}'",
        description=message,
        validation_errors=[f"{field}: {message}"],
        request=request,
        context={"field": field}
    )


def raise_permission_denied(action: str = None, resource: str = None, request: Request = None):
    """
    Convenience function to raise permission denied exceptions.
    
    Args:
        action: Action that was attempted (e.g., "delete", "update")
        resource: Resource type (e.g., "Patient", "Record")
        request: Optional request object for logging context
    """
    message = "Permission denied"
    description = "You do not have permission"
    
    if action and resource:
        message = f"Cannot {action} {resource.lower()}"
        description = f"You do not have permission to {action} this {resource.lower()}"
    elif action:
        message = f"Cannot {action}"
        description = f"You do not have permission to {action}"
    elif resource:
        message = f"Access denied to {resource.lower()}"
        description = f"You do not have permission to access this {resource.lower()}"
    
    raise ForbiddenException(
        message=message,
        description=description,
        request=request,
        context={"action": action, "resource_type": resource}
    )


# Export commonly used items
__all__ = [
    "setup_error_handling",
    "MedicalRecordsAPIException",
    "ValidationException",
    "UnauthorizedException", 
    "ForbiddenException",
    "NotFoundException",
    "ConflictException",
    "DatabaseException",
    "BusinessLogicException",
    "ServiceUnavailableException",
    "handle_database_errors",
    "raise_not_found",
    "raise_validation_error",
    "raise_permission_denied"
]