"""
CRUD operations for standardized tests
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case
from sqlalchemy.dialects.postgresql import array
from sqlalchemy import cast, ARRAY, String, any_
from sqlalchemy.sql import text
from app.models.models import StandardizedTest
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


def get_test_by_id(db: Session, test_id: int) -> Optional[StandardizedTest]:
    """Get a standardized test by ID."""
    return db.query(StandardizedTest).filter(StandardizedTest.id == test_id).first()


def get_test_by_loinc(db: Session, loinc_code: str) -> Optional[StandardizedTest]:
    """Get a standardized test by LOINC code."""
    return db.query(StandardizedTest).filter(StandardizedTest.loinc_code == loinc_code).first()


def get_test_by_name(db: Session, test_name: str) -> Optional[StandardizedTest]:
    """Get a standardized test by exact name match (case-insensitive)."""
    return db.query(StandardizedTest).filter(
        func.lower(StandardizedTest.test_name) == test_name.lower()
    ).first()


def search_tests(
    db: Session,
    query: str,
    category: Optional[str] = None,
    limit: int = 200
) -> List[StandardizedTest]:
    """
    Search for standardized tests using full-text search and fuzzy matching.

    Args:
        db: Database session
        query: Search query
        category: Optional category filter
        limit: Maximum number of results

    Returns:
        List of matching tests, ordered by relevance
    """
    if not query or not query.strip():
        # Return common tests if no query
        q = db.query(StandardizedTest).filter(StandardizedTest.is_common == True)
        if category:
            q = q.filter(StandardizedTest.category == category)
        return q.order_by(StandardizedTest.display_order).limit(limit).all()

    search_term = query.strip().lower()

    # Build query with multiple search strategies
    q = db.query(StandardizedTest)

    # Filter by category if specified
    if category:
        q = q.filter(StandardizedTest.category == category)

    # Search conditions (ordered by relevance)
    conditions = []

    # 1. Exact match on test name or short name (highest priority)
    conditions.append(func.lower(StandardizedTest.test_name) == search_term)
    conditions.append(func.lower(StandardizedTest.short_name) == search_term)

    # 2. Search in common_names array (case-insensitive)
    # Use text() with bound parameters for PostgreSQL-specific array operations
    # This is safe from SQL injection because bindparams() properly escapes values
    # SQLAlchemy doesn't have native support for unnest() with case-insensitive array matching
    conditions.append(
        text(":search_val = ANY(SELECT LOWER(unnest(common_names)))").bindparams(search_val=search_term)
    )

    # 3. Starts with query
    conditions.append(func.lower(StandardizedTest.test_name).startswith(search_term))
    conditions.append(func.lower(StandardizedTest.short_name).startswith(search_term))

    # 4. Contains query
    conditions.append(func.lower(StandardizedTest.test_name).contains(search_term))
    conditions.append(func.lower(StandardizedTest.short_name).contains(search_term))

    # 5. Full-text search on test_name
    # Using PostgreSQL ts_vector for better performance
    ts_query = func.plainto_tsquery('english', query)
    conditions.append(
        func.to_tsvector('english', StandardizedTest.test_name).op('@@')(ts_query)
    )

    # Combine conditions with OR
    q = q.filter(or_(*conditions))

    # Order by relevance: exact matches first, then partial matches
    # Using CASE to create a relevance score
    relevance_score = case(
        # Highest priority: exact match on test_name or short_name
        (func.lower(StandardizedTest.test_name) == search_term, 1),
        (func.lower(StandardizedTest.short_name) == search_term, 1),
        # High priority: exact match in common_names array
        (text(":search_val = ANY(SELECT LOWER(unnest(common_names)))").bindparams(search_val=search_term), 2),
        # Medium priority: starts with query
        (func.lower(StandardizedTest.test_name).startswith(search_term), 3),
        (func.lower(StandardizedTest.short_name).startswith(search_term), 3),
        # Low priority: contains query or full-text match
        else_=4
    )

    q = q.order_by(
        relevance_score.asc(),  # Lower score = higher relevance
        StandardizedTest.is_common.desc(),
        StandardizedTest.test_name
    )

    return q.limit(limit).all()


def get_autocomplete_options(
    db: Session,
    query: str,
    category: Optional[str] = None,
    limit: int = 50
) -> List[dict]:
    """
    Get autocomplete suggestions for test names.

    Returns formatted options suitable for frontend autocomplete.
    """
    tests = search_tests(db, query, category, limit)

    return [
        {
            'value': f"{test.test_name} ({test.short_name})" if test.short_name else test.test_name,
            'label': test.test_name,
            'loinc_code': test.loinc_code,
            'default_unit': test.default_unit,
            'category': test.category
        }
        for test in tests
    ]


def get_common_tests(db: Session, category: Optional[str] = None, limit: int = 100) -> List[StandardizedTest]:
    """Get common/frequently used tests."""
    q = db.query(StandardizedTest).filter(StandardizedTest.is_common == True)

    if category:
        q = q.filter(StandardizedTest.category == category)

    return q.order_by(StandardizedTest.display_order).limit(limit).all()


def get_tests_by_category(db: Session, category: str) -> List[StandardizedTest]:
    """Get all tests in a specific category."""
    return db.query(StandardizedTest).filter(
        StandardizedTest.category == category
    ).order_by(StandardizedTest.display_order).all()


def create_test(db: Session, test_data: dict) -> StandardizedTest:
    """Create a new standardized test."""
    test = StandardizedTest(**test_data)
    db.add(test)
    db.commit()
    db.refresh(test)
    logger.info(f"Created standardized test: {test.test_name}", extra={
        "loinc_code": test.loinc_code,
        "category": test.category
    })
    return test


def bulk_create_tests(db: Session, tests_data: List[dict]) -> int:
    """
    Bulk create standardized tests.

    Returns the number of tests created.
    """
    tests = [StandardizedTest(**data) for data in tests_data]
    db.bulk_save_objects(tests)
    db.commit()

    logger.info(f"Bulk created {len(tests)} standardized tests")
    return len(tests)


def update_test(db: Session, test_id: int, updates: dict) -> Optional[StandardizedTest]:
    """Update a standardized test."""
    test = get_test_by_id(db, test_id)
    if not test:
        return None

    for key, value in updates.items():
        setattr(test, key, value)

    db.commit()
    db.refresh(test)
    logger.info(f"Updated standardized test: {test.test_name}", extra={
        "test_id": test_id
    })
    return test


def delete_test(db: Session, test_id: int) -> bool:
    """Delete a standardized test."""
    test = get_test_by_id(db, test_id)
    if not test:
        return False

    db.delete(test)
    db.commit()
    logger.info(f"Deleted standardized test: {test.test_name}", extra={
        "test_id": test_id
    })
    return True


def count_tests(db: Session, category: Optional[str] = None) -> int:
    """Count total number of standardized tests."""
    q = db.query(StandardizedTest)
    if category:
        q = q.filter(StandardizedTest.category == category)
    return q.count()


def clear_all_tests(db: Session) -> int:
    """
    Delete all standardized tests.
    Use with caution - typically for re-importing LOINC data.
    """
    count = db.query(StandardizedTest).count()
    db.query(StandardizedTest).delete()
    db.commit()
    logger.warning(f"Cleared all {count} standardized tests from database")
    return count
