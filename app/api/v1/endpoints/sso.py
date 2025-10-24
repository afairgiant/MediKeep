from datetime import timedelta

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.auth.sso.exceptions import *
from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_access, log_endpoint_error, log_security_event
from app.core.utils.security import create_access_token
from app.crud.user_preferences import user_preferences
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

        # Get user's timeout preference BEFORE creating the token
        preferences = user_preferences.get_or_create_by_user_id(db, user_id=result["user"].id)
        session_timeout_minutes = preferences.session_timeout_minutes if preferences else settings.ACCESS_TOKEN_EXPIRE_MINUTES

        # Create JWT token for the user (matching regular auth format)
        # Use user's session timeout preference for token expiration
        access_token_expires = timedelta(minutes=session_timeout_minutes)
        access_token = create_access_token(
            data={
                "sub": result["user"].username,
                "role": (
                    result["user"].role if result["user"].role in ["admin", "user", "guest"] else "user"
                ),
                "user_id": result["user"].id,
            },
            expires_delta=access_token_expires,
        )

        # Log token creation for SSO
        log_endpoint_access(
            logger,
            req,
            result["user"].id,
            "sso_token_created",
            message=f"SSO JWT token created with {session_timeout_minutes} minute expiration",
            username=result["user"].username,
            session_timeout_minutes=session_timeout_minutes,
            used_user_preference=bool(preferences and preferences.session_timeout_minutes),
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": result["user"].id,
                "username": result["user"].username,
                "email": result["user"].email,
                "full_name": result["user"].full_name,
                "role": result["user"].role,
                "auth_method": result["user"].auth_method,
            },
            "is_new_user": result["is_new_user"],
            "session_timeout_minutes": session_timeout_minutes
        }
        
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

        # Get user's timeout preference BEFORE creating the token
        preferences = user_preferences.get_or_create_by_user_id(db, user_id=result["user"].id)
        session_timeout_minutes = preferences.session_timeout_minutes if preferences else settings.ACCESS_TOKEN_EXPIRE_MINUTES

        # Create JWT token for the user
        # Use user's session timeout preference for token expiration
        access_token_expires = timedelta(minutes=session_timeout_minutes)
        access_token = create_access_token(
            data={
                "sub": result["user"].username,
                "role": (
                    result["user"].role if result["user"].role in ["admin", "user", "guest"] else "user"
                ),
                "user_id": result["user"].id,
            },
            expires_delta=access_token_expires,
        )

        # Log token creation
        log_endpoint_access(
            logger,
            req,
            result["user"].id,
            "sso_conflict_resolved_token_created",
            message=f"SSO conflict resolved, JWT token created with {session_timeout_minutes} minute expiration",
            username=result["user"].username,
            session_timeout_minutes=session_timeout_minutes,
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": result["user"].id,
                "username": result["user"].username,
                "email": result["user"].email,
                "full_name": result["user"].full_name,
                "role": result["user"].role,
                "auth_method": result["user"].auth_method,
            },
            "is_new_user": result["is_new_user"],
            "session_timeout_minutes": session_timeout_minutes
        }
        
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

        # Get user's timeout preference BEFORE creating the token
        preferences = user_preferences.get_or_create_by_user_id(db, user_id=result["user"].id)
        session_timeout_minutes = preferences.session_timeout_minutes if preferences else settings.ACCESS_TOKEN_EXPIRE_MINUTES

        # Create JWT token for the user
        # Use user's session timeout preference for token expiration
        access_token_expires = timedelta(minutes=session_timeout_minutes)
        access_token = create_access_token(
            data={
                "sub": result["user"].username,
                "role": (
                    result["user"].role if result["user"].role in ["admin", "user", "guest"] else "user"
                ),
                "user_id": result["user"].id,
            },
            expires_delta=access_token_expires,
        )

        # Log token creation
        log_endpoint_access(
            logger,
            req,
            result["user"].id,
            "github_manual_link_token_created",
            message=f"GitHub manual link resolved, JWT token created with {session_timeout_minutes} minute expiration",
            username=result["user"].username,
            session_timeout_minutes=session_timeout_minutes,
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": result["user"].id,
                "username": result["user"].username,
                "email": result["user"].email,
                "full_name": result["user"].full_name,
                "role": result["user"].role,
                "auth_method": result["user"].auth_method,
            },
            "is_new_user": result["is_new_user"],
            "session_timeout_minutes": session_timeout_minutes
        }
        
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
        if result["success"]:
            return {"success": True, "message": result["message"]}
        else:
            return {"success": False, "message": result["message"]}
    except Exception as e:
        log_endpoint_error(
            logger, request, "SSO connection test failed", e
        )
        return {"success": False, "message": "Connection test failed"}