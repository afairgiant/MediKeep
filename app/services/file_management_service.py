"""
File Management Service for handling file operations including trash management.
"""

import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import settings
from app.core.logging.config import get_logger

logger = get_logger(__name__, "app")


class FileManagementService:
    """Service for managing file operations including trash functionality."""

    def __init__(self):
        self.uploads_dir = settings.UPLOAD_DIR
        self.trash_dir = settings.TRASH_DIR

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
            source_path = Path(file_path)

            if not source_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            # Create trash directory structure
            today = datetime.now().strftime("%Y-%m-%d")
            daily_trash_dir = self.trash_dir / today
            daily_trash_dir.mkdir(parents=True, exist_ok=True)

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

            # Create metadata file for recovery info
            metadata_path = trash_path.with_suffix(trash_path.suffix + ".meta")
            metadata = {
                "original_path": str(source_path),
                "deleted_at": datetime.now().isoformat(),
                "reason": reason or "User deletion",
                "trash_path": str(trash_path),
            }

            with open(metadata_path, "w") as f:
                import json

                json.dump(metadata, f, indent=2)

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
            # Validate and normalize trash_path to prevent directory traversal
            normalized_trash_path = os.path.normpath(trash_path)
            if not normalized_trash_path.startswith(str(self.trash_dir)):
                raise ValueError(f"Invalid trash path: {trash_path}")

            trash_file = Path(normalized_trash_path)

            if not trash_file.exists():
                raise FileNotFoundError(f"File not found in trash: {trash_path}")

            # Read metadata to get original path
            metadata_path = trash_file.with_suffix(trash_file.suffix + ".meta")
            if metadata_path.exists():
                with open(metadata_path, "r") as f:
                    import json

                    metadata = json.load(f)
                    original_path = metadata.get("original_path")
            else:
                original_path = None

            # Determine restore destination
            if restore_path:
                # Validate and normalize restore_path to prevent directory traversal
                normalized_restore_path = os.path.normpath(restore_path)
                # Only allow restore to uploads directory or its subdirectories
                if not normalized_restore_path.startswith(str(self.uploads_dir)):
                    raise ValueError(
                        f"Invalid restore path: {restore_path}. Files can only be restored to uploads directory."
                    )
                destination = Path(normalized_restore_path)
            elif original_path:
                destination = Path(original_path)
            else:
                # Fallback to uploads directory
                destination = self.uploads_dir / trash_file.name

            # Ensure destination directory exists
            destination.parent.mkdir(parents=True, exist_ok=True)

            # Handle destination conflicts
            if destination.exists():
                name_parts = destination.name.rsplit(".", 1)
                counter = 1
                while destination.exists():
                    if len(name_parts) == 2:
                        name, ext = name_parts
                        destination = (
                            destination.parent / f"{name}_restored_{counter}.{ext}"
                        )
                    else:
                        destination = (
                            destination.parent
                            / f"{destination.name}_restored_{counter}"
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

            # Walk through trash directory
            for root, dirs, files in os.walk(self.trash_dir, topdown=False):
                root_path = Path(root)

                # Check if this is a daily directory (YYYY-MM-DD format)
                if root_path.parent == self.trash_dir:
                    try:
                        dir_date = datetime.strptime(root_path.name, "%Y-%m-%d")
                        if dir_date < cutoff_date:
                            # Delete entire directory and its contents
                            shutil.rmtree(root_path)
                            deleted_dirs += 1
                            deleted_files += len(files)
                            logger.info(f"Deleted old trash directory: {root_path}")
                            continue
                    except ValueError:
                        # Not a date directory, skip
                        pass

                # For files in non-date directories, check individual file age
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
                for file in files:
                    if file.endswith(".meta"):
                        continue  # Skip metadata files

                    file_path = Path(root) / file
                    metadata_path = file_path.with_suffix(file_path.suffix + ".meta")

                    # Read metadata if available
                    metadata = {}
                    if metadata_path.exists():
                        try:
                            with open(metadata_path, "r") as f:
                                import json

                                metadata = json.load(f)
                        except (json.JSONDecodeError, IOError):
                            pass  # Skip invalid or unreadable metadata files

                    trash_contents.append(
                        {
                            "filename": file,
                            "trash_path": str(file_path),
                            "original_path": metadata.get("original_path", "Unknown"),
                            "deleted_at": metadata.get("deleted_at", "Unknown"),
                            "reason": metadata.get("reason", "Unknown"),
                            "size_bytes": file_path.stat().st_size,
                        }
                    )

            return sorted(trash_contents, key=lambda x: x["deleted_at"], reverse=True)

        except Exception as e:
            error_msg = f"Failed to list trash contents: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)


# Create instance of the service
file_management_service = FileManagementService()
