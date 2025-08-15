from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.error_handling import (
    NotFoundException,
    BusinessLogicException,
    handle_database_errors
)
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.api.activity_logging import log_update
from app.crud.insurance import insurance
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.insurance import (
    Insurance,
    InsuranceCreate,
    InsuranceStatusUpdate,
    InsuranceUpdate,
)

router = APIRouter()


@router.post("/", response_model=Insurance)
def create_insurance(
    *,
    insurance_in: InsuranceCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new insurance record."""
    insurance_obj = handle_create_with_logging(
        db=db,
        crud_obj=insurance,
        obj_in=insurance_in,
        entity_type=EntityType.INSURANCE,
        user_id=current_user_id,
        entity_name="Insurance",
        request=request,
    )

    return insurance_obj


@router.get("/", response_model=List[Insurance])
def get_insurances(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    insurance_type: Optional[str] = Query(None, description="Filter by insurance type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    active_only: bool = Query(False, description="Show only active insurances"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Get insurance records for the current patient."""
    
    with handle_database_errors(request=request):
        # Apply filters based on query parameters
        if active_only:
            insurances = insurance.get_active_by_patient(
                db=db, patient_id=target_patient_id
            )
        elif insurance_type:
            insurances = insurance.get_by_type(
                db=db, patient_id=target_patient_id, insurance_type=insurance_type
            )
        elif status:
            insurances = insurance.get_by_status(
                db=db, patient_id=target_patient_id, status=status
            )
        else:
            insurances = insurance.get_by_patient(
                db=db, patient_id=target_patient_id
            )

        # Apply pagination
        return insurances[skip : skip + limit]


@router.get("/{insurance_id}", response_model=Insurance)
def get_insurance(
    *,
    request: Request,
    insurance_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get insurance record by ID."""
    with handle_database_errors(request=request):
        insurance_obj = insurance.get(db=db, id=insurance_id)
        handle_not_found(insurance_obj, "Insurance", request)

        # Verify patient ownership using current user's patient record
        verify_patient_ownership(
            insurance_obj, current_user.patient_record.id, "insurance"
        )

        return insurance_obj


@router.put("/{insurance_id}", response_model=Insurance)
def update_insurance(
    *,
    insurance_id: int,
    insurance_in: InsuranceUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update insurance record."""
    updated_insurance = handle_update_with_logging(
        db=db,
        crud_obj=insurance,
        entity_id=insurance_id,
        obj_in=insurance_in,
        entity_type=EntityType.INSURANCE,
        user_id=current_user_id,
        entity_name="Insurance",
        request=request,
    )

    return updated_insurance


@router.delete("/{insurance_id}")
def delete_insurance(
    *,
    insurance_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete insurance record."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=insurance,
        entity_id=insurance_id,
        entity_type=EntityType.INSURANCE,
        user_id=current_user_id,
        entity_name="Insurance",
        request=request,
    )


@router.patch("/{insurance_id}/status", response_model=Insurance)
def update_insurance_status(
    *,
    insurance_id: int,
    status_update: InsuranceStatusUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update insurance status only."""
    with handle_database_errors(request=request):
        insurance_obj = insurance.get(db=db, id=insurance_id)
        handle_not_found(insurance_obj, "Insurance", request)

        # Verify patient ownership using current user
        current_user = deps.get_current_user_obj(db=db, user_id=current_user_id)
        verify_patient_ownership(
            insurance_obj, current_user.patient_record.id, "insurance"
        )

        updated_insurance = handle_update_with_logging(
            db=db,
            crud_obj=insurance,
            entity_id=insurance_id,
            obj_in=status_update,
            entity_type=EntityType.INSURANCE,
            user_id=current_user_id,
            entity_name="Insurance",
            request=request,
        )

        return updated_insurance


@router.patch("/{insurance_id}/set-primary", response_model=Insurance)
def set_primary_insurance(
    *,
    insurance_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Set insurance as primary (unsets others of same type)."""
    
    with handle_database_errors(request=request):
        # Verify the insurance exists and belongs to the current patient
        insurance_obj = insurance.get(db=db, id=insurance_id)
        handle_not_found(insurance_obj, "Insurance", request)

        verify_patient_ownership(insurance_obj, target_patient_id, "insurance")

        # Set as primary
        updated_insurance = insurance.set_primary(
            db=db, patient_id=target_patient_id, insurance_id=insurance_id
        )

        if not updated_insurance:
            raise BusinessLogicException(
                message="Failed to set insurance as primary",
                request=request
            )

        # Log the activity
        log_update(
            db=db,
            entity_type=EntityType.INSURANCE,
            entity_obj=updated_insurance,
            user_id=current_user.id,
            request=request,
        )

        return updated_insurance


@router.get("/expiring", response_model=List[Insurance])
def get_expiring_insurances(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    days: int = Query(30, ge=1, le=365, description="Days ahead to check for expiration"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Get insurance records expiring within specified days."""

    with handle_database_errors(request=request):
        return insurance.get_expiring_soon(
            db=db, patient_id=target_patient_id, days=days
        )


@router.get("/search", response_model=List[Insurance])
def search_insurances(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    company: str = Query(..., min_length=1, description="Company name to search for"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Search insurance records by company name."""

    with handle_database_errors(request=request):
        return insurance.search_by_company(
            db=db, patient_id=target_patient_id, company_name=company
        )