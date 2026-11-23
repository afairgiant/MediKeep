"""On-disk layout for imaging studies under UPLOAD_DIR/imaging."""

import re
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.services.file_management_service import file_management_service

logger = get_logger(__name__, "app")

IMAGING_SUBDIR = "imaging"

# DICOM UIDs are digits and dots, at most 64 characters (PS3.5 9.1)
_UID_PATTERN = re.compile(r"^[0-9]+(\.[0-9]+)*$")
_UID_MAX_LENGTH = 64


def is_valid_uid(uid: Optional[str]) -> bool:
    return (
        isinstance(uid, str)
        and len(uid) <= _UID_MAX_LENGTH
        and bool(_UID_PATTERN.match(uid))
    )


def imaging_root() -> Path:
    return Path(settings.UPLOAD_DIR) / IMAGING_SUBDIR


def study_directory(patient_id: int, study_instance_uid: str) -> Path:
    """Directory holding one study's files.

    Raises ValueError for a UID that is not a valid DICOM UID, so header values
    can never become path components.
    """
    if not is_valid_uid(study_instance_uid):
        raise ValueError("Invalid study instance UID")
    return imaging_root() / str(int(patient_id)) / study_instance_uid


def trash_study_files(
    patient_id: int, study_instance_uid: str, reason: str
) -> Optional[bool]:
    """Move a study's directory to trash as one entry.

    Returns True when moved, None when there was nothing to move, and False when the
    move failed. Never raises: a failure is logged and leaves the files in place.
    """
    try:
        directory = study_directory(patient_id, study_instance_uid)
    except ValueError:
        return None
    if not directory.is_dir():
        return None

    try:
        file_management_service.move_directory_to_trash(
            str(directory),
            trash_name=f"imaging_{int(patient_id)}_{study_instance_uid}",
            reason=reason,
        )
    except (OSError, ValueError) as exc:
        logger.error(
            "Failed to move imaging study files to trash",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "imaging_study_files_trash_failed",
                LogFields.PATIENT_ID: patient_id,
                LogFields.ERROR: type(exc).__name__,
            },
        )
        return False

    patient_dir = directory.parent
    try:
        if patient_dir.is_dir() and not any(patient_dir.iterdir()):
            patient_dir.rmdir()
    except OSError:
        pass  # A concurrent import may have just created a study here
    return True
