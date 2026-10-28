"""
Security-related domain events.

Events triggered by security-sensitive operations such as password changes,
authentication events, and access control modifications.
"""

from dataclasses import dataclass

from app.core.events.base import DomainEvent


@dataclass(frozen=True)
class PasswordChangedEvent(DomainEvent):
    """
    Event triggered when a user changes their password.

    Attributes:
        change_time: ISO 8601 formatted timestamp of when the password was changed
    """

    change_time: str = ""


@dataclass(frozen=True)
class TwoFactorDisabledEvent(DomainEvent):
    """Two-factor authentication was turned off for user_id, by them or by an administrator."""

    by_admin: bool = False


@dataclass(frozen=True)
class BackupCodeUsedEvent(DomainEvent):
    """A backup code was used to sign in as user_id."""

    codes_remaining: int = 0


@dataclass(frozen=True)
class SessionsRevokedEvent(DomainEvent):
    """Every other session of user_id was signed out."""


@dataclass(frozen=True)
class TwoFactorFailuresEvent(DomainEvent):
    """Enough wrong codes followed a correct password that the second step locked."""
