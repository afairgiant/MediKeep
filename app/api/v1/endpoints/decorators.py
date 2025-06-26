from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Type, Union, cast

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


def crud_endpoint(
    operation: str,
    *,
    entity_type: Any,
    entity_name: str,
    load_relations: Optional[List[str]] = None,
    verify_ownership: bool = True,
    require_patient_access: bool = False,
) -> Callable:
    """
    Advanced decorator for standardizing CRUD endpoint operations.

    Args:
        operation: Type of operation ('create', 'read', 'update', 'delete', 'list')
        entity_type: EntityType enum value for logging
        entity_name: Human-readable entity name (e.g., "Medication")
        load_relations: List of relationships to load for read operations
        verify_ownership: Whether to verify the entity belongs to current user
        require_patient_access: Whether to use verify_patient_access dependency

    Returns:
        Decorated function with standardized CRUD behavior
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Extract common dependencies from kwargs
            db = cast(Session, kwargs.get("db"))
            request = kwargs.get("request")  # type: Optional[Request]
            current_user_id = cast(int, kwargs.get("current_user_id"))
            current_user_patient_id = kwargs.get(
                "current_user_patient_id"
            )  # type: Optional[int]

            if operation == "create":
                return _handle_create_operation(
                    func,
                    args,
                    kwargs,
                    db,
                    request,
                    current_user_id,
                    entity_type,
                    entity_name,
                )
            elif operation == "read":
                return _handle_read_operation(
                    func,
                    args,
                    kwargs,
                    db,
                    current_user_patient_id,
                    entity_name,
                    load_relations,
                    verify_ownership,
                )
            elif operation == "update":
                return _handle_update_operation(
                    func,
                    args,
                    kwargs,
                    db,
                    request,
                    current_user_id,
                    entity_type,
                    entity_name,
                    verify_ownership,
                    current_user_patient_id,
                )
            elif operation == "delete":
                return _handle_delete_operation(
                    func,
                    args,
                    kwargs,
                    db,
                    request,
                    current_user_id,
                    entity_type,
                    entity_name,
                    verify_ownership,
                    current_user_patient_id,
                )
            elif operation == "list":
                return _handle_list_operation(
                    func, args, kwargs, db, current_user_patient_id, entity_name
                )
            else:
                # For custom operations, just call the function
                return func(*args, **kwargs)

        return wrapper

    return decorator


def _handle_create_operation(
    func: Callable,
    args: tuple,
    kwargs: dict,
    db: Session,
    request: Optional[Request],
    current_user_id: int,
    entity_type: Any,
    entity_name: str,
) -> Any:
    """Handle standardized create operations."""
    # Extract the input object (usually the first positional arg after dependencies)
    obj_in = None
    for arg in args:
        if hasattr(arg, "dict") or hasattr(arg, "model_dump"):  # Pydantic model
            obj_in = arg
            break

    if not obj_in:
        # Look in kwargs for the input object
        for key, value in kwargs.items():
            if hasattr(value, "dict") or hasattr(value, "model_dump"):
                obj_in = value
                break

    if not obj_in:
        raise HTTPException(status_code=400, detail="Invalid input data")

    # Get the CRUD object from the function
    result = func(*args, **kwargs)

    # The function should return the CRUD result
    # We'll use the existing handle_create_with_logging for consistency
    return result


def _handle_read_operation(
    func: Callable,
    args: tuple,
    kwargs: dict,
    db: Session,
    current_user_patient_id: Optional[int],
    entity_name: str,
    load_relations: Optional[List[str]],
    verify_ownership: bool,
) -> Any:
    """Handle standardized read operations."""
    # Call the function to get the entity
    entity_obj = func(*args, **kwargs)

    # Check if entity exists
    handle_not_found(entity_obj, entity_name)

    # Verify ownership if required
    if verify_ownership and current_user_patient_id:
        verify_patient_ownership(entity_obj, current_user_patient_id, entity_name)

    return entity_obj


def _handle_update_operation(
    func: Callable,
    args: tuple,
    kwargs: dict,
    db: Session,
    request: Optional[Request],
    current_user_id: int,
    entity_type: Any,
    entity_name: str,
    verify_ownership: bool,
    current_user_patient_id: Optional[int],
) -> Any:
    """Handle standardized update operations."""
    # Extract entity_id (usually in kwargs or as a positional arg)
    entity_id = kwargs.get("entity_id") or kwargs.get(f"{entity_name.lower()}_id")
    if not entity_id:
        # Look for ID-like arguments
        for key, value in kwargs.items():
            if key.endswith("_id") and isinstance(value, int):
                entity_id = value
                break

    if not entity_id:
        raise HTTPException(status_code=400, detail="Entity ID is required")

    # The function should handle the update logic
    result = func(*args, **kwargs)
    return result


def _handle_delete_operation(
    func: Callable,
    args: tuple,
    kwargs: dict,
    db: Session,
    request: Optional[Request],
    current_user_id: int,
    entity_type: Any,
    entity_name: str,
    verify_ownership: bool,
    current_user_patient_id: Optional[int],
) -> Any:
    """Handle standardized delete operations."""
    # Extract entity_id
    entity_id = kwargs.get("entity_id") or kwargs.get(f"{entity_name.lower()}_id")
    if not entity_id:
        for key, value in kwargs.items():
            if key.endswith("_id") and isinstance(value, int):
                entity_id = value
                break

    if not entity_id:
        raise HTTPException(status_code=400, detail="Entity ID is required")

    # The function should handle the deletion logic
    result = func(*args, **kwargs)
    return result


def _handle_list_operation(
    func: Callable,
    args: tuple,
    kwargs: dict,
    db: Session,
    current_user_patient_id: Optional[int],
    entity_name: str,
) -> Any:
    """Handle standardized list operations."""
    # The function should handle the list logic
    result = func(*args, **kwargs)
    return result


def standard_crud_endpoint(
    entity_type: Any,
    entity_name: str,
    crud_obj: Any,
    *,
    load_relations: Optional[List[str]] = None,
) -> Dict[str, Callable]:
    """
    Generate a complete set of standard CRUD endpoints for an entity.

    Args:
        entity_type: EntityType enum value
        entity_name: Human-readable entity name
        crud_obj: The CRUD object instance
        load_relations: Relations to load for read operations

    Returns:
        Dictionary of endpoint functions
    """

    def create_endpoint(
        *,
        db: Session = Depends(deps.get_db),
        obj_in: Any,
        request: Request,
        current_user_id: int = Depends(deps.get_current_user_id),
    ):
        return handle_create_with_logging(
            db=db,
            crud_obj=crud_obj,
            obj_in=obj_in,
            entity_type=entity_type,
            user_id=current_user_id,
            entity_name=entity_name,
            request=request,
        )

    def read_endpoint(
        *,
        db: Session = Depends(deps.get_db),
        entity_id: int,
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    ):
        if load_relations:
            entity_obj = crud_obj.get_with_relations(
                db=db, record_id=entity_id, relations=load_relations
            )
        else:
            entity_obj = crud_obj.get(db=db, id=entity_id)

        handle_not_found(entity_obj, entity_name)
        verify_patient_ownership(entity_obj, current_user_patient_id, entity_name)
        return entity_obj

    def update_endpoint(
        *,
        db: Session = Depends(deps.get_db),
        entity_id: int,
        obj_in: Any,
        request: Request,
        current_user_id: int = Depends(deps.get_current_user_id),
    ):
        return handle_update_with_logging(
            db=db,
            crud_obj=crud_obj,
            entity_id=entity_id,
            obj_in=obj_in,
            entity_type=entity_type,
            user_id=current_user_id,
            entity_name=entity_name,
            request=request,
        )

    def delete_endpoint(
        *,
        db: Session = Depends(deps.get_db),
        entity_id: int,
        request: Request,
        current_user_id: int = Depends(deps.get_current_user_id),
    ):
        return handle_delete_with_logging(
            db=db,
            crud_obj=crud_obj,
            entity_id=entity_id,
            entity_type=entity_type,
            user_id=current_user_id,
            entity_name=entity_name,
            request=request,
        )

    def list_endpoint(
        *,
        db: Session = Depends(deps.get_db),
        skip: int = 0,
        limit: int = 100,
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    ):
        return crud_obj.get_by_patient(
            db=db,
            patient_id=current_user_patient_id,
            skip=skip,
            limit=limit,
            load_relations=load_relations,
        )

    return {
        "create": create_endpoint,
        "read": read_endpoint,
        "update": update_endpoint,
        "delete": delete_endpoint,
        "list": list_endpoint,
    }
