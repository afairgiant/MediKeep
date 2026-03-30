from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_delete, log_update
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_error, log_security_event
from app.crud.patient import patient
from app.crud.user import user
from app.crud.user_preferences import user_preferences
from app.models.activity_log import ActivityLog, EntityType
from app.models.models import User as UserModel
from app.schemas.user import User, UserSelfUpdate
from app.schemas.user_preferences import UserPreferences, UserPreferencesResponse, UserPreferencesUpdate
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
    request: Request,
    db: Session = Depends(deps.get_db),
    user_in: UserSelfUpdate,
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Update current user profile."""
    updated_user = user.update(db, db_obj=current_user, obj_in=user_in)
    log_update(
        db=db,
        entity_type=EntityType.USER,
        entity_obj=updated_user,
        user_id=current_user.id,
        request=request,
    )
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


@router.get("/me/preferences", response_model=UserPreferencesResponse)
def get_current_user_preferences(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> UserPreferencesResponse:
    """Get current user's preferences."""
    try:
        preferences = user_preferences.get_or_create_by_user_id(
            db, user_id=int(current_user.id)
        )

        # Build response dict with computed fields the frontend needs
        from app.schemas.user_preferences import UserPreferences as UserPrefsSchema
        response = UserPrefsSchema.model_validate(preferences).model_dump()

        # Add computed boolean flags for credential existence
        response["paperless_has_token"] = bool(preferences.paperless_api_token_encrypted)
        response["paperless_has_credentials"] = bool(
            preferences.paperless_username_encrypted and preferences.paperless_password_encrypted
        )
        response["papra_has_token"] = bool(preferences.papra_api_token_encrypted)
        response["papra_organization_id"] = preferences.papra_organization_id

        return response
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

    Session timeout preference controls the frontend inactivity timer only.
    JWT expiry is fixed at server config and does not change with this preference.
    """
    try:
        # Update preferences
        updated_preferences = user_preferences.update_by_user_id(
            db, user_id=int(current_user.id), obj_in=preferences_in
        )
        if not updated_preferences:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user preferences",
            )

        response_data = {
            "id": updated_preferences.id,
            "user_id": updated_preferences.user_id,
            "unit_system": updated_preferences.unit_system,
            "session_timeout_minutes": updated_preferences.session_timeout_minutes,
            "language": updated_preferences.language,
            "date_format": updated_preferences.date_format,
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
            "papra_enabled": updated_preferences.papra_enabled,
            "papra_url": updated_preferences.papra_url,
            "papra_has_token": bool(updated_preferences.papra_api_token_encrypted),
            "papra_organization_id": updated_preferences.papra_organization_id,
            "created_at": updated_preferences.created_at,
            "updated_at": updated_preferences.updated_at,
        }

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
