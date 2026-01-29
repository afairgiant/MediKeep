"""
Notification message templates for the notification framework.

This module provides a registry pattern for notification templates.
To add a new event type, simply add a new method and register it in __init__.
"""

from datetime import datetime
from typing import Dict, Tuple


class NotificationTemplates:
    """
    Registry of notification message templates.

    Each template method receives event data and returns (title, message).
    Templates should be concise but informative.
    """

    def __init__(self):
        """Initialize the template registry."""
        self._templates = {
            # Backup events
            "backup_completed": self._backup_completed,
            "backup_failed": self._backup_failed,
            # Sharing/collaboration events
            "invitation_received": self._invitation_received,
            "invitation_accepted": self._invitation_accepted,
            "share_revoked": self._share_revoked,
            # Security events
            "password_changed": self._password_changed,
        }

    def get_template(self, event_type: str, data: Dict) -> Tuple[str, str]:
        """
        Get the formatted title and message for an event type.

        Args:
            event_type: The event type identifier
            data: Event-specific data for template formatting

        Returns:
            Tuple of (title, message)
        """
        template_fn = self._templates.get(event_type)
        if template_fn:
            return template_fn(data)

        # Fallback for unknown event types
        return (
            f"MediKeep Notification: {event_type}",
            f"An event occurred: {event_type}",
        )

    def get_supported_events(self) -> list:
        """Return list of supported event types."""
        return list(self._templates.keys())

    # =========================================================================
    # Backup Event Templates
    # =========================================================================

    def _backup_completed(self, data: Dict) -> Tuple[str, str]:
        """Template for successful backup completion."""
        filename = data.get("filename", "backup")
        size_mb = data.get("size_mb", "unknown")
        backup_type = data.get("backup_type", "backup")

        return (
            "Backup Completed Successfully",
            f"Your {backup_type} backup has completed successfully.\n\n"
            f"File: {filename}\n"
            f"Size: {size_mb} MB",
        )

    def _backup_failed(self, data: Dict) -> Tuple[str, str]:
        """Template for backup failure."""
        error = data.get("error", "Unknown error")
        backup_type = data.get("backup_type", "backup")

        return (
            "Backup Failed",
            f"Your {backup_type} backup has failed.\n\n"
            f"Error: {error}\n\n"
            "Please check your backup settings and try again.",
        )

    # =========================================================================
    # Sharing/Collaboration Event Templates
    # =========================================================================

    def _invitation_received(self, data: Dict) -> Tuple[str, str]:
        """Template for received sharing invitation."""
        from_user = data.get("from_user", "Someone")
        invitation_type = data.get("invitation_type", "share")

        return (
            "New Sharing Invitation",
            f"{from_user} has sent you a {invitation_type} invitation.\n\n"
            "Log in to MediKeep to review and respond to this invitation.",
        )

    def _invitation_accepted(self, data: Dict) -> Tuple[str, str]:
        """Template for accepted invitation notification."""
        by_user = data.get("by_user", "Someone")
        invitation_type = data.get("invitation_type", "share")

        return (
            "Invitation Accepted",
            f"{by_user} has accepted your {invitation_type} invitation.\n\n"
            "The shared records are now accessible.",
        )

    def _share_revoked(self, data: Dict) -> Tuple[str, str]:
        """Template for revoked share notification."""
        by_user = data.get("by_user", "Someone")
        patient_name = data.get("patient_name", "")

        patient_info = f" to {patient_name}'s records" if patient_name else ""

        return (
            "Share Access Revoked",
            f"{by_user} has revoked your access{patient_info}.\n\n"
            "You will no longer be able to view these records.",
        )

    # =========================================================================
    # Security Event Templates
    # =========================================================================

    def _password_changed(self, data: Dict) -> Tuple[str, str]:
        """Template for password change notification."""
        change_time = data.get(
            "change_time", datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )

        return (
            "Password Changed",
            f"Your MediKeep password was successfully changed.\n\n"
            f"Time: {change_time}\n\n",
        )
