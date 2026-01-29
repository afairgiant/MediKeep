"""
Backup-related domain events.

Events triggered by backup operations including successful backups
and backup failures.
"""

from dataclasses import dataclass
from typing import Optional

from app.core.events.base import DomainEvent


@dataclass(frozen=True)
class BackupCompletedEvent(DomainEvent):
    """
    Event triggered when a backup operation completes successfully.

    Attributes:
        filename: Name of the backup file created
        size_mb: Size of the backup file in megabytes
        backup_type: Type of backup performed (default: "backup")
        checksum: Optional checksum/hash of the backup file for verification
    """

    filename: str = ""
    size_mb: float = 0.0
    backup_type: str = "backup"
    checksum: Optional[str] = None


@dataclass(frozen=True)
class BackupFailedEvent(DomainEvent):
    """
    Event triggered when a backup operation fails.

    Attributes:
        error: Error message describing the failure
        backup_type: Type of backup that was attempted (default: "backup")
        partial_file: Optional path to partial backup file if created
    """

    error: str = ""
    backup_type: str = "backup"
    partial_file: Optional[str] = None
