"""Remembered browsers that may skip the second sign-in step for a while."""

import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import Request, Response
from sqlalchemy import and_
from sqlalchemy.orm import Query, Session

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import sanitize_log_input
from app.core.logging.helpers import log_endpoint_error, log_security_event
from app.core.utils.cookie_auth import set_cookie
from app.models.base import get_utc_now
from app.models.mfa import TrustedDevice
from app.models.models import User

logger = get_logger(__name__, "security")

_USER_AGENT_MAX_LENGTH = 255


def cookie_name(user: User) -> str:
    """The device cookie for user; one per user, so people sharing a browser keep theirs."""
    return f"{settings.TRUSTED_DEVICE_COOKIE_NAME}_{user.id}"


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _window() -> timedelta:
    return timedelta(days=settings.TWO_FACTOR_REMEMBER_DAYS)


def expires_at(device: TrustedDevice) -> datetime:
    """When trust in device ends, counting a TWO_FACTOR_REMEMBER_DAYS shortened since."""
    return min(device.expires_at, device.created_at + _window())


def _live_condition(user: User):
    now = get_utc_now()
    return and_(
        TrustedDevice.session_version == user.session_version,
        TrustedDevice.expires_at > now,
        TrustedDevice.created_at > now - _window(),
    )


def _live(db: Session, user: User) -> Query:
    return db.query(TrustedDevice).filter(
        TrustedDevice.user_id == user.id, _live_condition(user)
    )


def _delete_dead(db: Session, user: User) -> None:
    db.query(TrustedDevice).filter(
        TrustedDevice.user_id == user.id,
        ~_live_condition(user),
    ).delete(synchronize_session=False)


def is_trusted(db: Session, user: User, request: Request) -> bool:
    """Whether the request carries a live device cookie remembered for user.

    Records the use on the device for the caller to commit. Always False while
    remembering is turned off.
    """
    token = request.cookies.get(cookie_name(user))
    if not token or settings.TWO_FACTOR_REMEMBER_DAYS == 0:
        return False
    device = _live(db, user).filter(TrustedDevice.token_hash == _hash(token)).first()
    if device is None:
        return False
    device.last_used_at = get_utc_now()
    return True


def remember(db: Session, user: User, request: Request, response: Response) -> None:
    """Trust this browser for TWO_FACTOR_REMEMBER_DAYS and set its cookie on response.

    Call after the second factor was verified. Never raises: on failure the sign-in
    still succeeds and the next one asks for a code.
    """
    window = _window()
    token = secrets.token_urlsafe(32)
    raw_user_agent = request.headers.get("user-agent")
    user_agent = (
        sanitize_log_input(raw_user_agent, max_length=_USER_AGENT_MAX_LENGTH)
        if raw_user_agent
        else None
    )
    try:
        _delete_dead(db, user)
        # This browser's earlier device for the same user is replaced, not duplicated
        previous = request.cookies.get(cookie_name(user))
        if previous:
            db.query(TrustedDevice).filter(
                TrustedDevice.user_id == user.id,
                TrustedDevice.token_hash == _hash(previous),
            ).delete(synchronize_session=False)
        db.add(
            TrustedDevice(
                user_id=user.id,
                token_hash=_hash(token),
                user_agent=user_agent,
                session_version=user.session_version,
                expires_at=get_utc_now() + window,
            )
        )
        db.commit()
    except Exception as e:
        db.rollback()
        log_endpoint_error(
            logger, request, "Failed to remember device", e, user_id=user.id
        )
        return

    # Scoped like the session cookie, so it also reaches the API behind a sub-path proxy
    set_cookie(response, cookie_name(user), token, int(window.total_seconds()))
    log_security_event(
        logger,
        "trusted_device_added",
        request,
        f"Device remembered for: {user.username}",
        user_id=user.id,
        username=user.username,
    )


def list_devices(db: Session, user: User) -> list[TrustedDevice]:
    """The user's live remembered devices, most recently used first."""
    return (
        _live(db, user)
        .order_by(
            TrustedDevice.last_used_at.desc().nullslast(),
            TrustedDevice.created_at.desc(),
        )
        .all()
    )


def forget(db: Session, user: User, device_id: int) -> bool:
    """Stop trusting one of the user's devices; False if it is not theirs."""
    deleted = (
        db.query(TrustedDevice)
        .filter(TrustedDevice.id == device_id, TrustedDevice.user_id == user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted == 1


def forget_all(db: Session, user: User) -> None:
    """Stop trusting every device of the user. Does not commit."""
    db.query(TrustedDevice).filter(TrustedDevice.user_id == user.id).delete(
        synchronize_session=False
    )
