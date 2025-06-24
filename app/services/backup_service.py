"""
Backup Service for Medical Records

This service handles the creation of database and file backups.
Phase 1 implementation: Basic manual backup functionality.
"""

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.models import BackupRecord
from app.services.file_management_service import file_management_service

logger = get_logger(__name__, "app")


class BackupService:
    """Service for creating and managing database and file backups."""

    def __init__(self, db: Session):
        self.db = db
        self.backup_dir = settings.BACKUP_DIR

    def _get_postgres_version(self) -> str:
        """Get PostgreSQL major version from the database."""
        try:
            from sqlalchemy import text

            result = self.db.execute(text("SELECT version()")).fetchone()
            if result is None:
                logger.warning(
                    "PostgreSQL version query returned no results, defaulting to 17"
                )
                return "17"

            version_string = result[0]
            # Extract major version from "PostgreSQL 15.3 on ..." -> "15"
            major_version = version_string.split()[1].split(".")[0]
            logger.info(f"Detected PostgreSQL version: {major_version}")
            return major_version
        except Exception as e:
            logger.warning(
                f"Could not detect PostgreSQL version: {e}, defaulting to 17"
            )
            return "17"  # Safe default

    async def create_database_backup(
        self, description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a database backup using pg_dump.

        Args:
            description: Optional description for the backup

        Returns:
            Dictionary containing backup information
        """
        try:
            # Generate backup filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"database_backup_{timestamp}.sql"
            backup_path = self.backup_dir / backup_filename

            # Ensure backup directory exists
            self.backup_dir.mkdir(parents=True, exist_ok=True)

            # Extract database connection details from DATABASE_URL
            db_url = settings.DATABASE_URL
            if not db_url:
                raise ValueError("DATABASE_URL not configured")

            # Use Docker to run pg_dump since PostgreSQL client tools may not be installed
            # Extract connection components from DATABASE_URL for Docker command
            # Format: postgresql://user:password@host:port/database
            import urllib.parse

            parsed = urllib.parse.urlparse(db_url)

            # Handle localhost connections for Docker
            hostname = parsed.hostname
            if hostname in ["localhost", "127.0.0.1"]:
                hostname = "host.docker.internal"  # Docker Desktop's host access

            # Auto-detect PostgreSQL version for compatibility
            postgres_version = self._get_postgres_version()

            cmd = [
                "docker",
                "run",
                "--rm",
                "-e",
                f"PGPASSWORD={parsed.password}",
                f"postgres:{postgres_version}",  # Use matching PostgreSQL version
                "pg_dump",
                "-h",
                hostname,
                "-p",
                str(parsed.port),
                "-U",
                parsed.username,
                "-d",
                parsed.path[1:],  # Remove leading slash from path
                "--verbose",
                "--no-password",
            ]

            logger.info(f"Starting database backup: {backup_filename}")

            # Execute pg_dump via Docker and capture output
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            # Write the SQL dump to file
            with open(backup_path, "w", encoding="utf-8") as f:
                f.write(result.stdout)

            # Verify backup file was created
            if not backup_path.exists():
                raise Exception("Backup file was not created")

            # Get file size
            file_size = backup_path.stat().st_size

            # Calculate checksum for integrity verification
            checksum = self._calculate_file_checksum(backup_path)

            # Create backup record in database
            backup_record = BackupRecord(
                backup_type="database",
                status="created",
                file_path=str(backup_path),
                size_bytes=file_size,
                description=description
                or f"Database backup created on {datetime.now()}",
                checksum=checksum,
            )

            self.db.add(backup_record)
            self.db.commit()

            logger.info(
                f"Database backup completed successfully: {backup_filename} ({file_size} bytes)"
            )

            return {
                "id": backup_record.id,
                "backup_type": "database",
                "filename": backup_filename,
                "file_path": str(backup_path),
                "size_bytes": file_size,
                "status": "created",
                "created_at": backup_record.created_at.isoformat(),
                "checksum": checksum,
            }

        except subprocess.CalledProcessError as e:
            error_msg = f"Database backup failed: {e.stderr}"
            logger.error(error_msg)

            # Record failed backup
            backup_record = BackupRecord(
                backup_type="database",
                status="failed",
                file_path=str(backup_path) if "backup_path" in locals() else "",
                description=f"Failed backup: {error_msg}",
            )
            self.db.add(backup_record)
            self.db.commit()

            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Database backup failed: {str(e)}"
            logger.error(error_msg)

            # Record failed backup
            backup_record = BackupRecord(
                backup_type="database",
                status="failed",
                file_path=str(backup_path) if "backup_path" in locals() else "",
                description=f"Failed backup: {error_msg}",
            )
            self.db.add(backup_record)
            self.db.commit()

            raise Exception(error_msg)

    async def create_files_backup(
        self, description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a backup of the uploads directory using tar.

        Args:
            description: Optional description for the backup

        Returns:
            Dictionary containing backup information
        """
        try:
            # Generate backup filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"files_backup_{timestamp}.zip"
            backup_path = self.backup_dir / backup_filename

            # Ensure backup directory exists
            self.backup_dir.mkdir(parents=True, exist_ok=True)

            uploads_dir = settings.UPLOAD_DIR
            if not uploads_dir.exists():
                logger.warning(f"Uploads directory does not exist: {uploads_dir}")
                uploads_dir.mkdir(parents=True, exist_ok=True)

            logger.info(f"Starting files backup: {backup_filename}")

            # Create ZIP archive
            with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                # Walk through the uploads directory and add all files
                for root, dirs, files in os.walk(uploads_dir):
                    # Skip trash directory
                    root_path = Path(root)
                    if "trash" in root_path.parts:
                        continue

                    for file in files:
                        file_path = Path(root) / file
                        # Create archive path relative to uploads directory
                        arcname = Path("uploads") / file_path.relative_to(uploads_dir)
                        zipf.write(file_path, arcname)

            # Verify backup file was created
            if not backup_path.exists():
                raise Exception("Backup file was not created")

            # Get file size
            file_size = backup_path.stat().st_size

            # Calculate checksum for integrity verification
            checksum = self._calculate_file_checksum(backup_path)

            # Create backup record in database
            backup_record = BackupRecord(
                backup_type="files",
                status="created",
                file_path=str(backup_path),
                size_bytes=file_size,
                description=description or f"Files backup created on {datetime.now()}",
                compression_used=True,
                checksum=checksum,
            )

            self.db.add(backup_record)
            self.db.commit()

            logger.info(
                f"Files backup completed successfully: {backup_filename} ({file_size} bytes)"
            )

            return {
                "id": backup_record.id,
                "backup_type": "files",
                "filename": backup_filename,
                "file_path": str(backup_path),
                "size_bytes": file_size,
                "status": "created",
                "created_at": backup_record.created_at.isoformat(),
                "checksum": checksum,
            }

        except Exception as e:
            error_msg = f"Files backup failed: {str(e)}"
            logger.error(error_msg)

            # Record failed backup
            backup_record = BackupRecord(
                backup_type="files",
                status="failed",
                file_path=str(backup_path) if "backup_path" in locals() else "",
                description=f"Failed backup: {error_msg}",
            )
            self.db.add(backup_record)
            self.db.commit()

            raise Exception(error_msg)

    async def list_backups(self) -> List[Dict[str, Any]]:
        """
        List all backup records.

        Returns:
            List of backup records
        """
        try:
            # Return all backups except completely failed ones (so users can see and manage problematic ones)
            backup_records = (
                self.db.query(BackupRecord)
                .filter(BackupRecord.status != "failed")
                .order_by(BackupRecord.created_at.desc())
                .all()
            )

            backups = []
            for record in backup_records:
                backup_info = {
                    "id": record.id,
                    "backup_type": record.backup_type,
                    "status": record.status,
                    "filename": (
                        Path(record.file_path).name if record.file_path else None  # type: ignore
                    ),
                    "file_path": record.file_path,
                    "size_bytes": record.size_bytes,
                    "created_at": record.created_at.isoformat(),
                    "description": record.description,
                    "compression_used": record.compression_used,
                    "checksum": record.checksum,
                    "file_exists": (
                        Path(record.file_path).exists() if record.file_path else False  # type: ignore
                    ),
                }
                backups.append(backup_info)

            return backups

        except Exception as e:
            logger.error(f"Failed to list backups: {str(e)}")
            raise Exception(f"Failed to list backups: {str(e)}")

    async def verify_backup(self, backup_id: int) -> Dict[str, Any]:
        """
        Verify the integrity of a backup.

        Args:
            backup_id: ID of the backup to verify

        Returns:
            Dictionary containing verification results
        """
        try:
            backup_record = (
                self.db.query(BackupRecord).filter(BackupRecord.id == backup_id).first()
            )
            if not backup_record:
                raise ValueError(f"Backup with ID {backup_id} not found")

            backup_path = Path(backup_record.file_path)  # type: ignore

            # Check if file exists
            if not backup_path.exists():
                # Update status to indicate missing file
                setattr(backup_record, "status", "missing")
                self.db.commit()
                return {
                    "backup_id": backup_id,
                    "verified": False,
                    "file_exists": False,
                    "error": "Backup file does not exist",
                    "status_updated": "missing",
                }

            # Check file size
            current_size = backup_path.stat().st_size
            size_matches = current_size == backup_record.size_bytes

            # Check checksum if available
            checksum_matches = True
            if backup_record.checksum:  # type: ignore
                current_checksum = self._calculate_file_checksum(backup_path)
                checksum_matches = current_checksum == backup_record.checksum

            # Overall verification result
            verified = size_matches and checksum_matches

            # Update status based on verification result
            new_status = None
            if not verified:
                if not size_matches and not checksum_matches:
                    new_status = "corrupted"
                elif not size_matches:
                    new_status = "size_mismatch"
                elif not checksum_matches:
                    new_status = "checksum_failed"
                else:
                    new_status = "failed"

                setattr(backup_record, "status", new_status)
                self.db.commit()

            return {
                "backup_id": backup_id,
                "verified": verified,
                "file_exists": True,
                "size_matches": size_matches,
                "checksum_matches": checksum_matches,
                "current_size": current_size,
                "expected_size": backup_record.size_bytes,
                "status_updated": new_status,
            }

        except Exception as e:
            logger.error(f"Failed to verify backup {backup_id}: {str(e)}")
            return {"backup_id": backup_id, "verified": False}

    async def delete_backup(self, backup_id: int) -> Dict[str, Any]:
        """
        Delete a backup record and its associated file.

        Args:
            backup_id: ID of the backup to delete

        Returns:
            Dictionary containing deletion results
        """
        try:
            backup_record = (
                self.db.query(BackupRecord).filter(BackupRecord.id == backup_id).first()
            )
            if not backup_record:
                raise ValueError(f"Backup with ID {backup_id} not found")

            backup_path = Path(backup_record.file_path) if backup_record.file_path else None  # type: ignore
            filename = backup_path.name if backup_path else "Unknown"

            # Delete physical file if it exists
            file_deleted = False
            if backup_path and backup_path.exists():
                backup_path.unlink()
                file_deleted = True
                logger.info(f"Deleted backup file: {backup_path}")

            # Delete database record
            self.db.delete(backup_record)
            self.db.commit()

            logger.info(f"Deleted backup record: {backup_id} ({filename})")

            return {
                "backup_id": backup_id,
                "filename": filename,
                "file_deleted": file_deleted,
                "record_deleted": True,
                "message": f"Backup '{filename}' deleted successfully",
            }

        except Exception as e:
            logger.error(f"Failed to delete backup {backup_id}: {str(e)}")
            raise Exception(f"Failed to delete backup: {str(e)}")

    def _calculate_file_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

    async def cleanup_old_backups(self) -> Dict[str, Any]:
        """
        Clean up old backups based on retention policy.
        This includes both database records and orphaned files.

        Returns:
            Dictionary containing cleanup results
        """
        try:
            from datetime import timedelta

            cutoff_date = datetime.now() - timedelta(
                days=settings.BACKUP_RETENTION_DAYS
            )

            # Find old backup records
            old_backups = (
                self.db.query(BackupRecord)
                .filter(BackupRecord.created_at < cutoff_date)
                .all()
            )

            deleted_count = 0
            orphaned_deleted = 0
            errors = []

            # Delete old backup records and their files
            for backup in old_backups:
                try:
                    # Delete physical file
                    if backup.file_path and Path(backup.file_path).exists():  # type: ignore
                        Path(backup.file_path).unlink()  # type: ignore

                    # Delete database record
                    self.db.delete(backup)
                    deleted_count += 1

                except Exception as e:
                    errors.append(f"Failed to delete backup {backup.id}: {str(e)}")

            self.db.commit()

            # Clean up orphaned files (files that exist but aren't in database)
            if self.backup_dir.exists():
                try:
                    # Get all file paths from database records
                    all_backup_records = self.db.query(BackupRecord).all()
                    tracked_files = set()
                    for record in all_backup_records:
                        if record.file_path:
                            tracked_files.add(Path(record.file_path).resolve())

                    # Scan backup directory for all backup files
                    backup_patterns = [
                        "*.sql",
                        "*.zip",
                        "*backup*",
                        "database_*",
                        "files_*",
                        "full_*",
                    ]
                    for pattern in backup_patterns:
                        for file_path in self.backup_dir.glob(pattern):
                            if file_path.is_file():
                                resolved_path = file_path.resolve()
                                if resolved_path not in tracked_files:
                                    try:
                                        # Check if file is old enough to be considered orphaned
                                        file_mtime = datetime.fromtimestamp(
                                            file_path.stat().st_mtime
                                        )
                                        if file_mtime < cutoff_date:
                                            file_path.unlink()
                                            orphaned_deleted += 1
                                            logger.info(
                                                f"Deleted orphaned backup file: {file_path}"
                                            )
                                    except Exception as e:
                                        errors.append(
                                            f"Failed to delete orphaned file {file_path}: {str(e)}"
                                        )

                except Exception as e:
                    errors.append(f"Error scanning for orphaned files: {str(e)}")

            logger.info(
                f"Cleanup completed: deleted {deleted_count} tracked backups and {orphaned_deleted} orphaned files"
            )

            return {
                "deleted_count": deleted_count,
                "orphaned_deleted": orphaned_deleted,
                "total_deleted": deleted_count + orphaned_deleted,
                "errors": errors,
                "cutoff_date": cutoff_date.isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to cleanup old backups: {str(e)}")
            raise Exception(f"Failed to cleanup old backups: {str(e)}")

    async def cleanup_orphaned_files(self) -> Dict[str, Any]:
        """
        Clean up orphaned backup files (files that exist but aren't tracked in database).
        This removes ALL orphaned files regardless of age.

        Returns:
            Dictionary containing cleanup results
        """
        try:
            orphaned_deleted = 0
            errors = []

            if self.backup_dir.exists():
                # Get all file paths from database records
                all_backup_records = self.db.query(BackupRecord).all()
                tracked_files = set()
                for record in all_backup_records:
                    if record.file_path:
                        tracked_files.add(Path(record.file_path).resolve())

                # Scan backup directory for all backup files
                backup_patterns = [
                    "*.sql",
                    "*.zip",
                    "*backup*",
                    "database_*",
                    "files_*",
                    "full_*",
                ]
                for pattern in backup_patterns:
                    for file_path in self.backup_dir.glob(pattern):
                        if file_path.is_file():
                            resolved_path = file_path.resolve()
                            if resolved_path not in tracked_files:
                                try:
                                    file_path.unlink()
                                    orphaned_deleted += 1
                                    logger.info(
                                        f"Deleted orphaned backup file: {file_path}"
                                    )
                                except Exception as e:
                                    errors.append(
                                        f"Failed to delete orphaned file {file_path}: {str(e)}"
                                    )

            logger.info(
                f"Orphaned file cleanup completed: deleted {orphaned_deleted} files"
            )

            return {
                "orphaned_deleted": orphaned_deleted,
                "errors": errors,
            }

        except Exception as e:
            logger.error(f"Failed to cleanup orphaned files: {str(e)}")
            raise Exception(f"Failed to cleanup orphaned files: {str(e)}")

    async def create_full_backup(
        self, description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a full system backup (database + files) in a single archive.

        Args:
            description: Optional description for the backup

        Returns:
            Dictionary containing backup information
        """
        try:
            # Generate backup filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"full_backup_{timestamp}.zip"
            backup_path = self.backup_dir / backup_filename

            # Ensure backup directory exists
            self.backup_dir.mkdir(parents=True, exist_ok=True)

            logger.info(f"Starting full system backup: {backup_filename}")

            # Create temporary directory for staging
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                # Create database backup
                db_backup_path = temp_path / "database.sql"
                await self._create_database_dump(db_backup_path)

                # Create manifest file
                manifest = {
                    "backup_type": "full",
                    "created_at": datetime.now().isoformat(),
                    "description": description
                    or f"Full system backup created on {datetime.now()}",
                    "components": {"database": "database.sql", "files": "uploads/"},
                    "version": "1.0",
                }

                manifest_path = temp_path / "backup_manifest.json"
                with open(manifest_path, "w") as f:
                    json.dump(manifest, f, indent=2)

                # Create ZIP archive with all components
                with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                    # Add database dump
                    zipf.write(db_backup_path, "database.sql")

                    # Add manifest
                    zipf.write(manifest_path, "backup_manifest.json")

                    # Add files from uploads directory
                    uploads_dir = settings.UPLOAD_DIR
                    if uploads_dir.exists():
                        for root, dirs, files in os.walk(uploads_dir):
                            # Skip trash directory
                            root_path = Path(root)
                            if "trash" in root_path.parts:
                                continue

                            for file in files:
                                file_path = Path(root) / file
                                # Create archive path relative to uploads directory
                                arcname = Path("uploads") / file_path.relative_to(
                                    uploads_dir
                                )
                                zipf.write(file_path, arcname)

            # Verify backup file was created
            if not backup_path.exists():
                raise Exception("Backup file was not created")

            # Get file size
            file_size = backup_path.stat().st_size

            # Calculate checksum for integrity verification
            checksum = self._calculate_file_checksum(backup_path)

            # Create backup record in database
            backup_record = BackupRecord(
                backup_type="full",
                status="created",
                file_path=str(backup_path),
                size_bytes=file_size,
                description=description
                or f"Full system backup created on {datetime.now()}",
                compression_used=True,
                checksum=checksum,
            )

            self.db.add(backup_record)
            self.db.commit()

            logger.info(
                f"Full backup completed successfully: {backup_filename} ({file_size} bytes)"
            )

            return {
                "id": backup_record.id,
                "backup_type": "full",
                "filename": backup_filename,
                "file_path": str(backup_path),
                "size_bytes": file_size,
                "status": "created",
                "created_at": backup_record.created_at.isoformat(),
                "checksum": checksum,
                "components": ["database", "files", "manifest"],
            }

        except Exception as e:
            error_msg = f"Full backup failed: {str(e)}"
            logger.error(error_msg)

            # Record failed backup
            backup_record = BackupRecord(
                backup_type="full",
                status="failed",
                file_path=str(backup_path) if "backup_path" in locals() else "",
                description=f"Failed backup: {error_msg}",
            )
            self.db.add(backup_record)
            self.db.commit()

            raise Exception(error_msg)

    async def _create_database_dump(self, output_path: Path) -> None:
        """Create a database dump to a specific file path."""
        # Extract database connection details from DATABASE_URL
        db_url = settings.DATABASE_URL
        if not db_url:
            raise ValueError("DATABASE_URL not configured")

        import os
        import shutil
        import urllib.parse

        parsed = urllib.parse.urlparse(db_url)

        # Use native pg_dump (since we're in a container without Docker)
        logger.info("Using native pg_dump for database backup")

        # Check if pg_dump is available
        if not shutil.which("pg_dump"):
            raise Exception("pg_dump is not available for database backup")

        cmd = [
            "pg_dump",
            "-h",
            parsed.hostname,
            "-p",
            str(parsed.port),
            "-U",
            parsed.username,
            "-d",
            parsed.path[1:],  # Remove leading slash
            "--verbose",
            "--no-password",
        ]

        # Set password via environment variable
        env = os.environ.copy()
        env["PGPASSWORD"] = parsed.password

        # Execute pg_dump and capture output
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, check=True, env=env
            )

            # Write the SQL dump to file
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(result.stdout)

            logger.info(f"Database dump created successfully: {output_path}")

        except subprocess.CalledProcessError as e:
            error_msg = f"Database dump failed: {e.stderr}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def cleanup_all_old_data(self) -> Dict[str, Any]:
        """
        Clean up both old backups, orphaned backup files, and old trash files.

        Returns:
            Dictionary with cleanup statistics for backups, orphaned files, and trash
        """
        try:
            # Cleanup old backups (includes both tracked and orphaned files)
            backup_stats = await self.cleanup_old_backups()

            # Also cleanup any remaining orphaned files (regardless of age)
            orphaned_stats = await self.cleanup_orphaned_files()

            # Cleanup old trash files
            trash_stats = file_management_service.cleanup_old_trash()

            total_files_cleaned = (
                backup_stats.get("total_deleted", 0)
                + orphaned_stats.get("orphaned_deleted", 0)
                + trash_stats.get("deleted_files", 0)
            )

            total_stats = {
                "backups": backup_stats,
                "orphaned_files": orphaned_stats,
                "trash": trash_stats,
                "total_files_cleaned": total_files_cleaned,
                "summary": {
                    "tracked_backups_deleted": backup_stats.get("deleted_count", 0),
                    "orphaned_backups_deleted": backup_stats.get("orphaned_deleted", 0)
                    + orphaned_stats.get("orphaned_deleted", 0),
                    "trash_files_deleted": trash_stats.get("deleted_files", 0),
                    "total_deleted": total_files_cleaned,
                },
            }

            logger.info(
                f"Complete cleanup finished: {total_files_cleaned} total files cleaned"
            )
            return total_stats

        except Exception as e:
            error_msg = f"Failed to cleanup old data: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
