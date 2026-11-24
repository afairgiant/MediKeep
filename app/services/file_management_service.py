"""
File Management Service for handling file operations including trash management.
"""

import json
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.utils.stored_files import resolve_storage_path

logger = get_logger(__name__, "app")


def _metadata_path(trash_path: Path) -> Path:
    """Recovery metadata stored beside a trashed file or directory."""
    return trash_path.with_suffix(trash_path.suffix + ".meta")


def _read_metadata(trash_path: Path) -> Dict:
    metadata_path = _metadata_path(trash_path)
    if not metadata_path.exists():
        return {}
    try:
        with open(metadata_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _write_metadata(trash_path: Path, source: Path, reason: Optional[str], **extra):
    """Write the recovery metadata of a trashed entry and return it."""
    metadata = {
        "original_path": str(source),
        "deleted_at": datetime.now().isoformat(),
        "reason": reason or "User deletion",
        "trash_path": str(trash_path),
        **extra,
    }
    with open(_metadata_path(trash_path), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    return metadata


TRASH_DAY_FORMAT = "%Y-%m-%d"


def _is_day_folder_name(name: str) -> bool:
    try:
        datetime.strptime(name, TRASH_DAY_FORMAT)
    except ValueError:
        return False
    return True


def _tree_size(directory: Path) -> int:
    return sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())


def _trash_entry(path: Path, metadata: Dict, size_bytes: int) -> Dict:
    return {
        "filename": path.name,
        "trash_path": str(path),
        "original_path": metadata.get("original_path", "Unknown"),
        "deleted_at": metadata.get("deleted_at", "Unknown"),
        "reason": metadata.get("reason", "Unknown"),
        "size_bytes": size_bytes,
    }


class FileManagementService:
    """Service for managing file operations including trash functionality."""

    # Read on use so these always match what resolve_storage_path accepts
    @property
    def uploads_dir(self) -> Path:
        return Path(settings.UPLOAD_DIR)

    @property
    def trash_dir(self) -> Path:
        return Path(settings.TRASH_DIR)

    def _daily_trash_dir(self) -> Path:
        daily_trash_dir = self.trash_dir / datetime.now().strftime(TRASH_DAY_FORMAT)
        daily_trash_dir.mkdir(parents=True, exist_ok=True)
        return daily_trash_dir

    def resolve_trash_entry(self, trash_path: str) -> Path:
        """Resolved path of one trashed file or directory inside TRASH_DIR.

        Raises:
            ValueError: outside the trash, the trash root itself, or a directory that
                was not trashed as one entry (such as a day folder).
            FileNotFoundError: nothing exists at the path.
        """
        trash_root = os.path.realpath(self.trash_dir)
        try:
            real_path = os.path.realpath(trash_path)
        except (OSError, ValueError) as exc:
            raise ValueError(f"Invalid trash path: {trash_path}") from exc
        # The separator rejects the root itself and siblings such as trash_old
        if not real_path.startswith(trash_root + os.sep):
            raise ValueError(f"Invalid trash path: {trash_path}")
        resolved = Path(real_path)
        if not resolved.exists():
            raise FileNotFoundError(f"File not found in trash: {trash_path}")
        if resolved.is_dir() and not self.is_trashed_directory(resolved):
            raise ValueError(f"Invalid trash path: {trash_path}")
        return resolved

    def permanently_delete_from_trash(self, trash_path: str) -> None:
        """Delete one trashed file or directory and its metadata for good.

        Raises the same errors as resolve_trash_entry.
        """
        trash_entry = self.resolve_trash_entry(trash_path)
        if trash_entry.is_dir():
            shutil.rmtree(trash_entry)
        else:
            trash_entry.unlink()
        _metadata_path(trash_entry).unlink(missing_ok=True)

    def move_to_trash(
        self, file_path: str, reason: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Move a file to trash directory instead of deleting it permanently.

        Args:
            file_path: Path to the file to be moved to trash
            reason: Optional reason for deletion

        Returns:
            Dictionary with trash operation details
        """
        try:
            source_path = resolve_storage_path(file_path)
            if source_path is None:
                raise ValueError("File is outside the storage directories")

            if not source_path.is_file():
                raise FileNotFoundError(f"File not found: {file_path}")

            daily_trash_dir = self._daily_trash_dir()

            # Generate unique filename in trash (handle duplicates)
            original_name = source_path.name
            trash_path = daily_trash_dir / original_name
            counter = 1

            while trash_path.exists():
                name_parts = original_name.rsplit(".", 1)
                if len(name_parts) == 2:
                    name, ext = name_parts
                    trash_path = daily_trash_dir / f"{name}_{counter}.{ext}"
                else:
                    trash_path = daily_trash_dir / f"{original_name}_{counter}"
                counter += 1

            # Move file to trash
            shutil.move(str(source_path), str(trash_path))
            try:
                metadata = _write_metadata(trash_path, source_path, reason)
            except OSError:
                # Without its sidecar the file could be neither listed nor
                # restored, and its record would point to a missing file
                _metadata_path(trash_path).unlink(missing_ok=True)
                shutil.move(str(trash_path), str(source_path))
                raise

            logger.info(f"File moved to trash: {file_path} -> {trash_path}")

            return {
                "status": "success",
                "original_path": str(source_path),
                "trash_path": str(trash_path),
                "deleted_at": metadata["deleted_at"],
            }

        except Exception as e:
            error_msg = f"Failed to move file to trash: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def move_directory_to_trash(
        self, directory: str, trash_name: str, reason: Optional[str] = None
    ) -> Path:
        """Move a whole directory into today's trash folder as ``trash_name``.

        The trash keeps it as one entry: listed, restored and permanently deleted as a
        unit. ``trash_name`` must be a plain name, not a path.

        Raises:
            ValueError: the directory is outside storage, or the name is not plain.
            FileNotFoundError: the directory does not exist.
        """
        source = resolve_storage_path(directory)
        if source is None:
            raise ValueError("Directory is outside the storage directories")
        if not source.is_dir():
            raise FileNotFoundError("Directory not found")
        if Path(trash_name).name != trash_name or trash_name in ("", ".", ".."):
            raise ValueError("Trash name must be a plain name")

        daily_trash_dir = self._daily_trash_dir()
        trash_path = daily_trash_dir / trash_name
        counter = 1
        while trash_path.exists() or _metadata_path(trash_path).exists():
            trash_path = daily_trash_dir / f"{trash_name}_{counter}"
            counter += 1

        # Measured once here so listing the trash need not walk every file
        size_bytes = _tree_size(source)
        shutil.move(str(source), str(trash_path))
        try:
            _write_metadata(
                trash_path, source, reason, is_directory=True, size_bytes=size_bytes
            )
        except OSError:
            # Without its sidecar the entry could be neither listed nor restored
            _metadata_path(trash_path).unlink(missing_ok=True)
            shutil.move(str(trash_path), str(source))
            raise
        return trash_path

    def is_trashed_directory(self, path: Path) -> bool:
        """True for a directory that move_directory_to_trash put in the trash."""
        return path.is_dir() and bool(_read_metadata(path).get("is_directory"))

    def restore_from_trash(
        self, trash_path: str, restore_path: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Restore a file from trash to its original location or specified path.

        Args:
            trash_path: Path to the file in trash
            restore_path: Optional custom restore path

        Returns:
            Dictionary with restore operation details
        """
        try:
            trash_file = self.resolve_trash_entry(trash_path)
            metadata_path = _metadata_path(trash_file)
            original_path = _read_metadata(trash_file).get("original_path")

            # Determine restore destination
            if restore_path:
                destination = resolve_storage_path(restore_path)
                if destination is None:
                    raise ValueError(
                        f"Invalid restore path: {restore_path}. Files can only be restored to uploads directory."
                    )
            elif original_destination := resolve_storage_path(original_path):
                destination = original_destination
            else:
                # Fallback to uploads directory
                destination = self.uploads_dir / trash_file.name

            # Ensure destination directory exists
            destination.parent.mkdir(parents=True, exist_ok=True)

            # Handle destination conflicts
            if destination.exists():
                # Directory names (DICOM UIDs) contain dots that are not extensions
                name_parts = (
                    [destination.name]
                    if trash_file.is_dir()
                    else destination.name.rsplit(".", 1)
                )
                suffix = f".{name_parts[1]}" if len(name_parts) == 2 else ""
                counter = 1
                while destination.exists():
                    destination = (
                        destination.parent
                        / f"{name_parts[0]}_restored_{counter}{suffix}"
                    )
                    counter += 1

            # Move file back from trash
            shutil.move(str(trash_file), str(destination))

            # Remove metadata file
            if metadata_path.exists():
                metadata_path.unlink()

            logger.info(f"File restored from trash: {trash_path} -> {destination}")

            return {
                "status": "success",
                "trash_path": str(trash_file),
                "restored_path": str(destination),
            }

        except Exception as e:
            error_msg = f"Failed to restore file from trash: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def cleanup_old_trash(self) -> Dict[str, int]:
        """
        Clean up old files from trash directory based on retention policy.

        Returns:
            Dictionary with cleanup statistics
        """
        try:
            if not self.trash_dir.exists():
                return {"deleted_files": 0, "deleted_dirs": 0}

            cutoff_date = datetime.now() - timedelta(days=settings.TRASH_RETENTION_DAYS)
            deleted_files = 0
            deleted_dirs = 0

            for entry in list(self.trash_dir.iterdir()):
                if not entry.is_dir() or not _is_day_folder_name(entry.name):
                    continue
                # The folder date is the trash date; moved files keep their old mtimes
                if datetime.strptime(entry.name, TRASH_DAY_FORMAT) < cutoff_date:
                    deleted_files += sum(1 for p in entry.rglob("*") if p.is_file())
                    shutil.rmtree(entry)
                    deleted_dirs += 1
                    logger.info(f"Deleted old trash directory: {entry}")

            # Files outside day folders have no trash date, so their own age decides
            for root, dirs, files in os.walk(self.trash_dir, topdown=True):
                root_path = Path(root)
                if root_path == self.trash_dir:
                    dirs[:] = [d for d in dirs if not _is_day_folder_name(d)]

                for file in files:
                    file_path = root_path / file
                    if file_path.stat().st_mtime < cutoff_date.timestamp():
                        file_path.unlink()
                        deleted_files += 1
                        logger.info(f"Deleted old trash file: {file_path}")

            logger.info(
                f"Trash cleanup completed: {deleted_files} files, {deleted_dirs} directories deleted"
            )

            return {"deleted_files": deleted_files, "deleted_dirs": deleted_dirs}

        except Exception as e:
            error_msg = f"Failed to cleanup trash: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def list_trash_contents(self) -> List[Dict[str, str]]:
        """
        List all files currently in trash with their metadata.

        Returns:
            List of dictionaries containing trash file information
        """
        try:
            if not self.trash_dir.exists():
                return []

            trash_contents = []

            for root, dirs, files in os.walk(self.trash_dir):
                root_path = Path(root)
                # A trashed directory is one entry; its contents are not listed
                for name in list(dirs):
                    dir_path = root_path / name
                    metadata = _read_metadata(dir_path)
                    if not metadata.get("is_directory"):
                        continue
                    dirs.remove(name)
                    size_bytes = metadata.get("size_bytes")
                    if size_bytes is None:
                        size_bytes = _tree_size(dir_path)
                    trash_contents.append(_trash_entry(dir_path, metadata, size_bytes))

                for file in files:
                    if file.endswith(".meta"):
                        continue  # Skip metadata files

                    file_path = root_path / file
                    trash_contents.append(
                        _trash_entry(
                            file_path,
                            _read_metadata(file_path),
                            file_path.stat().st_size,
                        )
                    )

            return sorted(trash_contents, key=lambda x: x["deleted_at"], reverse=True)

        except Exception as e:
            error_msg = f"Failed to list trash contents: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)


# Create instance of the service
file_management_service = FileManagementService()
