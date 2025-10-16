"""
API endpoints for standardized test search and autocomplete
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.api import deps
from app.crud import standardized_test
from app.models.models import StandardizedTest
from app.core.logging_config import get_logger
from app.core.logging_helpers import log_endpoint_access, log_data_access
from pydantic import BaseModel

logger = get_logger(__name__, "app")

router = APIRouter()


# Pydantic schemas
class StandardizedTestResponse(BaseModel):
    id: int
    loinc_code: Optional[str]
    test_name: str
    short_name: Optional[str]
    default_unit: Optional[str]
    category: Optional[str]
    common_names: Optional[List[str]]
    is_common: bool

    class Config:
        from_attributes = True


class AutocompleteOption(BaseModel):
    value: str
    label: str
    loinc_code: Optional[str]
    default_unit: Optional[str]
    category: Optional[str]


class TestSearchResponse(BaseModel):
    tests: List[StandardizedTestResponse]
    total: int


@router.get("/search", response_model=TestSearchResponse)
def search_standardized_tests(
    request: Request,
    query: str = Query(None, description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(200, ge=1, le=1000, description="Maximum results"),
    db: Session = Depends(deps.get_db)
):
    """
    Search standardized tests with full-text search.

    Supports:
    - Exact name matching
    - Partial name matching
    - LOINC code lookup
    - Category filtering
    """
    tests = standardized_test.search_tests(db, query or "", category, limit)

    log_data_access(
        logger, request, 0, "read", "StandardizedTest",
        count=len(tests),
        query=query,
        category=category
    )

    return {
        "tests": tests,
        "total": len(tests)
    }


@router.get("/autocomplete", response_model=List[AutocompleteOption])
def get_test_autocomplete(
    request: Request,
    query: str = Query("", description="Autocomplete query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    db: Session = Depends(deps.get_db)
):
    """
    Get autocomplete suggestions for test names.

    Optimized for frontend autocomplete components.
    Returns formatted options with test name, LOINC code, and default unit.
    """
    options = standardized_test.get_autocomplete_options(db, query, category, limit)

    log_endpoint_access(
        logger, request, 0, "test_autocomplete_requested",
        query=query,
        category=category,
        results_count=len(options)
    )

    return options


@router.get("/common", response_model=List[StandardizedTestResponse])
def get_common_tests(
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    db: Session = Depends(deps.get_db)
):
    """Get frequently used/common tests."""
    tests = standardized_test.get_common_tests(db, category, limit)

    return tests


@router.get("/by-category/{category}", response_model=List[StandardizedTestResponse])
def get_tests_by_category(
    category: str,
    db: Session = Depends(deps.get_db)
):
    """Get all tests in a specific category (hematology, chemistry, etc.)."""
    tests = standardized_test.get_tests_by_category(db, category)

    if not tests:
        raise HTTPException(status_code=404, detail=f"No tests found for category: {category}")

    return tests


@router.get("/by-loinc/{loinc_code}", response_model=StandardizedTestResponse)
def get_test_by_loinc(
    loinc_code: str,
    db: Session = Depends(deps.get_db)
):
    """Get a standardized test by LOINC code."""
    test = standardized_test.get_test_by_loinc(db, loinc_code)

    if not test:
        raise HTTPException(status_code=404, detail=f"Test not found with LOINC code: {loinc_code}")

    return test


@router.get("/by-name/{test_name}", response_model=StandardizedTestResponse)
def get_test_by_name(
    test_name: str,
    db: Session = Depends(deps.get_db)
):
    """Get a standardized test by name (case-insensitive exact match)."""
    test = standardized_test.get_test_by_name(db, test_name)

    if not test:
        raise HTTPException(status_code=404, detail=f"Test not found: {test_name}")

    return test


@router.get("/count")
def count_tests(
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(deps.get_db)
):
    """Get total count of standardized tests."""
    count = standardized_test.count_tests(db, category)

    return {
        "category": category,
        "count": count
    }


class BatchMatchRequest(BaseModel):
    test_names: List[str]


class BatchMatchResult(BaseModel):
    test_name: str
    matched_test: Optional[StandardizedTestResponse]


class BatchMatchResponse(BaseModel):
    results: List[BatchMatchResult]


@router.post("/batch-match", response_model=BatchMatchResponse)
def batch_match_tests(
    req: Request,
    request: BatchMatchRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Match multiple test names at once.
    Returns the best match for each test name, or null if no match found.
    Much faster than individual API calls.

    NOTE: This endpoint is currently UNUSED by the frontend.
    The app uses testLibrary.ts static file for instant, synchronous matching.
    Keeping this endpoint for future use if we switch to database-based matching.
    """
    results = []

    for test_name in request.test_names:
        # Try exact match first
        matched = standardized_test.get_test_by_name(db, test_name)

        # If no exact match, try fuzzy search
        if not matched:
            search_results = standardized_test.search_tests(db, test_name, limit=1)
            matched = search_results[0] if search_results else None

        results.append(BatchMatchResult(
            test_name=test_name,
            matched_test=StandardizedTestResponse.from_orm(matched) if matched else None
        ))

    log_data_access(
        logger, req, 0, "read", "StandardizedTestBatch",
        count=len(request.test_names),
        matched_count=sum(1 for r in results if r.matched_test is not None)
    )

    return BatchMatchResponse(results=results)
