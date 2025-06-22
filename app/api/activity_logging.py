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
from app.crud.activity_log import activity_log
from app.models.activity_log import ActionType, EntityType

logger = get_logger(__name__, "activity_logging")


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
                # Special handling for patient names
                if entity_type == "patient" and field_name == "first_name":
                    last_name = getattr(entity_obj, "last_name", "")
                    entity_name = f"{entity_name} {last_name}".strip()
                # Special handling for encounters - include both reason and date
                elif entity_type == EntityType.ENCOUNTER and field_name == "reason":
                    encounter_date = getattr(entity_obj, "date", None)
                    if encounter_date:
                        if hasattr(encounter_date, "strftime"):
                            date_str = encounter_date.strftime("%Y-%m-%d")
                        else:
                            date_str = str(encounter_date)
                        entity_name = f"{entity_name} on {date_str}"

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
            date_str = "Unknown date"
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
        # Generate description if not provided
        if not description:
            description = get_entity_description(entity_obj, entity_type, action)

        # Extract entity details
        entity_id = getattr(entity_obj, "id", None)
        patient_id = getattr(entity_obj, "patient_id", None)

        # Extract request details if available
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

        # Log the activity using the CRUD method
        activity_log.log_activity(
            db=db,
            action=action,
            entity_type=entity_type,
            description=description,
            user_id=user_id,
            patient_id=patient_id,
            entity_id=entity_id,
            metadata=metadata,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return True

    except Exception as e:
        logger.error(
            f"Failed to log activity: {action} {entity_type}",
            extra={
                "error": str(e),
                "user_id": user_id,
                "entity_type": entity_type,
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
        # Log the error but don't break the main operation
        logger.warning(
            f"Activity logging failed for {action} {entity_type}: {str(e)}",
            extra={
                "user_id": user_id,
                "entity_type": entity_type,
                "action": action,
                "error": str(e),
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
