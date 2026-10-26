from datetime import timedelta
from typing import Any, Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.activity_logging import safe_log_activity
from app.core.config import settings
from app.core.http.auth_codes import AuthErrorCode
from app.core.http.error_handling import ForbiddenException, UnauthorizedException
from app.core.logging.config import get_logger
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_security_event,
)
from app.core.utils.cookie_auth import set_auth_cookie
from app.core.utils.security import ACCESS_TOKEN_TYPE, create_access_token
from app.crud.user import user as user_crud
from app.crud.user_preferences import user_preferences
from app.models.activity_log import ActionType, EntityType
from app.models.base import get_utc_now
from app.models.models import User
from app.services import two_factor_service
from app.services.patient_management import PatientManagementService

logger = get_logger(__name__, "app")

_TOKEN_ROLES = ("admin", "user", "guest")


def _session_timing(db: Session, user: User) -> tuple[int, int]:
    preferences = user_preferences.get_or_create_by_user_id(db, user_id=user.id)
    session_timeout_minutes = (
        preferences.session_timeout_minutes
        if preferences
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    # The cookie must outlive the frontend inactivity timer, or the user gets a hard 401
    jwt_lifetime = max(settings.ACCESS_TOKEN_EXPIRE_MINUTES, session_timeout_minutes)
    return session_timeout_minutes, jwt_lifetime


def _issue_access_token(user: User, lifetime_minutes: int) -> str:
    return create_access_token(
        data={
            "sub": user.username,
            "role": user.role if user.role in _TOKEN_ROLES else "user",
            "user_id": user.id,
            "full_name": user.full_name or user.username,
            "typ": ACCESS_TOKEN_TYPE,
            "sv": user.session_version,
        },
        expires_delta=timedelta(minutes=lifetime_minutes),
    )


def require_password_login_allowed(request: Request, username: str) -> None:
    """Raise 403 under SSO_ONLY_MODE, the server-side boundary for password sign-in."""
    if not settings.SSO_ONLY_MODE:
        return
    log_security_event(
        logger,
        "password_login_blocked_sso_only",
        request,
        f"Password login blocked - SSO-only mode. Username: {username}",
        username=username,
    )
    raise ForbiddenException(
        message=(
            "Password sign-in is disabled on this instance. Please sign in "
            "with your identity provider."
        ),
        request=request,
        error_code=AuthErrorCode.SSO_ONLY_PASSWORD_LOGIN_DISABLED,
    )


def require_active(request: Request, user: User, event: str) -> None:
    """Raise 401 account_deactivated, logging event, when the account is inactive."""
    if user.is_active:
        return
    log_security_event(
        logger,
        event,
        request,
        f"Login rejected for inactive user: {user.username}",
        user_id=user.id,
        username=user.username,
    )
    raise UnauthorizedException(
        message="This account has been deactivated. Please contact an administrator.",
        request=request,
        error_code=AuthErrorCode.ACCOUNT_DEACTIVATED,
    )


def record_account_change(
    db: Session,
    request: Request,
    user: User,
    *,
    action: str,
    event: str,
    message: str,
) -> None:
    """Write the activity entry and the security log entry for a change to user."""
    safe_log_activity(
        db=db,
        action=action,
        entity_type=EntityType.USER,
        entity_obj=user,
        user_id=user.id,
        description=f"{message}: {user.username}",
        request=request,
    )
    log_security_event(
        logger,
        event,
        request,
        f"{message}: {user.username}",
        user_id=user.id,
        username=user.username,
    )


def end_other_sessions(
    db: Session, user: User, request: Request, response: Response
) -> None:
    """End every session of user and set a fresh cookie on response for this one."""
    user_crud.commit_ending_sessions(db, user)
    reissue_session(db, user, request, response)


def reissue_session(
    db: Session, user: User, request: Request, response: Response
) -> None:
    """Set a fresh session cookie on response, after the user's sessions were ended.

    Call after the session_version change is committed. Never raises: the change is
    already saved, so on failure the caller still succeeds and the user signs in again.
    """
    try:
        _, jwt_lifetime = _session_timing(db, user)
        set_auth_cookie(
            response,
            _issue_access_token(user, jwt_lifetime),
            max_age_minutes=jwt_lifetime,
        )
    except Exception as e:
        db.rollback()
        log_endpoint_error(
            logger, request, "Failed to reissue session", e, user_id=user.id
        )


def complete_login(
    db: Session,
    user: User,
    request: Request,
    *,
    method: str,
    activity_description: str,
    log_event_name: str,
    extra_body: Optional[dict[str, Any]] = None,
) -> JSONResponse:
    """Finish an authenticated login: record it, then return the token body and cookie.

    The caller must already have verified the user's credentials and is_active.

    Args:
        method: how the user authenticated, stored on the LOGIN activity entry.
        extra_body: keys added to the standard response body.

    Clears must_change_password on an account with no usable password, which could
    never complete the change. If that commit fails the login fails instead.
    """
    if not user.active_patient_id:
        try:
            PatientManagementService(db).ensure_active_patient(user)
        except (SQLAlchemyError, ValueError) as e:
            db.rollback()
            log_endpoint_error(
                logger,
                request,
                "Failed to set active patient during login",
                e,
                user_id=user.id,
            )

    safe_log_activity(
        db=db,
        action=ActionType.LOGIN,
        entity_type=EntityType.USER,
        entity_obj=user,
        user_id=user.id,
        description=activity_description,
        metadata={"method": method},
        request=request,
    )

    clear_forced_change = (
        bool(user.must_change_password) and not user.has_usable_password
    )
    try:
        user.last_login_at = get_utc_now()
        if clear_forced_change:
            user.must_change_password = False
        db.commit()
    except Exception as e:
        db.rollback()
        if clear_forced_change:
            log_endpoint_error(
                logger,
                request,
                "Failed to clear forced password change during login",
                e,
                user_id=user.id,
            )
            raise
        # A failed last_login_at update alone is not worth failing a login over

    if clear_forced_change:
        log_security_event(
            logger,
            "sso_forced_password_change_cleared",
            request,
            "Cleared unsatisfiable forced password change for SSO-only user",
            user_id=user.id,
            username=user.username,
            auth_method=user.auth_method,
        )

    session_timeout_minutes, jwt_lifetime = _session_timing(db, user)
    access_token = _issue_access_token(user, jwt_lifetime)

    log_endpoint_access(
        logger,
        request,
        user.id,
        log_event_name,
        message=f"JWT token created with {jwt_lifetime} minute expiration",
        username=user.username,
        login_method=method,
        jwt_expiry_minutes=jwt_lifetime,
        inactivity_timeout_minutes=session_timeout_minutes,
    )

    body = {
        "access_token": access_token,
        "token_type": "bearer",
        "session_timeout_minutes": session_timeout_minutes,
        "must_change_password": bool(user.must_change_password),
        **(extra_body or {}),
    }
    response = JSONResponse(content=body)
    set_auth_cookie(response, access_token, max_age_minutes=jwt_lifetime)
    return response


def finish_password_login(db: Session, user: User, request: Request) -> JSONResponse:
    """Complete a verified password sign-in, or start the second step when one is due.

    The caller must already have verified the password and is_active.
    """
    if two_factor_service.is_required_at_login(db, user):
        log_security_event(
            logger,
            "login_password_verified_mfa_required",
            request,
            f"Password verified, second factor required for: {user.username}",
            user_id=user.id,
            username=user.username,
        )
        return JSONResponse(content=two_factor_service.issue_challenge(user))

    response = complete_login(
        db,
        user,
        request,
        method="password",
        activity_description=f"User logged in: {user.username}",
        log_event_name="token_created",
    )
    log_endpoint_access(
        logger,
        request,
        user.id,
        "login_success",
        message=f"Login successful for username: {user.username}",
        username=user.username,
    )
    return response
