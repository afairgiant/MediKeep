"""
Collaboration-related domain events.

Events triggered by user collaboration actions including invitations,
sharing, and access management.
"""

from dataclasses import dataclass
from typing import Optional

from app.core.events.base import DomainEvent


@dataclass(frozen=True)
class InvitationReceivedEvent(DomainEvent):
    """
    Event triggered when a user receives an invitation.

    Attributes:
        from_user: Username or identifier of the user who sent the invitation
        invitation_type: Type of invitation (e.g., "patient_share", "collaboration")
        title: Title or description of what is being invited to
    """

    from_user: str = ""
    invitation_type: str = ""
    title: str = ""


@dataclass(frozen=True)
class InvitationAcceptedEvent(DomainEvent):
    """
    Event triggered when a user accepts an invitation.

    Attributes:
        by_user: Username or identifier of the user who accepted
        invitation_type: Type of invitation that was accepted
        title: Title or description of what was accepted
    """

    by_user: str = ""
    invitation_type: str = ""
    title: str = ""


@dataclass(frozen=True)
class ShareRevokedEvent(DomainEvent):
    """
    Event triggered when sharing access is revoked.

    Attributes:
        by_user: Username or identifier of the user who revoked access
        patient_name: Optional name of the patient whose access was revoked
    """

    by_user: str = ""
    patient_name: Optional[str] = None
