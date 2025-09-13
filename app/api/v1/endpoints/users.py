from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_delete
from app.core.logging_config import get_logger
from app.crud.patient import patient
from app.crud.user import user
from app.crud.user_preferences import user_preferences
from app.models.activity_log import ActivityLog, EntityType
from app.models.models import User as UserModel
from app.schemas.user import User, UserUpdate
from app.schemas.user_preferences import UserPreferences, UserPreferencesUpdate
from app.services.user_deletion_service import UserDeletionService

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
    deletion_service = UserDeletionService()
    user_ip = request.client.host if request.client else "unknown"

    try:
        # Get user info for logging before deletion
        current_user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        username = current_user.username
        # Log deletion attempt
        log_delete(
            db=db,
            entity_type=EntityType.USER,
            entity_obj=current_user,
            user_id=user_id,
            request=request,
        )

        # Prepare request metadata for logging
        request_metadata = {
            "ip": user_ip,
            "category": "security",
            "event": "account_self_deletion"
        }

        # Use the deletion service to handle all the complex deletion logic
        deletion_result = deletion_service.delete_user_account(
            db=db,
            user_id=user_id,
            request_metadata=request_metadata
        )

        # Commit all changes atomically
        db.commit()

        # Log successful account deletion
        logger.info(
            f"User account deleted successfully: {username}",
            extra={
                "category": "security",
                "event": "account_self_deletion",
                "user_id": user_id,
                "username": username,
                "ip": user_ip,
                "deletion_stats": deletion_result,
            },
        )

        return {
            "message": "Account and all associated data deleted successfully",
            "deleted_user_id": user_id,
            "deleted_patient_id": deletion_result.get("patient_id"),
            "deletion_summary": deletion_result["deleted_records"],
        }

    except ValueError as e:
        # Validation errors from the service (last user/admin)
        db.rollback()
        logger.warning(
            f"User deletion validation failed: {str(e)}",
            extra={
                "user_id": user_id,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        # Rollback all changes on any error
        db.rollback()

        # Log failed deletion
        logger.error(
            f"Failed to delete user account: {str(e)}",
            extra={
                "category": "app",
                "event": "account_deletion_failed",
                "user_id": user_id,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account. Please try again or contact support.",
        )


@router.get("/me/preferences", response_model=UserPreferences)
def get_current_user_preferences(
    *,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Get current user's preferences."""
    try:
        preferences = user_preferences.get_or_create_by_user_id(
            db, user_id=int(current_user.id)
        )
        return preferences
    except Exception as e:
        logger.error(f"Error getting preferences for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user preferences",
        )


@router.put("/me/preferences", response_model=UserPreferences)
def update_current_user_preferences(
    *,
    db: Session = Depends(deps.get_db),
    preferences_in: UserPreferencesUpdate,
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Update current user's preferences."""
    try:
        updated_preferences = user_preferences.update_by_user_id(
            db, user_id=int(current_user.id), obj_in=preferences_in
        )
        if not updated_preferences:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user preferences",
            )
        return updated_preferences
    except Exception as e:
        logger.error(f"Error updating preferences for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user preferences",
        )
