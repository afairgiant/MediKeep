"""
Admin Activity Log API - Full audit trail with search, filtering, and CSV export

Provides endpoints for viewing, searching, filtering, and exporting
the system activity log for compliance and auditing purposes.
"""

import csv
import io
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api import deps
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_access, log_endpoint_error
from app.models.activity_log import ActionType, ActivityLog, EntityType
from app.models.models import User

logger = get_logger(__name__, "app")

router = APIRouter()

# Entity type display name mapping
ENTITY_TYPE_DISPLAY = {
    "medication": "Medication",
    "patient": "Patient",
    "user": "User",
    "lab_result": "Lab Result",
    "lab_result_file": "Lab Result File",
    "lab_test_component": "Lab Test Component",
    "entity_file": "Entity File",
    "procedure": "Procedure",
    "allergy": "Allergy",
    "condition": "Condition",
    "immunization": "Immunization",
    "vitals": "Vitals",
    "pharmacy": "Pharmacy",
    "practitioner": "Practitioner",
    "treatment": "Treatment",
    "encounter": "Visit",
    "emergency_contact": "Emergency Contact",
    "family_member": "Family Member",
    "family_condition": "Family Condition",
    "insurance": "Insurance",
    "symptom": "Symptom",
    "injury": "Injury",
    "injury_type": "Injury Type",
    "medical_equipment": "Medical Equipment",
    "practice": "Practice",
    "system": "System",
    "backup": "Backup",
}


# --- Pydantic Schemas ---


class ActivityLogEntry(BaseModel):
    """Single activity log entry for API response."""

    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    entity_type: str
    entity_type_display: str
    entity_id: Optional[int] = None
    patient_id: Optional[int] = None
    description: str
    timestamp: Optional[str] = None
    ip_address: Optional[str] = None

    model_config = {"from_attributes": True}


class ActivityLogListResponse(BaseModel):
    """Paginated activity log list response."""

    items: List[ActivityLogEntry]
    total: int
    page: int
    per_page: int
    total_pages: int


class FilterOption(BaseModel):
    """Single filter option with value and label."""

    value: str
    label: str


class UserFilterOption(BaseModel):
    """User filter option."""

    value: int
    label: str


class ActivityLogFilters(BaseModel):
    """Available filter options for the activity log."""

    actions: List[FilterOption]
    entity_types: List[FilterOption]
    users: List[UserFilterOption]


# --- Helper Functions ---


def _build_activity_query(
    db: Session,
    search: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    """Build a filtered query for activity logs."""
    query = db.query(ActivityLog).options(joinedload(ActivityLog.user))

    if search:
        query = query.filter(ActivityLog.description.ilike(f"%{search}%"))
    if action:
        query = query.filter(ActivityLog.action == action)
    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if start_date:
        query = query.filter(ActivityLog.timestamp >= start_date)
    if end_date:
        query = query.filter(ActivityLog.timestamp <= end_date)

    return query


def _log_to_entry(log: ActivityLog) -> ActivityLogEntry:
    """Convert an ActivityLog model instance to an API response entry."""
    entity_type = log.entity_type or ""
    username = log.user.username if log.user else None

    return ActivityLogEntry(
        id=log.id,
        user_id=log.user_id,
        username=username or "System",
        action=log.action,
        entity_type=entity_type,
        entity_type_display=ENTITY_TYPE_DISPLAY.get(entity_type, entity_type.replace("_", " ").title()),
        entity_id=log.entity_id,
        patient_id=log.patient_id,
        description=log.description,
        timestamp=log.timestamp.isoformat() if log.timestamp else None,
        ip_address=log.ip_address,
    )


# --- Endpoints ---


@router.get("", response_model=ActivityLogListResponse)
def get_activity_log(
    request: Request,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get paginated, filtered activity log entries."""
    log_endpoint_access(logger, request, current_user.id, "activity_log_list_accessed")

    try:
        query = _build_activity_query(
            db,
            search=search,
            action=action,
            entity_type=entity_type,
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )

        total = query.count()
        total_pages = max(1, (total + per_page - 1) // per_page)

        logs = (
            query.order_by(ActivityLog.timestamp.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        items = [_log_to_entry(log) for log in logs]

        return ActivityLogListResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
        )

    except Exception as e:
        log_endpoint_error(logger, request, "Error fetching activity log", e)
        raise


@router.get("/export")
def export_activity_log(
    request: Request,
    search: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Export filtered activity log entries as CSV."""
    log_endpoint_access(logger, request, current_user.id, "activity_log_export")

    try:
        query = _build_activity_query(
            db,
            search=search,
            action=action,
            entity_type=entity_type,
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )

        logs = query.order_by(ActivityLog.timestamp.desc()).all()

        def iter_csv():
            output = io.StringIO()
            writer = csv.writer(output)

            writer.writerow(
                ["Timestamp", "User", "Action", "Entity Type", "Entity ID", "Description", "IP Address"]
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            for log in logs:
                username = log.user.username if log.user else "System"
                writer.writerow(
                    [
                        log.timestamp.isoformat() if log.timestamp else "",
                        username,
                        log.action,
                        ENTITY_TYPE_DISPLAY.get(
                            log.entity_type or "", (log.entity_type or "").replace("_", " ").title()
                        ),
                        log.entity_id or "",
                        log.description,
                        log.ip_address or "",
                    ]
                )
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        return StreamingResponse(
            iter_csv(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_log_export.csv"},
        )

    except Exception as e:
        log_endpoint_error(logger, request, "Error exporting activity log", e)
        raise


@router.get("/filters", response_model=ActivityLogFilters)
def get_activity_log_filters(
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get available filter options for the activity log."""
    log_endpoint_access(logger, request, current_user.id, "activity_log_filters_accessed")

    try:
        actions = [
            FilterOption(value=a, label=a.replace("_", " ").title())
            for a in ActionType.get_all_actions()
        ]

        entity_types = [
            FilterOption(
                value=et,
                label=ENTITY_TYPE_DISPLAY.get(et, et.replace("_", " ").title()),
            )
            for et in EntityType.get_all_types()
        ]

        # Get distinct users who have activity log entries
        user_rows = (
            db.query(User.id, User.username)
            .join(ActivityLog, ActivityLog.user_id == User.id)
            .distinct()
            .order_by(User.username)
            .all()
        )

        users = [UserFilterOption(value=row.id, label=row.username) for row in user_rows]

        return ActivityLogFilters(
            actions=actions,
            entity_types=entity_types,
            users=users,
        )

    except Exception as e:
        log_endpoint_error(logger, request, "Error fetching activity log filters", e)
        raise
