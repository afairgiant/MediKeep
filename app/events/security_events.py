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
