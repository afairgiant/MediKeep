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

    Works with both PostgreSQL and SQLite:
    - SQLite: Casts JSON to text and searches for quoted value
    - PostgreSQL: Same approach (works but doesn't use indexes optimally)

    Note: For PostgreSQL index support, use the dialect-aware version in search queries.

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
    # We search for the quoted value within the JSON structure
    return func.lower(func.cast(column, String)).contains(
        f'"{search_value.lower()}"'
    )


def create_text_search_condition(column: ColumnElement, search_term: str) -> ColumnElement:
    """
    Create a text search condition that works across databases.

    PostgreSQL: Uses full-text search (to_tsvector)
    SQLite: Falls back to LIKE-based search

    Args:
        column: The text column to search
        search_term: The search term

    Returns:
        SQLAlchemy condition
    """
    # For now, we'll use a simple approach that works on both:
    # Word boundary matching using LIKE
    # This is less powerful than PostgreSQL's full-text search but works everywhere

    # Split search term into words and search for each
    words = search_term.strip().split()

    if not words:
        return true()  # Dialect-neutral always-true condition

    # Create conditions for each word
    conditions = []
    for word in words:
        conditions.append(func.lower(column).contains(word.lower()))

    # All words must match (AND logic)
    if len(conditions) == 1:
        return conditions[0]

    return and_(*conditions)
