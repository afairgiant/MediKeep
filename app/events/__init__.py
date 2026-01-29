"""
Domain events for MediKeep notification system.

This module contains all domain event classes that represent significant
occurrences in the application. Events are used to trigger notifications
and maintain system state consistency.

Event Categories:
    - Backup Events: Backup completion and failure events
    - Collaboration Events: Invitation and sharing events
    - Security Events: Password changes and security-related events

All events inherit from DomainEvent and include:
    - event_id: Unique identifier for the event
    - occurred_at: Timestamp when the event occurred
    - user_id: ID of the user associated with the event
"""

from app.events.backup_events import BackupCompletedEvent, BackupFailedEvent
from app.events.collaboration_events import (
    InvitationAcceptedEvent,
    InvitationReceivedEvent,
    ShareRevokedEvent,
)
from app.events.security_events import PasswordChangedEvent

__all__ = [
    # Backup Events
    "BackupCompletedEvent",
    "BackupFailedEvent",
    # Collaboration Events
    "InvitationReceivedEvent",
    "InvitationAcceptedEvent",
    "ShareRevokedEvent",
    # Security Events
    "PasswordChangedEvent",
]
