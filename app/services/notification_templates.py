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

            # Lab result events
            "lab_result_available": self._lab_result_available,
            "lab_result_abnormal": self._lab_result_abnormal,

            # Immunization events
            "immunization_due": self._immunization_due,
            "immunization_overdue": self._immunization_overdue,

            # Sharing/collaboration events
            "invitation_received": self._invitation_received,
            "invitation_accepted": self._invitation_accepted,
            "share_revoked": self._share_revoked,

            # Security events
            "login_from_new_device": self._login_from_new_device,
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
            f"An event occurred: {event_type}"
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
            f"Size: {size_mb} MB"
        )

    def _backup_failed(self, data: Dict) -> Tuple[str, str]:
        """Template for backup failure."""
        error = data.get("error", "Unknown error")
        backup_type = data.get("backup_type", "backup")

        return (
            "Backup Failed",
            f"Your {backup_type} backup has failed.\n\n"
            f"Error: {error}\n\n"
            "Please check your backup settings and try again."
        )

    # =========================================================================
    # Lab Result Event Templates
    # =========================================================================

    def _lab_result_available(self, data: Dict) -> Tuple[str, str]:
        """Template for new lab results available."""
        test_name = data.get("test_name", "Lab test")
        patient_name = data.get("patient_name", "")

        patient_info = f" for {patient_name}" if patient_name else ""

        return (
            "New Lab Results Available",
            f"New lab results are available{patient_info}.\n\n"
            f"Test: {test_name}\n\n"
            "Log in to MediKeep to view the full results."
        )

    def _lab_result_abnormal(self, data: Dict) -> Tuple[str, str]:
        """Template for abnormal lab results."""
        test_name = data.get("test_name", "Lab test")
        patient_name = data.get("patient_name", "")
        abnormal_count = data.get("abnormal_count", 0)

        patient_info = f" for {patient_name}" if patient_name else ""

        return (
            "Abnormal Lab Results Detected",
            f"Abnormal values were detected in your lab results{patient_info}.\n\n"
            f"Test: {test_name}\n"
            f"Abnormal values: {abnormal_count}\n\n"
            "Please review your results and consult with your healthcare provider."
        )

    # =========================================================================
    # Immunization Event Templates
    # =========================================================================

    def _immunization_due(self, data: Dict) -> Tuple[str, str]:
        """Template for upcoming immunization reminder."""
        vaccine_name = data.get("vaccine_name", "Immunization")
        due_date = data.get("due_date", "")
        patient_name = data.get("patient_name", "")

        patient_info = f" for {patient_name}" if patient_name else ""

        return (
            "Immunization Due Soon",
            f"An immunization is coming due{patient_info}.\n\n"
            f"Vaccine: {vaccine_name}\n"
            f"Due date: {due_date}\n\n"
            "Please schedule an appointment with your healthcare provider."
        )

    def _immunization_overdue(self, data: Dict) -> Tuple[str, str]:
        """Template for overdue immunization."""
        vaccine_name = data.get("vaccine_name", "Immunization")
        due_date = data.get("due_date", "")
        patient_name = data.get("patient_name", "")

        patient_info = f" for {patient_name}" if patient_name else ""

        return (
            "Immunization Overdue",
            f"An immunization is now overdue{patient_info}.\n\n"
            f"Vaccine: {vaccine_name}\n"
            f"Was due: {due_date}\n\n"
            "Please contact your healthcare provider as soon as possible."
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
            "Log in to MediKeep to review and respond to this invitation."
        )

    def _invitation_accepted(self, data: Dict) -> Tuple[str, str]:
        """Template for accepted invitation notification."""
        by_user = data.get("by_user", "Someone")
        invitation_type = data.get("invitation_type", "share")

        return (
            "Invitation Accepted",
            f"{by_user} has accepted your {invitation_type} invitation.\n\n"
            "The shared records are now accessible."
        )

    def _share_revoked(self, data: Dict) -> Tuple[str, str]:
        """Template for revoked share notification."""
        by_user = data.get("by_user", "Someone")
        patient_name = data.get("patient_name", "")

        patient_info = f" to {patient_name}'s records" if patient_name else ""

        return (
            "Share Access Revoked",
            f"{by_user} has revoked your access{patient_info}.\n\n"
            "You will no longer be able to view these records."
        )

    # =========================================================================
    # Security Event Templates
    # =========================================================================

    def _login_from_new_device(self, data: Dict) -> Tuple[str, str]:
        """Template for login from new device."""
        device_info = data.get("device_info", "Unknown device")
        ip_address = data.get("ip_address", "Unknown IP")
        login_time = data.get("login_time", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        location = data.get("location", "")

        location_info = f"\nLocation: {location}" if location else ""

        return (
            "New Device Login Detected",
            f"A login to your MediKeep account was detected from a new device.\n\n"
            f"Device: {device_info}\n"
            f"IP Address: {ip_address}\n"
            f"Time: {login_time}{location_info}\n\n"
            "If this wasn't you, please change your password immediately."
        )

    def _password_changed(self, data: Dict) -> Tuple[str, str]:
        """Template for password change notification."""
        change_time = data.get("change_time", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        ip_address = data.get("ip_address", "Unknown IP")

        return (
            "Password Changed",
            f"Your MediKeep password was changed.\n\n"
            f"Time: {change_time}\n"
            f"IP Address: {ip_address}\n\n"
            "If you did not make this change, please contact support immediately."
        )
