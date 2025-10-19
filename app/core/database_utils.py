"""
Database utility functions for cross-database compatibility.

Provides helper functions that work with both PostgreSQL and SQLite,
abstracting away database-specific operations.
"""
from typing import Any
from sqlalchemy import func, or_
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

    Works with both PostgreSQL and SQLite by using JSON functions available in both.

    Args:
        column: The JSON array column to search
        search_value: The value to search for (will be lowercased)

    Returns:
        SQLAlchemy condition that can be used in filter()

    Example:
        # PostgreSQL: Uses json_array_elements_text
        # SQLite: Uses json_each
        filter(json_array_contains_lower(Test.common_names, 'cbc'))
    """
    # This works for both databases:
    # - PostgreSQL: json_array_elements_text unnests the JSON array
    # - SQLite: json_each with .value extracts array elements
    # We use a subquery that checks if any array element matches (case-insensitive)

    # For simplicity and cross-database compatibility, we use a LIKE-based approach
    # Convert JSON array to text and check if it contains the search value
    # Format: column might be ["CBC", "Complete Blood Count"]
    # We search for the value within the JSON structure

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
        return column.ilike('%')  # Match anything if no search term

    # Create conditions for each word
    conditions = []
    for word in words:
        conditions.append(func.lower(column).contains(word.lower()))

    # All words must match (AND logic)
    if len(conditions) == 1:
        return conditions[0]

    return and_(*conditions)


def String():
    """Import String from sqlalchemy for type casting."""
    from sqlalchemy import String as SQLAString
    return SQLAString


def and_(*clauses):
    """Import and_ from sqlalchemy."""
    from sqlalchemy import and_ as sqla_and
    return sqla_and(*clauses)
