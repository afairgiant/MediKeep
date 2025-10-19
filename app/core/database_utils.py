"""
Database utility functions for cross-database compatibility.

Provides helper functions that work with both PostgreSQL and SQLite,
abstracting away database-specific operations.
"""
from sqlalchemy import func, String, and_, true
from sqlalchemy.sql import ColumnElement
from sqlalchemy.orm import Session


def get_database_type(db: Session) -> str:
    """
    Detect the database type (postgresql or sqlite).

    Args:
        db: Database session

    Returns:
        'postgresql' or 'sqlite'
    """
    dialect_name = db.bind.dialect.name
    return dialect_name


def json_array_contains_lower(column: ColumnElement, search_value: str) -> ColumnElement:
    """
    Check if a JSON array column contains a value (case-insensitive).

    Uses text-based matching that works on both PostgreSQL and SQLite.
    Note: This approach works correctly but may not use specialized indexes.

    For production optimization:
    - PostgreSQL: Create a functional GIN index on LOWER(jsonb_array_elements_text(column))
    - SQLite: Use a generated column for searchable text

    Args:
        column: The JSON array column to search
        search_value: The value to search for (will be lowercased)

    Returns:
        SQLAlchemy condition that can be used in filter()

    Example:
        filter(json_array_contains_lower(Test.common_names, 'cbc'))
    """
    # Convert JSON array to text and check if it contains the search value
    # Format: column might be ["CBC", "Complete Blood Count"]
    # We search for the quoted value within the JSON structure (both sides lowercased)
    return func.lower(func.cast(column, String)).contains(
        f'"{search_value.lower()}"'
    )


def create_text_search_condition(column: ColumnElement, search_term: str) -> ColumnElement:
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

    # Create conditions for each word (case-insensitive)
    conditions = []
    for word in words:
        conditions.append(func.lower(column).contains(word.lower()))

    # All words must match (AND logic)
    if len(conditions) == 1:
        return conditions[0]

    return and_(*conditions)
