"""
Database utility functions for cross-database compatibility.

Provides helper functions that work with both PostgreSQL and SQLite,
abstracting away database-specific operations.
"""

from sqlalchemy import JSON, and_, case, cast, func, literal, true
from sqlalchemy.orm import Session
from sqlalchemy.sql import ColumnElement


def get_database_type(db: Session) -> str:
    """
    Detect the database dialect name.

    Args:
        db: Database session

    Returns:
        Dialect name (e.g., 'postgresql', 'sqlite', 'mysql', etc.)
    """
    dialect_name = db.bind.dialect.name
    return dialect_name


def contains_ignore_case(column: ColumnElement, term: str) -> ColumnElement:
    """Case-insensitive substring match; `%` and `_` in the term match literally."""
    return func.lower(column).contains(term.lower(), autoescape=True)


def create_text_search_condition(
    column: ColumnElement, search_term: str
) -> ColumnElement:
    """
    Create a text search condition that works across databases.

    Uses word-based LIKE matching (works on both PostgreSQL and SQLite).
    This is simpler than full-text search but provides cross-database compatibility.

    For production optimization with PostgreSQL, consider using to_tsvector/to_tsquery
    with a GIN index for better full-text search performance.

    Args:
        column: The text column to search
        search_term: The search term (will be split on whitespace)

    Returns:
        SQLAlchemy condition (all words must match using AND logic)
    """
    # Word-based matching using contains()
    # Works on both databases but doesn't use specialized text search indexes

    # Split search term into words and search for each
    words = search_term.strip().split()

    if not words:
        return true()  # Dialect-neutral always-true condition

    # Create conditions for each word (case-insensitive with LIKE escaping)
    conditions = []
    for word in words:
        conditions.append(contains_ignore_case(column, word))

    # All words must match (AND logic)
    if len(conditions) == 1:
        return conditions[0]

    return and_(*conditions)


def json_array_elements(db: Session, column: ColumnElement):
    """Table-valued expansion of a JSON array column; each element is in `.c.value`.

    Null or non-array values expand to no rows. Reference it inside a query on the
    column's table so it correlates per row.
    """
    # PostgreSQL raises on expanding JSON null or a scalar, so swap those for []
    if get_database_type(db) == "sqlite":
        # A CAST to JSON gets numeric affinity in SQLite and turns '[]' into 0
        array_only = case((func.json_type(column) == "array", column), else_="[]")
        return func.json_each(array_only).table_valued("value")
    array_only = case(
        (func.json_typeof(column) == "array", column),
        else_=cast(literal("[]"), JSON),
    )
    return func.json_array_elements_text(array_only).table_valued("value")
