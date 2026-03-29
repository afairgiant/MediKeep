"""
Papra document management integration API endpoints.

Provides API endpoints for Papra integration including connection testing,
organization listing, and settings management. Papra uses Bearer token
authentication only (no username/password).
"""

import traceback
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import log_endpoint_access, log_endpoint_error
from app.crud.user_preferences import user_preferences
from app.models.models import UserPreferences
from app.schemas.user_preferences import PapraConnectionData
from app.services.credential_encryption import (
    SecurityError,
    decrypt_papra_token,
    encrypt_papra_token,
)
from app.services.papra_auth import PapraAuth
from app.services.papra_client import PapraClientError, PapraConnectionError, create_papra_client

logger = get_logger(__name__, "app")

router = APIRouter()


class PapraSettingsUpdate(BaseModel):
    """Request body for updating Papra settings."""

    papra_url: Optional[str] = None
    papra_api_token: Optional[str] = None
    papra_organization_id: Optional[str] = None
    papra_enabled: Optional[bool] = None

    @field_validator("papra_url")
    @classmethod
    def validate_url(cls, v):
        """Validate Papra URL format if provided."""
        if v is None or v == "":
            return v
        from app.schemas.user_preferences import _validate_integration_url
        return _validate_integration_url(v)

    @field_validator("papra_api_token")
    @classmethod
    def validate_api_token(cls, v):
        """Validate API token format if provided."""
        if v is not None and v.strip():
            if len(v.strip()) < 10:
                raise ValueError("API token appears to be too short")
            return v.strip()
        return v


def _mask_token(token: Optional[str]) -> Optional[str]:
    """Return only the last 4 characters of a token for safe display."""
    if not token:
        return None
    return f"****{token[-4:]}" if len(token) >= 4 else "****"


def _build_settings_response(prefs: UserPreferences) -> Dict[str, Any]:
    """Build the public settings response dict from a UserPreferences record."""
    raw_token = None
    if prefs.papra_api_token_encrypted:
        try:
            raw_token = decrypt_papra_token(prefs.papra_api_token_encrypted)
        except Exception:
            raw_token = None

    return {
        "papra_enabled": prefs.papra_enabled or False,
        "papra_url": prefs.papra_url or "",
        "papra_has_token": bool(prefs.papra_api_token_encrypted),
        "papra_connection_verified": prefs.papra_connection_verified or False,
        "papra_token_preview": _mask_token(raw_token),
        "papra_organization_id": prefs.papra_organization_id or "",
    }


@router.post("/test-connection", response_model=Dict[str, Any])
async def test_papra_connection(
    connection_data: PapraConnectionData,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Test connection to a Papra instance using Bearer token auth.

    Args:
        connection_data: Papra connection details (URL and API token).
        current_user_id: Current authenticated user ID.
        db: Database session.

    Returns:
        Dict with "status" ("success" or "error") and "message".

    Raises:
        HTTPException: 400 on connection failure, 500 on internal error.
    """
    log_endpoint_access(
        logger,
        request=request,
        user_id=current_user_id,
        event="papra_connection_test_started",
        message=f"Papra connection test initiated for user {current_user_id}",
        papra_url=connection_data.papra_url,
    )

    try:
        # Determine whether to use provided token or fall back to saved credentials
        use_saved = not connection_data.papra_api_token
        token = connection_data.papra_api_token

        if use_saved:
            logger.debug(f"Using saved credentials for Papra connection test, user {current_user_id}")
            prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )
            if not prefs or not prefs.papra_api_token_encrypted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No API token provided and no saved credentials found.",
                )
            try:
                token = decrypt_papra_token(prefs.papra_api_token_encrypted)
            except SecurityError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to decrypt saved API token. Please re-enter your token.",
                )

        auth = PapraAuth(
            url=connection_data.papra_url,
            token=token,
            organization_id=connection_data.papra_organization_id or "_test_",
        )

        success, message = await auth.test_connection()

        if success:
            # Also fetch organizations so the frontend can populate the selector
            organizations = await auth.list_organizations()

            # Mark connection as verified in the database
            prefs = user_preferences.get_by_user_id(db, user_id=current_user_id)
            if prefs:
                user_preferences.update(db, db_obj=prefs, obj_in={"papra_connection_verified": True})

            log_endpoint_access(
                logger,
                request=request,
                user_id=current_user_id,
                event="papra_connection_test_succeeded",
                message=f"Papra connection test succeeded for user {current_user_id}",
                papra_url=connection_data.papra_url,
            )
            return {
                "status": "success",
                "message": message,
                "organizations": organizations,
            }

        log_endpoint_access(
            logger,
            request=request,
            user_id=current_user_id,
            event="papra_connection_test_failed",
            message=f"Papra connection test failed for user {current_user_id}: {message}",
            papra_url=connection_data.papra_url,
        )
        return {"status": "error", "message": message}

    except ValueError as exc:
        log_endpoint_error(
            logger,
            request,
            "Invalid Papra connection parameters",
            exc,
            user_id=current_user_id,
            event="papra_connection_test_invalid_params",
            papra_url=connection_data.papra_url,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid connection parameters provided.",
        ) from exc

    except Exception as exc:
        logger.error(
            "Unexpected error during Papra connection test",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "papra_connection_test_error",
                LogFields.USER_ID: current_user_id,
                LogFields.ERROR: str(exc),
                "papra_url": connection_data.papra_url,
                "error_type": type(exc).__name__,
                "stack_trace": traceback.format_exc(),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during the connection test.",
        ) from exc


@router.get("/organizations", response_model=List[Dict[str, Any]])
async def list_papra_organizations(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    List organizations available to the authenticated Papra account.

    Requires Papra settings to have been saved previously. The stored token
    is decrypted before use and never returned to the caller.

    Args:
        current_user_id: Current authenticated user ID.
        db: Database session.

    Returns:
        List of organization dicts as returned by the Papra API.

    Raises:
        HTTPException: 400 if settings are missing or incomplete,
                       500 on internal error.
    """
    log_endpoint_access(
        logger,
        request=request,
        user_id=current_user_id,
        event="papra_list_organizations_started",
        message=f"Papra organization listing requested by user {current_user_id}",
    )

    try:
        prefs = user_preferences.get_by_user_id(db, user_id=current_user_id)

        if not prefs or not prefs.papra_url or not prefs.papra_api_token_encrypted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Papra is not configured. Please save your Papra URL and API token "
                    "in settings before listing organizations."
                ),
            )

        try:
            raw_token = decrypt_papra_token(prefs.papra_api_token_encrypted)
        except SecurityError as exc:
            logger.error(
                "Failed to decrypt Papra token for organization listing",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "papra_token_decryption_failed",
                    LogFields.USER_ID: current_user_id,
                    LogFields.ERROR: str(exc),
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="A security error occurred while accessing your Papra credentials.",
            ) from exc

        if not raw_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stored Papra API token could not be read. Please re-save your settings.",
            )

        # organization_id is not required for listing orgs; use a sentinel value.
        auth = PapraAuth(
            url=prefs.papra_url,
            token=raw_token,
            organization_id=prefs.papra_organization_id or "_list_",
        )

        organizations = await auth.list_organizations()

        log_endpoint_access(
            logger,
            request=request,
            user_id=current_user_id,
            event="papra_list_organizations_succeeded",
            message=f"Retrieved {len(organizations)} Papra organization(s) for user {current_user_id}",
            organization_count=len(organizations),
        )

        return organizations

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        log_endpoint_error(
            logger,
            request,
            "Database error listing Papra organizations",
            exc,
            user_id=current_user_id,
            event="papra_list_organizations_db_error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred while retrieving Papra organizations.",
        ) from exc

    except Exception as exc:
        logger.error(
            "Unexpected error listing Papra organizations",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "papra_list_organizations_error",
                LogFields.USER_ID: current_user_id,
                LogFields.ERROR: str(exc),
                "error_type": type(exc).__name__,
                "stack_trace": traceback.format_exc(),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while retrieving Papra organizations.",
        ) from exc


@router.get("/settings", response_model=Dict[str, Any])
async def get_papra_settings(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get current Papra settings for the authenticated user.

    The API token is masked: only the last 4 characters are returned.

    Args:
        current_user_id: Current authenticated user ID.
        db: Database session.

    Returns:
        Current Papra settings with the token masked.

    Raises:
        HTTPException: 500 on internal or database error.
    """
    log_endpoint_access(
        logger,
        request=request,
        user_id=current_user_id,
        event="papra_settings_retrieved",
        message=f"Papra settings retrieved for user {current_user_id}",
    )

    try:
        prefs = user_preferences.get_by_user_id(db, user_id=current_user_id)

        if not prefs:
            # Default setting values, not passwords
            return {  # nosec B105
                "papra_enabled": False,
                "papra_url": "",
                "papra_has_token": False,
                "papra_connection_verified": False,
                "papra_token_preview": None,
                "papra_organization_id": "",
            }

        return _build_settings_response(prefs)

    except SQLAlchemyError as exc:
        log_endpoint_error(
            logger,
            request,
            "Database error retrieving Papra settings",
            exc,
            user_id=current_user_id,
            event="papra_settings_db_error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred while retrieving Papra settings.",
        ) from exc

    except Exception as exc:
        logger.error(
            "Unexpected error retrieving Papra settings",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "papra_settings_retrieval_error",
                LogFields.USER_ID: current_user_id,
                LogFields.ERROR: str(exc),
                "error_type": type(exc).__name__,
                "stack_trace": traceback.format_exc(),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while retrieving Papra settings.",
        ) from exc


@router.put("/settings", response_model=Dict[str, Any])
async def update_papra_settings(
    settings_update: PapraSettingsUpdate,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Save Papra settings for the authenticated user.

    The API token is encrypted before being persisted. The returned settings
    object masks the token (last 4 characters only).

    Args:
        settings_update: Fields to update (all optional; only provided fields
            are changed).
        current_user_id: Current authenticated user ID.
        db: Database session.

    Returns:
        Updated Papra settings with the token masked.

    Raises:
        HTTPException: 400 on invalid input, 500 on security or database error.
    """
    log_endpoint_access(
        logger,
        request=request,
        user_id=current_user_id,
        event="papra_settings_update_started",
        message=f"Papra settings update initiated for user {current_user_id}",
    )

    try:
        prefs = user_preferences.get_or_create_by_user_id(db, user_id=current_user_id)

        update_data: Dict[str, Any] = {}

        if settings_update.papra_enabled is not None:
            update_data["papra_enabled"] = settings_update.papra_enabled

        if settings_update.papra_url is not None:
            update_data["papra_url"] = settings_update.papra_url

        if settings_update.papra_organization_id is not None:
            update_data["papra_organization_id"] = settings_update.papra_organization_id

        if settings_update.papra_api_token:
            try:
                encrypted = encrypt_papra_token(settings_update.papra_api_token)
            except SecurityError as exc:
                logger.error(
                    "Failed to encrypt Papra token during settings update",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: "papra_token_encryption_failed",
                        LogFields.USER_ID: current_user_id,
                        LogFields.ERROR: str(exc),
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="A security error occurred while saving your Papra API token.",
                ) from exc

            if encrypted is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to encrypt the Papra API token.",
                )

            update_data["papra_api_token_encrypted"] = encrypted

        # Reset connection verified only if URL changed (new server = must re-verify)
        if "papra_url" in update_data and update_data["papra_url"] != (prefs.papra_url or ""):
            update_data["papra_connection_verified"] = False

        updated_prefs = user_preferences.update(db, db_obj=prefs, obj_in=update_data)

        logger.info(
            f"Papra settings updated for user {current_user_id}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "papra_settings_updated",
                LogFields.USER_ID: current_user_id,
                "updated_fields": list(update_data.keys()),
            },
        )

        return _build_settings_response(updated_prefs)

    except HTTPException:
        raise

    except ValueError as exc:
        log_endpoint_error(
            logger,
            request,
            "Invalid Papra settings data",
            exc,
            user_id=current_user_id,
            event="papra_settings_validation_error",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid settings data provided.",
        ) from exc

    except SQLAlchemyError as exc:
        log_endpoint_error(
            logger,
            request,
            "Database error saving Papra settings",
            exc,
            user_id=current_user_id,
            event="papra_settings_db_error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred while saving Papra settings.",
        ) from exc

    except Exception as exc:
        logger.error(
            "Unexpected error updating Papra settings",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "papra_settings_update_error",
                LogFields.USER_ID: current_user_id,
                LogFields.ERROR: str(exc),
                "error_type": type(exc).__name__,
                "stack_trace": traceback.format_exc(),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while saving Papra settings.",
        ) from exc


@router.get("/documents/search", response_model=Dict[str, Any])
async def search_papra_documents(
    request: Request,
    query: str = "",
    page: int = 0,
    page_size: int = 20,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Search or list documents available in the user's configured Papra organization.

    Args:
        query: Optional search string; omit or leave empty to list all documents.
        page: Zero-based page index (default 0).
        page_size: Number of results per page (default 20).
        current_user_id: Current authenticated user ID.
        db: Database session.

    Returns:
        Dict with ``results`` (list of document dicts) and ``count`` (total number
        of matching documents as reported by Papra).

    Raises:
        HTTPException: 400 if Papra is not configured or token cannot be decrypted,
                       500 on connection or internal error.
    """
    log_endpoint_access(
        logger,
        request=request,
        user_id=current_user_id,
        event="papra_document_search_started",
        message=f"Papra document search requested by user {current_user_id}",
        query=query,
        page=page,
        page_size=page_size,
    )

    try:
        prefs = user_preferences.get_by_user_id(db, user_id=current_user_id)

        if not prefs or not prefs.papra_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Papra integration is not enabled.",
            )

        if not prefs.papra_url or not prefs.papra_api_token_encrypted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Papra is not fully configured. Please save your Papra URL, "
                    "API token, and organization in settings."
                ),
            )

        if not prefs.papra_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No Papra organization selected. Please select an organization in settings.",
            )

        try:
            raw_token = decrypt_papra_token(prefs.papra_api_token_encrypted)
        except SecurityError as exc:
            logger.error(
                "Failed to decrypt Papra token for document search",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "papra_token_decryption_failed",
                    LogFields.USER_ID: current_user_id,
                    LogFields.ERROR: str(exc),
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="A security error occurred while accessing your Papra credentials.",
            ) from exc

        if not raw_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stored Papra API token could not be read. Please re-save your settings.",
            )

        papra_client = create_papra_client(
            url=prefs.papra_url,
            encrypted_token=prefs.papra_api_token_encrypted,
            organization_id=prefs.papra_organization_id,
            user_id=current_user_id,
        )

        async with papra_client:
            search_result = await papra_client.search_documents(
                query=query,
                page=page,
                page_size=page_size,
            )

        documents = search_result.get("documents", [])
        total_count = search_result.get("documentsCount", 0)

        log_endpoint_access(
            logger,
            request=request,
            user_id=current_user_id,
            event="papra_document_search_succeeded",
            message=(
                f"Papra document search returned {len(documents)} result(s) "
                f"(total {total_count}) for user {current_user_id}"
            ),
            result_count=len(documents),
            total_count=total_count,
        )

        return {"results": documents, "count": total_count}

    except HTTPException:
        raise

    except PapraConnectionError as exc:
        log_endpoint_error(
            logger,
            request,
            "Papra connection error during document search",
            exc,
            user_id=current_user_id,
            event="papra_document_search_connection_error",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to connect to Papra: {exc}",
        ) from exc

    except PapraClientError as exc:
        log_endpoint_error(
            logger,
            request,
            "Papra client error during document search",
            exc,
            user_id=current_user_id,
            event="papra_document_search_client_error",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Papra error: {exc}",
        ) from exc

    except SQLAlchemyError as exc:
        log_endpoint_error(
            logger,
            request,
            "Database error during Papra document search",
            exc,
            user_id=current_user_id,
            event="papra_document_search_db_error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred while searching Papra documents.",
        ) from exc

    except Exception as exc:
        logger.error(
            "Unexpected error searching Papra documents",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "papra_document_search_error",
                LogFields.USER_ID: current_user_id,
                LogFields.ERROR: str(exc),
                "error_type": type(exc).__name__,
                "stack_trace": traceback.format_exc(),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while searching Papra documents.",
        ) from exc
