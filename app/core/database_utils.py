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
    Detect the database dialect name.

    Args:
        db: Database session

    Returns:
        Dialect name (e.g., 'postgresql', 'sqlite', 'mysql', etc.)
    """
    dialect_name = db.bind.dialect.name
    return dialect_name


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

    # Create conditions for each word (case-insensitive with LIKE escaping)
    conditions = []
    for word in words:
        conditions.append(func.lower(column).contains(word.lower(), autoescape=True))

    # All words must match (AND logic)
    if len(conditions) == 1:
        return conditions[0]

    return and_(*conditions)
