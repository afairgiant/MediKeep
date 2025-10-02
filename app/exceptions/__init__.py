"""
Custom exceptions for the application
"""

from .patient_sharing import (
    PatientSharingError,
    PatientNotFoundError,
    AlreadySharedError,
    PendingInvitationError,
    RecipientNotFoundError,
    InvalidPermissionLevelError,
    ShareNotFoundError,
    SelfShareError,
)

__all__ = [
    "PatientSharingError",
    "PatientNotFoundError",
    "AlreadySharedError",
    "PendingInvitationError",
    "RecipientNotFoundError",
    "InvalidPermissionLevelError",
    "ShareNotFoundError",
    "SelfShareError",
]
