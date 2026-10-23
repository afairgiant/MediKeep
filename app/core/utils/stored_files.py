"""Containment checks for file paths kept in the database."""

from pathlib import Path
from typing import Any, Optional

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

security_logger = get_logger(__name__, "security")

# Paperless and Papra records hold these placeholder URIs instead of local paths
REMOTE_FILE_PREFIXES = ("paperless://", "papra://")


def is_remote_placeholder(file_path: Optional[str]) -> bool:
    return isinstance(file_path, str) and file_path.startswith(REMOTE_FILE_PREFIXES)


def resolve_storage_path(file_path: Optional[str]) -> Optional[Path]:
    """Resolved path, or None unless it is strictly inside UPLOAD_DIR or TRASH_DIR.

    Relative paths resolve against the working directory, as they were stored.
    Does not check that the file exists.
    """
    if not file_path:
        return None
    try:
        resolved = Path(file_path).resolve()
        roots = [
            Path(settings.UPLOAD_DIR).resolve(),
            Path(settings.TRASH_DIR).resolve(),
        ]
    except (OSError, ValueError):
        return None
    # Roots are excluded so a record can never name a whole storage folder
    if resolved in roots:
        return None
    if any(resolved.is_relative_to(root) for root in roots):
        return resolved
    return None


def resolve_stored_file(record: Any) -> Optional[Path]:
    """Path of record.file_path when it is an existing regular file inside storage.

    Logs a security event when a local path escapes storage. The record needs
    file_path and id attributes.
    """
    file_path = getattr(record, "file_path", None)
    resolved = resolve_storage_path(file_path)
    if resolved is None and file_path and not is_remote_placeholder(file_path):
        security_logger.warning(
            "Refused a stored file path outside the storage directories",
            extra={
                LogFields.CATEGORY: "security",
                LogFields.EVENT: "stored_file_path_rejected",
                LogFields.MODEL: type(record).__name__,
                LogFields.RECORD_ID: getattr(record, "id", None),
            },
        )
    if resolved is None or not resolved.is_file():
        return None
    return resolved
