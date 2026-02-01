"""
Admin Maintenance API Endpoints

Provides admin-only endpoints for system maintenance tasks.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_db
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_access, log_endpoint_error, log_security_event
from app.models.models import LabTestComponent, User
from app.services.canonical_test_matching import canonical_test_matching
from app.services.test_library_loader import get_tests, get_library_version, reload_test_library

logger = get_logger(__name__, "app")

router = APIRouter()


class TestLibraryInfoResponse(BaseModel):
    version: str
    test_count: int
    categories: dict


class TestLibrarySyncRequest(BaseModel):
    force_all: bool = False


class TestLibrarySyncResponse(BaseModel):
    success: bool
    components_processed: int
    canonical_names_updated: int
    categories_updated: int
    message: str


@router.get("/test-library/info", response_model=TestLibraryInfoResponse)
async def get_test_library_info(
    request: Request,
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get information about the current test library.

    Only admin users can access this endpoint.
    """
    try:
        tests = get_tests()
        version = get_library_version()

        categories = {}
        for test in tests:
            cat = test.get("category", "other")
            categories[cat] = categories.get(cat, 0) + 1

        log_endpoint_access(
            logger, request, current_user.id, "test_library_info_accessed"
        )

        return TestLibraryInfoResponse(
            version=version,
            test_count=len(tests),
            categories=categories,
        )

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to get test library info", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get test library information",
        )


@router.post("/test-library/reload")
async def reload_test_library_endpoint(
    request: Request,
    current_user: User = Depends(get_current_admin_user),
):
    """
    Reload the test library from disk.

    Useful after updating the test library JSON file.
    Only admin users can access this endpoint.
    """
    try:
        reload_test_library()

        log_security_event(
            logger,
            "test_library_reloaded",
            request,
            "Test library reloaded from disk",
            user_id=current_user.id,
        )

        tests = get_tests()
        version = get_library_version()

        return {
            "success": True,
            "version": version,
            "test_count": len(tests),
            "message": "Test library reloaded successfully",
        }

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to reload test library", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload test library",
        )


@router.post("/test-library/sync", response_model=TestLibrarySyncResponse)
async def sync_test_library(
    sync_request: TestLibrarySyncRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Sync lab test components with the test library.

    This will:
    1. Reload the test library from disk
    2. Re-match all lab test components to canonical names
    3. Update categories based on the test library

    Args:
        force_all: If True, re-process all components. If False, only process
                   components without a canonical_test_name.

    Only admin users can access this endpoint.
    """
    try:
        reload_test_library()

        if sync_request.force_all:
            components = db.query(LabTestComponent).all()
        else:
            components = (
                db.query(LabTestComponent)
                .filter(LabTestComponent.canonical_test_name.is_(None))
                .all()
            )

        total_processed = len(components)
        canonical_updated = 0
        category_updated = 0

        for component in components:
            canonical_name = canonical_test_matching.find_canonical_match(
                component.test_name
            )

            if canonical_name:
                if component.canonical_test_name != canonical_name:
                    component.canonical_test_name = canonical_name
                    canonical_updated += 1

                test_info = canonical_test_matching.get_test_info(canonical_name)
                if test_info and test_info.get("category"):
                    if component.category != test_info["category"]:
                        component.category = test_info["category"]
                        category_updated += 1

        db.commit()

        log_security_event(
            logger,
            "test_library_synced",
            request,
            f"Test library synced: {total_processed} processed, {canonical_updated} names updated, {category_updated} categories updated",
            user_id=current_user.id,
        )

        return TestLibrarySyncResponse(
            success=True,
            components_processed=total_processed,
            canonical_names_updated=canonical_updated,
            categories_updated=category_updated,
            message=f"Successfully synced {total_processed} components",
        )

    except Exception as e:
        db.rollback()
        log_endpoint_error(
            logger, request, "Failed to sync test library", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync test library",
        )
