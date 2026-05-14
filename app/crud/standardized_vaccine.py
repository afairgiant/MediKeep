"""
CRUD operations for standardized vaccines.

Mirrors the standardized_test pattern: read-mostly catalog of vaccines (WHO PCMT
plus curated additions). Free-text vaccine_name on Immunization records is still
accepted for entries not in this catalog.
"""

from typing import List, Optional

from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.crud._search_helpers import json_array_text_contains
from app.models.clinical import StandardizedVaccine

logger = get_logger(__name__, "app")


def get_vaccine_by_id(db: Session, vaccine_id: int) -> Optional[StandardizedVaccine]:
    """Get a standardized vaccine by ID."""
    return (
        db.query(StandardizedVaccine)
        .filter(StandardizedVaccine.id == vaccine_id)
        .first()
    )


def get_vaccine_by_who_code(
    db: Session, who_code: str
) -> Optional[StandardizedVaccine]:
    """Get a standardized vaccine by WHO PCMT code."""
    return (
        db.query(StandardizedVaccine)
        .filter(StandardizedVaccine.who_code == who_code)
        .first()
    )


def get_vaccine_by_name(
    db: Session, vaccine_name: str
) -> Optional[StandardizedVaccine]:
    """Get a standardized vaccine by exact name match (case-insensitive)."""
    return (
        db.query(StandardizedVaccine)
        .filter(func.lower(StandardizedVaccine.vaccine_name) == vaccine_name.lower())
        .first()
    )


def search_vaccines(
    db: Session, query: str, category: Optional[str] = None, limit: int = 200
) -> List[StandardizedVaccine]:
    """
    Full-text + fuzzy search across vaccine_name, short_name, who_code, and
    common_names. Ordered by relevance, with is_common boost for ties.
    """
    if not query or not query.strip():
        q = db.query(StandardizedVaccine).filter(
            StandardizedVaccine.is_common.is_(True)
        )
        if category:
            q = q.filter(StandardizedVaccine.category == category)
        return q.order_by(StandardizedVaccine.display_order).limit(limit).all()

    search_term = query.strip().lower()
    q = db.query(StandardizedVaccine)

    if category:
        q = q.filter(StandardizedVaccine.category == category)

    # Relevance buckets, highest priority first; OR'd together for the WHERE,
    # then re-scored via a CASE expression for ORDER BY below.
    conditions = [
        func.lower(StandardizedVaccine.vaccine_name) == search_term,
        func.lower(StandardizedVaccine.short_name) == search_term,
        func.lower(StandardizedVaccine.who_code) == search_term,
        json_array_text_contains(
            StandardizedVaccine.common_names, search_term
        ),
        func.lower(StandardizedVaccine.vaccine_name).startswith(
            search_term, autoescape=True
        ),
        func.lower(StandardizedVaccine.short_name).startswith(
            search_term, autoescape=True
        ),
        func.lower(StandardizedVaccine.vaccine_name).contains(
            search_term, autoescape=True
        ),
        func.lower(StandardizedVaccine.short_name).contains(
            search_term, autoescape=True
        ),
    ]

    if " " in search_term:
        words = search_term.split()
        word_conditions = []
        for word in words:
            word_conditions.append(
                or_(
                    func.lower(StandardizedVaccine.vaccine_name).contains(
                        word, autoescape=True
                    ),
                    func.lower(StandardizedVaccine.short_name).contains(
                        word, autoescape=True
                    ),
                )
            )
        if word_conditions:
            conditions.append(and_(*word_conditions))

    q = q.filter(or_(*conditions))

    relevance_score = case(
        (func.lower(StandardizedVaccine.vaccine_name) == search_term, 1),
        (func.lower(StandardizedVaccine.short_name) == search_term, 1),
        (func.lower(StandardizedVaccine.who_code) == search_term, 1),
        (
            json_array_text_contains(
                StandardizedVaccine.common_names, search_term
            ),
            2,
        ),
        (
            func.lower(StandardizedVaccine.vaccine_name).startswith(
                search_term, autoescape=True
            ),
            3,
        ),
        (
            func.lower(StandardizedVaccine.short_name).startswith(
                search_term, autoescape=True
            ),
            3,
        ),
        else_=4,
    )

    q = q.order_by(
        relevance_score.asc(),
        StandardizedVaccine.is_common.desc(),
        StandardizedVaccine.vaccine_name,
    )

    return q.limit(limit).all()


def get_autocomplete_options(
    db: Session, query: str, category: Optional[str] = None, limit: int = 50
) -> List[dict]:
    """Autocomplete suggestions formatted for the frontend dropdown."""
    vaccines = search_vaccines(db, query, category, limit)

    return [
        {
            "value": (
                f"{v.vaccine_name} ({v.short_name})"
                if v.short_name and v.short_name != v.vaccine_name
                else v.vaccine_name
            ),
            "label": v.vaccine_name,
            "who_code": v.who_code,
            "short_name": v.short_name,
            "category": v.category,
            "is_combined": v.is_combined,
            "components": v.components,
        }
        for v in vaccines
    ]


def get_common_vaccines(
    db: Session, category: Optional[str] = None, limit: int = 100
) -> List[StandardizedVaccine]:
    """Frequently used vaccines, ordered by display_order."""
    q = db.query(StandardizedVaccine).filter(StandardizedVaccine.is_common.is_(True))
    if category:
        q = q.filter(StandardizedVaccine.category == category)
    return q.order_by(StandardizedVaccine.display_order).limit(limit).all()


def get_vaccines_by_category(
    db: Session, category: str
) -> List[StandardizedVaccine]:
    """All vaccines in a category (Viral, Bacterial, Combined, Toxoid, Parasitic)."""
    return (
        db.query(StandardizedVaccine)
        .filter(StandardizedVaccine.category == category)
        .order_by(StandardizedVaccine.display_order)
        .all()
    )


def create_vaccine(db: Session, vaccine_data: dict) -> StandardizedVaccine:
    """Create a new standardized vaccine entry."""
    vaccine = StandardizedVaccine(**vaccine_data)
    db.add(vaccine)
    db.commit()
    db.refresh(vaccine)
    logger.info(
        f"Created standardized vaccine: {vaccine.vaccine_name}",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "standardized_vaccine_created",
            LogFields.MODEL: "StandardizedVaccine",
            LogFields.RECORD_ID: vaccine.id,
            "who_code": vaccine.who_code,
            "vaccine_category": vaccine.category,
        },
    )
    return vaccine


def bulk_create_vaccines(db: Session, vaccines_data: List[dict]) -> int:
    """Bulk-create standardized vaccines. Returns count created."""
    vaccines = [StandardizedVaccine(**data) for data in vaccines_data]
    db.bulk_save_objects(vaccines)
    db.commit()
    logger.info(
        f"Bulk created {len(vaccines)} standardized vaccines",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "standardized_vaccines_bulk_created",
            LogFields.MODEL: "StandardizedVaccine",
            "count": len(vaccines),
        },
    )
    return len(vaccines)


def count_vaccines(db: Session, category: Optional[str] = None) -> int:
    """Total count, optionally filtered by category."""
    q = db.query(StandardizedVaccine)
    if category:
        q = q.filter(StandardizedVaccine.category == category)
    return q.count()


def clear_all_vaccines(db: Session) -> int:
    """Delete all standardized vaccines. Used by re-seed paths."""
    count = db.query(StandardizedVaccine).count()
    db.query(StandardizedVaccine).delete()
    db.commit()
    logger.warning(
        f"Cleared all {count} standardized vaccines from database",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "standardized_vaccines_cleared",
            LogFields.MODEL: "StandardizedVaccine",
            "count": count,
        },
    )
    return count
