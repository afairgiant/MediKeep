"""
Non-admin MedicalSpecialty endpoints.

These routes expose the lookup table to any authenticated user so the
practitioner form can populate its dropdown and quick-create new entries
without requiring admin privileges. The full CRUD surface (update, delete,
deactivate) stays behind the admin registry at ``/api/v1/admin/models/medical_specialty``.

Create is rate-limited per user to prevent form-abuse spam since this is the
only write path non-admins have.
"""
import time
from collections import deque
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import safe_log_activity
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.crud.medical_specialty import medical_specialty
from app.models.activity_log import ActionType, EntityType
from app.schemas.medical_specialty import (
    MedicalSpecialty,
    MedicalSpecialtyCreate,
    MedicalSpecialtySummary,
)

router = APIRouter()

logger = get_logger(__name__, "app")


class _UserRateLimiter:
    """Tiny in-memory per-user rate limiter.

    Mirrors the pattern from ``app.api.v1.endpoints.system.SimpleRateLimiter``
    but keyed on user_id instead of IP so SSO users behind a shared NAT
    aren't limited collectively. Not durable across restarts — adequate for
    abuse prevention, not for hard quotas.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Plain dict — entries are only created when we actually record a
        # request, and pruned-to-empty entries are deleted so idle users
        # don't accumulate forever.
        self.requests: Dict[int, deque] = {}

    def allow(self, user_id: int) -> bool:
        now = time.time()
        window = self.requests.get(user_id)
        if window is not None:
            while window and window[0] <= now - self.window_seconds:
                window.popleft()
            if not window:
                del self.requests[user_id]
                window = None
        if window is None:
            window = deque()
        if len(window) < self.max_requests:
            window.append(now)
            self.requests[user_id] = window
            return True
        return False

    def retry_after(self, user_id: int) -> int:
        window = self.requests.get(user_id)
        if not window:
            return 0
        return max(1, int(window[0] + self.window_seconds - time.time()))


# 20 specialty creates per user per hour — tight enough to prevent abuse,
# generous enough for a real user onboarding multiple practitioners in one session.
_create_limiter = _UserRateLimiter(max_requests=20, window_seconds=3600)


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

    The rate limit only counts actual creates — name matches short-circuit
    before consuming a slot so users aren't punished for repeatedly
    requesting an already-known specialty. Responds 200 when an existing
    specialty is matched and 201 when a new row is inserted so the
    frontend can treat both uniformly (select the returned row by id).
    """
    with handle_database_errors(request=request):
        existing = medical_specialty.get_by_name(db, name=specialty_in.name)
        if existing:
            response.status_code = status.HTTP_200_OK
            return existing

        if not _create_limiter.allow(current_user_id):
            retry_after = _create_limiter.retry_after(current_user_id)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many specialty create requests. Try again later.",
                headers={"Retry-After": str(retry_after)},
            )

        created = medical_specialty.create(db, obj_in=specialty_in)

        safe_log_activity(
            db=db,
            action=ActionType.CREATED,
            entity_type=EntityType.MEDICAL_SPECIALTY,
            entity_obj=created,
            user_id=current_user_id,
            request=request,
        )

        return created
