"""TOTP two-factor authentication: enrollment, code checks, backup codes, sign-in tickets."""

import hmac
import re
import secrets
import time
from dataclasses import dataclass
from typing import List, Optional

import bcrypt
import pyotp
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils.ephemeral_store import EphemeralStore, StoredEntry
from app.core.utils.rate_limit import SlidingWindowRateLimiter
from app.core.utils.security import verify_password
from app.crud.user import user as user_crud
from app.models.base import get_utc_now
from app.models.mfa import UserBackupCode, UserTotp
from app.models.models import User
from app.schemas.two_factor import MfaChallenge
from app.services.credential_encryption import (
    SecurityError,
    mfa_credential_encryption,
)

TOTP_STEP_SECONDS = 30
TOTP_DIGITS = 6
# Steps either side of now that still count, for clock drift between phone and server
TOTP_VALID_WINDOW = 1

BACKUP_CODE_COUNT = 10
BACKUP_CODE_GROUP = 4
BACKUP_CODE_BCRYPT_ROUNDS = 10
# Crockford base32: no I, L, O or U, so a code read aloud or retyped is unambiguous
_CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_CROCKFORD_ALIASES = str.maketrans({"I": "1", "L": "1", "O": "0"})

MFA_TICKET_TTL_SECONDS = 300
MFA_TICKET_MAX_ATTEMPTS = 5

METHOD_TOTP = "totp"
METHOD_BACKUP_CODE = "backup_code"
METHODS = (METHOD_TOTP, METHOD_BACKUP_CODE)


class BlockedReason:
    """Why a user may not turn on two-factor authentication right now."""

    DISABLED_BY_OPERATOR = "disabled_by_operator"
    SSO_ONLY_MODE = "sso_only_mode"
    SSO_ACCOUNT = "sso_account"
    SECRET_KEY_NOT_CONFIGURED = "secret_key_not_configured"


class TotpSecretUnavailable(Exception):
    """The stored secret cannot be decrypted, usually because SECRET_KEY changed."""


class CodeRejected(Exception):
    """A submitted code was wrong, or was already used."""

    def __init__(self, replayed: bool = False):
        super().__init__("code rejected")
        self.replayed = replayed


@dataclass
class MfaTicket:
    user_id: int
    # Sessions ended between the two steps also end the half-finished sign-in
    session_version: int
    attempts: int = 0


# Holds the password-verified, not yet second-factor-verified sign-ins, one per user
mfa_tickets = EphemeralStore(ttl_seconds=MFA_TICKET_TTL_SECONDS, max_entries=10000)
# Failed second-factor checks per user, across tickets
mfa_verify_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=900)
# Caps guessing by someone who has the password at a few percent a year
mfa_daily_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=86400)
# Failed password or code checks on the two-factor settings endpoints, per user
settings_check_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=900)


def reset_state() -> None:
    """Discard tickets and limiter counts. For tests."""
    mfa_tickets.reset()
    mfa_verify_limiter.reset()
    mfa_daily_limiter.reset()
    settings_check_limiter.reset()


def _get_totp(db: Session, user: User) -> Optional[UserTotp]:
    return db.query(UserTotp).filter(UserTotp.user_id == user.id).first()


def is_totp_enabled(db: Session, user: User) -> bool:
    totp = _get_totp(db, user)
    return totp is not None and totp.enabled_at is not None


def is_required_at_login(db: Session, user: User) -> bool:
    """Whether a password sign-in must be followed by a second factor."""
    return settings.TWO_FACTOR_ENABLED and is_totp_enabled(db, user)


def enrollment_blocked_reason(user: User) -> Optional[str]:
    if not settings.TWO_FACTOR_ENABLED:
        return BlockedReason.DISABLED_BY_OPERATOR
    if settings.SSO_ONLY_MODE:
        return BlockedReason.SSO_ONLY_MODE
    if not user.has_usable_password:
        return BlockedReason.SSO_ACCOUNT
    # A generated key changes on restart, which would make every secret unreadable
    if settings.SECRET_KEY_IS_EPHEMERAL:
        return BlockedReason.SECRET_KEY_NOT_CONFIGURED
    return None


def backup_codes_remaining(db: Session, user: User) -> int:
    return (
        db.query(UserBackupCode)
        .filter(UserBackupCode.user_id == user.id, UserBackupCode.used_at.is_(None))
        .count()
    )


def status(db: Session, user: User) -> dict:
    reason = enrollment_blocked_reason(user)
    return {
        "totp_enabled": is_totp_enabled(db, user),
        "backup_codes_remaining": backup_codes_remaining(db, user),
        "enrollment_allowed": reason is None,
        "blocked_reason": reason,
    }


def start_enrollment(db: Session, user: User) -> tuple[str, str]:
    """Create a pending secret, replacing any earlier pending one.

    Returns (secret, otpauth_uri). Caller checks enrollment_blocked_reason and that
    TOTP is not already enabled.
    """
    secret = pyotp.random_base32()
    encrypted = mfa_credential_encryption.encrypt_token(secret)
    totp = _get_totp(db, user)
    if totp is None:
        db.add(UserTotp(user_id=user.id, secret_encrypted=encrypted))
    else:
        totp.secret_encrypted = encrypted
        totp.enabled_at = None
        totp.last_used_step = None
    db.commit()

    uri = pyotp.TOTP(secret).provisioning_uri(
        name=user.username, issuer_name=settings.TOTP_ISSUER
    )
    return secret, uri


def has_pending_enrollment(db: Session, user: User) -> bool:
    totp = _get_totp(db, user)
    return totp is not None and totp.enabled_at is None


def confirm_enrollment(
    db: Session, user: User, code: str, now: Optional[float] = None
) -> List[str]:
    """Turn on TOTP once the user proves their app works; return new backup codes.

    Ends every session of the user in the same commit. Raises CodeRejected or
    TotpSecretUnavailable. Caller checks a pending secret exists.
    """
    totp = _get_totp(db, user)
    step = _matching_step(_decrypt_secret(totp), code, now)
    if step is None:
        raise CodeRejected()

    totp.enabled_at = get_utc_now()
    # The confirming code must not also work for the next sign-in
    totp.last_used_step = step
    codes = _replace_backup_codes(db, user)
    user_crud.commit_ending_sessions(db, user)
    return codes


def verify_totp(
    db: Session, user: User, code: str, now: Optional[float] = None
) -> None:
    """Accept a current authenticator code once.

    Raises CodeRejected (wrong or reused) or TotpSecretUnavailable.
    """
    totp = _get_totp(db, user)
    if totp is None or totp.enabled_at is None:
        raise CodeRejected()

    step = _matching_step(_decrypt_secret(totp), code, now)
    if step is None:
        raise CodeRejected()

    # Conditional so two requests with the same code cannot both pass
    claimed = (
        db.query(UserTotp)
        .filter(
            UserTotp.id == totp.id,
            (UserTotp.last_used_step.is_(None)) | (UserTotp.last_used_step < step),
        )
        .update({UserTotp.last_used_step: step}, synchronize_session=False)
    )
    db.commit()
    if claimed != 1:
        raise CodeRejected(replayed=True)


def verify_backup_code(db: Session, user: User, code: str) -> int:
    """Use up one backup code. Returns how many are left; raises CodeRejected."""
    normalized = normalize_backup_code(code)
    if len(normalized) != BACKUP_CODE_GROUP * 2:
        raise CodeRejected()

    unused = (
        db.query(UserBackupCode)
        .filter(UserBackupCode.user_id == user.id, UserBackupCode.used_at.is_(None))
        .all()
    )
    for candidate in unused:
        if not verify_password(normalized, candidate.code_hash):
            continue
        claimed = (
            db.query(UserBackupCode)
            .filter(UserBackupCode.id == candidate.id, UserBackupCode.used_at.is_(None))
            .update({UserBackupCode.used_at: get_utc_now()}, synchronize_session=False)
        )
        db.commit()
        if claimed != 1:
            raise CodeRejected(replayed=True)
        return backup_codes_remaining(db, user)

    raise CodeRejected()


def verify_any_code(db: Session, user: User, code: str) -> None:
    """Accept either an authenticator code or a backup code; raises CodeRejected."""
    if _totp_digits(code) is None:
        verify_backup_code(db, user, code)
        return
    try:
        verify_totp(db, user, code)
    except TotpSecretUnavailable as e:
        raise CodeRejected() from e


def regenerate_backup_codes(db: Session, user: User) -> List[str]:
    codes = _replace_backup_codes(db, user)
    db.commit()
    return codes


def remove_all(db: Session, user: User) -> bool:
    """Delete the user's TOTP secret and backup codes; returns whether TOTP was on.

    Ends every session of the user in the same commit.
    """
    was_enabled = is_totp_enabled(db, user)
    db.query(UserBackupCode).filter(UserBackupCode.user_id == user.id).delete(
        synchronize_session=False
    )
    db.query(UserTotp).filter(UserTotp.user_id == user.id).delete(
        synchronize_session=False
    )
    user_crud.commit_ending_sessions(db, user)
    return was_enabled


def normalize_backup_code(code: str) -> str:
    return re.sub(r"[\s-]", "", code or "").upper().translate(_CROCKFORD_ALIASES)


def issue_challenge(user: User) -> dict:
    """Start the second sign-in step; returns the /auth/login body that asks for it.

    The ticket in it is useless for anything but /auth/two-factor/verify, and
    replaces any earlier ticket of the same user.
    """
    ticket = MfaTicket(user_id=user.id, session_version=user.session_version)
    return MfaChallenge(
        mfa_ticket=mfa_tickets.put(ticket, owner=user.id),
        methods=list(METHODS),
        expires_in=MFA_TICKET_TTL_SECONDS,
    ).model_dump()


def take_ticket(token: str) -> Optional[StoredEntry]:
    """Hold the ticket for one verification attempt; None if unknown or expired."""
    return mfa_tickets.take(token)


def return_ticket(token: str, entry: StoredEntry, count_attempt: bool) -> None:
    """Give a ticket back after a failed attempt, unless it has run out of attempts."""
    if count_attempt:
        entry.value.attempts += 1
    if entry.value.attempts < MFA_TICKET_MAX_ATTEMPTS:
        mfa_tickets.put_back(token, entry)


def _decrypt_secret(totp: UserTotp) -> str:
    try:
        return mfa_credential_encryption.decrypt_token(totp.secret_encrypted)
    except SecurityError as e:
        raise TotpSecretUnavailable() from e


def _totp_digits(code: str) -> Optional[str]:
    """The code without spaces if it is shaped like an authenticator code, else None."""
    candidate = re.sub(r"\s", "", code or "")
    # Not \d, which also matches non-ASCII digits that compare_digest refuses
    return candidate if re.fullmatch(rf"[0-9]{{{TOTP_DIGITS}}}", candidate) else None


def _matching_step(secret: str, code: str, now: Optional[float]) -> Optional[int]:
    candidate = _totp_digits(code)
    if candidate is None:
        return None

    totp = pyotp.TOTP(secret, digits=TOTP_DIGITS, interval=TOTP_STEP_SECONDS)
    current = int((time.time() if now is None else now) // TOTP_STEP_SECONDS)
    for step in range(current - TOTP_VALID_WINDOW, current + TOTP_VALID_WINDOW + 1):
        if hmac.compare_digest(totp.generate_otp(step), candidate):
            return step
    return None


def _new_backup_code() -> str:
    chars = "".join(
        secrets.choice(_CROCKFORD_ALPHABET) for _ in range(BACKUP_CODE_GROUP * 2)
    )
    return f"{chars[:BACKUP_CODE_GROUP]}-{chars[BACKUP_CODE_GROUP:]}"


def _replace_backup_codes(db: Session, user: User) -> List[str]:
    """Swap the user's backup codes for fresh ones. Does not commit."""
    db.query(UserBackupCode).filter(UserBackupCode.user_id == user.id).delete(
        synchronize_session=False
    )
    codes = [_new_backup_code() for _ in range(BACKUP_CODE_COUNT)]
    for code in codes:
        code_hash = bcrypt.hashpw(
            normalize_backup_code(code).encode(),
            bcrypt.gensalt(rounds=BACKUP_CODE_BCRYPT_ROUNDS),
        ).decode()
        db.add(UserBackupCode(user_id=user.id, code_hash=code_hash))
    return codes
