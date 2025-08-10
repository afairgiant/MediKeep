"""
Examples of how to use the comprehensive error handling system.

This module provides practical examples of using the new APIException-based
error handling system in the Medical Records Management System.
"""

from fastapi import Request
from sqlalchemy.exc import IntegrityError

from app.core.error_handling import (
    ValidationException,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
    BusinessLogicException,
    DatabaseException,
    handle_database_errors,
    raise_not_found,
    raise_validation_error,
    raise_permission_denied
)


# Example 1: Basic Exception Usage
def example_validation_error():
    """Example of raising a validation error."""
    
    # Simple validation error
    raise ValidationException(
        message="Invalid patient data",
        description="The provided patient data failed validation",
        validation_errors=[
            "name: This field is required",
            "email: Invalid email format",
            "age: Must be between 0 and 150"
        ]
    )


def example_not_found_error():
    """Example of raising a not found error."""
    
    # Resource not found
    raise NotFoundException(
        resource="Patient",
        message="Patient not found",
        description="The requested patient with ID 123 does not exist"
    )


def example_permission_error():
    """Example of raising a permission error."""
    
    # Permission denied
    raise ForbiddenException(
        message="Access denied",
        description="You do not have permission to delete patient records"
    )


# Example 2: Using Convenience Functions
def example_convenience_functions(patient_id: str):
    """Example of using convenience functions."""
    
    # Convenience function for not found
    raise_not_found("Patient", patient_id)
    
    # Convenience function for validation
    raise_validation_error("email", "Email format is invalid")
    
    # Convenience function for permissions
    raise_permission_denied("delete", "Patient")


# Example 3: Database Error Handling
def example_database_operations():
    """Example of handling database errors with context manager."""
    
    # Simulated database operations with error handling
    try:
        with handle_database_errors(context={"operation": "create_patient"}):
            # Simulate IntegrityError (duplicate key)
            raise IntegrityError(
                statement="INSERT INTO patients...",
                params={},
                orig=Exception("UNIQUE constraint failed: patients.email")
            )
    except ConflictException as e:
        # This would be caught and converted to ConflictException
        print(f"Handled conflict: {e.message}")
    
    try:
        with handle_database_errors(context={"operation": "update_record"}):
            # Simulate foreign key constraint
            raise IntegrityError(
                statement="UPDATE records...",
                params={},
                orig=Exception("FOREIGN KEY constraint failed")
            )
    except BusinessLogicException as e:
        # This would be caught and converted to BusinessLogicException
        print(f"Handled business logic error: {e.message}")


# Example 4: Request Context Usage
async def example_with_request_context(request: Request, patient_id: str):
    """Example of using exceptions with request context for enhanced logging."""
    
    # Check if patient exists (simulated)
    patient_exists = False  # This would be a real database query
    
    if not patient_exists:
        raise NotFoundException(
            resource="Patient",
            message=f"Patient {patient_id} not found",
            description=f"No patient record found with ID {patient_id}",
            request=request,  # This adds IP, method, path to logs
            context={
                "patient_id": patient_id,
                "operation": "fetch_patient"
            }
        )


# Example 5: Business Logic Errors
def example_business_logic_error():
    """Example of business logic validation."""
    
    # Business rule violation
    raise BusinessLogicException(
        message="Cannot discharge patient",
        description="Patient has pending treatments and cannot be discharged",
        context={
            "patient_status": "active_treatment",
            "pending_treatments": 3
        }
    )


# Example 6: API Endpoint Usage Pattern
async def example_api_endpoint_pattern(request: Request, patient_id: str):
    """
    Example of typical API endpoint error handling pattern.
    This shows how the error handling integrates seamlessly with FastAPI endpoints.
    """
    
    try:
        # 1. Validate input
        if not patient_id or len(patient_id) < 3:
            raise ValidationException(
                message="Invalid patient ID",
                description="Patient ID must be at least 3 characters long",
                validation_errors=["patient_id: Must be at least 3 characters"],
                request=request
            )
        
        # 2. Check permissions (simulated)
        user_has_permission = False  # This would check actual user permissions
        if not user_has_permission:
            raise_permission_denied("view", "Patient", request)
        
        # 3. Database operations with error handling
        with handle_database_errors(request=request, context={"operation": "fetch_patient"}):
            # Simulate database query
            patient = None  # This would be actual database query
            
            if not patient:
                raise_not_found("Patient", patient_id, request)
        
        # 4. Business logic validation
        if patient and hasattr(patient, 'status') and patient.status == 'archived':
            raise BusinessLogicException(
                message="Cannot access archived patient",
                description="This patient record has been archived and is no longer accessible",
                request=request,
                context={"patient_id": patient_id, "status": "archived"}
            )
        
        return {"status": "success", "patient": patient}
        
    except Exception:
        # All our custom exceptions will be automatically handled by the 
        # global error handler and converted to proper JSON responses
        # with appropriate HTTP status codes and structured logging
        raise


if __name__ == "__main__":
    # These examples would normally be called within FastAPI endpoints
    print("Error handling examples module loaded successfully")
    print("Use these patterns in your API endpoints for consistent error handling")