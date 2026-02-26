"""
Admin User Management endpoints.

Provides admin-only endpoints for creating users with optional patient linking
and searching patients across the system.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.api.activity_logging import log_create
from app.core.database.database import get_db
from app.core.logging.config import get_logger
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_security_event,
)
from app.core.http.error_handling import handle_database_errors
from app.api.deps import (
    get_current_admin_user,
    NotFoundException,
    ConflictException,
)
from app.crud.user import user as user_crud
from app.models.activity_log import ActionType, EntityType, ActivityLog
from app.models.models import User, Patient
from app.schemas.user import UserCreate
from app.schemas.admin import (
    AdminUserCreateRequest,
    AdminPatientSearchResult,
    AdminPatientSearchResponse,
)
from app.services.patient_management import PatientManagementService

router = APIRouter()
logger = get_logger(__name__, "app")


@router.get("/patients/search", response_model=AdminPatientSearchResponse)
def search_patients(
    request: Request,
    q: str = Query(None, description="Optional search query (name or patient ID)"),
    limit: int = Query(200, ge=1, le=500, description="Max results to return"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """List or search all patients in the system (admin only).

    When q is omitted, returns all patients (up to limit).
    When q is provided, filters by name or patient ID.
    """
    admin_id = getattr(admin_user, "id", None)

    log_endpoint_access(
        logger, request, admin_id, "admin_patient_search",
        message=f"Admin {admin_id} listing/searching patients",
    )

    query = db.query(Patient, User).outerjoin(
        User, Patient.owner_user_id == User.id
    )

    if q and q.strip():
        search_term = q.strip()

        # If search term is numeric, search by patient ID as well
        if search_term.isdigit():
            patient_id_val = int(search_term)
            query = query.filter(
                or_(
                    Patient.id == patient_id_val,
                    func.lower(Patient.first_name).contains(search_term.lower()),
                    func.lower(Patient.last_name).contains(search_term.lower()),
                )
            )
        else:
            query = query.filter(
                or_(
                    func.lower(Patient.first_name).contains(search_term.lower()),
                    func.lower(Patient.last_name).contains(search_term.lower()),
                    func.lower(
                        Patient.first_name + " " + Patient.last_name
                    ).contains(search_term.lower()),
                )
            )

    total_count = query.count()
    results = query.order_by(Patient.last_name, Patient.first_name).limit(limit).all()

    patients = []
    for patient, owner in results:
        patients.append(
            AdminPatientSearchResult(
                id=patient.id,
                first_name=patient.first_name,
                last_name=patient.last_name,
                birth_date=patient.birth_date,
                gender=patient.gender,
                owner_user_id=patient.owner_user_id,
                owner_username=owner.username if owner else None,
                owner_full_name=owner.full_name if owner else None,
                is_self_record=patient.is_self_record or False,
            )
        )

    return AdminPatientSearchResponse(patients=patients, total_count=total_count)


@router.post("/users/create")
def create_user_with_optional_link(
    request: Request,
    user_data: AdminUserCreateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """
    Create a new user account with optional patient linking.

    If link_patient_id is provided, the specified patient record will be
    transferred to the new user instead of auto-creating a blank patient.
    The original owner receives edit access via PatientShare.
    """
    admin_id = getattr(admin_user, "id", None)

    log_endpoint_access(
        logger, request, admin_id, "admin_user_create_attempt",
        message=f"Admin {admin_id} creating user: {user_data.username}",
    )

    # Check username uniqueness
    if user_crud.get_by_username(db, username=user_data.username):
        raise ConflictException(
            message=f"Username '{user_data.username}' is already taken.",
            request=request,
        )

    # Check email uniqueness
    if user_crud.get_by_email(db, email=user_data.email):
        raise ConflictException(
            message=f"Email '{user_data.email}' is already in use.",
            request=request,
        )

    # If linking to a patient, validate the patient exists before creating user
    if user_data.link_patient_id:
        target_patient = db.query(Patient).filter(
            Patient.id == user_data.link_patient_id
        ).first()
        if not target_patient:
            raise NotFoundException(
                message=f"Patient with ID {user_data.link_patient_id} not found.",
                request=request,
            )

    # Build UserCreate schema for the CRUD layer
    user_create = UserCreate(
        username=user_data.username,
        password=user_data.password,
        email=user_data.email,
        full_name=user_data.full_name,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
    )

    with handle_database_errors(request=request):
        new_user = user_crud.create(db, obj_in=user_create)

    # Log user creation in activity log (attributed to admin)
    log_create(
        db=db,
        entity_type=EntityType.USER,
        entity_obj=new_user,
        user_id=admin_id,
        request=request,
    )

    if user_data.link_patient_id:
        # Transfer existing patient to new user
        try:
            patient_service = PatientManagementService(db)
            transfer_result = patient_service.transfer_patient_ownership(
                patient_id=user_data.link_patient_id,
                new_owner=new_user,
                admin_user=admin_user,
            )

            log_security_event(
                logger, "admin_user_created_with_patient_link", request,
                f"Admin {admin_id} created user {new_user.id} and linked patient "
                f"{user_data.link_patient_id}",
                user_id=admin_id,
            )

            return {
                "status": "success",
                "message": "User created and linked to existing patient",
                "data": {
                    "user_id": new_user.id,
                    "username": new_user.username,
                    "linked_patient_id": user_data.link_patient_id,
                    "transfer_details": transfer_result,
                },
            }

        except ValueError as e:
            log_endpoint_error(
                logger, request,
                "Failed to link patient during user creation",
                e, user_id=admin_id,
            )
            # User was created but linking failed - report the issue
            # Log full error server-side but return generic message to client
            return {
                "status": "partial_success",
                "message": "User created but patient linking failed. Check server logs for details.",
                "data": {
                    "user_id": new_user.id,
                    "username": new_user.username,
                    "linked_patient_id": None,
                },
            }
    else:
        # Standard auto-create patient flow (same as auth.py registration)
        # Derive first/last name from full_name when not explicitly provided
        name_parts = user_data.full_name.strip().split()

        if user_data.first_name:
            first_name = user_data.first_name
        elif name_parts:
            first_name = name_parts[0]
        else:
            first_name = "Update"

        if user_data.last_name:
            last_name = user_data.last_name
        elif len(name_parts) >= 2:
            last_name = " ".join(name_parts[1:])
        elif name_parts:
            last_name = name_parts[0]
        else:
            last_name = "Your Name"

        patient_create_failed = False
        try:
            patient_service = PatientManagementService(db)
            patient_data = {
                "first_name": first_name,
                "last_name": last_name,
                "birth_date": date.today().replace(year=date.today().year - 25),
                "gender": "OTHER",
                "address": "Please update your address in your profile",
            }

            created_patient = patient_service.create_patient(
                user=new_user,
                patient_data=patient_data,
                is_self_record=True,
            )

            new_user.active_patient_id = created_patient.id
            db.commit()
            db.refresh(new_user)

        except Exception as e:
            patient_create_failed = True
            logger.warning(
                f"Failed to auto-create patient for new user {new_user.id}: {str(e)}"
            )

        log_security_event(
            logger, "admin_user_created", request,
            f"Admin {admin_id} created user {new_user.id} (standard flow)",
            user_id=admin_id,
        )

        if patient_create_failed:
            return {
                "status": "partial_success",
                "message": "User created but auto-creating patient failed. Check server logs for details.",
                "data": {
                    "user_id": new_user.id,
                    "username": new_user.username,
                    "linked_patient_id": None,
                },
            }

        return {
            "status": "success",
            "message": "User created successfully",
            "data": {
                "user_id": new_user.id,
                "username": new_user.username,
                "linked_patient_id": None,
            },
        }


@router.get("/users/{user_id}/login-history")
def get_user_login_history(
    request: Request,
    user_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Get login history for a specific user from the activity log."""
    log_endpoint_access(logger, request, admin_user.id, "user_login_history_viewed")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise NotFoundException(message="User not found", request=request)

    query = db.query(ActivityLog).filter(
        ActivityLog.user_id == user_id,
        ActivityLog.action == ActionType.LOGIN,
    ).order_by(ActivityLog.timestamp.desc())

    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "status": "success",
        "data": {
            "items": [
                {
                    "id": item.id,
                    "timestamp": item.timestamp.isoformat() if item.timestamp else None,
                    "ip_address": item.ip_address,
                    "user_agent": item.user_agent,
                    "description": item.description,
                }
                for item in items
            ],
            "total": total,
            "page": page,
            "per_page": per_page,
        },
    }
