from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import (
    BusinessLogicException,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
)
from app.core.events import publish_from_thread
from app.core.http.auth_codes import AuthErrorCode
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_security_event
from app.core.utils.rate_limit import (
    LimitedKey,
    any_exhausted,
    failure_slots,
    reserve_all,
)
from app.core.utils.security import verify_password
from app.crud.user import user as user_crud
from app.events.security_events import (
    BackupCodeUsedEvent,
    TwoFactorDisabledEvent,
    TwoFactorFailuresEvent,
)
from app.models.activity_log import ActionType, LoginFailureReason
from app.models.models import User
from app.schemas.two_factor import (
    BackupCodesResponse,
    PasswordAndCodeRequest,
    TotpConfirmRequest,
    TotpSetupRequest,
    TotpSetupResponse,
    TwoFactorStatus,
    TwoFactorVerifyRequest,
)
from app.services import two_factor_service
from app.services.auth_session import (
    complete_login,
    finish_password_login,
    record_account_change,
    record_login_failure,
    reissue_session,
    require_active,
    require_password_login_allowed,
)
from app.services.two_factor_service import (
    CodeRejected,
    TotpSecretUnavailable,
    mfa_daily_limiter,
    mfa_verify_limiter,
    settings_check_limiter,
)

logger = get_logger(__name__, "security")

# Mounted at /auth/two-factor: the second sign-in step, before any session exists
auth_router = APIRouter()
# Mounted at /users/me: the signed-in user's own two-factor settings
account_router = APIRouter()

_CODE_REJECTED_MESSAGE = "That code is incorrect."
_CODE_REUSED = {
    two_factor_service.METHOD_TOTP: (
        "That code was already used. Wait for your authenticator app to show a new one.",
        AuthErrorCode.MFA_CODE_REUSED,
    ),
    two_factor_service.METHOD_BACKUP_CODE: (
        "That backup code was already used. Use a different one.",
        AuthErrorCode.MFA_BACKUP_CODE_REUSED,
    ),
}


def _code_refusal(rejected: CodeRejected) -> tuple[str, str]:
    """(message, error_code) for a rejected code, telling a reused one from a wrong one."""
    if rejected.replayed and rejected.method in _CODE_REUSED:
        return _CODE_REUSED[rejected.method]
    return _CODE_REJECTED_MESSAGE, AuthErrorCode.MFA_CODE_INVALID


def _attempts_left(limits: list[LimitedKey], ticket_left: Optional[int] = None) -> dict:
    """A refusal's data: tries left, and whether the last one ends in a wait or a new sign-in.

    Call after the failed attempt's slot is taken, so it is already counted.
    """
    until_lock = min(limiter.get_remaining_requests(key) for limiter, key in limits)
    if ticket_left is not None and ticket_left < until_lock:
        return {"attempts_remaining": ticket_left, "after_last": "sign_in_again"}
    return {"attempts_remaining": until_lock, "after_last": "wait"}


def _record_code_failure(
    db: Session,
    request: Request,
    user: User,
    rejected: CodeRejected,
    method: str,
    limits: list[LimitedKey],
) -> None:
    """Audit a refused sign-in code; when it used the last try, also the lockout and an alert."""
    reason = (
        LoginFailureReason.CODE_REUSED
        if rejected.replayed
        else LoginFailureReason.WRONG_CODE
    )
    user_id = user.id
    locked = any_exhausted(limits)
    record_login_failure(
        db, request, reason=reason, method=method, user=user, locked=locked
    )
    if locked:
        publish_from_thread(TwoFactorFailuresEvent(user_id=user_id))


def _ticket_invalid(request: Request) -> UnauthorizedException:
    log_security_event(
        logger, "mfa_ticket_invalid", request, "Unknown or expired two-factor ticket"
    )
    return UnauthorizedException(
        message="This sign-in has expired. Please sign in again.",
        request=request,
        error_code=AuthErrorCode.MFA_TICKET_INVALID,
    )


def _reserve(
    request: Request,
    user: User,
    limits: list[LimitedKey],
    *,
    event: str,
    message: str,
    error_code: str,
) -> None:
    """Take a slot under every limit, or raise 429 for the first one that is full."""
    full = reserve_all(limits)
    if full is None:
        return
    limiter, key = full
    rejection = limiter.too_many_requests(key, message, error_code)
    log_security_event(
        logger,
        event,
        request,
        f"{message} User: {user.username}",
        user_id=user.id,
        username=user.username,
        retry_after_seconds=rejection.headers["Retry-After"],
    )
    raise rejection


@auth_router.post("/verify")
def verify_second_factor(
    body: TwoFactorVerifyRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
):
    """Finish a password sign-in with an authenticator or backup code.

    Returns the same body and cookie as /auth/login, plus backup_codes_remaining
    after a backup code. A ticket allows a limited number of attempts.
    """
    entry = two_factor_service.take_ticket(body.mfa_ticket)
    if entry is None:
        raise _ticket_invalid(request)

    db_user = user_crud.get(db, id=entry.value.user_id)
    if db_user is None:
        raise _ticket_invalid(request)
    require_password_login_allowed(request, db_user.username)
    require_active(db, request, db_user, "login_rejected_inactive", method=body.method)
    if entry.value.session_version != db_user.session_version:
        raise _ticket_invalid(request)

    # The operator turned two-factor off between the two steps
    if not two_factor_service.is_required_at_login(db, db_user):
        return finish_password_login(db, db_user, request)

    limits = [(mfa_verify_limiter, db_user.id), (mfa_daily_limiter, db_user.id)]
    try:
        _reserve(
            request,
            db_user,
            limits,
            event="mfa_rate_limited",
            message="Too many incorrect codes.",
            error_code=AuthErrorCode.MFA_RATE_LIMITED,
        )
    except HTTPException:
        two_factor_service.return_ticket(body.mfa_ticket, entry, count_attempt=False)
        raise

    remaining: Optional[int] = None
    try:
        with failure_slots(limits, counted=(CodeRejected,)):
            if body.method == two_factor_service.METHOD_TOTP:
                two_factor_service.verify_totp(db, db_user, body.code)
            else:
                remaining = two_factor_service.verify_backup_code(
                    db, db_user, body.code
                )
    except TotpSecretUnavailable as e:
        two_factor_service.return_ticket(body.mfa_ticket, entry, count_attempt=False)
        log_security_event(
            logger,
            "mfa_secret_unavailable",
            request,
            f"Stored authenticator secret could not be decrypted for: {db_user.username}",
            user_id=db_user.id,
            username=db_user.username,
        )
        raise UnauthorizedException(
            message=(
                "Authenticator codes cannot be checked on this server right now. "
                "Use one of your backup codes."
            ),
            request=request,
            error_code=AuthErrorCode.MFA_SECRET_UNAVAILABLE,
        ) from e
    except CodeRejected as rejected:
        two_factor_service.return_ticket(body.mfa_ticket, entry, count_attempt=True)
        log_security_event(
            logger,
            "mfa_code_replayed" if rejected.replayed else "mfa_verify_failed",
            request,
            f"Second-factor code rejected for: {db_user.username}",
            user_id=db_user.id,
            username=db_user.username,
            method=body.method,
        )
        _record_code_failure(db, request, db_user, rejected, body.method, limits)
        message, error_code = _code_refusal(rejected)
        raise UnauthorizedException(
            message=message,
            request=request,
            error_code=error_code,
            data=_attempts_left(limits, two_factor_service.ticket_attempts_left(entry)),
        ) from rejected

    log_security_event(
        logger,
        "mfa_backup_code_used" if remaining is not None else "mfa_verify_success",
        request,
        f"Second factor verified for: {db_user.username}",
        user_id=db_user.id,
        username=db_user.username,
        method=body.method,
        backup_codes_remaining=remaining,
    )
    if remaining is not None:
        publish_from_thread(
            BackupCodeUsedEvent(user_id=db_user.id, codes_remaining=remaining)
        )

    return complete_login(
        db,
        db_user,
        request,
        method=body.method,
        activity_description=f"User logged in with two-factor: {db_user.username}",
        log_event_name="token_created",
        extra_body=(
            {"backup_codes_remaining": remaining} if remaining is not None else None
        ),
    )


def _reserve_settings_check(request: Request, user: User) -> None:
    _reserve(
        request,
        user,
        [(settings_check_limiter, user.id)],
        event="two_factor_settings_rate_limited",
        message="Too many failed attempts.",
        error_code=AuthErrorCode.TWO_FACTOR_RATE_LIMITED,
    )


def _reject_reauth(
    request: Request, user: User, what: str, *, message: str, error_code: str
) -> BusinessLogicException:
    log_security_event(
        logger,
        "two_factor_reauth_failed",
        request,
        f"Incorrect {what} on two-factor settings for: {user.username}",
        user_id=user.id,
        username=user.username,
    )
    # Not 401: the session is still valid, and clients end the session on a 401
    return BusinessLogicException(
        message=message,
        request=request,
        error_code=error_code,
        data=_attempts_left([(settings_check_limiter, user.id)]),
    )


def _reauthenticate(
    request: Request,
    db: Session,
    user: User,
    password: str,
    code: Optional[str] = None,
) -> None:
    """Check the password, and the code when given; failures count toward a limit."""
    _reserve_settings_check(request, user)
    with settings_check_limiter.failure_slot(
        user.id, counted=(BusinessLogicException,)
    ):
        if not verify_password(password, str(user.password_hash)):
            raise _reject_reauth(
                request,
                user,
                "password",
                message="Current password is incorrect",
                error_code=AuthErrorCode.CURRENT_PASSWORD_INCORRECT,
            )
        if code is None:
            return
        try:
            two_factor_service.verify_any_code(db, user, code)
        except CodeRejected as e:
            message, error_code = _code_refusal(e)
            raise _reject_reauth(
                request, user, "code", message=message, error_code=error_code
            ) from e


def _require_can_enroll(request: Request, db: Session, user: User) -> None:
    if two_factor_service.enrollment_blocked_reason(user) is not None:
        raise ForbiddenException(
            message="Two-factor authentication cannot be turned on for this account.",
            request=request,
            error_code=AuthErrorCode.TWO_FACTOR_ENROLLMENT_BLOCKED,
        )
    if two_factor_service.is_totp_enabled(db, user):
        raise ConflictException(
            message="Two-factor authentication is already turned on.",
            request=request,
            error_code=AuthErrorCode.TWO_FACTOR_ALREADY_ENABLED,
        )


def _require_enabled(request: Request, db: Session, user: User) -> None:
    if not two_factor_service.is_totp_enabled(db, user):
        raise ConflictException(
            message="Two-factor authentication is not turned on.",
            request=request,
            error_code=AuthErrorCode.TWO_FACTOR_NOT_ENABLED,
        )


@account_router.get("/two-factor", response_model=TwoFactorStatus)
def get_two_factor_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """The caller's two-factor state and whether they may turn it on."""
    return two_factor_service.status(db, current_user)


@account_router.post("/two-factor/totp/setup", response_model=TotpSetupResponse)
def start_totp_setup(
    body: TotpSetupRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a pending authenticator secret; nothing changes at sign-in until confirmed."""
    _require_can_enroll(request, db, current_user)
    _reauthenticate(request, db, current_user, body.current_password)

    secret, uri = two_factor_service.start_enrollment(db, current_user)
    log_security_event(
        logger,
        "totp_enrollment_started",
        request,
        f"Authenticator setup started: {current_user.username}",
        user_id=current_user.id,
        username=current_user.username,
    )
    return TotpSetupResponse(secret=secret, otpauth_uri=uri)


@account_router.post("/two-factor/totp/confirm", response_model=BackupCodesResponse)
def confirm_totp_setup(
    body: TotpConfirmRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Turn on two-factor with a code from the new authenticator; returns backup codes once.

    Signs out every other session; this one continues.
    """
    _require_can_enroll(request, db, current_user)
    if not two_factor_service.has_pending_enrollment(db, current_user):
        raise ConflictException(
            message="Start two-factor setup first.",
            request=request,
            error_code=AuthErrorCode.TWO_FACTOR_SETUP_NOT_STARTED,
        )

    _reserve_settings_check(request, current_user)
    try:
        with settings_check_limiter.failure_slot(
            current_user.id, counted=(CodeRejected,)
        ):
            codes = two_factor_service.confirm_enrollment(db, current_user, body.code)
    except TotpSecretUnavailable as e:
        raise ConflictException(
            message="Two-factor setup expired. Please start again.",
            request=request,
            error_code=AuthErrorCode.TWO_FACTOR_SETUP_NOT_STARTED,
        ) from e
    except CodeRejected as e:
        raise BusinessLogicException(
            message="That code is incorrect. Check the time on your device and try again.",
            request=request,
            error_code=AuthErrorCode.MFA_CODE_INVALID,
            data=_attempts_left([(settings_check_limiter, current_user.id)]),
        ) from e

    response = JSONResponse(
        content=BackupCodesResponse(backup_codes=codes).model_dump()
    )
    reissue_session(db, current_user, request, response)
    record_account_change(
        db,
        request,
        current_user,
        action=ActionType.TWO_FACTOR_ENABLED,
        event="totp_enabled",
        message="Two-factor authentication turned on",
    )
    return response


@account_router.post("/two-factor/disable")
def disable_two_factor(
    body: PasswordAndCodeRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Turn off two-factor. Signs out every other session; this one continues."""
    _require_enabled(request, db, current_user)
    _reauthenticate(request, db, current_user, body.current_password, body.code)

    two_factor_service.remove_all(db, current_user)
    response = JSONResponse(content={"message": "Two-factor authentication turned off"})
    reissue_session(db, current_user, request, response)
    record_account_change(
        db,
        request,
        current_user,
        action=ActionType.TWO_FACTOR_DISABLED,
        event="totp_disabled",
        message="Two-factor authentication turned off",
    )
    publish_from_thread(TwoFactorDisabledEvent(user_id=current_user.id))
    return response


@account_router.post(
    "/two-factor/backup-codes/regenerate", response_model=BackupCodesResponse
)
def regenerate_backup_codes(
    body: PasswordAndCodeRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Replace every backup code; the old ones stop working."""
    _require_enabled(request, db, current_user)
    _reauthenticate(request, db, current_user, body.current_password, body.code)

    codes = two_factor_service.regenerate_backup_codes(db, current_user)
    record_account_change(
        db,
        request,
        current_user,
        action=ActionType.BACKUP_CODES_REGENERATED,
        event="backup_codes_regenerated",
        message="Backup codes regenerated",
    )
    return BackupCodesResponse(backup_codes=codes)
