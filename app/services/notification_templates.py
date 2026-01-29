"""
Notification message templates for the notification framework.

This module provides standalone template functions for different notification types.
Each function takes event data and returns a (title, message) tuple.
"""

from datetime import datetime
from typing import Dict, Tuple


def backup_completed_template(data: Dict) -> Tuple[str, str]:
    """
    Template for successful backup completion.

    Args:
        data: Event data containing:
            - filename: Name of the backup file
            - size_mb: Size of the backup in MB
            - backup_type: Type of backup (e.g., "automatic", "manual")

    Returns:
        Tuple of (title, message) for the notification
    """
    filename = data.get("filename", "backup")
    size_mb = data.get("size_mb", "unknown")
    backup_type = data.get("backup_type", "backup")

    return (
        "Backup Completed Successfully",
        f"Your {backup_type} backup has completed successfully.\n\n"
        f"File: {filename}\n"
        f"Size: {size_mb} MB",
    )


def backup_failed_template(data: Dict) -> Tuple[str, str]:
    """
    Template for backup failure.

    Args:
        data: Event data containing:
            - error: Error message describing the failure
            - backup_type: Type of backup (e.g., "automatic", "manual")

    Returns:
        Tuple of (title, message) for the notification
    """
    error = data.get("error", "Unknown error")
    backup_type = data.get("backup_type", "backup")

    return (
        "Backup Failed",
        f"Your {backup_type} backup has failed.\n\n"
        f"Error: {error}\n\n"
        "Please check your backup settings and try again.",
    )


def invitation_received_template(data: Dict) -> Tuple[str, str]:
    """
    Template for received sharing invitation.

    Args:
        data: Event data containing:
            - from_user: Username/name of the user who sent the invitation
            - invitation_type: Type of invitation (e.g., "share", "collaboration")

    Returns:
        Tuple of (title, message) for the notification
    """
    from_user = data.get("from_user", "Someone")
    invitation_type = data.get("invitation_type", "share")

    return (
        "New Sharing Invitation",
        f"{from_user} has sent you a {invitation_type} invitation.\n\n"
        "Log in to MediKeep to review and respond to this invitation.",
    )


def invitation_accepted_template(data: Dict) -> Tuple[str, str]:
    """
    Template for accepted invitation notification.

    Args:
        data: Event data containing:
            - by_user: Username/name of the user who accepted the invitation
            - invitation_type: Type of invitation (e.g., "share", "collaboration")

    Returns:
        Tuple of (title, message) for the notification
    """
    by_user = data.get("by_user", "Someone")
    invitation_type = data.get("invitation_type", "share")

    return (
        "Invitation Accepted",
        f"{by_user} has accepted your {invitation_type} invitation.\n\n"
        "The shared records are now accessible.",
    )


def share_revoked_template(data: Dict) -> Tuple[str, str]:
    """
    Template for revoked share notification.

    Args:
        data: Event data containing:
            - by_user: Username/name of the user who revoked the share
            - patient_name: Name of the patient (optional)

    Returns:
        Tuple of (title, message) for the notification
    """
    by_user = data.get("by_user", "Someone")
    patient_name = data.get("patient_name", "")

    patient_info = f" to {patient_name}'s records" if patient_name else ""

    return (
        "Share Access Revoked",
        f"{by_user} has revoked your access{patient_info}.\n\n"
        "You will no longer be able to view these records.",
    )


def password_changed_template(data: Dict) -> Tuple[str, str]:
    """
    Template for password change notification.

    Args:
        data: Event data containing:
            - change_time: Timestamp when the password was changed (optional)

    Returns:
        Tuple of (title, message) for the notification
    """
    change_time = data.get(
        "change_time", datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

    return (
        "Password Changed",
        f"Your MediKeep password was successfully changed.\n\n"
        f"Time: {change_time}",
    )


# Template registry for easy lookup
NOTIFICATION_TEMPLATES = {
    "backup_completed": backup_completed_template,
    "backup_failed": backup_failed_template,
    "invitation_received": invitation_received_template,
    "invitation_accepted": invitation_accepted_template,
    "share_revoked": share_revoked_template,
    "password_changed": password_changed_template,
}


def get_template(event_type: str, data: Dict) -> Tuple[str, str]:
    """
    Get the formatted title and message for an event type.

    Args:
        event_type: The event type identifier
        data: Event-specific data for template formatting

    Returns:
        Tuple of (title, message)
    """
    template_fn = NOTIFICATION_TEMPLATES.get(event_type)
    if template_fn:
        return template_fn(data)

    # Fallback for unknown event types
    return (
        f"MediKeep Notification: {event_type}",
        f"An event occurred: {event_type}",
    )


def get_supported_events() -> list:
    """Return list of supported event types."""
    return list(NOTIFICATION_TEMPLATES.keys())
