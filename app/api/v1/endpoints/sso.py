from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api import deps
from app.core.http.auth_codes import AuthErrorCode
from app.auth.sso.exceptions import *
from app.core.config import settings
from app.core.http.error_handling import MedicalRecordsAPIException
from app.core.logging.config import get_logger
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_security_event,
)
from app.core.utils.client_ip import get_client_ip
from app.core.utils.rate_limit import SlidingWindowRateLimiter
from app.core.utils.return_url import is_safe_return_url
from app.models.models import User
from app.services.auth_session import (
    complete_login,
    record_password_failure,
    require_active,
)
from app.services.login_throttle import login_throttle
from app.services.sso_service import SSOService

logger = get_logger(__name__, "sso")
router = APIRouter(prefix="/auth/sso", tags=["sso"])
sso_service = SSOService()

# Throttles the unauthenticated /initiate endpoint, which is what stops an
# anonymous caller from minting SSO state entries without bound. Keyed per IP.
#
# The limits are read from settings at import time, so patching
# settings.SSO_RATE_LIMIT_* has no effect on this instance. A test overrides
# max_requests / window_seconds on the object directly and calls reset() to clear
# counters - see the limiter_ceiling fixture in tests/api/conftest.py.
_initiate_limiter = SlidingWindowRateLimiter(
    max_requests=settings.SSO_RATE_LIMIT_ATTEMPTS,
    window_seconds=settings.SSO_RATE_LIMIT_WINDOW_MINUTES * 60,
)

# How much of a rejected return_url reaches the security log. Enough to identify
# what was attempted, short enough that an oversized value cannot pad the log.
_LOGGED_RETURN_URL_CHARS = 200


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


def _complete_sso_login(
    result: dict,
    req: Request,
    db: Session,
    log_event_name: str,
    activity_description: str,
) -> JSONResponse:
    """Finish an SSO login through the shared login completion, adding SSO body keys."""
    sso_user = result["user"]
    return complete_login(
        db,
        sso_user,
        req,
        method="sso",
        activity_description=activity_description,
        log_event_name=log_event_name,
        extra_body={
            "user": {
                "id": sso_user.id,
                "username": sso_user.username,
                "email": sso_user.email,
                "full_name": sso_user.full_name,
                "role": sso_user.role,
                "auth_method": sso_user.auth_method,
            },
            "is_new_user": result["is_new_user"],
            # Deep link carried through the state entry; no frontend reads it yet
            "return_url": result.get("return_url"),
        },
    )


@router.get("/config")
async def get_sso_config(request: Request):
    """Check if SSO is enabled and get configuration info for frontend

    `registration_enabled` reports the raw ALLOW_USER_REGISTRATION setting, which in
    this payload governs whether SSO may provision new accounts - something
    SSO_ONLY_MODE does not disable. The question "can someone register with a
    password" is answered by /auth/registration-status, which folds SSO_ONLY_MODE in.

    No try/except here on purpose. The body is four settings reads and cannot fail;
    the handler this used to carry synthesized `enabled: false, sso_only: false` on
    error, which under SSO_ONLY_MODE is the one answer that strands the user - the
    client hides the SSO button (SSO reported off) and shows a password form the
    server refuses. A 500 is better: the client cannot mistake it for "SSO is off"
    and shows its retry UI instead. Anything unexpected is handled by the global
    handler in app/core/http/error_handling.py.
    """
    return {
        "enabled": settings.SSO_ENABLED,
        "provider_type": settings.SSO_PROVIDER_TYPE if settings.SSO_ENABLED else None,
        "registration_enabled": settings.ALLOW_USER_REGISTRATION,
        "sso_only": settings.SSO_ONLY_MODE,
        "auto_redirect": settings.SSO_AUTO_REDIRECT,
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
        rejection = _initiate_limiter.too_many_requests(
            client_ip,
            "Too many SSO sign-in attempts.",
            AuthErrorCode.SSO_RATE_LIMITED,
        )
        log_security_event(
            logger,
            "sso_initiate_rate_limited",
            request,
            "Rate limit exceeded for SSO initiate endpoint",
            endpoint="/api/v1/auth/sso/initiate",
            retry_after_seconds=rejection.headers["Retry-After"],
        )
        raise rejection

    # Outside the try below on purpose: an HTTPException raised inside it is caught
    # by the broad handler and re-reported as a 500, which is the same defect this
    # PR fixes on the three login endpoints.
    #
    # After the rate limit, so a caller probing this burns its quota. The rejected
    # value is logged for the operator but deliberately not echoed in `detail` -
    # it is attacker-controlled text that a client would render. Truncated for the
    # same reason: the length cap lives inside is_safe_return_url and only decides
    # the rejection, so without this an oversized value would be written to the
    # security log in full.
    #
    # FastAPI binds a bare `?return_url=` to "", not None. That is "no deep link",
    # not a hostile value: rejecting it would lock out any client that appends the
    # parameter unconditionally, and under SSO_ONLY_MODE that client has no password
    # login to fall back to. Collapsed to None rather than merely skipped, so the
    # empty value is not stored and echoed back to the callback as "" where every
    # consumer expects a path or null. Matches safeInternalPath, which returns null
    # for an empty value rather than failing.
    if not return_url:
        return_url = None

    if return_url is not None and not is_safe_return_url(return_url):
        log_security_event(
            logger,
            "sso_return_url_rejected",
            request,
            "Rejected non-internal return_url on SSO initiate",
            endpoint="/api/v1/auth/sso/initiate",
            return_url=return_url[:_LOGGED_RETURN_URL_CHARS],
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid return URL",
            headers={"X-Error-Code": AuthErrorCode.SSO_INVALID_RETURN_URL},
        )

    try:
        result = await sso_service.get_authorization_url(return_url)
        return result
    except SSOConfigurationError as e:
        log_security_event(
            logger, "sso_config_error", request, "SSO configuration error", error=str(e)
        )
        raise HTTPException(
            status_code=400,
            detail="SSO configuration error",
            headers={"X-Error-Code": AuthErrorCode.SSO_CONFIGURATION_ERROR},
        )
    except (MedicalRecordsAPIException, HTTPException):
        # Same guard the three login endpoints carry. This endpoint has no typed
        # raise inside the try today - the return_url check sits above it precisely
        # so its 400 cannot be swallowed - but leaving the fourth broad handler
        # unguarded is what makes the next guard written inside it a silent 500.
        raise
    except Exception as e:
        log_endpoint_error(logger, request, "Failed to initiate SSO", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to start SSO authentication",
            headers={"X-Error-Code": AuthErrorCode.SSO_INITIATE_FAILED},
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

        require_active(
            db, req, result["user"], "sso_login_rejected_inactive", method="sso"
        )

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
            headers={
                "X-Error-Code": e.error_code or AuthErrorCode.REGISTRATION_DISABLED
            },
        )
    except SSOAuthenticationError as e:
        log_security_event(
            logger,
            "sso_authentication_failed",
            req,
            "SSO authentication failed",
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=e.message,
            headers={
                "X-Error-Code": e.error_code or AuthErrorCode.SSO_AUTHENTICATION_FAILED
            },
        )
    except (MedicalRecordsAPIException, HTTPException):
        # A typed response is a deliberate answer, not a failure. Without this the
        # broad handler below swallows it: require_active raises
        # UnauthorizedException from inside this try, so a deactivated user was
        # told "SSO authentication failed" with a 500 instead of being told their
        # account is deactivated. HTTPException is included so that any guard added
        # inside this try later does not silently become a 500 too.
        raise
    except Exception as e:
        log_endpoint_error(logger, req, "Unexpected error in SSO callback", e)
        raise HTTPException(
            status_code=500,
            detail="SSO authentication failed",
            headers={"X-Error-Code": AuthErrorCode.SSO_AUTHENTICATION_FAILED},
        )


@router.post("/resolve-conflict")
async def resolve_account_conflict(
    req: Request, request: SSOConflictRequest, db: Session = Depends(deps.get_db)
):
    """Resolve SSO account conflict based on user's choice"""
    try:
        result = sso_service.resolve_account_conflict(
            request.temp_token, request.action, request.preference, db
        )

        require_active(
            db,
            req,
            result["user"],
            "sso_conflict_login_rejected_inactive",
            method="sso",
        )

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
        raise HTTPException(
            status_code=400,
            detail=e.message,
            headers={
                "X-Error-Code": e.error_code or AuthErrorCode.SSO_AUTHENTICATION_FAILED
            },
        )
    except (MedicalRecordsAPIException, HTTPException):
        # See /callback - a deactivated user's 401 must not become a 500.
        raise
    except Exception as e:
        log_endpoint_error(
            logger, req, "Unexpected error in SSO conflict resolution", e
        )
        raise HTTPException(
            status_code=500,
            detail="SSO conflict resolution failed",
            headers={"X-Error-Code": AuthErrorCode.SSO_CONFLICT_RESOLUTION_FAILED},
        )


@router.post("/resolve-github-link")
async def resolve_github_manual_link(
    req: Request, request: GitHubLinkRequest, db: Session = Depends(deps.get_db)
):
    """Resolve GitHub manual linking by verifying user credentials

    Deliberately NOT gated on SSO_ONLY_MODE. It verifies a password, which makes it
    look like an alternative to SSO, but it is SSO flow machinery: every GitHub user
    whose email the provider does not expose is routed here, so under SSO-only this
    is their only route into the app.
    """
    login_throttle.reserve(req, request.username)
    try:
        try:
            result = sso_service.resolve_github_manual_link(
                request.temp_token, request.username, request.password, db
            )
        except Exception as e:
            # Only a wrong password keeps its slot in the failed-login count
            if getattr(e, "error_code", None) != AuthErrorCode.INVALID_CREDENTIALS:
                login_throttle.release(req, request.username)
            else:
                record_password_failure(db, req, request.username, method="sso")
            raise
        login_throttle.release(req, request.username)

        require_active(
            db, req, result["user"], "github_link_login_rejected_inactive", method="sso"
        )

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
        raise HTTPException(
            status_code=400,
            detail=e.message,
            headers={
                "X-Error-Code": e.error_code or AuthErrorCode.SSO_AUTHENTICATION_FAILED
            },
        )
    except (MedicalRecordsAPIException, HTTPException):
        # See /callback - a deactivated user's 401 must not become a 500.
        raise
    except Exception as e:
        log_endpoint_error(
            logger,
            req,
            "Unexpected error in GitHub manual linking",
            e,
            username=request.username,
        )
        raise HTTPException(
            status_code=500,
            detail="GitHub manual linking failed",
            headers={"X-Error-Code": AuthErrorCode.SSO_GITHUB_LINK_FAILED},
        )


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
