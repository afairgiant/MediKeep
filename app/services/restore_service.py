"""
Restore Service for Medical Records

This service handles the restoration of database and file backups.
Simplified version using centralized security validation and native PostgreSQL tools.
"""

import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.utils.security import SecurityValidator
from app.models.models import BackupRecord
from app.services.backup_service import BackupService

logger = get_logger(__name__, "app")


class RestoreService:
    """Service for restoring database and file backups using native PostgreSQL tools."""

    def __init__(self, db: Session):
        self.db = db
        self.backup_dir = settings.BACKUP_DIR
        self.upload_dir = settings.UPLOAD_DIR

    def _debug_print(self, message: str):
        """Print debug message only if DEBUG mode is enabled."""
        if settings.DEBUG:
            print(message)

    def _get_postgres_version(self) -> str:
        """Get PostgreSQL major version from the database."""
        try:
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

    async def preview_restore(self, backup_id: int) -> Dict[str, Any]:
        """
        Preview what will be affected by a restore operation.

        Args:
            backup_id: ID of the backup to preview

        Returns:
            Dictionary containing preview information
        """
        try:
            # Get backup record
            backup_record = (
                self.db.query(BackupRecord).filter(BackupRecord.id == backup_id).first()
            )
            if not backup_record:
                raise ValueError(f"Backup with ID {backup_id} not found")

            backup_path = Path(backup_record.file_path)  # type: ignore
            if not backup_path.exists():
                raise ValueError(f"Backup file does not exist: {backup_path}")

            backup_type = str(backup_record.backup_type)

            preview_info = {
                "backup_id": backup_id,
                "backup_type": backup_type,
                "backup_created": backup_record.created_at.isoformat(),
                "backup_size": backup_record.size_bytes,
                "backup_description": backup_record.description,
                "warnings": [],
                "affected_data": {},
            }

            if backup_type == "database":
                preview_info.update(await self._preview_database_restore(backup_path))
            elif backup_type == "files":
                preview_info.update(await self._preview_files_restore(backup_path))
            elif backup_type == "full":
                preview_info.update(await self._preview_full_restore(backup_path))
            else:
                raise ValueError(f"Unsupported backup type: {backup_type}")

            return preview_info

        except Exception as e:
            logger.error(f"Failed to preview restore for backup {backup_id}: {str(e)}")
            raise Exception(f"Failed to preview restore: {str(e)}")

    async def _preview_database_restore(self, backup_path: Path) -> Dict[str, Any]:
        """Preview database restore operation."""
        try:
            # Get current database statistics
            current_stats = await self._get_database_stats()

            # Analyze backup file (basic analysis)
            backup_stats = await self._analyze_sql_backup(backup_path)

            warnings = []

            # Check for potential data loss
            if current_stats.get("total_records", 0) > 0:
                warnings.append("Current database contains data that will be replaced")

            warnings.append("Current backup records will be preserved")

            # Check backup age
            backup_mtime = datetime.fromtimestamp(backup_path.stat().st_mtime)
            backup_age_days = (datetime.now() - backup_mtime).days
            if backup_age_days > 7:
                warnings.append(f"Backup is {backup_age_days} days old")

            return {
                "warnings": warnings,
                "affected_data": {
                    "current_database": current_stats,
                    "backup_content": backup_stats,
                    "restore_method": "Full database replacement",
                },
            }

        except Exception as e:
            logger.error(f"Failed to preview database restore: {str(e)}")
            return {
                "warnings": [f"Could not analyze backup: {str(e)}"],
                "affected_data": {"error": str(e)},
            }

    async def _preview_files_restore(self, backup_path: Path) -> Dict[str, Any]:
        """Preview files restore operation."""
        try:
            # Analyze ZIP file contents
            file_list = []
            total_files = 0
            total_size = 0

            with zipfile.ZipFile(backup_path, "r") as zipf:
                for info in zipf.infolist():
                    if not info.is_dir():
                        file_list.append(
                            {
                                "filename": info.filename,
                                "size": info.file_size,
                                "modified": datetime(*info.date_time).isoformat(),
                            }
                        )
                        total_files += 1
                        total_size += info.file_size

            # Check current uploads directory
            current_files = []
            current_total = 0
            if self.upload_dir.exists():
                for file_path in self.upload_dir.rglob("*"):
                    if file_path.is_file():
                        current_files.append(
                            str(file_path.relative_to(self.upload_dir))
                        )
                        current_total += 1

            warnings = []
            if current_total > 0:
                warnings.append(
                    f"Current uploads directory contains {current_total} files that will be replaced"
                )

            return {
                "warnings": warnings,
                "affected_data": {
                    "backup_files": {
                        "total_files": total_files,
                        "total_size": total_size,
                        "sample_files": file_list[:10],  # Show first 10 files
                    },
                    "current_files": {
                        "total_files": current_total,
                        "sample_files": current_files[:10],
                    },
                    "restore_method": "Complete files replacement",
                },
            }

        except Exception as e:
            logger.error(f"Failed to preview files restore: {str(e)}")
            return {
                "warnings": [f"Could not analyze backup: {str(e)}"],
                "affected_data": {"error": str(e)},
            }

    async def _preview_full_restore(self, backup_path: Path) -> Dict[str, Any]:
        """Preview full backup restore operation."""
        try:
            # Analyze ZIP file contents to identify components
            components = []
            total_files = 0
            total_size = 0
            has_database = False
            has_files = False

            with zipfile.ZipFile(backup_path, "r") as zipf:
                file_list = zipf.namelist()

                # Check for manifest file
                manifest_data = None
                if "backup_manifest.json" in file_list:
                    with zipf.open("backup_manifest.json") as f:
                        manifest_data = json.loads(f.read().decode("utf-8"))

                # Check components
                if "database.sql" in file_list:
                    has_database = True
                    components.append("Database")

                # Count files in uploads directory
                for filename in file_list:
                    if filename.startswith("uploads/") and not filename.endswith("/"):
                        has_files = True
                        total_files += 1
                        info = zipf.getinfo(filename)
                        total_size += info.file_size

                if has_files:
                    components.append("Files")

            # Get current system stats
            current_db_stats = await self._get_database_stats()
            current_files = 0
            if self.upload_dir.exists():
                for file_path in self.upload_dir.rglob("*"):
                    if file_path.is_file():
                        current_files += 1

            warnings = [
                "This will restore BOTH database and files",
                "All current data will be replaced",
                "Current backup records will be preserved",
                "Safety backups will be created before restore",
            ]

            if current_db_stats.get("total_records", 0) > 0:
                warnings.append(
                    f"Current database has {current_db_stats['total_records']} records"
                )

            if current_files > 0:
                warnings.append(f"Current uploads directory has {current_files} files")

            return {
                "warnings": warnings,
                "affected_data": {
                    "backup_components": components,
                    "backup_manifest": manifest_data,
                    "backup_files_count": total_files,
                    "backup_files_size": total_size,
                    "current_database": current_db_stats,
                    "current_files_count": current_files,
                    "restore_method": "Complete system replacement (database + files)",
                },
            }

        except Exception as e:
            logger.error(f"Failed to preview full restore: {str(e)}")
            return {
                "warnings": [f"Could not analyze backup: {str(e)}"],
                "affected_data": {"error": str(e)},
            }

    async def execute_restore(
        self, backup_id: int, confirmation_token: str
    ) -> Dict[str, Any]:
        """
        Execute a restore operation with safety checks.

        Args:
            backup_id: ID of the backup to restore
            confirmation_token: Security token to confirm the operation

        Returns:
            Dictionary containing restore results
        """
        try:
            self._debug_print(
                f"🔐 RESTORE DEBUG: Starting restore execution for backup ID: {backup_id}"
            )

            # Validate confirmation token (simple implementation)
            expected_token = f"restore_{backup_id}_{datetime.now().strftime('%Y%m%d')}"
            if confirmation_token != expected_token:
                self._debug_print(
                    f"RESTORE DEBUG: Invalid confirmation token. Expected: {expected_token}, Got: {confirmation_token}"
                )
                raise ValueError("Invalid confirmation token")

            self._debug_print("RESTORE DEBUG: Confirmation token validated")

            # Get backup record and extract needed data using the original session
            self._debug_print(
                f"RESTORE DEBUG: Looking up backup record for ID: {backup_id}"
            )
            backup_record = (
                self.db.query(BackupRecord).filter(BackupRecord.id == backup_id).first()
            )
            if not backup_record:
                self._debug_print(
                    f"RESTORE DEBUG: Backup with ID {backup_id} not found in database"
                )
                raise ValueError(f"Backup with ID {backup_id} not found")

            # Extract data from the record before any operations that might detach it
            backup_type = str(backup_record.backup_type)
            backup_file_path = str(backup_record.file_path)

            self._debug_print(
                f"RESTORE DEBUG: Backup details - Type: {backup_type}, Path: {backup_file_path}"
            )

            backup_path = Path(backup_file_path)  # type: ignore
            if not backup_path.exists():
                self._debug_print(
                    f"RESTORE DEBUG: Backup file does not exist at: {backup_path}"
                )
                raise ValueError(f"Backup file does not exist: {backup_path}")

            self._debug_print(
                f"RESTORE DEBUG: Backup file exists, size: {backup_path.stat().st_size} bytes"
            )

            logger.info(f"Starting restore operation for backup {backup_id}")

            # Create safety backup before restore
            self._debug_print("RESTORE DEBUG: Creating safety backup before restore...")
            safety_backup_id = await self._create_safety_backup(backup_type)
            self._debug_print(
                f"RESTORE DEBUG: Safety backup created with ID: {safety_backup_id}"
            )

            self._debug_print(
                f"🔄 RESTORE DEBUG: Starting {backup_type} restore process..."
            )
            if backup_type == "database":
                result = await self._restore_database(backup_path)
            elif backup_type == "files":
                result = await self._restore_files(backup_path)
            elif backup_type == "full":
                result = await self._restore_full_backup(backup_path)
            else:
                self._debug_print(
                    f"RESTORE DEBUG: Unsupported backup type: {backup_type}"
                )
                raise ValueError(f"Unsupported backup type: {backup_type}")

            result.update(
                {
                    "backup_id": backup_id,
                    "backup_type": backup_type,
                    "safety_backup_id": safety_backup_id,
                    "restore_completed": datetime.now().isoformat(),
                }
            )

            self._debug_print(
                f"RESTORE DEBUG: Restore operation completed successfully for backup {backup_id}"
            )
            logger.info(
                f"Restore operation completed successfully for backup {backup_id}"
            )
            return result

        except Exception as e:
            # Rollback any pending transaction to prevent transaction abort errors
            try:
                self.db.rollback()
                logger.debug("Rolled back transaction after restore failure")
            except Exception as rollback_error:
                logger.warning(f"Could not rollback transaction: {str(rollback_error)}")

            logger.error(f"Failed to execute restore for backup {backup_id}: {str(e)}")
            raise Exception(f"Failed to execute restore: {str(e)}")

    async def _create_safety_backup(self, backup_type: str) -> int:
        """Create a safety backup before restore operation."""
        try:
            backup_service = BackupService(self.db)
            description = f"Safety backup before restore - {datetime.now().isoformat()}"

            if backup_type == "database":
                result = await backup_service.create_database_backup(description)
            elif backup_type == "files":
                result = await backup_service.create_files_backup(description)
            elif backup_type == "full":
                result = await backup_service.create_full_backup(description)
            else:
                raise ValueError(f"Unknown backup type: {backup_type}")

            logger.info(f"Created safety backup with ID: {result['id']}")
            return result["id"]

        except Exception as e:
            logger.error(f"Failed to create safety backup: {str(e)}")
            raise Exception(f"Failed to create safety backup: {str(e)}")

    async def _restore_database(self, backup_path: Path) -> Dict[str, Any]:
        """Restore database using PostgreSQL's native psql tool with single transaction."""
        try:
            self._debug_print(
                f"RESTORE DEBUG: Starting native database restore for backup: {backup_path}"
            )
            logger.info("Starting native database restore using psql")

            # Validate backup path
            allowed_dirs = [self.backup_dir, self.upload_dir]
            if not SecurityValidator.validate_backup_path(backup_path, allowed_dirs):
                raise ValueError(f"Invalid backup path: {backup_path}")

            # Get validated connection parameters
            conn_params = SecurityValidator.validate_connection_params(
                settings.DATABASE_URL
            )

            # Step 1: Drop existing tables to allow restore to recreate them
            self._debug_print("RESTORE DEBUG: Step 1 - Dropping tables with CASCADE...")
            logger.info("Step 1: Dropping tables with CASCADE...")
            await self._drop_all_tables()

            # Step 2: Restore using Docker psql
            self._debug_print("RESTORE DEBUG: Step 2 - Restoring with Docker psql...")
            logger.info("Step 2: Restoring with Docker psql...")

            # Use native psql from within container
            logger.info("Using native psql for database restore")
            await self._restore_with_native_psql(backup_path, conn_params)

            self._debug_print("RESTORE DEBUG: Database restore completed successfully!")
            logger.info("Database restore completed successfully")

            return {
                "success": True,
                "message": "Database restored successfully using native PostgreSQL tools",
                "restored_size": backup_path.stat().st_size,
                "warnings": None,
            }

        except subprocess.CalledProcessError as e:
            error_msg = f"Database restore failed: {e.stderr if e.stderr else str(e)}"
            self._debug_print(f"RESTORE DEBUG: {error_msg}")
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Database restore failed: {str(e)}"
            self._debug_print(f"RESTORE DEBUG: {error_msg}")
            logger.error(error_msg)
            raise Exception(error_msg)

    async def _drop_all_tables(self):
        """Drop all user tables to allow restore to recreate them with proper SQL escaping."""
        try:
            self._debug_print("RESTORE DEBUG: Starting DROP TABLE CASCADE operation...")
            logger.info("Dropping existing tables with CASCADE to allow restore...")

            # Get list of all user tables (excluding only backup_records to preserve backup history)
            tables_query = text(
                """
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename != 'backup_records'
                AND tablename ~ '^[a-zA-Z][a-zA-Z0-9_]*$'  -- Validate table names
                ORDER BY tablename
            """
            )

            result = self.db.execute(tables_query).fetchall()
            table_names = [row[0] for row in result]

            if not table_names:
                self._debug_print("RESTORE DEBUG: No tables found to drop")
                logger.info("No tables found to drop")
                return

            # Additional security validation: ensure all table names are safe
            safe_table_names = []
            for table_name in table_names:
                # Only allow alphanumeric and underscore characters
                if (
                    table_name.replace("_", "").replace("-", "").isalnum()
                    and len(table_name) <= 63
                ):
                    safe_table_names.append(table_name)
                else:
                    logger.warning(
                        f"Skipping potentially unsafe table name: {table_name}"
                    )

            if not safe_table_names:
                self._debug_print("RESTORE DEBUG: No safe table names to drop")
                logger.info("No safe table names to drop")
                return

            self._debug_print(
                f"RESTORE DEBUG: Found {len(safe_table_names)} tables to drop: {safe_table_names}"
            )

            # Use parameterized query construction to prevent SQL injection
            # Build individual DROP statements for each table to ensure safety
            self._debug_print(
                f"RESTORE DEBUG: Executing DROP TABLE CASCADE on {len(safe_table_names)} tables..."
            )
            logger.info(f"Dropping {len(safe_table_names)} tables with CASCADE...")

            # Execute DROP for each table individually for maximum safety
            dropped_tables = []
            for table_name in safe_table_names:
                try:
                    # Use SQL identifier quoting for safety
                    drop_query = text(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')
                    self.db.execute(drop_query)
                    dropped_tables.append(table_name)
                    self._debug_print(f"   RESTORE DEBUG: Dropped table: {table_name}")
                except Exception as e:
                    logger.warning(f"Failed to drop table {table_name}: {str(e)}")
                    # Continue with other tables

            if dropped_tables:
                self.db.commit()
                self._debug_print(
                    f"RESTORE DEBUG: Successfully dropped {len(dropped_tables)} tables with CASCADE"
                )
                logger.info(f"Successfully dropped {len(dropped_tables)} tables")
            else:
                raise Exception("No tables were successfully dropped")

        except Exception as e:
            try:
                self.db.rollback()
                logger.debug("Rolled back transaction after drop failure")
            except Exception as rollback_error:
                logger.warning(f"Could not rollback transaction: {str(rollback_error)}")

            error_msg = f"Failed to drop tables: {str(e)}"
            self._debug_print(f"RESTORE DEBUG: {error_msg}")
            logger.error(error_msg)
            raise Exception(error_msg)

    async def _restore_with_native_psql(
        self, backup_path: Path, conn_params: Dict[str, str]
    ) -> None:
        """Restore database using native psql command within container."""
        logger.info("Using native psql for database restore")

        cmd = [
            "psql",
            "--host",
            conn_params["hostname"],
            "--port",
            conn_params["port"],
            "--username",
            conn_params["username"],
            "--dbname",
            conn_params["database"],
            "--file",
            str(backup_path),
            "--single-transaction",  # All-or-nothing restore
            "--echo-errors",  # Show errors
            "--quiet",  # Reduce verbose output
            "--no-password",
            "--set",
            "ON_ERROR_STOP=on",  # Stop on first error
        ]

        env = os.environ.copy()
        env["PGPASSWORD"] = conn_params["password"]

        self._debug_print("RESTORE DEBUG: Running native psql command")
        logger.debug("Executing native psql restore command")

        try:
            result = subprocess.run(
                cmd,
                env=env,
                check=True,
                stderr=subprocess.PIPE,
                stdout=subprocess.PIPE,
                text=True,
                timeout=3600,  # 1 hour timeout for large restores
            )

            if result.stderr:
                logger.info(f"psql messages: {result.stderr}")
            if result.stdout:
                logger.debug(f"psql output: {result.stdout}")

        except subprocess.CalledProcessError as e:
            error_details = f"psql failed with exit code {e.returncode}"
            if e.stderr:
                error_details += f". Error output: {e.stderr}"
            if e.stdout:
                error_details += f". Standard output: {e.stdout}"
            logger.error(error_details)
            raise Exception(f"Database restore failed: {error_details}")

    async def _restore_with_docker_psql(
        self, backup_path: Path, conn_params: Dict[str, str]
    ) -> None:
        """Restore database using Docker psql command with enhanced security."""
        logger.info("Using Docker psql for database restore")

        postgres_version = self._get_postgres_version()

        # Mount the backup file to allow access from container
        backup_file_host = backup_path.resolve()
        backup_filename = backup_path.name

        # Create a temporary directory for safe mounting
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_backup_path = Path(temp_dir) / backup_filename
            shutil.copy2(backup_file_host, temp_backup_path)

            cmd = [
                "docker",
                "run",
                "--rm",
                "--interactive",
                "--network",
                "dev_docker_medical-records-network-dev",  # Use same network as app
                "--user",
                (
                    f"{os.getuid()}:{os.getgid()}"
                    if hasattr(os, "getuid")
                    else "1000:1000"
                ),  # Security: run as current user
                "--security-opt",
                "no-new-privileges",  # Security: prevent privilege escalation
                "--read-only",  # Security: read-only container
                "--tmpfs",
                "/tmp:noexec,nosuid,size=100m",  # Secure temp space
                "-v",
                f"{temp_dir}:/backup:ro",  # Read-only mount
                "-e",
                f"PGPASSWORD={conn_params['password']}",
                f"postgres:{postgres_version}",
                "psql",
                "--host",
                conn_params["hostname"],
                "--port",
                conn_params["port"],
                "--username",
                conn_params["username"],
                "--dbname",
                conn_params["database"],
                "--file",
                f"/backup/{backup_filename}",
                "--single-transaction",  # All-or-nothing restore
                "--echo-errors",  # Show errors
                "--quiet",  # Reduce verbose output
                "--no-password",
                "--set",
                "ON_ERROR_STOP=on",  # Stop on first error
            ]

            self._debug_print(f"RESTORE DEBUG: Running Docker psql command")
            logger.debug("Executing Docker psql restore command")

            # Execute Docker psql with the backup file
            try:
                result = subprocess.run(
                    cmd,
                    check=True,
                    stderr=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    text=True,
                    timeout=3600,  # 1 hour timeout for large restores
                )

                if result.stderr:
                    logger.info(f"Docker psql messages: {result.stderr}")

                if result.stdout:
                    logger.debug(f"Docker psql output: {result.stdout}")

            except subprocess.TimeoutExpired:
                logger.error("Docker psql restore timed out after 1 hour")
                raise Exception("Restore operation timed out")
            except subprocess.CalledProcessError as e:
                logger.error(f"Docker psql failed with exit code {e.returncode}")
                if e.stderr:
                    logger.error(f"Docker psql error output: {e.stderr}")
                raise Exception(f"Docker restore failed: {e.stderr}")

    async def _restore_files(self, backup_path: Path) -> Dict[str, Any]:
        """Restore files from ZIP archive."""
        try:
            # Create backup of current uploads directory
            if self.upload_dir.exists():
                backup_dir = (
                    self.upload_dir.parent
                    / f"uploads_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                )
                shutil.copytree(self.upload_dir, backup_dir)
                logger.info(f"Created backup of current uploads at: {backup_dir}")

            # Clear current uploads directory
            if self.upload_dir.exists():
                shutil.rmtree(self.upload_dir)
            self.upload_dir.mkdir(parents=True, exist_ok=True)

            # Extract files from backup
            extracted_files = 0
            total_size = 0

            with zipfile.ZipFile(backup_path, "r") as zipf:
                for member in zipf.infolist():
                    if not member.is_dir():
                        # Remove 'uploads/' prefix from archive path
                        target_path = Path(member.filename)
                        if target_path.parts[0] == "uploads":
                            target_path = Path(*target_path.parts[1:])

                        full_target_path = self.upload_dir / target_path
                        full_target_path.parent.mkdir(parents=True, exist_ok=True)

                        # Extract file
                        with zipf.open(member) as source, open(
                            full_target_path, "wb"
                        ) as target:
                            shutil.copyfileobj(source, target)

                        extracted_files += 1
                        total_size += member.file_size

            logger.info(f"Restored {extracted_files} files ({total_size} bytes)")

            return {
                "success": True,
                "message": "Files restored successfully",
                "restored_files": extracted_files,
                "restored_size": total_size,
            }

        except Exception as e:
            error_msg = f"Files restore failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def _restore_full_backup(self, backup_path: Path) -> Dict[str, Any]:
        """Restore full backup (database + files) from ZIP archive."""
        try:
            # Extract the backup to a temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                # Extract the full backup with path validation
                with zipfile.ZipFile(backup_path, "r") as zipf:
                    for member in zipf.infolist():
                        # Validate each file path to prevent path traversal
                        if member.filename.startswith("/") or ".." in member.filename:
                            logger.warning(
                                f"Skipping potentially unsafe path: {member.filename}"
                            )
                            continue
                        # Extract safely
                        zipf.extract(member, temp_path)

                # Check for required components
                db_backup_path = temp_path / "database.sql"
                manifest_path = temp_path / "backup_manifest.json"

                if not db_backup_path.exists():
                    raise Exception("Database backup not found in full backup archive")

                # Read manifest if available
                manifest_data = None
                if manifest_path.exists():
                    with open(manifest_path, "r") as f:
                        manifest_data = json.load(f)
                    logger.info(f"Restoring full backup with manifest: {manifest_data}")

                # Copy database backup to safe location for security validation
                safe_db_backup_path = (
                    self.backup_dir
                    / f"temp_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
                )
                shutil.copy2(db_backup_path, safe_db_backup_path)

                try:
                    # Restore database first
                    logger.info("Restoring database from full backup...")
                    db_result = await self._restore_database(safe_db_backup_path)
                finally:
                    # Clean up temporary file
                    if safe_db_backup_path.exists():
                        safe_db_backup_path.unlink()
                        logger.debug(
                            f"Cleaned up temporary file: {safe_db_backup_path}"
                        )

                # Restore files if they exist
                files_restored = 0
                files_size = 0
                uploads_backup_path = temp_path / "uploads"

                if uploads_backup_path.exists():
                    logger.info("Restoring files from full backup...")

                    # Create backup of current uploads directory with retry logic
                    if self.upload_dir.exists():
                        backup_dir = (
                            self.upload_dir.parent
                            / f"uploads_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                        )
                        try:
                            shutil.copytree(self.upload_dir, backup_dir)
                            logger.info(
                                f"Created backup of current uploads at: {backup_dir}"
                            )
                        except Exception as e:
                            logger.warning(
                                f"Could not backup uploads directory: {str(e)}"
                            )

                    # Clear current uploads directory with retry logic
                    directory_cleared = False
                    if self.upload_dir.exists():
                        max_retries = 3
                        for attempt in range(max_retries):
                            try:
                                shutil.rmtree(self.upload_dir)
                                directory_cleared = True
                                break
                            except OSError as e:
                                if attempt == max_retries - 1:
                                    logger.warning(
                                        f"Could not remove uploads directory after {max_retries} attempts: {str(e)}"
                                    )
                                    logger.info(
                                        "Skipping file restore due to directory lock"
                                    )
                                    files_restored = 0
                                    files_size = 0
                                    directory_cleared = False
                                else:
                                    logger.debug(
                                        f"Retry {attempt + 1}/{max_retries} to remove uploads directory"
                                    )
                                    import asyncio

                                    await asyncio.sleep(1)
                    else:
                        directory_cleared = True

                    # Only proceed with file restore if directory was successfully cleared
                    if directory_cleared:
                        self.upload_dir.mkdir(parents=True, exist_ok=True)

                        # Copy files from backup
                        for item in uploads_backup_path.rglob("*"):
                            if item.is_file():
                                relative_path = item.relative_to(uploads_backup_path)
                                target_path = self.upload_dir / relative_path
                                target_path.parent.mkdir(parents=True, exist_ok=True)
                                shutil.copy2(item, target_path)
                                files_restored += 1
                                files_size += item.stat().st_size

                    logger.info(f"Restored {files_restored} files ({files_size} bytes)")

                return {
                    "success": True,
                    "message": "Full backup restored successfully",
                    "database_restored": True,
                    "files_restored": files_restored,
                    "total_restored_size": db_result.get("restored_size", 0)
                    + files_size,
                    "manifest": manifest_data,
                    "warnings": db_result.get(
                        "warnings"
                    ),  # Pass through database warnings
                }

        except Exception as e:
            error_msg = f"Full backup restore failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def _get_database_stats(self) -> Dict[str, Any]:
        """Get current database statistics."""
        try:
            # Get table counts
            tables_query = text(
                """
                SELECT schemaname, tablename, n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes
                FROM pg_stat_user_tables 
                ORDER BY schemaname, tablename
            """
            )

            result = self.db.execute(tables_query).fetchall()

            tables = []
            total_records = 0

            for row in result:
                table_info = {
                    "schema": row[0],
                    "table": row[1],
                    "inserts": row[2] or 0,
                    "updates": row[3] or 0,
                    "deletes": row[4] or 0,
                }
                tables.append(table_info)
                total_records += table_info["inserts"]

            return {
                "total_tables": len(tables),
                "total_records": total_records,
                "tables": tables[:10],  # Show first 10 tables
            }

        except Exception as e:
            logger.error(f"Failed to get database stats: {str(e)}")
            return {"error": str(e)}

    async def _analyze_sql_backup(self, backup_path: Path) -> Dict[str, Any]:
        """Analyze SQL backup file content without loading into memory."""
        try:
            # Basic file-based analysis without loading entire content
            file_size = backup_path.stat().st_size

            # Quick line count without loading full file
            line_count = 0
            with open(backup_path, "r", encoding="utf-8") as f:
                for _ in f:
                    line_count += 1

            return {
                "file_size": file_size,
                "estimated_lines": line_count,
                "analysis_method": "File-based (no memory loading)",
            }

        except Exception as e:
            logger.error(f"Failed to analyze SQL backup: {str(e)}")
            return {"error": str(e)}

    def generate_confirmation_token(self, backup_id: int) -> str:
        """Generate confirmation token for restore operation."""
        return f"restore_{backup_id}_{datetime.now().strftime('%Y%m%d')}"

    async def process_uploaded_backup(
        self, uploaded_file: Path, uploaded_by: str
    ) -> "BackupRecord":
        """
        Process an uploaded backup file and create a backup record.

        Args:
            uploaded_file: Path to the uploaded backup file
            uploaded_by: Username of the admin who uploaded the file

        Returns:
            BackupRecord: The created backup record
        """
        try:
            # Determine backup type from file extension and content
            backup_type = await self._determine_backup_type(uploaded_file)

            # Create permanent storage location
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"uploaded_{backup_type}_{timestamp}_{uploaded_file.name}"
            permanent_path = self.backup_dir / filename

            # Ensure backup directory exists
            self.backup_dir.mkdir(parents=True, exist_ok=True)

            # Copy file to permanent location
            shutil.copy2(uploaded_file, permanent_path)

            # Get file size
            file_size = permanent_path.stat().st_size

            # Create backup record
            backup_record = BackupRecord(
                backup_type=backup_type,
                status="uploaded",
                file_path=str(permanent_path),
                size_bytes=file_size,
                description=f"Uploaded by {uploaded_by} - {uploaded_file.name}",
                compression_used=backup_type
                in ["files", "full"],  # ZIP files are compressed
                checksum=await self._calculate_checksum(permanent_path),
            )

            self.db.add(backup_record)
            self.db.commit()
            self.db.refresh(backup_record)

            logger.info(
                f"Processed uploaded backup: {filename} (type: {backup_type}, size: {file_size})"
            )

            return backup_record

        except Exception as e:
            logger.error(f"Failed to process uploaded backup: {str(e)}")
            raise Exception(f"Failed to process uploaded backup: {str(e)}")

    async def _determine_backup_type(self, file_path: Path) -> str:
        """
        Determine the backup type from file extension and content.

        Args:
            file_path: Path to the backup file

        Returns:
            str: Backup type ('database', 'files', or 'full')
        """
        try:
            filename = file_path.name.lower()

            if filename.endswith(".sql"):
                return "database"
            elif filename.endswith(".zip"):
                # Check ZIP contents to determine if it's files or full backup
                with zipfile.ZipFile(file_path, "r") as zipf:
                    file_list = zipf.namelist()

                    # Check for full backup indicators
                    has_database = any(name == "database.sql" for name in file_list)
                    has_manifest = any(
                        name == "backup_manifest.json" for name in file_list
                    )
                    has_uploads = any(name.startswith("uploads/") for name in file_list)

                    if has_database and (has_manifest or has_uploads):
                        return "full"
                    elif has_uploads or any("/" in name for name in file_list):
                        return "files"
                    else:
                        # Default to files for ZIP without clear indicators
                        return "files"
            else:
                raise ValueError(f"Unsupported file type: {filename}")

        except Exception as e:
            logger.error(f"Failed to determine backup type: {str(e)}")
            raise Exception(f"Failed to determine backup type: {str(e)}")

    async def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        import hashlib

        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
