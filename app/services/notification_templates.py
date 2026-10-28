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


def medication_reminder_due_template(data: Dict) -> Tuple[str, str]:
    """
    Template for medication reminder notifications.

    Args:
        data: Event data containing:
            - medication_name: Name of the medication
            - dosage: Optional dosage string
            - reminder_message: Optional custom note appended to the notification body
            - scheduled_time_local: HH:MM string (empty for test reminders)
            - is_test: True for one-shot test reminders

    Returns:
        Tuple of (title, message) for the notification
    """
    name = data.get("medication_name", "your medication")
    dosage = data.get("dosage")
    scheduled = data.get("scheduled_time_local", "")
    custom_msg = data.get("reminder_message")
    dosage_part = f" ({dosage})" if dosage else ""

    if data.get("is_test"):
        title = f"Test Reminder: {name}"
        body = (
            f"This is a test reminder for {name}{dosage_part}.\n"
            "If you received this, your notification channel is working."
        )
    else:
        title = f"Medication Reminder: {name}"
        body = f"Time to take {name}{dosage_part} at {scheduled}."

    if custom_msg:
        body += f"\n{custom_msg}"
    return (title, body)


def password_changed_template(data: Dict) -> Tuple[str, str]:
    """
    Template for password change notification.

    Args:
        data: Event data containing:
            - change_time: Timestamp when the password was changed (optional)

    Returns:
        Tuple of (title, message) for the notification
    """
    change_time = data.get("change_time", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    return (
        "Password Changed",
        f"Your MediKeep password was successfully changed.\n\n" f"Time: {change_time}",
    )


def _event_time(data: Dict) -> str:
    occurred_at = data.get("occurred_at")
    try:
        return datetime.fromisoformat(occurred_at).strftime("%Y-%m-%d %H:%M:%S UTC")
    except (TypeError, ValueError):
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


_NOT_YOU = "If this was not you, change your password and contact your administrator."


def two_factor_disabled_template(data: Dict) -> Tuple[str, str]:
    """Two-factor turned off; data may carry by_admin and occurred_at."""
    if data.get("by_admin"):
        body = (
            "An administrator turned off two-factor authentication for your "
            "MediKeep account and signed out all your sessions. You can turn it "
            "on again in Settings > Security."
        )
    else:
        body = (
            "Two-factor authentication was turned off for your MediKeep account. "
            + _NOT_YOU
        )
    return (
        "Two-Factor Authentication Turned Off",
        f"{body}\n\nTime: {_event_time(data)}",
    )


def backup_code_used_template(data: Dict) -> Tuple[str, str]:
    """A backup code signed in; data carries codes_remaining and occurred_at."""
    remaining = data.get("codes_remaining", 0)
    return (
        "Backup Code Used",
        "A backup code was used to sign in to your MediKeep account. "
        f"Backup codes left: {remaining}. {_NOT_YOU}\n\n"
        f"Time: {_event_time(data)}",
    )


def sessions_revoked_template(data: Dict) -> Tuple[str, str]:
    """Other sessions signed out; data carries occurred_at."""
    return (
        "Other Devices Signed Out",
        "Every other device signed in to your MediKeep account was signed out. "
        f"{_NOT_YOU}\n\nTime: {_event_time(data)}",
    )


def two_factor_failures_template(data: Dict) -> Tuple[str, str]:
    """Second step locked after wrong codes; data carries occurred_at."""
    return (
        "Repeated Incorrect Two-Factor Codes",
        "Someone entered your correct MediKeep password, then too many incorrect "
        "two-factor codes, so sign-in is paused for a while. If this was not you, "
        "change your password now.\n\n"
        f"Time: {_event_time(data)}",
    )


# Template registry for easy lookup
NOTIFICATION_TEMPLATES = {
    "backup_completed": backup_completed_template,
    "backup_failed": backup_failed_template,
    "invitation_received": invitation_received_template,
    "invitation_accepted": invitation_accepted_template,
    "share_revoked": share_revoked_template,
    "password_changed": password_changed_template,
    "two_factor_disabled": two_factor_disabled_template,
    "backup_code_used": backup_code_used_template,
    "sessions_revoked": sessions_revoked_template,
    "two_factor_failures": two_factor_failures_template,
    "medication_reminder_due": medication_reminder_due_template,
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
