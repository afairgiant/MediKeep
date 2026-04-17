"""
Custom exceptions for patient sharing operations
"""


class PatientSharingError(Exception):
    """Base exception for patient sharing errors"""


class PatientNotFoundError(PatientSharingError):
    """Raised when a patient is not found or not owned by user"""


class AlreadySharedError(PatientSharingError):
    """Raised when attempting to share a patient that is already shared"""


class PendingInvitationError(PatientSharingError):
    """Raised when a pending invitation already exists"""


class RecipientNotFoundError(PatientSharingError):
    """Raised when the recipient user is not found"""


class InvalidPermissionLevelError(PatientSharingError):
    """Raised when an invalid permission level is specified"""


class ShareNotFoundError(PatientSharingError):
    """Raised when a share is not found"""


class SelfShareError(PatientSharingError):
    """Raised when attempting to share a patient with yourself"""
