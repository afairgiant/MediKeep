from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_delete
from app.core.logging_config import get_logger
from app.crud.patient import patient
from app.crud.user import user
from app.models.activity_log import ActivityLog, EntityType
from app.models.models import User as UserModel
from app.schemas.user import User, UserUpdate

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.get("/me", response_model=User)
def get_current_user(current_user: UserModel = Depends(deps.get_current_user)) -> Any:
    """Get current user profile."""
    return current_user


@router.put("/me", response_model=User)
def update_current_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserUpdate,
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Update current user profile."""
    updated_user = user.update(db, db_obj=current_user, obj_in=user_in)
    return updated_user


@router.delete("/me")
def delete_current_user_account(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete current user's account and all associated data.

    This will permanently delete:
    - The user account
    - Their patient record (if exists)
    - ALL medical data including:
    - Medications, Lab Results, Allergies, Conditions
    - Procedures, Immunizations, Vital Signs, Encounters
    - Treatments, Emergency Contacts

    WARNING: This action cannot be undone!
    """
    user_ip = request.client.host if request.client else "unknown"

    # Get the user object to access username and role
    current_user = user.get(db, id=user_id)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    username = current_user.username

    try:
        # Check if this is the last user in the system (prevent complete system lockout)
        total_users = db.query(UserModel).count()
        if total_users <= 1:
            logger.warning(
                f"Attempted deletion of last user in system: {username}",
                extra={
                    "category": "security",
                    "event": "last_user_deletion_attempt",
                    "user_id": user_id,
                    "username": username,
                    "ip": user_ip,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last remaining user in the system. The system must have at least one user account.",
            )

        # Check if user is the last admin (prevent administrative lockout)
        if current_user.role is not None and current_user.role.lower() in [
            "admin",
            "administrator",
        ]:
            admin_count = (
                db.query(UserModel)
                .filter(
                    UserModel.role.in_(
                        ["admin", "Admin", "administrator", "Administrator"]
                    )
                )
                .count()
            )

            if admin_count <= 1:
                logger.warning(
                    f"Attempted deletion of last admin user {username}",
                    extra={
                        "category": "security",
                        "event": "last_admin_deletion_attempt",
                        "user_id": user_id,
                        "username": username,
                        "ip": user_ip,
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete the last remaining admin user in the system. Please create another admin user first.",
                )

        # Get the user's patient record for cascade deletion
        user_patient = patient.get_by_user_id(db, user_id=user_id)
        patient_id = None

        if user_patient:
            patient_id = int(user_patient.id) if user_patient.id is not None else None

            if patient_id is not None:
                # Log patient deletion activity before deletion
                log_delete(
                    db=db,
                    entity_type=EntityType.PATIENT,
                    entity_obj=user_patient,
                    user_id=user_id,
                    request=request,
                )

                # Preserve audit trail by nullifying patient_id in activity logs
                # This keeps the activity history while removing the foreign key reference
                db.query(ActivityLog).filter(
                    ActivityLog.patient_id == patient_id
                ).update({"patient_id": None}, synchronize_session=False)

                # Delete patient record (automatically cascades to all medical data)
                patient.delete(db, id=patient_id)

                logger.info(
                    f"Patient record and medical data deleted for user {username}",
                    extra={
                        "category": "app",
                        "event": "patient_cascade_deletion",
                        "user_id": user_id,
                        "patient_id": patient_id,
                        "username": username,
                        "ip": user_ip,
                    },
                )

        # Log user deletion activity before deletion
        log_delete(
            db=db,
            entity_type=EntityType.USER,
            entity_obj=current_user,
            user_id=user_id,
            request=request,
        )

        # Preserve audit trail by nullifying user_id in activity logs
        # This keeps the activity history while removing the foreign key reference
        db.query(ActivityLog).filter(ActivityLog.user_id == user_id).update(
            {"user_id": None}, synchronize_session=False
        )

        # Delete the user account
        user.delete(db, id=user_id)

        # Log successful account deletion
        logger.info(
            f"User account deleted successfully: {username}",
            extra={
                "category": "security",
                "event": "account_self_deletion",
                "user_id": user_id,
                "username": username,
                "ip": user_ip,
                "had_patient_record": patient_id is not None,
            },
        )

        return {
            "message": "Account and all associated data deleted successfully",
            "deleted_user_id": user_id,
            "deleted_patient_id": patient_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        # Log failed deletion
        logger.error(
            f"Failed to delete user account {username}: {str(e)}",
            extra={
                "category": "app",
                "event": "account_deletion_failed",
                "user_id": user_id,
                "username": username,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account. Please try again or contact support.",
        )
