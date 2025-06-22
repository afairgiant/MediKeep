"""
Utility functions and common query patterns for CRUD operations.

This module provides reusable query patterns and helper functions
that can be used across different CRUD classes to reduce code duplication.
"""

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Type, TypeVar

from sqlalchemy import and_, asc, desc, or_
from sqlalchemy.orm import Query, Session
from sqlalchemy.sql.functions import count

# Type variable for SQLAlchemy models
ModelType = TypeVar("ModelType")


def apply_common_filters(
    query: Query,
    model: Type[ModelType],
    *,
    patient_id: Optional[int] = None,
    practitioner_id: Optional[int] = None,
    status: Optional[str] = None,
    additional_filters: Optional[Dict[str, Any]] = None,
) -> Query:
    """
    Apply common filters to a query.

    Args:
        query: SQLAlchemy query object
        model: SQLAlchemy model class
        patient_id: Optional patient ID filter
        practitioner_id: Optional practitioner ID filter
        status: Optional status filter
        additional_filters: Additional field filters

    Returns:
        Modified query with filters applied
    """
    if patient_id and hasattr(model, "patient_id"):
        query = query.filter(getattr(model, "patient_id") == patient_id)

    if practitioner_id and hasattr(model, "practitioner_id"):
        query = query.filter(getattr(model, "practitioner_id") == practitioner_id)

    if status and hasattr(model, "status"):
        query = query.filter(getattr(model, "status") == status.lower())

    if additional_filters:
        for field_name, field_value in additional_filters.items():
            if hasattr(model, field_name):
                field = getattr(model, field_name)
                query = query.filter(field == field_value)

    return query


def apply_ordering(
    query: Query,
    model: Type[ModelType],
    *,
    order_by: Optional[str] = None,
    order_desc: bool = True,
) -> Query:
    """
    Apply ordering to a query.

    Args:
        query: SQLAlchemy query object
        model: SQLAlchemy model class
        order_by: Field name to order by
        order_desc: Whether to order in descending order

    Returns:
        Modified query with ordering applied
    """
    if order_by and hasattr(model, order_by):
        order_field = getattr(model, order_by)
        if order_desc:
            query = query.order_by(desc(order_field))
        else:
            query = query.order_by(asc(order_field))
    else:
        # Default ordering by id
        if order_desc:
            query = query.order_by(desc(getattr(model, "id")))
        else:
            query = query.order_by(asc(getattr(model, "id")))

    return query


def apply_pagination(query: Query, *, skip: int = 0, limit: int = 100) -> Query:
    """
    Apply pagination to a query.

    Args:
        query: SQLAlchemy query object
        skip: Number of records to skip
        limit: Maximum number of records to return

    Returns:
        Modified query with pagination applied
    """
    return query.offset(skip).limit(limit)


def get_by_date_range(
    db: Session,
    model: Type[ModelType],
    *,
    date_field: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    order_by: Optional[str] = None,
    order_desc: bool = True,
) -> List[ModelType]:
    """
    Get records within a date range.

    Args:
        db: Database session
        model: SQLAlchemy model class
        date_field: Name of the date field to filter by
        start_date: Start date for range
        end_date: End date for range
        patient_id: Optional patient ID filter
        skip: Number of records to skip
        limit: Maximum number of records to return
        order_by: Field name to order by
        order_desc: Whether to order in descending order

    Returns:
        List of records within the date range
    """
    if not hasattr(model, date_field):
        raise ValueError(f"Model {model.__name__} does not have field '{date_field}'")

    query = db.query(model)

    # Apply date range filters
    date_field_obj = getattr(model, date_field)
    if start_date:
        query = query.filter(date_field_obj >= start_date)
    if end_date:
        query = query.filter(date_field_obj <= end_date)

    # Apply patient filter
    if patient_id and hasattr(model, "patient_id"):
        query = query.filter(getattr(model, "patient_id") == patient_id)

    # Apply ordering and pagination
    query = apply_ordering(query, model, order_by=order_by, order_desc=order_desc)
    query = apply_pagination(query, skip=skip, limit=limit)

    return query.all()


def get_recent_records(
    db: Session,
    model: Type[ModelType],
    *,
    date_field: str,
    days: int = 30,
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    order_by: Optional[str] = None,
    order_desc: bool = True,
) -> List[ModelType]:
    """
    Get recent records within the last N days.

    Args:
        db: Database session
        model: SQLAlchemy model class
        date_field: Name of the date field to filter by
        days: Number of days to look back
        patient_id: Optional patient ID filter
        skip: Number of records to skip
        limit: Maximum number of records to return
        order_by: Field name to order by
        order_desc: Whether to order in descending order

    Returns:
        List of recent records
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    return get_by_date_range(
        db=db,
        model=model,
        date_field=date_field,
        start_date=cutoff_date,
        patient_id=patient_id,
        skip=skip,
        limit=limit,
        order_by=order_by,
        order_desc=order_desc,
    )


def search_by_text_pattern(
    db: Session,
    model: Type[ModelType],
    *,
    field_name: str,
    search_term: str,
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    order_by: Optional[str] = None,
    order_desc: bool = True,
    additional_filters: Optional[Dict[str, Any]] = None,
) -> List[ModelType]:
    """
    Search records by text field using ILIKE pattern matching.

    Args:
        db: Database session
        model: SQLAlchemy model class
        field_name: Name of the text field to search
        search_term: Text to search for
        patient_id: Optional patient ID filter
        skip: Number of records to skip
        limit: Maximum number of records to return
        order_by: Field name to order by
        order_desc: Whether to order in descending order
        additional_filters: Additional field filters

    Returns:
        List of records matching the search criteria
    """
    if not hasattr(model, field_name):
        raise ValueError(f"Model {model.__name__} does not have field '{field_name}'")

    query = db.query(model)

    # Apply text search filter
    field = getattr(model, field_name)
    search_pattern = f"%{search_term}%"
    query = query.filter(field.ilike(search_pattern))

    # Apply common filters
    query = apply_common_filters(
        query, model, patient_id=patient_id, additional_filters=additional_filters
    )

    # Apply ordering and pagination
    query = apply_ordering(query, model, order_by=order_by, order_desc=order_desc)
    query = apply_pagination(query, skip=skip, limit=limit)

    return query.all()


def get_active_records(
    db: Session,
    model: Type[ModelType],
    *,
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    order_by: Optional[str] = None,
    order_desc: bool = True,
) -> List[ModelType]:
    """
    Get active records (status = 'active').

    Args:
        db: Database session
        model: SQLAlchemy model class
        patient_id: Optional patient ID filter
        skip: Number of records to skip
        limit: Maximum number of records to return
        order_by: Field name to order by
        order_desc: Whether to order in descending order

    Returns:
        List of active records
    """
    return get_by_field_with_filters(
        db=db,
        model=model,
        field_name="status",
        field_value="active",
        patient_id=patient_id,
        skip=skip,
        limit=limit,
        order_by=order_by,
        order_desc=order_desc,
    )


def get_by_field_with_filters(
    db: Session,
    model: Type[ModelType],
    *,
    field_name: str,
    field_value: Any,
    patient_id: Optional[int] = None,
    practitioner_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    order_by: Optional[str] = None,
    order_desc: bool = True,
    additional_filters: Optional[Dict[str, Any]] = None,
) -> List[ModelType]:
    """
    Get records by field value with optional additional filters.

    Args:
        db: Database session
        model: SQLAlchemy model class
        field_name: Name of the field to filter by
        field_value: Value to filter for
        patient_id: Optional patient ID filter
        practitioner_id: Optional practitioner ID filter
        skip: Number of records to skip
        limit: Maximum number of records to return
        order_by: Field name to order by
        order_desc: Whether to order in descending order
        additional_filters: Additional field filters

    Returns:
        List of records matching the criteria
    """
    if not hasattr(model, field_name):
        raise ValueError(f"Model {model.__name__} does not have field '{field_name}'")

    query = db.query(model)

    # Apply main filter
    field = getattr(model, field_name)
    query = query.filter(field == field_value)

    # Apply common filters
    query = apply_common_filters(
        query,
        model,
        patient_id=patient_id,
        practitioner_id=practitioner_id,
        additional_filters=additional_filters,
    )

    # Apply ordering and pagination
    query = apply_ordering(query, model, order_by=order_by, order_desc=order_desc)
    query = apply_pagination(query, skip=skip, limit=limit)

    return query.all()


def count_by_field(
    db: Session,
    model: Type[ModelType],
    *,
    field_name: str,
    patient_id: Optional[int] = None,
    additional_filters: Optional[Dict[str, Any]] = None,
) -> Dict[str, int]:
    """
    Count records grouped by a field.

    Args:
        db: Database session
        model: SQLAlchemy model class
        field_name: Name of the field to group by
        patient_id: Optional patient ID filter
        additional_filters: Additional field filters

    Returns:
        Dictionary with field values as keys and counts as values
    """
    if not hasattr(model, field_name):
        raise ValueError(f"Model {model.__name__} does not have field '{field_name}'")

    query = db.query(
        getattr(model, field_name), count(getattr(model, "id")).label("count")
    )

    # Apply common filters
    if patient_id and hasattr(model, "patient_id"):
        query = query.filter(getattr(model, "patient_id") == patient_id)

    if additional_filters:
        for filter_field, filter_value in additional_filters.items():
            if hasattr(model, filter_field):
                field = getattr(model, filter_field)
                query = query.filter(field == filter_value)

    # Group by the specified field
    query = query.group_by(getattr(model, field_name))

    result = query.all()
    return {row[0]: row[1] for row in result if row[0]}


def get_unique_values(
    db: Session,
    model: Type[ModelType],
    *,
    field_name: str,
    patient_id: Optional[int] = None,
    additional_filters: Optional[Dict[str, Any]] = None,
) -> List[Any]:
    """
    Get unique values for a field.

    Args:
        db: Database session
        model: SQLAlchemy model class
        field_name: Name of the field to get unique values for
        patient_id: Optional patient ID filter
        additional_filters: Additional field filters

    Returns:
        List of unique values
    """
    if not hasattr(model, field_name):
        raise ValueError(f"Model {model.__name__} does not have field '{field_name}'")

    from sqlalchemy import distinct

    query = db.query(distinct(getattr(model, field_name)))

    # Apply common filters
    if patient_id and hasattr(model, "patient_id"):
        query = query.filter(getattr(model, "patient_id") == patient_id)

    if additional_filters:
        for filter_field, filter_value in additional_filters.items():
            if hasattr(model, filter_field):
                field = getattr(model, filter_field)
                query = query.filter(field == filter_value)

    result = query.all()
    return sorted([row[0] for row in result if row[0]])
