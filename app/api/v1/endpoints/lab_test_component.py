from typing import Any, Dict, List, Optional
from datetime import datetime
from datetime import date as date_type

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Request,
    status,
)
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.api import deps
from app.core.error_handling import (
    NotFoundException,
    ForbiddenException,
    BusinessLogicException,
    DatabaseException,
    handle_database_errors
)
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    validate_search_input,
)
from app.core.database import get_db
from app.crud.lab_result import lab_result
from app.crud.lab_test_component import lab_test_component
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.lab_test_component import (
    LabTestComponentBulkCreate,
    LabTestComponentBulkResponse,
    LabTestComponentCreate,
    LabTestComponentResponse,
    LabTestComponentUpdate,
    LabTestComponentWithLabResult,
    LabTestComponentTrendResponse,
    LabTestComponentTrendDataPoint,
    LabTestComponentTrendStatistics,
    LabResultBasicForTrend,
)
from app.core.logging_config import get_logger
from app.core.logging_helpers import log_data_access, log_endpoint_error, log_validation_error

router = APIRouter()
logger = get_logger(__name__, "app")


# Lab Test Component Endpoints
@router.get("/lab-result/{lab_result_id}/components", response_model=List[LabTestComponentResponse])
def get_lab_test_components_by_lab_result(
    *,
    request: Request,
    lab_result_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all test components for a specific lab result."""

    with handle_database_errors(request=request):
        # First verify the lab result exists and user has access
        db_lab_result = lab_result.get(db, lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        # Verify patient access through the lab result
        deps.verify_patient_access(db_lab_result.patient_id, db, current_user)

        # Get components with optional filtering
        if category or status:
            components = lab_test_component.search_components(
                db,
                query_text="",
                lab_result_id=lab_result_id,
                category=category,
                status=status,
                skip=skip,
                limit=limit
            )
        else:
            components = lab_test_component.get_by_lab_result(
                db,
                lab_result_id=lab_result_id,
                skip=skip,
                limit=limit
            )

    return components


@router.get("/components/{component_id}", response_model=LabTestComponentWithLabResult)
def get_lab_test_component(
    *,
    request: Request,
    component_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get a specific test component by ID with related lab result data."""

    with handle_database_errors(request=request):
        db_component = lab_test_component.get_with_relations(
            db=db, record_id=component_id, relations=["lab_result"]
        )
        handle_not_found(db_component, "Lab test component", request)

    assert db_component is not None

    # Verify patient access through the lab result
    deps.verify_patient_access(db_component.lab_result.patient_id, db, current_user)

    # Convert to response format with lab result data
    result_dict = {
        "id": db_component.id,
        "lab_result_id": db_component.lab_result_id,
        "test_name": db_component.test_name,
        "abbreviation": db_component.abbreviation,
        "test_code": db_component.test_code,
        "value": db_component.value,
        "unit": db_component.unit,
        "ref_range_min": db_component.ref_range_min,
        "ref_range_max": db_component.ref_range_max,
        "ref_range_text": db_component.ref_range_text,
        "status": db_component.status,
        "category": db_component.category,
        "display_order": db_component.display_order,
        "notes": db_component.notes,
        "created_at": db_component.created_at,
        "updated_at": db_component.updated_at,
        "lab_result": {
            "id": db_component.lab_result.id,
            "test_name": db_component.lab_result.test_name,
            "ordered_date": db_component.lab_result.ordered_date,
            "completed_date": db_component.lab_result.completed_date,
            "status": db_component.lab_result.status,
        } if db_component.lab_result else None,
    }

    return result_dict


@router.post("/lab-result/{lab_result_id}/components", response_model=LabTestComponentResponse, status_code=status.HTTP_201_CREATED)
def create_lab_test_component(
    *,
    request: Request,
    lab_result_id: int,
    lab_test_component_in: LabTestComponentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new test component for a lab result."""

    with handle_database_errors(request=request):
        # Verify the lab result exists and user has access
        db_lab_result = lab_result.get(db, lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        # Verify patient access
        deps.verify_patient_access(db_lab_result.patient_id, db, current_user)

        # Set the lab_result_id from the URL parameter
        lab_test_component_in.lab_result_id = lab_result_id

        # Create the component
        db_component = handle_create_with_logging(
            db=db,
            crud_obj=lab_test_component,
            obj_in=lab_test_component_in,
            entity_type=EntityType.LAB_TEST_COMPONENT,
            user_id=current_user.id,
            entity_name=lab_test_component_in.test_name,
            request=request,
        )

    return db_component


@router.post("/lab-result/{lab_result_id}/components/bulk", response_model=LabTestComponentBulkResponse, status_code=status.HTTP_201_CREATED)
def create_lab_test_components_bulk(
    *,
    request: Request,
    lab_result_id: int,
    bulk_data: LabTestComponentBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create multiple test components for a lab result in bulk."""

    with handle_database_errors(request=request):
        # Verify the lab result exists and user has access
        db_lab_result = lab_result.get(db, lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        # Verify patient access
        deps.verify_patient_access(db_lab_result.patient_id, db, current_user)

        # Set the lab_result_id from the URL parameter
        bulk_data.lab_result_id = lab_result_id

        try:
            # Create components in bulk
            created_components = lab_test_component.bulk_create(db, obj_in=bulk_data)

            # Log the bulk creation
            log_data_access(
                logger, request, current_user.id, "create", "LabTestComponent",
                count=len(created_components),
                lab_result_id=lab_result_id
            )

            return LabTestComponentBulkResponse(
                created_count=len(created_components),
                components=created_components,
                errors=[]
            )

        except ValueError as e:
            # Handle validation errors
            log_validation_error(
                logger, request, str(e),
                user_id=current_user.id,
                lab_result_id=lab_result_id
            )
            raise BusinessLogicException(f"Validation error: {str(e)}")

        except IntegrityError as e:
            # Handle database constraint violations
            log_endpoint_error(
                logger, request, "Database constraint violation in bulk create",
                e, user_id=current_user.id,
                lab_result_id=lab_result_id
            )
            db.rollback()
            raise BusinessLogicException("Data integrity error. Please check your input data.")

        except DatabaseException:
            # Re-raise database exceptions as-is (already handled by handle_database_errors)
            raise

        except Exception as e:
            # Handle unexpected errors
            log_endpoint_error(
                logger, request, "Unexpected error in bulk create",
                e, user_id=current_user.id,
                lab_result_id=lab_result_id,
                error_type=type(e).__name__
            )
            db.rollback()
            raise BusinessLogicException("An unexpected error occurred. Please try again later.")


@router.put("/components/{component_id}", response_model=LabTestComponentResponse)
def update_lab_test_component(
    *,
    request: Request,
    component_id: int,
    lab_test_component_in: LabTestComponentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update an existing test component."""

    with handle_database_errors(request=request):
        # Get the existing component
        db_component = lab_test_component.get(db, component_id)
        handle_not_found(db_component, "Lab test component", request)

        # Verify patient access through the lab result
        db_lab_result = lab_result.get(db, db_component.lab_result_id)
        deps.verify_patient_access(db_lab_result.patient_id, db, current_user)

        # Update the component
        db_component = handle_update_with_logging(
            db=db,
            crud_obj=lab_test_component,
            entity_id=component_id,
            obj_in=lab_test_component_in,
            entity_type=EntityType.LAB_TEST_COMPONENT,
            user_id=current_user.id,
            entity_name=db_component.test_name,
            request=request,
        )

    return db_component


@router.delete("/components/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lab_test_component(
    *,
    request: Request,
    component_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete a test component."""

    with handle_database_errors(request=request):
        # Get the existing component
        db_component = lab_test_component.get(db, component_id)
        handle_not_found(db_component, "Lab test component", request)

        # Verify patient access through the lab result
        db_lab_result = lab_result.get(db, db_component.lab_result_id)
        deps.verify_patient_access(db_lab_result.patient_id, db, current_user)

        # Delete the component
        handle_delete_with_logging(
            db=db,
            crud_obj=lab_test_component,
            entity_id=component_id,
            entity_type=EntityType.LAB_TEST_COMPONENT,
            user_id=current_user.id,
            entity_name=db_component.test_name,
            request=request,
        )


# Search and Filter Endpoints
@router.get("/components/search", response_model=List[LabTestComponentResponse])
def search_lab_test_components(
    *,
    request: Request,
    q: str = Query(..., description="Search query for test name, abbreviation, or test code"),
    lab_result_id: Optional[int] = Query(None, description="Filter by lab result ID"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Search test components by name, abbreviation, or test code."""

    # Validate and sanitize search input
    validated_query = validate_search_input(q)

    with handle_database_errors(request=request):
        # If lab_result_id is specified, verify access to that specific lab result
        if lab_result_id:
            db_lab_result = lab_result.get(db, lab_result_id)
            handle_not_found(db_lab_result, "Lab result", request)
            deps.verify_patient_access(db_lab_result.patient_id, db, current_user)

        # Search components with patient filter to avoid N+1 queries
        components = lab_test_component.search_components(
            db,
            query_text=validated_query,
            lab_result_id=lab_result_id,
            patient_id=target_patient_id if not lab_result_id else None,  # Only filter by patient if not already filtered by specific lab result
            category=category,
            status=status,
            skip=skip,
            limit=limit
        )

    return components


@router.get("/components/abnormal", response_model=List[LabTestComponentResponse])
def get_abnormal_lab_test_components(
    *,
    request: Request,
    lab_result_id: Optional[int] = Query(None, description="Filter by lab result ID"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Get all abnormal test results (high, low, critical, abnormal)."""

    with handle_database_errors(request=request):
        # If lab_result_id is specified, verify access
        if lab_result_id:
            db_lab_result = lab_result.get(db, lab_result_id)
            handle_not_found(db_lab_result, "Lab result", request)
            deps.verify_patient_access(db_lab_result.patient_id, db, current_user)

        # Get abnormal results with patient filter to avoid N+1 queries
        components = lab_test_component.get_abnormal_results(
            db,
            lab_result_id=lab_result_id,
            patient_id=target_patient_id if not lab_result_id else None,  # Only filter by patient if not already filtered by specific lab result
            skip=skip,
            limit=limit
        )

    return components


@router.get("/lab-result/{lab_result_id}/statistics", response_model=Dict[str, Any])
def get_lab_test_component_statistics(
    *,
    request: Request,
    lab_result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get statistics for test components in a lab result."""

    with handle_database_errors(request=request):
        # Verify the lab result exists and user has access
        db_lab_result = lab_result.get(db, lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        # Verify patient access
        deps.verify_patient_access(db_lab_result.patient_id, db, current_user)

        # Get statistics
        stats = lab_test_component.get_statistics_by_lab_result(db, lab_result_id=lab_result_id)

    return stats


# Utility Endpoints
@router.get("/suggestions/test-names", response_model=List[str])
def get_test_name_suggestions(
    *,
    request: Request,
    limit: int = Query(50, ge=1, le=100, description="Number of suggestions to return"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get unique test names for autocomplete suggestions."""

    with handle_database_errors(request=request):
        test_names = lab_test_component.get_unique_test_names(db, limit=limit)

    return test_names


@router.get("/suggestions/abbreviations", response_model=List[str])
def get_abbreviation_suggestions(
    *,
    request: Request,
    limit: int = Query(50, ge=1, le=100, description="Number of suggestions to return"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get unique abbreviations for autocomplete suggestions."""

    with handle_database_errors(request=request):
        abbreviations = lab_test_component.get_unique_abbreviations(db, limit=limit)

    return abbreviations


# Helper function for trend statistics
def calculate_trend_statistics(components: List[Any]) -> LabTestComponentTrendStatistics:
    """Calculate statistics for trend data."""
    if not components:
        return LabTestComponentTrendStatistics(
            count=0,
            normal_count=0,
            abnormal_count=0,
            trend_direction="stable"
        )

    values = [c.value for c in components]

    # Basic stats
    count = len(values)
    latest = values[0] if values else None
    average = sum(values) / count if count > 0 else None
    minimum = min(values) if values else None
    maximum = max(values) if values else None

    # Trend direction (compare first half vs second half)
    trend = "stable"
    if count >= 4:
        mid = count // 2
        first_half_avg = sum(values[:mid]) / mid
        second_half_avg = sum(values[mid:]) / (count - mid)

        # Only calculate percentage if first_half_avg is meaningful
        # Use absolute threshold to avoid division by zero and unstable percentages
        if abs(first_half_avg) > 0.01:
            change_percent = ((second_half_avg - first_half_avg) / abs(first_half_avg)) * 100

            if change_percent > 5:
                trend = "increasing"
            elif change_percent < -5:
                trend = "decreasing"
        elif abs(second_half_avg - first_half_avg) > 0.01:
            # For near-zero values, use absolute difference instead of percentage
            if second_half_avg > first_half_avg:
                trend = "increasing"
            elif second_half_avg < first_half_avg:
                trend = "decreasing"

    # Time in range (count normal vs abnormal)
    normal_count = sum(1 for c in components if c.status == "normal")
    time_in_range_percent = (normal_count / count * 100) if count > 0 else None

    # Standard deviation
    # Note: Using population variance (divide by N) rather than sample variance (divide by N-1)
    # This is appropriate for analyzing the complete set of measurements we have for a patient,
    # rather than estimating variance for a theoretical larger population
    if count > 1 and average is not None:
        variance = sum((x - average) ** 2 for x in values) / count
        std_dev = variance ** 0.5
    else:
        std_dev = None

    return LabTestComponentTrendStatistics(
        count=count,
        latest=round(latest, 2) if latest is not None else None,
        average=round(average, 2) if average is not None else None,
        min=round(minimum, 2) if minimum is not None else None,
        max=round(maximum, 2) if maximum is not None else None,
        std_dev=round(std_dev, 2) if std_dev is not None else None,
        trend_direction=trend,
        time_in_range_percent=round(time_in_range_percent, 1) if time_in_range_percent is not None else None,
        normal_count=normal_count,
        abnormal_count=count - normal_count
    )


# Trend Tracking Endpoint
@router.get("/patient/{patient_id}/trends", response_model=LabTestComponentTrendResponse)
def get_lab_test_component_trends(
    *,
    request: Request,
    patient_id: int,
    test_name: str = Query(..., description="Test component name"),
    date_from: Optional[date_type] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[date_type] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=100, description="Max results (max 100)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get trend data for a specific test component across all lab results for a patient.
    Returns historical values with statistics.

    Decision: Uses exact test name matching (no fuzzy matching).
    Decision: Uses lab_result.completed_date if available, otherwise created_at.
    Decision: Shows warnings in response for unit mismatches or missing dates (handled client-side).
    """

    with handle_database_errors(request=request):
        # Verify patient access
        deps.verify_patient_access(patient_id, db, current_user)

        # Validate and sanitize test_name
        validated_test_name = validate_search_input(test_name)

        # Get test components with database-level filtering for better performance
        # Date filtering and ordering are pushed into the database query
        components = lab_test_component.get_by_patient_and_test_name(
            db,
            patient_id=patient_id,
            test_name=validated_test_name,
            date_from=date_from,
            date_to=date_to,
            limit=limit
        )

        # Detect unit mismatches
        if components:
            primary_unit = components[0].unit
            units_found = set(c.unit for c in components if c.unit)
            if len(units_found) > 1:
                log_validation_error(
                    logger, request, f"Unit mismatch detected in trend data for {test_name}",
                    user_id=current_user.id,
                    patient_id=patient_id,
                    test_name=test_name,
                    primary_unit=primary_unit,
                    all_units=list(units_found)
                )

        # Log the request
        log_data_access(
            logger, request, current_user.id, "read", "LabTestComponentTrends",
            patient_id=patient_id,
            count=len(components),
            test_name=test_name,
            date_from=str(date_from) if date_from else None,
            date_to=str(date_to) if date_to else None
        )

        # Return empty response if no components found
        if not components:
            return LabTestComponentTrendResponse(
                test_name=test_name,
                unit="",
                category=None,
                data_points=[],
                statistics=LabTestComponentTrendStatistics(
                    count=0,
                    normal_count=0,
                    abnormal_count=0,
                    trend_direction="stable"
                ),
                is_aggregated=False,
                aggregation_period=None
            )

        # Calculate statistics
        statistics = calculate_trend_statistics(components)

        # Build data points with proper date handling
        data_points = []
        for component in components:
            # Use completed_date if available
            recorded_date = component.lab_result.completed_date if component.lab_result.completed_date else None

            data_point = LabTestComponentTrendDataPoint(
                id=component.id,
                value=component.value,
                unit=component.unit,
                status=component.status,
                ref_range_min=component.ref_range_min,
                ref_range_max=component.ref_range_max,
                ref_range_text=component.ref_range_text,
                recorded_date=recorded_date,
                created_at=component.created_at,
                lab_result=LabResultBasicForTrend(
                    id=component.lab_result.id,
                    test_name=component.lab_result.test_name,
                    completed_date=component.lab_result.completed_date
                )
            )
            data_points.append(data_point)

        # Get unit and category from most recent component
        unit = components[0].unit
        category = components[0].category

        # Build response
        response = LabTestComponentTrendResponse(
            test_name=test_name,
            unit=unit,
            category=category,
            data_points=data_points,
            statistics=statistics,
            is_aggregated=False,
            aggregation_period=None
        )

        return response