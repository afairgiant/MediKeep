"""
Backup Service for Medical Records

This service handles the creation of database and file backups.
Phase 1 implementation: Basic manual backup functionality.
"""

import hashlib
import os
import shutil
import subprocess
import tarfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.models import BackupRecord

logger = get_logger(__name__, "app")


class BackupService:
    """Service for creating and managing database and file backups."""

    def __init__(self, db: Session):
        self.db = db
        self.backup_dir = settings.BACKUP_DIR

    def _get_postgres_version(self) -> str:
        """Get PostgreSQL major version from the database."""
        try:
            result = self.db.execute("SELECT version()").fetchone()
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
            backup_filename = f"files_backup_{timestamp}.tar.gz"
            backup_path = self.backup_dir / backup_filename

            # Ensure backup directory exists
            self.backup_dir.mkdir(parents=True, exist_ok=True)

            uploads_dir = settings.UPLOAD_DIR
            if not uploads_dir.exists():
                logger.warning(f"Uploads directory does not exist: {uploads_dir}")
                uploads_dir.mkdir(parents=True, exist_ok=True)

            logger.info(f"Starting files backup: {backup_filename}")

            # Create tar archive
            with tarfile.open(backup_path, "w:gz") as tar:
                tar.add(uploads_dir, arcname="uploads", recursive=True)

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
            # Only return successful backups, not failed ones
            backup_records = (
                self.db.query(BackupRecord)
                .filter(BackupRecord.status == "created")
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
                        Path(record.file_path).name if record.file_path else None
                    ),
                    "file_path": record.file_path,
                    "size_bytes": record.size_bytes,
                    "created_at": record.created_at.isoformat(),
                    "description": record.description,
                    "compression_used": record.compression_used,
                    "checksum": record.checksum,
                    "file_exists": (
                        Path(record.file_path).exists() if record.file_path else False
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

            backup_path = Path(backup_record.file_path)

            # Check if file exists
            if not backup_path.exists():
                return {
                    "backup_id": backup_id,
                    "verified": False,
                    "error": "Backup file does not exist",
                }

            # Check file size
            current_size = backup_path.stat().st_size
            size_matches = current_size == backup_record.size_bytes

            # Check checksum if available
            checksum_matches = True
            if backup_record.checksum:
                current_checksum = self._calculate_file_checksum(backup_path)
                checksum_matches = current_checksum == backup_record.checksum

            # Overall verification result
            verified = size_matches and checksum_matches

            # Update status if verification failed
            if not verified:
                backup_record.status = "failed"
                self.db.commit()

            return {
                "backup_id": backup_id,
                "verified": verified,
                "file_exists": True,
                "size_matches": size_matches,
                "checksum_matches": checksum_matches,
                "current_size": current_size,
                "expected_size": backup_record.size_bytes,
            }

        except Exception as e:
            logger.error(f"Failed to verify backup {backup_id}: {str(e)}")
            return {"backup_id": backup_id, "verified": False, "error": str(e)}

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
            errors = []

            for backup in old_backups:
                try:
                    # Delete physical file
                    if backup.file_path and Path(backup.file_path).exists():
                        Path(backup.file_path).unlink()

                    # Delete database record
                    self.db.delete(backup)
                    deleted_count += 1

                except Exception as e:
                    errors.append(f"Failed to delete backup {backup.id}: {str(e)}")

            self.db.commit()

            logger.info(f"Cleanup completed: deleted {deleted_count} old backups")

            return {
                "deleted_count": deleted_count,
                "errors": errors,
                "cutoff_date": cutoff_date.isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to cleanup old backups: {str(e)}")
            raise Exception(f"Failed to cleanup old backups: {str(e)}")
