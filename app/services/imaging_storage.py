"""On-disk layout for imaging studies under UPLOAD_DIR/imaging."""

import re
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.services.file_management_service import file_management_service

logger = get_logger(__name__, "app")

IMAGING_SUBDIR = "imaging"

# Holds one work directory per import; backups skip it, startup empties it
IMPORT_STAGING_DIR = ".imaging-staging"

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


def instance_path(
    patient_id: int, study_instance_uid: str, series_instance_uid: str, sop_uid: str
) -> Path:
    """Where one image file is stored. Raises ValueError for any invalid UID."""
    if not (is_valid_uid(series_instance_uid) and is_valid_uid(sop_uid)):
        raise ValueError("Invalid series or SOP instance UID")
    return (
        study_directory(patient_id, study_instance_uid)
        / series_instance_uid
        / f"{sop_uid}.dcm"
    )


def import_staging_root() -> Path:
    return Path(settings.UPLOAD_DIR) / IMPORT_STAGING_DIR


def create_import_staging_dir() -> Path:
    """A new empty directory under UPLOAD_DIR for one import; the caller removes it."""
    root = import_staging_root()
    root.mkdir(parents=True, exist_ok=True)
    return Path(tempfile.mkdtemp(dir=root))


def remove_stale_import_staging() -> int:
    """Delete staging directories left by interrupted imports; returns how many.

    Call only at startup, before any import can be running. Raises OSError when a
    directory could not be removed.
    """
    root = import_staging_root()
    if not root.is_dir():
        return 0
    removed = sum(1 for _ in root.iterdir())
    shutil.rmtree(root)
    return removed


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

    try:
        if not directory.is_dir():
            return None
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
