from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import safe_log_activity
from app.api.deps import UnauthorizedException
from app.auth.sso.exceptions import *
from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_security_event,
)
from app.core.utils.cookie_auth import set_auth_cookie
from app.core.utils.rate_limit import SlidingWindowRateLimiter, get_client_ip
from app.core.utils.security import create_access_token
from app.crud.user_preferences import user_preferences
from app.models.activity_log import ActionType, EntityType
from app.models.base import get_utc_now
from app.models.models import User
from app.services.patient_management import PatientManagementService
from app.services.sso_service import SSOService

logger = get_logger(__name__, "sso")
router = APIRouter(prefix="/auth/sso", tags=["sso"])
sso_service = SSOService()

# Throttles the unauthenticated /initiate endpoint, which is what stops an
# anonymous caller from minting SSO state entries without bound. Keyed per IP.
#
# The limits are read from settings at import time, so a test that patches
# settings.SSO_RATE_LIMIT_* must call _initiate_limiter.reconfigure() to apply the
# override to this instance.
_initiate_limiter = SlidingWindowRateLimiter(
    max_requests=settings.SSO_RATE_LIMIT_ATTEMPTS,
    window_seconds=settings.SSO_RATE_LIMIT_WINDOW_MINUTES * 60,
)


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
            logger,
            event_name,
            req,
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

    Logs the login activity, updates last_login_at, clears an unsatisfiable forced
    password change for SSO-only accounts, creates a JWT token, and returns the
    standard SSO login response dict.
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

    # Auto-set active patient if not already set (matches regular login behavior)
    if not sso_user.active_patient_id:
        try:
            patient_service = PatientManagementService(db)
            patient_service.ensure_active_patient(sso_user)
        except (SQLAlchemyError, ValueError) as e:
            db.rollback()
            log_endpoint_error(
                logger,
                req,
                "Failed to set active patient during SSO login",
                e,
                user_id=sso_user.id,
            )
            # Continue login without active patient - user can set it later

    # A forced password change is unsatisfiable for a pure-SSO user: the account was
    # created with a random password that was discarded immediately (crud/user.py
    # create_from_sso), and /auth/change-password requires the current password. The
    # flag would lock the account out permanently, so clear it on successful SSO login.
    # Hybrid users are deliberately excluded - they have a real local password they
    # know, so the normal forced-change flow works for them.
    clear_forced_password_change = (
        bool(sso_user.must_change_password) and not sso_user.has_usable_password
    )

    try:
        sso_user.last_login_at = get_utc_now()
        if clear_forced_password_change:
            sso_user.must_change_password = False
        db.commit()
    except Exception as e:
        db.rollback()
        if clear_forced_password_change:
            # The flag is still set in the database. Issuing a session now would
            # send the user to the forced-change form they cannot satisfy - the
            # exact lockout this clear exists to prevent - so fail the login
            # instead and let the next attempt retry the clear.
            log_endpoint_error(
                logger,
                req,
                "Failed to clear forced password change during SSO login",
                e,
                user_id=sso_user.id,
            )
            raise
        # A failed last_login_at update on its own is not worth failing a login
        # over; this tolerance predates the clear and is deliberate.

    if clear_forced_password_change:
        log_security_event(
            logger,
            "sso_forced_password_change_cleared",
            req,
            "Cleared unsatisfiable forced password change for SSO-only user",
            user_id=sso_user.id,
            username=sso_user.username,
            auth_method=sso_user.auth_method,
        )

    preferences = user_preferences.get_or_create_by_user_id(db, user_id=sso_user.id)
    session_timeout_minutes = (
        preferences.session_timeout_minutes
        if preferences
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    jwt_lifetime = max(settings.ACCESS_TOKEN_EXPIRE_MINUTES, session_timeout_minutes)
    access_token = create_access_token(
        data={
            "sub": sso_user.username,
            "role": (
                sso_user.role if sso_user.role in ["admin", "user", "guest"] else "user"
            ),
            "user_id": sso_user.id,
        },
        expires_delta=timedelta(minutes=jwt_lifetime),
    )

    log_endpoint_access(
        logger,
        req,
        sso_user.id,
        log_event_name,
        message=f"SSO JWT token created with {jwt_lifetime} minute expiration",
        username=sso_user.username,
        jwt_expiry_minutes=jwt_lifetime,
        inactivity_timeout_minutes=session_timeout_minutes,
    )

    response_data = {
        "access_token": access_token,
        "token_type": "bearer",  # nosec B105 - OAuth2 token type, not a password
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
        "must_change_password": bool(sso_user.must_change_password),
        # The deep link /auth/sso/initiate was given, carried through the state entry.
        # Ships inert: no frontend reads it yet (deep links currently survive via
        # sessionStorage, which fails in private browsing). See SSO_ONLY_MODE_SPEC.md
        # 8.8 - the consumer is a later PR.
        "return_url": result.get("return_url"),
    }
    response = JSONResponse(content=response_data)
    set_auth_cookie(response, access_token, max_age_minutes=jwt_lifetime)
    return response


@router.get("/config")
async def get_sso_config(request: Request):
    """Check if SSO is enabled and get configuration info for frontend"""
    try:
        return {
            "enabled": settings.SSO_ENABLED,
            "provider_type": (
                settings.SSO_PROVIDER_TYPE if settings.SSO_ENABLED else None
            ),
            "registration_enabled": settings.ALLOW_USER_REGISTRATION,
        }
    except Exception as e:
        log_endpoint_error(logger, request, "Error getting SSO config", e)
        return {
            "enabled": False,
            "provider_type": None,
            "registration_enabled": settings.ALLOW_USER_REGISTRATION,
        }


@router.post("/initiate")
async def initiate_sso_login(
    request: Request,
    return_url: str = Query(None, description="URL to return to after SSO"),
    db: Session = Depends(deps.get_db),
):
    """Start SSO authentication flow"""
    # Checked before get_authorization_url so a limited request mints no state
    # entry - throttling this endpoint is what bounds the in-memory state store.
    client_ip = get_client_ip(request)
    if not _initiate_limiter.is_allowed(client_ip):
        headers = _initiate_limiter.rate_limit_headers(client_ip)

        log_security_event(
            logger,
            "sso_initiate_rate_limited",
            request,
            "Rate limit exceeded for SSO initiate endpoint",
            endpoint="/api/v1/auth/sso/initiate",
            retry_after_seconds=headers["Retry-After"],
        )

        raise HTTPException(
            status_code=429,
            detail=(
                "Too many SSO sign-in attempts. "
                f"Please wait {headers['Retry-After']} seconds and try again."
            ),
            headers={
                **headers,
                # X-Error-Code lets a client distinguish this from the generic SSO
                # failures without matching on the message text. Nothing reads it
                # yet - the frontend consumer is SSO_ONLY_MODE_SPEC.md criterion 15.
                "X-Error-Code": "sso_rate_limited",
            },
        )

    try:
        result = await sso_service.get_authorization_url(return_url)
        return result
    except SSOConfigurationError as e:
        log_security_event(
            logger, "sso_config_error", request, "SSO configuration error", error=str(e)
        )
        raise HTTPException(status_code=400, detail="SSO configuration error")
    except Exception as e:
        log_endpoint_error(logger, request, "Failed to initiate SSO", e)
        raise HTTPException(
            status_code=500, detail="Failed to start SSO authentication"
        )


@router.post("/callback")
async def sso_callback(
    req: Request, request: SSOCallbackRequest, db: Session = Depends(deps.get_db)
):
    """Handle SSO callback and complete authentication

    Security Note: OAuth authorization codes are sent in POST body from frontend
    to prevent exposure in backend URL parameters, browser history, and server logs.
    The OAuth provider still redirects to the frontend GET route as per OAuth spec.
    """
    try:
        # Complete SSO authentication
        result = await sso_service.complete_authentication(
            request.code, request.state, db
        )

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
            result,
            req,
            db,
            log_event_name="sso_token_created",
            activity_description=f"User logged in via SSO: {result['user'].username}",
        )

    except SSORegistrationBlockedError as e:
        log_security_event(
            logger,
            "sso_registration_blocked",
            req,
            "SSO registration blocked",
            error=str(e),
        )
        raise HTTPException(
            status_code=403,
            detail="Registration is currently disabled. Please contact an administrator.",
        )
    except SSOAuthenticationError as e:
        log_security_event(
            logger,
            "sso_authentication_failed",
            req,
            "SSO authentication failed",
            error=str(e),
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_endpoint_error(logger, req, "Unexpected error in SSO callback", e)
        raise HTTPException(status_code=500, detail="SSO authentication failed")


@router.post("/resolve-conflict")
async def resolve_account_conflict(
    req: Request, request: SSOConflictRequest, db: Session = Depends(deps.get_db)
):
    """Resolve SSO account conflict based on user's choice"""
    try:
        result = sso_service.resolve_account_conflict(
            request.temp_token, request.action, request.preference, db
        )

        _check_user_active(result["user"], "sso_conflict_login_rejected_inactive", req)

        return _complete_sso_login(
            result,
            req,
            db,
            log_event_name="sso_conflict_resolved_token_created",
            activity_description=f"User logged in via SSO conflict resolution: {result['user'].username}",
        )

    except SSOAuthenticationError as e:
        log_security_event(
            logger,
            "sso_conflict_resolution_failed",
            req,
            "SSO conflict resolution failed",
            error=str(e),
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_endpoint_error(
            logger, req, "Unexpected error in SSO conflict resolution", e
        )
        raise HTTPException(status_code=500, detail="SSO conflict resolution failed")


@router.post("/resolve-github-link")
async def resolve_github_manual_link(
    req: Request, request: GitHubLinkRequest, db: Session = Depends(deps.get_db)
):
    """Resolve GitHub manual linking by verifying user credentials"""
    try:
        result = sso_service.resolve_github_manual_link(
            request.temp_token, request.username, request.password, db
        )

        _check_user_active(result["user"], "github_link_login_rejected_inactive", req)

        return _complete_sso_login(
            result,
            req,
            db,
            log_event_name="github_manual_link_token_created",
            activity_description=f"User logged in via GitHub linking: {result['user'].username}",
        )

    except SSOAuthenticationError as e:
        log_security_event(
            logger,
            "github_linking_failed",
            req,
            "GitHub manual linking failed",
            error=str(e),
            username=request.username,
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_endpoint_error(
            logger,
            req,
            "Unexpected error in GitHub manual linking",
            e,
            username=request.username,
        )
        raise HTTPException(status_code=500, detail="GitHub manual linking failed")


@router.post("/test-connection")
async def test_sso_connection(
    request: Request,
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Test SSO provider connection. Admin only.

    Each call makes the server perform an outbound token exchange against the
    configured IdP and can echo provider configuration detail, so it must not be
    reachable anonymously - the docstring always claimed admin use, but nothing
    enforced it.
    """
    try:
        result = await sso_service.test_connection()
        if result["success"]:
            log_endpoint_access(
                logger,
                request,
                None,
                "sso_test_connection_success",
                message=result["message"],
            )
        else:
            log_security_event(
                logger,
                "sso_test_connection_failed",
                request,
                result["message"],
            )
        return {"success": result["success"], "message": result["message"]}
    except Exception as e:
        log_endpoint_error(logger, request, "SSO connection test failed", e)
        return {"success": False, "message": "Connection test failed"}
