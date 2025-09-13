"""
Response models for standardized API responses in the Medical Records Management System.

This module provides Pydantic models for consistent API responses across the application,
integrating with the APIException library for standardized error handling.
"""

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class ExceptionStatus(str, Enum):
    """
    Enumeration for exception status types used in error responses.
    """
    SUCCESS = "SUCCESS"
    WARNING = "WARNING" 
    FAIL = "FAIL"


class BaseExceptionCode(str, Enum):
    """
    Base enumeration for exception codes with standard HTTP error types.
    """
    # 400 Bad Request
    BAD_REQUEST = "BAD-400"
    VALIDATION_ERROR = "VAL-422"
    
    # 401 Unauthorized
    UNAUTHORIZED = "AUTH-401"
    TOKEN_EXPIRED = "AUTH-401-EXPIRED"
    TOKEN_INVALID = "AUTH-401-INVALID"
    
    # 403 Forbidden
    FORBIDDEN = "PERM-403"
    INSUFFICIENT_PERMISSIONS = "PERM-403-INSUF"
    
    # 404 Not Found
    NOT_FOUND = "NOT-404"
    RESOURCE_NOT_FOUND = "RES-404"
    
    # 409 Conflict
    CONFLICT = "CONF-409"
    DUPLICATE_ENTRY = "CONF-409-DUP"
    
    # 500 Internal Server Error
    INTERNAL_SERVER_ERROR = "ISE-500"
    DATABASE_ERROR = "DB-500"
    
    # Custom application errors
    BUSINESS_LOGIC_ERROR = "BIZ-400"
    SERVICE_UNAVAILABLE = "SVC-503"


class ExceptionCodeDefinition:
    """
    Helper class to define exception code details.
    """
    def __init__(self, error_code: str, message: str, description: str):
        self.error_code = error_code
        self.message = message
        self.description = description


class ExceptionCode(ExceptionCodeDefinition):
    """
    Exception code definitions for various error scenarios.
    """
    
    # 400 Bad Request
    BAD_REQUEST = ExceptionCodeDefinition(
        "BAD-400",
        "Bad Request", 
        "The request was invalid or cannot be served"
    )
    
    VALIDATION_ERROR = ExceptionCodeDefinition(
        "VAL-422",
        "Validation Error",
        "Input validation failed for one or more fields"
    )
    
    # 401 Unauthorized
    UNAUTHORIZED = ExceptionCodeDefinition(
        "AUTH-401",
        "Unauthorized",
        "Authentication is required to access this resource"
    )
    
    TOKEN_EXPIRED = ExceptionCodeDefinition(
        "AUTH-401-EXPIRED",
        "Token Expired",
        "The authentication token has expired"
    )
    
    TOKEN_INVALID = ExceptionCodeDefinition(
        "AUTH-401-INVALID", 
        "Invalid Token",
        "The authentication token is invalid or malformed"
    )
    
    # 403 Forbidden
    FORBIDDEN = ExceptionCodeDefinition(
        "PERM-403",
        "Forbidden",
        "You do not have permission to access this resource"
    )
    
    INSUFFICIENT_PERMISSIONS = ExceptionCodeDefinition(
        "PERM-403-INSUF",
        "Insufficient Permissions",
        "Your current permissions are not sufficient for this action"
    )
    
    # 404 Not Found
    NOT_FOUND = ExceptionCodeDefinition(
        "NOT-404",
        "Not Found",
        "The requested resource was not found"
    )
    
    RESOURCE_NOT_FOUND = ExceptionCodeDefinition(
        "RES-404",
        "Resource Not Found", 
        "The specified resource does not exist or has been deleted"
    )
    
    # 409 Conflict
    CONFLICT = ExceptionCodeDefinition(
        "CONF-409",
        "Conflict",
        "The request conflicts with the current state of the resource"
    )
    
    DUPLICATE_ENTRY = ExceptionCodeDefinition(
        "CONF-409-DUP",
        "Duplicate Entry",
        "A resource with the same identifier already exists"
    )
    
    # 500 Internal Server Error
    INTERNAL_SERVER_ERROR = ExceptionCodeDefinition(
        "ISE-500",
        "Internal Server Error",
        "An unexpected error occurred on the server"
    )
    
    DATABASE_ERROR = ExceptionCodeDefinition(
        "DB-500",
        "Database Error",
        "A database operation failed"
    )
    
    # Custom application errors
    BUSINESS_LOGIC_ERROR = ExceptionCodeDefinition(
        "BIZ-400",
        "Business Logic Error",
        "The operation violates business rules"
    )
    
    SERVICE_UNAVAILABLE = ExceptionCodeDefinition(
        "SVC-503",
        "Service Unavailable",
        "The service is temporarily unavailable"
    )


class ResponseModel(BaseModel):
    """
    Standard response model for API endpoints.
    
    This model provides a consistent structure for all API responses,
    whether successful or error responses.
    """
    
    data: Optional[Any] = Field(None, description="Response data payload")
    status: ExceptionStatus = Field(
        ExceptionStatus.SUCCESS,
        description="Response status indicating success, warning, or failure"
    )
    message: str = Field(..., description="Human-readable response message")
    error_code: Optional[str] = Field(None, description="Specific error code for failures")
    description: Optional[str] = Field(None, description="Detailed description of the response")
    
    class Config:
        """Pydantic model configuration."""
        use_enum_values = True
        validate_assignment = True
        
    def dict(self, **kwargs):
        """Override dict method to maintain compatibility."""
        return self.model_dump(**kwargs)