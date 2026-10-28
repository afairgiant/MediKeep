"""
Core events module.

This module provides the base infrastructure for domain events, including
the event bus for publish-subscribe patterns and the event registry for
metadata and notification templates.
"""

from app.core.events.base import DomainEvent
from app.core.events.bus import EventBus, get_event_bus, publish_from_thread
from app.core.events.registry import EventMetadata, EventRegistry, get_event_registry
from app.services.notification_templates import (
    backup_code_used_template,
    backup_completed_template,
    backup_failed_template,
    invitation_accepted_template,
    invitation_received_template,
    medication_reminder_due_template,
    password_changed_template,
    sessions_revoked_template,
    share_revoked_template,
    two_factor_disabled_template,
    two_factor_failures_template,
)


def register_all_events() -> None:
    """
    Register all notification event types with the event registry.

    This function registers every notification trigger with its metadata
    and template function. Should be called once during application startup.
    """
    registry = get_event_registry()

    # System events
    registry.register(
        event_type="backup_completed",
        label="Backup Completed",
        description="Notification when a backup completes successfully",
        category="system",
        template_fn=backup_completed_template,
        is_implemented=True,
    )

    registry.register(
        event_type="backup_failed",
        label="Backup Failed",
        description="Notification when a backup fails",
        category="system",
        template_fn=backup_failed_template,
        is_implemented=True,
    )

    # Collaboration events
    registry.register(
        event_type="invitation_received",
        label="Invitation Received",
        description="Notification when you receive a sharing invitation",
        category="collaboration",
        template_fn=invitation_received_template,
        is_implemented=True,
    )

    registry.register(
        event_type="invitation_accepted",
        label="Invitation Accepted",
        description="Notification when someone accepts your invitation",
        category="collaboration",
        template_fn=invitation_accepted_template,
        is_implemented=True,
    )

    registry.register(
        event_type="share_revoked",
        label="Share Revoked",
        description="Notification when access to shared records is revoked",
        category="collaboration",
        template_fn=share_revoked_template,
        is_implemented=True,
    )

    # Security events
    registry.register(
        event_type="password_changed",
        label="Password Changed",
        description="Confirmation when your password is changed",
        category="security",
        template_fn=password_changed_template,
        is_implemented=True,
    )

    registry.register(
        event_type="two_factor_disabled",
        label="Two-Factor Turned Off",
        description="When two-factor authentication is turned off for your account",
        category="security",
        template_fn=two_factor_disabled_template,
        is_implemented=True,
    )

    registry.register(
        event_type="backup_code_used",
        label="Backup Code Used",
        description="When a backup code is used to sign in to your account",
        category="security",
        template_fn=backup_code_used_template,
        is_implemented=True,
    )

    registry.register(
        event_type="sessions_revoked",
        label="Other Devices Signed Out",
        description="When your other devices are signed out",
        category="security",
        template_fn=sessions_revoked_template,
        is_implemented=True,
    )

    registry.register(
        event_type="two_factor_failures",
        label="Repeated Incorrect Two-Factor Codes",
        description="When your password is used but too many two-factor codes are wrong",
        category="security",
        template_fn=two_factor_failures_template,
        is_implemented=True,
    )

    # Medical events
    registry.register(
        event_type="medication_reminder_due",
        label="Medication Reminder",
        description="Notification when it is time to take a scheduled medication",
        category="medical",
        template_fn=medication_reminder_due_template,
        is_implemented=True,
    )


def setup_event_system() -> EventBus:
    """
    Set up the event system on application startup.

    This function:
    1. Registers all event types with the event registry
    2. Returns the event bus for handler subscription

    Returns:
        EventBus: The event bus singleton for handler registration

    Example:
        >>> event_bus = setup_event_system()
        >>> event_bus.subscribe("backup_completed", my_handler)
    """
    register_all_events()
    return get_event_bus()


__all__ = [
    "DomainEvent",
    "EventBus",
    "get_event_bus",
    "publish_from_thread",
    "EventRegistry",
    "EventMetadata",
    "get_event_registry",
    "register_all_events",
    "setup_event_system",
]
