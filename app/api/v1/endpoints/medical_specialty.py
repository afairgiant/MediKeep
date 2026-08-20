"""
Non-admin MedicalSpecialty endpoints.

These routes expose the lookup table to any authenticated user so the
practitioner form can populate its dropdown and quick-create new entries
without requiring admin privileges. The full CRUD surface (update, delete,
deactivate) stays behind the admin registry at ``/api/v1/admin/models/medical_specialty``.

Create is rate-limited per user to prevent form-abuse spam since this is the
only write path non-admins have.
"""

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import safe_log_activity
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.utils.rate_limit import SlidingWindowRateLimiter
from app.crud.medical_specialty import medical_specialty
from app.models.activity_log import ActionType, EntityType
from app.schemas.medical_specialty import (
    MedicalSpecialty,
    MedicalSpecialtyCreate,
    MedicalSpecialtySummary,
)

router = APIRouter()

logger = get_logger(__name__, "app")


# 20 specialty creates per user per hour — tight enough to prevent abuse,
# generous enough for a real user onboarding multiple practitioners in one session.
# Keyed on user_id rather than IP so users behind a shared NAT aren't limited
# collectively.
_create_limiter = SlidingWindowRateLimiter(max_requests=20, window_seconds=3600)


@router.get("/", response_model=List[MedicalSpecialtySummary])
def list_active_specialties(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Return active specialties for dropdown population."""
    with handle_database_errors(request=request):
        return medical_specialty.get_active(db)


@router.post(
    "/",
    response_model=MedicalSpecialty,
    status_code=status.HTTP_201_CREATED,
)
def create_or_get_specialty(
    *,
    specialty_in: MedicalSpecialtyCreate,
    request: Request,
    response: Response,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create a new specialty or return an existing one by case-insensitive name.

    Delegates to ``medical_specialty.get_or_create`` so concurrent creates
    resolve via its IntegrityError fallback instead of racing here.
    Responds 200 when an existing specialty is matched and 201 when a new
    row is inserted so the frontend can treat both uniformly (select the
    returned row by id).
    """
    if not _create_limiter.is_allowed(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many specialty create requests. Try again later.",
            headers=_create_limiter.rate_limit_headers(current_user_id),
        )

    with handle_database_errors(request=request):
        specialty, created = medical_specialty.get_or_create(db, obj_in=specialty_in)

        if not created:
            response.status_code = status.HTTP_200_OK
            return specialty

        safe_log_activity(
            db=db,
            action=ActionType.CREATED,
            entity_type=EntityType.MEDICAL_SPECIALTY,
            entity_obj=specialty,
            user_id=current_user_id,
            request=request,
        )

        return specialty
