from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_delete
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_error, log_security_event
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
        log_security_event(
            logger,
            "account_self_deletion",
            request,
            f"User account deleted successfully: {username}",
            user_id=user_id,
            username=username,
            deletion_stats=deletion_result
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
        log_security_event(
            logger,
            "account_deletion_validation_failed",
            request,
            f"User deletion validation failed: {str(e)}",
            user_id=user_id,
            error=str(e)
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
        log_endpoint_error(
            logger,
            request,
            f"Failed to delete user account: {str(e)}",
            e,
            user_id=user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account. Please try again or contact support.",
        )


@router.get("/me/preferences", response_model=UserPreferences)
def get_current_user_preferences(
    *,
    request: Request,
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
        log_endpoint_error(
            logger,
            request,
            f"Error getting preferences for user {current_user.id}",
            e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user preferences",
        )


@router.put("/me/preferences")
def update_current_user_preferences(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    preferences_in: UserPreferencesUpdate,
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """
    Update current user's preferences.

    If session_timeout_minutes is changed, a new JWT token with the updated
    expiration time will be generated and returned.
    """
    try:
        # Get current preferences to check if session timeout changed
        from datetime import timedelta
        from app.core.utils.security import create_access_token
        from app.core.config import settings

        current_preferences = user_preferences.get_or_create_by_user_id(
            db, user_id=int(current_user.id)
        )
        old_timeout = current_preferences.session_timeout_minutes if current_preferences else settings.ACCESS_TOKEN_EXPIRE_MINUTES

        # Update preferences
        updated_preferences = user_preferences.update_by_user_id(
            db, user_id=int(current_user.id), obj_in=preferences_in
        )
        if not updated_preferences:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user preferences",
            )

        # Check if session timeout was changed
        new_timeout = updated_preferences.session_timeout_minutes
        timeout_changed = (preferences_in.session_timeout_minutes is not None and
                          new_timeout != old_timeout)

        response_data = {
            "id": updated_preferences.id,
            "user_id": updated_preferences.user_id,
            "unit_system": updated_preferences.unit_system,
            "session_timeout_minutes": updated_preferences.session_timeout_minutes,
            "language": updated_preferences.language,
            "paperless_enabled": updated_preferences.paperless_enabled,
            "paperless_url": updated_preferences.paperless_url,
            "paperless_auto_sync": updated_preferences.paperless_auto_sync,
            "paperless_sync_tags": updated_preferences.paperless_sync_tags,
            "paperless_has_token": bool(updated_preferences.paperless_api_token_encrypted),
            "paperless_has_credentials": bool(
                updated_preferences.paperless_username_encrypted and
                updated_preferences.paperless_password_encrypted
            ),
            "default_storage_backend": updated_preferences.default_storage_backend,
            "created_at": updated_preferences.created_at,
            "updated_at": updated_preferences.updated_at,
        }

        # If session timeout changed, generate a new token with updated expiration
        if timeout_changed:
            access_token_expires = timedelta(minutes=new_timeout)
            new_token = create_access_token(
                data={
                    "sub": current_user.username,
                    "role": (
                        current_user.role if current_user.role in ["admin", "user", "guest"] else "user"
                    ),
                    "user_id": current_user.id,
                    "full_name": getattr(current_user, "full_name", None) or current_user.username,
                },
                expires_delta=access_token_expires,
            )

            from app.core.logging.helpers import log_endpoint_access
            log_endpoint_access(
                logger,
                request,
                current_user.id,
                "session_timeout_updated_token_regenerated",
                message=f"Session timeout changed from {old_timeout} to {new_timeout} minutes, new token generated",
                username=current_user.username,
                old_timeout=old_timeout,
                new_timeout=new_timeout,
            )

            # Return preferences with new token
            response_data["new_token"] = new_token
            response_data["token_type"] = "bearer"

        return response_data

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            f"Error updating preferences for user {current_user.id}",
            e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user preferences",
        )
