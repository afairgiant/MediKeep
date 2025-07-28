"""
Centralized Activity Logging for API Endpoints

This module provides reusable functions and decorators to eliminate duplicate
activity logging code across all API endpoints.
"""

from functools import wraps
from typing import Any, Dict, Optional, Union

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.core.logging_config import get_logger
from app.core.logging_constants import sanitize_log_input
from app.crud.activity_log import activity_log
from app.models.activity_log import ActionType, EntityType

logger = get_logger(__name__, "activity_logging")


def _is_sensitive_field(field_name: str) -> bool:
    """
    Check if a field name contains sensitive information that should not be logged.

    Args:
        field_name: The field name to check

    Returns:
        True if the field is considered sensitive, False otherwise
    """
    sensitive_patterns = {
        "password",
        "token",
        "secret",
        "key",
        "ssn",
        "social_security",
        "credit_card",
        "bank_account",
        "routing_number",
        "api_key",
        "private_key",
        "hash",
        "salt",
        "session_id",
    }

    field_lower = field_name.lower()
    return any(pattern in field_lower for pattern in sensitive_patterns)


def _sanitize_entity_value(field_name: str, value: Any) -> str:
    """
    Sanitize entity field values, redacting sensitive information.

    Args:
        field_name: Name of the field
        value: Value to sanitize

    Returns:
        Sanitized string representation of the value
    """
    if value is None:
        return "None"

    # Check if this is a sensitive field
    if _is_sensitive_field(field_name):
        return "[REDACTED]"

    # For non-sensitive fields, sanitize the value
    return sanitize_log_input(str(value))


def get_entity_description(entity_obj: Any, entity_type: str, action: str) -> str:
    """
    Generate a human-readable description for an entity based on its type and action.

    Args:
        entity_obj: The database entity object
        entity_type: Type of entity (from EntityType constants)
        action: Action performed (from ActionType constants)

    Returns:
        Human-readable description string
    """
    action_word = action.capitalize()

    # Map entity types to their identifying fields (with fallback options)
    entity_field_map = {
        EntityType.MEDICATION: ["medication_name", "name"],
        EntityType.ALLERGY: ["allergen"],
        EntityType.CONDITION: [
            "condition_name",
            "diagnosis",
        ],  # Try condition_name first, then diagnosis
        EntityType.PROCEDURE: ["procedure_name", "name"],
        EntityType.TREATMENT: ["treatment_name", "name"],
        EntityType.IMMUNIZATION: ["vaccine_name", "name"],
        EntityType.ENCOUNTER: ["reason"],
        EntityType.PRACTITIONER: ["name"],
        EntityType.LAB_RESULT: ["test_name", "name"],
        EntityType.LAB_RESULT_FILE: ["file_name", "name"],
        EntityType.EMERGENCY_CONTACT: ["name"],
        EntityType.INSURANCE: ["company_name", "insurance_type"],  # Try company_name first, then insurance_type
        "vitals": [
            "recorded_date"
        ],  # For vitals, use the date since there's no single identifying field
        "pharmacy": ["name"],
        "patient": ["first_name", "last_name"],  # Combine first and last name
        "user": ["full_name", "username"],
    }

    # Get the identifying field(s) for this entity type
    field_names = entity_field_map.get(entity_type, [])
    if not isinstance(field_names, list):
        field_names = [field_names]

    # Try each field name until we find one that exists and has a value
    for field_name in field_names:
        if hasattr(entity_obj, field_name):
            entity_name = getattr(entity_obj, field_name, None)
            if entity_name:  # Only use if it's not None or empty
                # Sanitize the entity name before logging
                entity_name = _sanitize_entity_value(field_name, entity_name)

                # Special handling for patient names
                if entity_type == "patient" and field_name == "first_name":
                    last_name = getattr(entity_obj, "last_name", "")
                    last_name = (
                        _sanitize_entity_value("last_name", last_name)
                        if last_name
                        else ""
                    )
                    entity_name = f"{entity_name} {last_name}".strip()
                # Special handling for encounters - include both reason and date
                elif entity_type == EntityType.ENCOUNTER and field_name == "reason":
                    encounter_date = getattr(entity_obj, "date", None)
                    if encounter_date:
                        if hasattr(encounter_date, "strftime"):
                            date_str = encounter_date.strftime("%Y-%m-%d")
                        else:
                            date_str = _sanitize_entity_value("date", encounter_date)
                        entity_name = f"{entity_name} on {date_str}"
                # Special handling for insurance - include type and company
                elif entity_type == EntityType.INSURANCE:
                    insurance_type = getattr(entity_obj, "insurance_type", "")
                    if field_name == "company_name" and insurance_type:
                        insurance_type_sanitized = _sanitize_entity_value("insurance_type", insurance_type)
                        entity_name = f"{insurance_type_sanitized.title()} Insurance: {entity_name}"
                    elif field_name == "insurance_type":
                        entity_name = f"{entity_name.title()} Insurance"

                # Use friendly display names
                entity_display_names = {
                    EntityType.ENCOUNTER: "Visit",
                    "encounter": "Visit",
                    EntityType.MEDICATION: "Medication",
                    EntityType.ALLERGY: "Allergy",
                    EntityType.CONDITION: "Condition",
                    EntityType.PROCEDURE: "Procedure",
                    EntityType.TREATMENT: "Treatment",
                    EntityType.IMMUNIZATION: "Immunization",
                    EntityType.PRACTITIONER: "Practitioner",
                    EntityType.LAB_RESULT: "Lab Result",
                    EntityType.LAB_RESULT_FILE: "Lab Result File",
                    EntityType.EMERGENCY_CONTACT: "Emergency Contact",
                    EntityType.INSURANCE: "Insurance",
                    "vitals": "Vitals",
                    "pharmacy": "Pharmacy",
                    "patient": "Patient",
                    "user": "User",
                }

                display_name = entity_display_names.get(
                    entity_type, entity_type.replace("_", " ")
                )
                return f"{action_word} {display_name}: {entity_name}"

    # Special case for vitals - create a more descriptive name
    if entity_type == "vitals":
        recorded_date = getattr(entity_obj, "recorded_date", None)
        if recorded_date and hasattr(recorded_date, "strftime"):
            date_str = recorded_date.strftime("%Y-%m-%d")
        else:
            date_str = (
                _sanitize_entity_value("recorded_date", recorded_date)
                if recorded_date
                else "Unknown date"
            )
        return f"{action_word} vitals recorded on {date_str}"

    # Fallback to generic description with friendly names
    entity_display_names = {
        EntityType.ENCOUNTER: "Visit",
        "encounter": "Visit",
        EntityType.MEDICATION: "Medication",
        EntityType.ALLERGY: "Allergy",
        EntityType.CONDITION: "Condition",
        EntityType.PROCEDURE: "Procedure",
        EntityType.TREATMENT: "Treatment",
        EntityType.IMMUNIZATION: "Immunization",
        EntityType.PRACTITIONER: "Practitioner",
        EntityType.LAB_RESULT: "Lab Result",
        EntityType.LAB_RESULT_FILE: "Lab Result File",
        EntityType.EMERGENCY_CONTACT: "Emergency Contact",
        EntityType.INSURANCE: "Insurance",
        "vitals": "Vitals",
        "pharmacy": "Pharmacy",
        "patient": "Patient",
        "user": "User",
    }

    display_name = entity_display_names.get(entity_type, entity_type.replace("_", " "))
    return f"{action_word} {display_name}"


def log_crud_activity(
    db: Session,
    action: str,
    entity_type: str,
    entity_obj: Any,
    user_id: int,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> bool:
    """
    Log a CRUD activity for an entity object.

    Args:
        db: Database session
        action: Action performed (use ActionType constants)
        entity_type: Type of entity (use EntityType constants)
        entity_obj: The database entity object
        user_id: ID of the user who performed the action
        description: Optional custom description (auto-generated if not provided)
        metadata: Optional additional metadata
        request: Optional FastAPI request object for IP/user agent

    Returns:
        True if logging succeeded, False otherwise
    """
    try:
        # Generate description if not provided, otherwise sanitize the provided description
        if not description:
            description = get_entity_description(entity_obj, entity_type, action)
        else:
            description = sanitize_log_input(description)

        # Extract entity details
        entity_id = getattr(entity_obj, "id", None)
        patient_id = getattr(entity_obj, "patient_id", None)

        # Extract and sanitize request details if available
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            raw_user_agent = request.headers.get("user-agent")
            user_agent = sanitize_log_input(raw_user_agent) if raw_user_agent else None

        # Sanitize metadata to prevent sensitive data exposure
        safe_metadata = None
        if metadata:
            safe_metadata = {}
            for key, value in metadata.items():
                # Sanitize both keys and values
                safe_key = sanitize_log_input(str(key))
                safe_value = _sanitize_entity_value(key, value)
                safe_metadata[safe_key] = safe_value

        # Log the activity using the CRUD method
        activity_log.log_activity(
            db=db,
            action=action,
            entity_type=entity_type,
            description=description,
            user_id=user_id,
            patient_id=patient_id,
            entity_id=entity_id,
            metadata=safe_metadata,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return True

    except Exception as e:
        # Sanitize error message to prevent sensitive data exposure
        safe_error_msg = sanitize_log_input(str(e))
        sanitized_entity_type = (
            "[REDACTED]" if _is_sensitive_field(entity_type) else entity_type
        )
        logger.error(
            f"Failed to log activity: {action} {entity_type}",
            extra={
                "error": safe_error_msg,
                "user_id": user_id,
                "entity_type": sanitized_entity_type,
                "action": action,
            },
        )
        return False


def safe_log_activity(
    db: Session,
    action: str,
    entity_type: str,
    entity_obj: Any,
    user_id: int,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Safely log an activity without raising exceptions.

    This function ensures that activity logging failures don't break the main operation.
    It logs errors but continues execution.

    Args:
        db: Database session
        action: Action performed (use ActionType constants)
        entity_type: Type of entity (use EntityType constants)
        entity_obj: The database entity object
        user_id: ID of the user who performed the action
        description: Optional custom description (auto-generated if not provided)
        metadata: Optional additional metadata
        request: Optional FastAPI request object for IP/user agent
    """
    try:
        log_crud_activity(
            db=db,
            action=action,
            entity_type=entity_type,
            entity_obj=entity_obj,
            user_id=user_id,
            description=description,
            metadata=metadata,
            request=request,
        )
    except Exception as e:
        # Sanitize error message to prevent sensitive data exposure in logs
        safe_error_msg = sanitize_log_input(str(e))
        sanitized_entity_type = (
            "[REDACTED]" if _is_sensitive_field(entity_type) else entity_type
        )
        logger.warning(
            f"Activity logging failed for {action} {entity_type}: {safe_error_msg}",
            extra={
                "user_id": user_id,
                "entity_type": sanitized_entity_type,
                "action": action,
                "error": safe_error_msg,
            },
        )
        # Rollback any partial transaction that might have been started
        try:
            db.rollback()
        except Exception:
            pass


def activity_logger(
    action: str,
    entity_type: str,
    description_field: Optional[str] = None,
):
    """
    Decorator to automatically log activities for CRUD operations.

    Args:
        action: Action performed (use ActionType constants)
        entity_type: Type of entity (use EntityType constants)
        description_field: Optional field name to use for description

    Example:
        @activity_logger(ActionType.CREATED, EntityType.MEDICATION)
        def create_medication(db, medication_in, current_user_id):
            return medication.create(db=db, obj_in=medication_in)
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract common parameters
            db = kwargs.get("db")
            current_user_id = kwargs.get("current_user_id")
            request = kwargs.get("request")

            # Execute the main function
            result = func(*args, **kwargs)

            # Log the activity if we have the required parameters
            if db and current_user_id and result:
                safe_log_activity(
                    db=db,
                    action=action,
                    entity_type=entity_type,
                    entity_obj=result,
                    user_id=current_user_id,
                    request=request,
                )

            return result

        return wrapper

    return decorator


# Convenience functions for common CRUD operations
def log_create(
    db: Session,
    entity_type: str,
    entity_obj: Any,
    user_id: int,
    request: Optional[Request] = None,
) -> None:
    """Log a CREATE operation."""
    safe_log_activity(
        db=db,
        action=ActionType.CREATED,
        entity_type=entity_type,
        entity_obj=entity_obj,
        user_id=user_id,
        request=request,
    )


def log_update(
    db: Session,
    entity_type: str,
    entity_obj: Any,
    user_id: int,
    request: Optional[Request] = None,
) -> None:
    """Log an UPDATE operation."""
    safe_log_activity(
        db=db,
        action=ActionType.UPDATED,
        entity_type=entity_type,
        entity_obj=entity_obj,
        user_id=user_id,
        request=request,
    )


def log_delete(
    db: Session,
    entity_type: str,
    entity_obj: Any,
    user_id: int,
    request: Optional[Request] = None,
) -> None:
    """Log a DELETE operation."""
    safe_log_activity(
        db=db,
        action=ActionType.DELETED,
        entity_type=entity_type,
        entity_obj=entity_obj,
        user_id=user_id,
        request=request,
    )


def log_view(
    db: Session,
    entity_type: str,
    entity_obj: Any,
    user_id: int,
    request: Optional[Request] = None,
) -> None:
    """Log a VIEW operation."""
    safe_log_activity(
        db=db,
        action=ActionType.VIEWED,
        entity_type=entity_type,
        entity_obj=entity_obj,
        user_id=user_id,
        request=request,
    )
