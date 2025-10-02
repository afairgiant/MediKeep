"""
Custom exceptions for patient sharing operations
"""


class PatientSharingError(Exception):
    """Base exception for patient sharing errors"""
    pass


class PatientNotFoundError(PatientSharingError):
    """Raised when a patient is not found or not owned by user"""
    pass


class AlreadySharedError(PatientSharingError):
    """Raised when attempting to share a patient that is already shared"""
    pass


class PendingInvitationError(PatientSharingError):
    """Raised when a pending invitation already exists"""
    pass


class RecipientNotFoundError(PatientSharingError):
    """Raised when the recipient user is not found"""
    pass


class InvalidPermissionLevelError(PatientSharingError):
    """Raised when an invalid permission level is specified"""
    pass


class ShareNotFoundError(PatientSharingError):
    """Raised when a share is not found"""
    pass


class SelfShareError(PatientSharingError):
    """Raised when attempting to share a patient with yourself"""
    pass
