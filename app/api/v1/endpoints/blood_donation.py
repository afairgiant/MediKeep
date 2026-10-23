"""API endpoints for Blood Donations."""

from dataclasses import asdict
from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access
from app.core.utils.datetime_utils import get_facility_timezone
from app.crud.blood_donation import blood_donation
from app.crud.user_preferences import user_preferences
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.blood_donation import (
    BloodDonationCreate,
    BloodDonationEligibilityResponse,
    BloodDonationResponse,
    BloodDonationUpdate,
)
from app.services.blood_donation_eligibility import (
    calculate_eligibility,
    resolve_intervals,
)

router = APIRouter()

logger = get_logger(__name__, "app")


@router.post("/", response_model=BloodDonationResponse)
def create_blood_donation(
    *,
    donation_in: BloodDonationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Create a new blood donation record."""
    return handle_create_with_logging(
        db=db,
        crud_obj=blood_donation,
        obj_in=donation_in,
        entity_type=EntityType.BLOOD_DONATION,
        user_id=current_user_id,
        entity_name="BloodDonation",
        request=request,
        current_user_patient_id=current_user_patient_id,
        current_user=current_user,
    )


@router.get("/", response_model=List[BloodDonationResponse])
def read_blood_donations(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=10000, le=10000),
    donation_type: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(
        False, description="Match all tags (AND) vs any tag (OR)"
    ),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve blood donations for the current or an accessible patient."""
    with handle_database_errors(request=request):
        donations = blood_donation.get_by_patient(
            db,
            patient_id=target_patient_id,
            skip=skip,
            limit=limit,
            donation_type=donation_type,
            tags=tags,
            tag_match_all=tag_match_all,
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "BloodDonation",
            patient_id=target_patient_id,
            count=len(donations),
        )

        return donations


@router.get("/eligibility", response_model=BloodDonationEligibilityResponse)
def read_blood_donation_eligibility(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Next eligible donation date, based on the latest donation and the user's intervals.

    Intervals come from the requesting user's preferences, also when viewing
    a shared patient.
    """
    with handle_database_errors(request=request):
        latest = blood_donation.get_latest(db, patient_id=target_patient_id)
        preferences = user_preferences.get_by_user_id(db, user_id=current_user.id)
        intervals = resolve_intervals(
            preferences.blood_donation_intervals if preferences else None
        )

        result = calculate_eligibility(
            last_donation_date=latest.donation_date if latest else None,
            last_donation_type=latest.donation_type if latest else None,
            intervals=intervals,
            today=datetime.now(get_facility_timezone()).date(),
        )

        log_data_access(
            logger,
            request,
            current_user.id,
            "read",
            "BloodDonationEligibility",
            patient_id=target_patient_id,
        )

        return asdict(result)


@router.get("/{donation_id}", response_model=BloodDonationResponse)
def read_blood_donation(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    donation_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get a blood donation by ID."""
    with handle_database_errors(request=request):
        donation_obj = blood_donation.get(db, id=donation_id)
        handle_not_found(donation_obj, "BloodDonation", request)
        verify_patient_ownership(
            donation_obj,
            current_user_patient_id,
            "blood donation",
            db=db,
            current_user=current_user,
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "BloodDonation",
            record_id=donation_id,
            patient_id=donation_obj.patient_id,
        )

        return donation_obj


@router.put("/{donation_id}", response_model=BloodDonationResponse)
def update_blood_donation(
    *,
    donation_id: int,
    donation_in: BloodDonationUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update a blood donation."""
    return handle_update_with_logging(
        db=db,
        crud_obj=blood_donation,
        entity_id=donation_id,
        obj_in=donation_in,
        entity_type=EntityType.BLOOD_DONATION,
        user_id=current_user_id,
        entity_name="BloodDonation",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.delete("/{donation_id}")
def delete_blood_donation(
    *,
    donation_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete a blood donation."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=blood_donation,
        entity_id=donation_id,
        entity_type=EntityType.BLOOD_DONATION,
        user_id=current_user_id,
        entity_name="BloodDonation",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )
