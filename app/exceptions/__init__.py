"""
Custom exceptions for the application
"""

from .patient_sharing import (
    AlreadySharedError,
    InvalidPermissionLevelError,
    PatientNotFoundError,
    PatientSharingError,
    PendingInvitationError,
    RecipientNotFoundError,
    SelfShareError,
    ShareNotFoundError,
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
