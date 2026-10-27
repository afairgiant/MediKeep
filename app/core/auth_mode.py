"""Auth-mode warnings: configurations that are legal but worth saying out loud.

Separate from validate_auth_mode_config(), which fails the boot. Nothing here ever
does. Lives outside config.py because some checks need the models, which config.py
cannot import without a cycle.
"""

from typing import Callable, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging.config import get_logger
from app.models.mfa import UserTotp
from app.models.user import User

logger = get_logger(__name__, "app")

Warning = tuple[str, str]

SEALED_INSTANCE_EVENT = "sso_only_no_registration_route"
SEALED_INSTANCE_MESSAGE = (
    "SSO_ONLY_MODE is enabled and user registration is disabled. No new user can "
    "be created by any self-service route; accounts must be created by an "
    "administrator. If this was not intended, enable registration or unset "
    "SSO_ONLY_MODE."
)

NO_LOCAL_PASSWORD_EVENT = "sso_only_no_local_password"
NO_LOCAL_PASSWORD_MESSAGE = (
    "SSO_ONLY_MODE is enabled and no account has a usable password. Unsetting the "
    "flag would leave a login form no account can answer, so recovery needs shell "
    "access to the host and app/scripts/create_emergency_admin.py. To restore the "
    "documented recovery path, give one administrator a local password."
)

TWO_FACTOR_OFF_EVENT = "two_factor_disabled_with_enrolled_users"
TWO_FACTOR_OFF_MESSAGE = (
    "TWO_FACTOR_ENABLED is false, so users who turned on two-factor authentication "
    "sign in with their password alone. Unset it once the reason for turning it off "
    "is resolved."
)

EPHEMERAL_KEY_EVENT = "two_factor_secret_key_ephemeral"
EPHEMERAL_KEY_MESSAGE = (
    "SECRET_KEY is not configured, and some users have two-factor authentication "
    "on. Their authenticator codes cannot be checked until the SECRET_KEY they "
    "enrolled under is restored; until then they must sign in with a backup code, or "
    "an administrator can reset their two-factor with app/scripts/reset_user_mfa.py."
)


def _has_two_factor_users(db: Session) -> bool:
    return (
        db.query(UserTotp.id).filter(UserTotp.enabled_at.isnot(None)).first()
        is not None
    )


def two_factor_off_warning(db: Optional[Session]) -> Optional[Warning]:
    """Return the kill-switch (event, message) pair while enrolled users exist."""
    if db is None or settings.TWO_FACTOR_ENABLED or not _has_two_factor_users(db):
        return None
    return (TWO_FACTOR_OFF_EVENT, TWO_FACTOR_OFF_MESSAGE)


def ephemeral_key_warning(db: Optional[Session]) -> Optional[Warning]:
    """Return the generated-SECRET_KEY (event, message) pair while enrolled users exist."""
    if (
        db is None
        or not settings.SECRET_KEY_IS_EPHEMERAL
        or not _has_two_factor_users(db)
    ):
        return None
    return (EPHEMERAL_KEY_EVENT, EPHEMERAL_KEY_MESSAGE)


def sealed_instance_warning(
    sso_only: bool, registration_enabled: bool
) -> Optional[Warning]:
    """Return the sealed-instance (event, message) pair, or None when not sealed.

    Takes its values as arguments so the admin registration toggle can ask about the
    state it is about to create.
    """
    if sso_only and not registration_enabled:
        return (SEALED_INSTANCE_EVENT, SEALED_INSTANCE_MESSAGE)
    return None


def _check_sealed_instance(_db: Optional[Session]) -> Optional[Warning]:
    return sealed_instance_warning(
        settings.SSO_ONLY_MODE, settings.ALLOW_USER_REGISTRATION
    )


def no_local_password_warning(db: Optional[Session]) -> Optional[Warning]:
    """Return the no-local-password (event, message) pair, or None when recoverable.

    Counts accounts, not sessions: a deactivated local admin still suppresses it.
    """
    if db is None or not settings.SSO_ONLY_MODE:
        return None

    has_local_account = (
        db.query(User.id).filter(User.has_usable_password).first() is not None
    )
    if has_local_account:
        return None

    return (NO_LOCAL_PASSWORD_EVENT, NO_LOCAL_PASSWORD_MESSAGE)


def warnings(db: Optional[Session] = None) -> list[Warning]:
    """Every auth-mode warning that currently applies, as (event, message) pairs.

    Call after persisted settings load - reads admin-overridable values. Checks
    needing a session return nothing when db is None.
    """
    # Resolved per call, not at import, so each check stays individually patchable.
    checks: tuple[Callable[[Optional[Session]], Optional[Warning]], ...] = (
        _check_sealed_instance,
        no_local_password_warning,
        two_factor_off_warning,
        ephemeral_key_warning,
    )

    found = []
    for check in checks:
        try:
            result = check(db)
        except Exception as e:
            # One failing check must not suppress the others, or fail the boot -
            # including via this handler, so the name is read defensively.
            name = getattr(check, "__name__", type(check).__name__)
            logger.warning(f"Auth-mode check {name} failed: {e}")
            continue
        if result:
            found.append(result)
    return found
