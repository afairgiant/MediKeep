"""
Restore Service for Medical Records

This service handles the restoration of database and file backups.
Simplified version using centralized security validation and native PostgreSQL tools.
"""

import asyncio
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
import zlib
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Dict, FrozenSet, Iterator, List, Tuple, TypeVar

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database.database import engine
from app.core.database.postgres_tools import psql_binary
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.security import SecurityValidator
from app.models.models import BackupRecord
from app.services.backup_service import (
    RESTORE_STAGING_PREFIX,
    BackupService,
    backup_excluded_paths,
    is_excluded_from_backup,
)

logger = get_logger(__name__, "app")

_UPLOADS_PREFIX = "uploads/"
_DB_MEMBER = "database.sql"
RESTORE_WORK_DIR_PREFIX = ".restore-"
_STAGING_PREFIX = RESTORE_STAGING_PREFIX
_PREVIOUS_PREFIX = f"{RESTORE_WORK_DIR_PREFIX}previous-"
# Arbitrary app-wide key; any process restoring into this database must use the same one.
_RESTORE_LOCK_KEY = 0x4D4B5253
_DRIVE_PREFIX = re.compile(r"[A-Za-z]:")

_T = TypeVar("_T")


class RestoreInProgressError(Exception):
    """Another restore holds the restore lock."""


@contextmanager
def _restore_lock() -> Iterator[None]:
    """Hold a database-wide lock for one restore, across every process using this database.

    Raises RestoreInProgressError at once if another restore holds it. A no-op on
    databases without advisory locks.
    """
    if engine.dialect.name != "postgresql":
        yield
        return
    with engine.connect() as conn:
        # Without autocommit the session sits idle in a transaction for the whole restore.
        conn.execution_options(isolation_level="AUTOCOMMIT")
        acquired = conn.execute(
            text("SELECT pg_try_advisory_lock(:key)"), {"key": _RESTORE_LOCK_KEY}
        ).scalar()
        if not acquired:
            raise RestoreInProgressError("Another restore is already in progress")
        try:
            yield
        finally:
            try:
                conn.execute(
                    text("SELECT pg_advisory_unlock(:key)"), {"key": _RESTORE_LOCK_KEY}
                )
            except Exception as e:
                # Closing the connection releases a session-level lock.
                logger.error(
                    f"Could not release the restore lock: {e}",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: "restore_lock_release_failed",
                    },
                )
                conn.invalidate()


async def _run_to_completion(func: Callable[..., _T], *args: Any) -> _T:
    """Run func in a worker thread.

    If the caller is cancelled, waits for the worker to finish before re-raising
    the cancellation, so locks held by the caller outlive the work. A worker error
    raised meanwhile is attached to the cancellation as restore_step_error.
    """
    task = asyncio.ensure_future(asyncio.to_thread(func, *args))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError as cancel:
        while not task.done():
            try:
                await asyncio.wait({task})
            except asyncio.CancelledError:
                continue
        if not task.cancelled() and task.exception() is not None:
            cancel.restore_step_error = task.exception()
        raise


def _safe_member_path(name: str) -> PurePosixPath:
    """Normalized relative path for an archive member name.

    Raises ValueError for an empty, absolute, drive-qualified or backslash path, or
    one with a parent ('..') component.
    """
    path = PurePosixPath(name)
    if (
        "\\" in name
        or path.is_absolute()
        or not path.parts
        or ".." in path.parts
        or _DRIVE_PREFIX.match(name)
    ):
        raise ValueError(f"Unsafe path in backup archive: {name}")
    return path


def _move_contents(source: Path, destination: Path, keep: FrozenSet[Path]) -> None:
    """Move every entry of source into destination, merging into existing directories.

    Paths in keep stay in source; directories above them are walked into, not moved.
    """
    for child in list(source.iterdir()):
        if child in keep:
            continue
        target = destination / child.name
        is_real_dir = child.is_dir() and not child.is_symlink()
        if is_real_dir and (target.is_dir() or any(child in k.parents for k in keep)):
            target.mkdir(exist_ok=True)
            _move_contents(child, target, keep)
        else:
            child.rename(target)


def _manifest_lists_files(manifest: Any) -> bool:
    """True if a full backup's manifest declares a files component, even an empty one."""
    components = manifest.get("components") if isinstance(manifest, dict) else None
    return isinstance(components, dict) and "files" in components


def _check_backup_readable(path: Path, backup_type: str) -> None:
    """Raise ValueError unless a ZIP backup reads intact and has what its type needs."""
    if backup_type == "database":
        return
    try:
        with zipfile.ZipFile(path, "r") as zipf:
            names = zipf.namelist()
            damaged = zipf.testzip()
    except (zipfile.BadZipFile, zlib.error, EOFError) as e:
        raise ValueError(f"Backup archive cannot be opened: {e}") from e
    if damaged is not None:
        raise ValueError(f"Backup archive member {damaged} is damaged")
    if backup_type == "full" and _DB_MEMBER not in names:
        raise ValueError(f"Backup archive has no {_DB_MEMBER}")


class RestoreService:
    """Service for restoring database and file backups using native PostgreSQL tools."""

    def __init__(self, db: Session):
        self.db = db
        self.backup_dir = settings.BACKUP_DIR
        self.upload_dir = settings.UPLOAD_DIR
        # Set once tables are dropped or uploads are moved; earlier failures change nothing.
        self._data_changed = False

    def _debug_print(self, message: str):
        """Print debug message only if DEBUG mode is enabled."""
        if settings.DEBUG:
            print(message)

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
                "warnings": [
                    "Could not analyze the backup. See the server logs for details."
                ],
                "affected_data": {"error": "Backup analysis failed"},
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
                "warnings": [
                    "Could not analyze the backup. See the server logs for details."
                ],
                "affected_data": {"error": "Backup analysis failed"},
            }

    async def _preview_full_restore(self, backup_path: Path) -> Dict[str, Any]:
        """Preview full backup restore operation."""
        try:
            # Analyze ZIP file contents to identify components
            components = []
            total_files = 0
            total_size = 0
            has_files = False

            with zipfile.ZipFile(backup_path, "r") as zipf:
                file_list = zipf.namelist()

                # Check for manifest file
                manifest_data = None
                if "backup_manifest.json" in file_list:
                    with zipf.open("backup_manifest.json") as f:
                        manifest_data = json.loads(f.read().decode("utf-8"))

                # Check components
                if _DB_MEMBER in file_list:
                    components.append("Database")

                # Count files in uploads directory
                for filename in file_list:
                    if filename.startswith(_UPLOADS_PREFIX) and not filename.endswith(
                        "/"
                    ):
                        has_files = True
                        total_files += 1
                        info = zipf.getinfo(filename)
                        total_size += info.file_size

                if has_files or _manifest_lists_files(manifest_data):
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

            if "Files" in components and not has_files:
                warnings.append(
                    "The backup holds no files; restoring it removes the current "
                    "uploads, except the trash"
                )

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
                "warnings": [
                    "Could not analyze the backup. See the server logs for details."
                ],
                "affected_data": {"error": "Backup analysis failed"},
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

        Raises:
            RestoreInProgressError: another restore, in any process, is running.
        """
        with _restore_lock():
            return await self._execute_restore_locked(backup_id, confirmation_token)

    async def _execute_restore_locked(
        self, backup_id: int, confirmation_token: str
    ) -> Dict[str, Any]:
        safety_backup_id = None
        self._data_changed = False
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

        except asyncio.CancelledError as cancel:
            step_error = getattr(cancel, "restore_step_error", None)
            if step_error is not None:
                self._report_restore_failure(backup_id, safety_backup_id, step_error)
            raise
        except Exception as e:
            self._report_restore_failure(backup_id, safety_backup_id, e)
            raise Exception(f"Failed to execute restore: {str(e)}")

    def _report_restore_failure(
        self, backup_id: int, safety_backup_id: Any, error: BaseException
    ) -> None:
        """Roll back the session and log the failure, naming the safety backup if data changed."""
        # Rollback any pending transaction to prevent transaction abort errors
        try:
            self.db.rollback()
            logger.debug("Rolled back transaction after restore failure")
        except Exception as rollback_error:
            logger.warning(f"Could not rollback transaction: {str(rollback_error)}")

        logger.error(f"Failed to execute restore for backup {backup_id}: {str(error)}")
        if self._data_changed and safety_backup_id is not None:
            logger.error(
                f"Restore of backup {backup_id} left data partly changed; restore "
                f"safety backup {safety_backup_id} to roll back",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "restore_incomplete",
                    LogFields.RECORD_ID: backup_id,
                },
            )

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

            # The restore replaces current data, so the copy it falls back on must be readable.
            await _run_to_completion(
                _check_backup_readable, Path(result["file_path"]), backup_type
            )

            logger.info(f"Created and checked safety backup with ID: {result['id']}")
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

            # Dropping tables is irreversible, so prove psql can log in first
            await self._check_psql_connection(conn_params)

            # Step 1: Drop existing tables to allow restore to recreate them
            self._debug_print("RESTORE DEBUG: Step 1 - Dropping tables with CASCADE...")
            logger.info("Step 1: Dropping tables with CASCADE...")
            self._data_changed = True
            await self._drop_all_tables()

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
            tables_query = text("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename != 'backup_records'
                AND tablename ~ '^[a-zA-Z][a-zA-Z0-9_]*$'  -- Validate table names
                ORDER BY tablename
            """)

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

    @staticmethod
    def _psql_connection_args(conn_params: Dict[str, str]) -> list:
        return [
            psql_binary(),
            "--host",
            conn_params["hostname"],
            "--port",
            conn_params["port"],
            "--username",
            conn_params["username"],
            "--dbname",
            conn_params["database"],
            "--no-password",
        ]

    @staticmethod
    def _psql_env(conn_params: Dict[str, str]) -> Dict[str, str]:
        env = os.environ.copy()
        env["PGPASSWORD"] = conn_params["password"]
        return env

    async def _check_psql_connection(self, conn_params: Dict[str, str]) -> None:
        """Run a trivial query through psql with the restore's credentials.

        Raises:
            Exception: psql could not connect or authenticate; nothing was changed.
        """
        cmd = self._psql_connection_args(conn_params) + [
            "--quiet",
            "--command",
            "SELECT 1",
        ]

        try:
            subprocess.run(
                cmd,
                env=self._psql_env(conn_params),
                check=True,
                stderr=subprocess.PIPE,
                stdout=subprocess.PIPE,
                text=True,
                timeout=30,
            )
        except subprocess.CalledProcessError as e:
            error_details = f"psql could not connect (exit code {e.returncode})"
            if e.stderr:
                error_details += f". Error output: {e.stderr}"
            logger.error(error_details)
            raise Exception(
                f"Database restore aborted before any changes: {error_details}"
            )
        except subprocess.TimeoutExpired:
            logger.error("psql connection check timed out")
            raise Exception(
                "Database restore aborted before any changes: "
                "psql connection check timed out"
            )

    async def _restore_with_native_psql(
        self, backup_path: Path, conn_params: Dict[str, str]
    ) -> None:
        """Restore database using native psql command within container."""
        logger.info("Using native psql for database restore")

        cmd = self._psql_connection_args(conn_params) + [
            "--file",
            str(backup_path),
            "--single-transaction",  # All-or-nothing restore
            "--echo-errors",  # Show errors
            "--quiet",  # Reduce verbose output
            "--set",
            "ON_ERROR_STOP=on",  # Stop on first error
        ]

        env = self._psql_env(conn_params)

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

    async def _restore_files(self, backup_path: Path) -> Dict[str, Any]:
        """Replace the contents of the uploads directory with a files backup."""
        try:
            with zipfile.ZipFile(backup_path, "r") as zipf:
                members = self._upload_members(zipf, prefix_required=False)
                staging = self._new_staging_dir()
                try:
                    extracted_files, total_size = await _run_to_completion(
                        self._stage_uploads, zipf, members, staging
                    )
                except BaseException:
                    shutil.rmtree(staging, ignore_errors=True)
                    raise
            await _run_to_completion(self._swap_in_staged_uploads, staging)

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
            staging = None
            files_restored = 0
            files_size = 0
            with zipfile.ZipFile(backup_path, "r") as zipf:
                members = self._upload_members(zipf, prefix_required=True)
                names = set(zipf.namelist())
                if _DB_MEMBER not in names:
                    raise Exception("Database backup not found in full backup archive")

                manifest_data = None
                if "backup_manifest.json" in names:
                    manifest_data = json.loads(zipf.read("backup_manifest.json"))
                    logger.info(f"Restoring full backup with manifest: {manifest_data}")

                if members or _manifest_lists_files(manifest_data):
                    staging = self._new_staging_dir()

                # Staged before the database restore, so an unreadable archive changes nothing.
                try:
                    if staging is not None:
                        files_restored, files_size = await _run_to_completion(
                            self._stage_uploads, zipf, members, staging
                        )
                    db_result = await self._restore_database_member(zipf)
                except BaseException:
                    if staging is not None:
                        shutil.rmtree(staging, ignore_errors=True)
                    raise

            if staging is not None:
                logger.info("Restoring files from full backup...")
                await _run_to_completion(self._swap_in_staged_uploads, staging)
                logger.info(f"Restored {files_restored} files ({files_size} bytes)")

            return {
                "success": True,
                "message": "Full backup restored successfully",
                "database_restored": True,
                "files_restored": files_restored,
                "total_restored_size": db_result.get("restored_size", 0) + files_size,
                "manifest": manifest_data,
                "warnings": db_result.get("warnings"),  # Pass through database warnings
            }

        except Exception as e:
            error_msg = f"Full backup restore failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def _restore_database_member(self, zipf: zipfile.ZipFile) -> Dict[str, Any]:
        """Restore the database from the archive's dump, removing the temporary copy."""
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        # Under backup_dir, the only place _restore_database accepts; nested so orphan cleanup skips it.
        with tempfile.TemporaryDirectory(
            dir=self.backup_dir, prefix="restore-work-"
        ) as work_dir:
            dump = Path(work_dir) / _DB_MEMBER
            with zipf.open(_DB_MEMBER) as source, open(dump, "wb") as target:
                shutil.copyfileobj(source, target)
            logger.info("Restoring database from full backup...")
            return await self._restore_database(dump)

    def _upload_members(
        self, zipf: zipfile.ZipFile, prefix_required: bool
    ) -> List[Tuple[zipfile.ZipInfo, str]]:
        """Archive files to restore, as (member, path relative to the uploads directory).

        Raises ValueError for an unsafe path, or a file where the trash directory or
        one of its parents must stay a directory. Paths backups exclude and restore
        work directories are left out.
        """
        excluded = backup_excluded_paths(self.upload_dir)
        members = []
        for member in zipf.infolist():
            if member.is_dir():
                continue
            name = member.filename
            if name.startswith(_UPLOADS_PREFIX):
                name = name[len(_UPLOADS_PREFIX) :]
            elif prefix_required:
                continue
            relative = Path(_safe_member_path(name))
            if relative.parts[0].startswith(RESTORE_WORK_DIR_PREFIX):
                continue
            if is_excluded_from_backup(relative, excluded):
                continue
            if any(path.is_relative_to(relative) for path in excluded):
                raise ValueError(
                    f"Backup archive file {member.filename} would replace a directory "
                    "that holds the trash"
                )
            members.append((member, relative.as_posix()))
        return members

    def _new_staging_dir(self) -> Path:
        """Create an empty staging directory inside the uploads directory."""
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        staging = self.upload_dir / f"{_STAGING_PREFIX}{stamp}"
        staging.mkdir()
        return staging

    def _stage_uploads(
        self,
        zipf: zipfile.ZipFile,
        members: List[Tuple[zipfile.ZipInfo, str]],
        staging: Path,
    ) -> Tuple[int, int]:
        """Extract members into staging and return (files, bytes).

        On failure staging is left partly written; the caller removes it.
        """
        staging_root = staging.resolve()
        extracted_files = 0
        total_size = 0
        for member, relative in members:
            target_path = staging / relative
            if not target_path.resolve().is_relative_to(staging_root):
                raise ValueError(f"Unsafe path in backup archive: {member.filename}")
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with zipf.open(member) as source, open(target_path, "wb") as target:
                shutil.copyfileobj(source, target)
            extracted_files += 1
            total_size += member.file_size
        return extracted_files, total_size

    def _swap_in_staged_uploads(self, staging: Path) -> None:
        """Replace the uploads directory's contents with staging's, keeping excluded paths.

        The uploads directory itself is never removed. If the swap fails, the previous
        contents are left in a holding directory named in the error, not deleted.
        """
        previous = self.upload_dir / (
            _PREVIOUS_PREFIX + staging.name[len(_STAGING_PREFIX) :]
        )
        previous.mkdir()
        # Earlier restores' work directories can hold the only copy of files; leave them.
        earlier_work_dirs = {
            p
            for p in self.upload_dir.iterdir()
            if p.name.startswith(RESTORE_WORK_DIR_PREFIX)
            and p not in (staging, previous)
        }
        if earlier_work_dirs:
            names = ", ".join(sorted(p.name for p in earlier_work_dirs))
            logger.warning(
                f"Leaving earlier restore work directories in place: {names}"
            )
        keep = frozenset(
            {staging, previous}
            | earlier_work_dirs
            | {self.upload_dir / p for p in backup_excluded_paths(self.upload_dir)}
        )

        self._data_changed = True
        try:
            _move_contents(self.upload_dir, previous, keep)
            _move_contents(staging, self.upload_dir, frozenset())
        except Exception as e:
            raise RuntimeError(
                f"Could not move restored files into place; the previous files are "
                f"in {previous}: {e}"
            ) from e

        for leftover in (previous, staging):
            try:
                shutil.rmtree(leftover)
            except OSError as e:
                logger.warning(f"Could not remove {leftover} after restore: {e}")

    async def _get_database_stats(self) -> Dict[str, Any]:
        """Get current database statistics."""
        try:
            # Get table counts
            tables_query = text("""
                SELECT schemaname, tablename, n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes
                FROM pg_stat_user_tables 
                ORDER BY schemaname, tablename
            """)

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
            return {"error": "Could not read database statistics"}

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
            return {"error": "Could not analyze the SQL backup"}

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
            if filename.endswith(".zip"):
                # Check ZIP contents to determine if it's files or full backup
                with zipfile.ZipFile(file_path, "r") as zipf:
                    file_list = zipf.namelist()

                    # Check for full backup indicators
                    has_database = _DB_MEMBER in file_list
                    has_manifest = any(
                        name == "backup_manifest.json" for name in file_list
                    )
                    has_uploads = any(
                        name.startswith(_UPLOADS_PREFIX) for name in file_list
                    )

                    if has_database and (has_manifest or has_uploads):
                        return "full"
                    if has_uploads or any("/" in name for name in file_list):
                        return "files"
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
