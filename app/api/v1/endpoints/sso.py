from datetime import timedelta

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.api.deps import UnauthorizedException
from app.api.activity_logging import safe_log_activity
from app.auth.sso.exceptions import *
from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_access, log_endpoint_error, log_security_event
from app.core.utils.security import create_access_token
from app.crud.user_preferences import user_preferences
from app.models.activity_log import ActionType, EntityType
from app.models.base import get_utc_now
from app.services.sso_service import SSOService

logger = get_logger(__name__, "sso")
router = APIRouter(prefix="/auth/sso", tags=["sso"])
sso_service = SSOService()

class SSOConflictRequest(BaseModel):
    temp_token: str
    action: str  # "link" or "create_separate"
    preference: str  # "auto_link", "create_separate", "always_ask"

class SSOCallbackRequest(BaseModel):
    code: str  # Authorization code from SSO provider
    state: str  # State parameter for CSRF protection

class GitHubLinkRequest(BaseModel):
    temp_token: str
    username: str
    password: str


def _check_user_active(sso_user, event_name: str, req: Request) -> None:
    """Raise UnauthorizedException if the user account is inactive."""
    if not sso_user.is_active:
        log_security_event(
            logger, event_name, req,
            f"SSO login rejected for inactive user: {sso_user.username}",
            username=sso_user.username,
        )
        raise UnauthorizedException(
            message="This account has been deactivated. Please contact an administrator.",
            request=req,
        )


def _complete_sso_login(
    result: dict,
    req: Request,
    db: Session,
    log_event_name: str,
    activity_description: str,
) -> dict:
    """Shared post-authentication logic for all SSO login paths.

    Logs the login activity, updates last_login_at, creates a JWT token,
    and returns the standard SSO login response dict.
    """
    sso_user = result["user"]

    safe_log_activity(
        db=db,
        action=ActionType.LOGIN,
        entity_type=EntityType.USER,
        entity_obj=sso_user,
        user_id=sso_user.id,
        description=activity_description,
        request=req,
    )

    try:
        sso_user.last_login_at = get_utc_now()
        db.commit()
    except Exception:
        db.rollback()

    preferences = user_preferences.get_or_create_by_user_id(db, user_id=sso_user.id)
    session_timeout_minutes = (
        preferences.session_timeout_minutes
        if preferences
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    access_token = create_access_token(
        data={
            "sub": sso_user.username,
            "role": sso_user.role if sso_user.role in ["admin", "user", "guest"] else "user",
            "user_id": sso_user.id,
        },
        expires_delta=timedelta(minutes=session_timeout_minutes),
    )

    log_endpoint_access(
        logger, req, sso_user.id, log_event_name,
        message=f"SSO JWT token created with {session_timeout_minutes} minute expiration",
        username=sso_user.username,
        session_timeout_minutes=session_timeout_minutes,
        used_user_preference=bool(preferences and preferences.session_timeout_minutes),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": sso_user.id,
            "username": sso_user.username,
            "email": sso_user.email,
            "full_name": sso_user.full_name,
            "role": sso_user.role,
            "auth_method": sso_user.auth_method,
        },
        "is_new_user": result["is_new_user"],
        "session_timeout_minutes": session_timeout_minutes,
    }

@router.get("/config")
async def get_sso_config(request: Request):
    """Check if SSO is enabled and get configuration info for frontend"""
    try:
        return {
            "enabled": settings.SSO_ENABLED,
            "provider_type": settings.SSO_PROVIDER_TYPE if settings.SSO_ENABLED else None,
            "registration_enabled": settings.ALLOW_USER_REGISTRATION,
        }
    except Exception as e:
        log_endpoint_error(
            logger, request, "Error getting SSO config", e
        )
        return {
            "enabled": False,
            "provider_type": None,
            "registration_enabled": settings.ALLOW_USER_REGISTRATION,
        }

@router.post("/initiate")
async def initiate_sso_login(
    request: Request,
    return_url: str = Query(None, description="URL to return to after SSO"),
    db: Session = Depends(deps.get_db)
):
    """Start SSO authentication flow"""
    try:
        result = await sso_service.get_authorization_url(return_url)
        return result
    except SSOConfigurationError as e:
        log_security_event(
            logger, "sso_config_error", request,
            "SSO configuration error",
            error=str(e)
        )
        raise HTTPException(status_code=400, detail="SSO configuration error")
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to initiate SSO", e
        )
        raise HTTPException(status_code=500, detail="Failed to start SSO authentication")

@router.post("/callback")
async def sso_callback(
    req: Request,
    request: SSOCallbackRequest,
    db: Session = Depends(deps.get_db)
):
    """Handle SSO callback and complete authentication
    
    Security Note: OAuth authorization codes are sent in POST body from frontend
    to prevent exposure in backend URL parameters, browser history, and server logs.
    The OAuth provider still redirects to the frontend GET route as per OAuth spec.
    """
    try:
        # Complete SSO authentication
        result = await sso_service.complete_authentication(request.code, request.state, db)
        
        # Check if this is a conflict response
        if result.get("conflict"):
            # Return conflict data directly for frontend to handle
            return result

        # Check if this is a GitHub manual linking response
        if result.get("github_manual_link"):
            # Return GitHub manual linking data for frontend to handle
            return result

        _check_user_active(result["user"], "sso_login_rejected_inactive", req)

        return _complete_sso_login(
            result, req, db,
            log_event_name="sso_token_created",
            activity_description=f"User logged in via SSO: {result['user'].username}",
        )
        
    except SSORegistrationBlockedError as e:
        log_security_event(
            logger, "sso_registration_blocked", req,
            "SSO registration blocked",
            error=str(e)
        )
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Registration is currently disabled",
                "error_code": "REGISTRATION_DISABLED"
            }
        )
    except SSOAuthenticationError as e:
        log_security_event(
            logger, "sso_authentication_failed", req,
            "SSO authentication failed",
            error=str(e)
        )
        raise HTTPException(
            status_code=400,
            detail={
                "message": "SSO authentication failed",
                "error_code": "AUTH_FAILED"
            }
        )
    except Exception as e:
        log_endpoint_error(
            logger, req, "Unexpected error in SSO callback", e
        )
        raise HTTPException(
            status_code=500,
            detail="SSO authentication failed"
        )

@router.post("/resolve-conflict")
async def resolve_account_conflict(
    req: Request,
    request: SSOConflictRequest,
    db: Session = Depends(deps.get_db)
):
    """Resolve SSO account conflict based on user's choice"""
    try:
        result = sso_service.resolve_account_conflict(request.temp_token, request.action, request.preference, db)

        _check_user_active(result["user"], "sso_conflict_login_rejected_inactive", req)

        return _complete_sso_login(
            result, req, db,
            log_event_name="sso_conflict_resolved_token_created",
            activity_description=f"User logged in via SSO conflict resolution: {result['user'].username}",
        )
        
    except SSOAuthenticationError as e:
        log_security_event(
            logger, "sso_conflict_resolution_failed", req,
            "SSO conflict resolution failed",
            error=str(e)
        )
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Account conflict resolution failed",
                "error_code": "CONFLICT_RESOLUTION_FAILED"
            }
        )
    except Exception as e:
        log_endpoint_error(
            logger, req, "Unexpected error in SSO conflict resolution", e
        )
        raise HTTPException(
            status_code=500,
            detail="SSO conflict resolution failed"
        )

@router.post("/resolve-github-link")
async def resolve_github_manual_link(
    req: Request,
    request: GitHubLinkRequest,
    db: Session = Depends(deps.get_db)
):
    """Resolve GitHub manual linking by verifying user credentials"""
    try:
        result = sso_service.resolve_github_manual_link(request.temp_token, request.username, request.password, db)

        _check_user_active(result["user"], "github_link_login_rejected_inactive", req)

        return _complete_sso_login(
            result, req, db,
            log_event_name="github_manual_link_token_created",
            activity_description=f"User logged in via GitHub linking: {result['user'].username}",
        )
        
    except SSOAuthenticationError as e:
        log_security_event(
            logger, "github_linking_failed", req,
            "GitHub manual linking failed",
            error=str(e),
            username=request.username
        )
        raise HTTPException(
            status_code=400,
            detail={
                "message": "GitHub account linking failed",
                "error_code": "GITHUB_LINK_FAILED"
            }
        )
    except Exception as e:
        log_endpoint_error(
            logger, req, "Unexpected error in GitHub manual linking", e,
            username=request.username
        )
        raise HTTPException(
            status_code=500,
            detail="GitHub manual linking failed"
        )

@router.post("/test-connection")
async def test_sso_connection(request: Request):
    """Test SSO provider connection (for admin use)"""
    try:
        result = sso_service.test_connection()
        return {"success": result["success"], "message": result["message"]}
    except Exception as e:
        log_endpoint_error(
            logger, request, "SSO connection test failed", e
        )
        return {"success": False, "message": "Connection test failed"}