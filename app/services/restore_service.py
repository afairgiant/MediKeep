"""
Restore Service for Medical Records

This service handles the restoration of database and file backups.
Phase 2 implementation: Basic restore functionality with safety checks.
"""

import json
import os
import re
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
from app.core.logging_config import get_logger
from app.models.models import BackupRecord
from app.services.backup_service import BackupService

logger = get_logger(__name__, "app")


class RestoreService:
    """Service for restoring database and file backups."""

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
                    f"❌ RESTORE DEBUG: Invalid confirmation token. Expected: {expected_token}, Got: {confirmation_token}"
                )
                raise ValueError("Invalid confirmation token")

            self._debug_print("✅ RESTORE DEBUG: Confirmation token validated")

            # Get backup record and extract needed data using the original session
            self._debug_print(
                f"🔍 RESTORE DEBUG: Looking up backup record for ID: {backup_id}"
            )
            backup_record = (
                self.db.query(BackupRecord).filter(BackupRecord.id == backup_id).first()
            )
            if not backup_record:
                self._debug_print(
                    f"❌ RESTORE DEBUG: Backup with ID {backup_id} not found in database"
                )
                raise ValueError(f"Backup with ID {backup_id} not found")

            # Extract data from the record before any operations that might detach it
            backup_type = str(backup_record.backup_type)
            backup_file_path = str(backup_record.file_path)

            print(
                f"📋 RESTORE DEBUG: Backup details - Type: {backup_type}, Path: {backup_file_path}"
            )

            backup_path = Path(backup_file_path)  # type: ignore
            if not backup_path.exists():
                self._debug_print(
                    f"❌ RESTORE DEBUG: Backup file does not exist at: {backup_path}"
                )
                raise ValueError(f"Backup file does not exist: {backup_path}")

            print(
                f"✅ RESTORE DEBUG: Backup file exists, size: {backup_path.stat().st_size} bytes"
            )

            logger.info(f"Starting restore operation for backup {backup_id}")

            # Create safety backup before restore
            self._debug_print(
                "🛡️ RESTORE DEBUG: Creating safety backup before restore..."
            )
            safety_backup_id = await self._create_safety_backup(backup_type)
            print(
                f"✅ RESTORE DEBUG: Safety backup created with ID: {safety_backup_id}"
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
                    f"❌ RESTORE DEBUG: Unsupported backup type: {backup_type}"
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

            print(
                f"🎉 RESTORE DEBUG: Restore operation completed successfully for backup {backup_id}"
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
        """Restore database using clean slate approach - truncate and insert."""
        import asyncio

        async def restore_operations():
            print(
                "🚀 RESTORE DEBUG: Starting clean slate database restore operations..."
            )

            # Step 1: Clear existing data from all tables
            self._debug_print("🚀 RESTORE DEBUG: Step 1 - Clearing tables...")
            logger.info("Step 1: Clearing tables...")
            await self._clear_all_tables()

            # Step 2: Extract and execute only INSERT statements from backup
            self._debug_print(
                "🚀 RESTORE DEBUG: Step 2 - Extracting INSERT statements..."
            )
            logger.info("Step 2: Extracting INSERT statements...")
            insert_statements = await self._extract_insert_statements(backup_path)

            # Step 3: Execute INSERT statements
            self._debug_print(
                "🚀 RESTORE DEBUG: Step 3 - Executing INSERT statements..."
            )
            logger.info("Step 3: Executing INSERT statements...")
            await self._execute_insert_statements(insert_statements)

            # Step 4: Reset sequences to match the restored data
            self._debug_print("🚀 RESTORE DEBUG: Step 4 - Resetting sequences...")
            logger.info("Step 4: Resetting sequences...")
            await self._reset_sequences()

            self._debug_print(
                "🎉 RESTORE DEBUG: All restore operations completed successfully!"
            )
            return {
                "success": True,
                "message": "Database restored successfully using clean slate approach",
                "restored_size": backup_path.stat().st_size,
                "warnings": None,
            }

        try:
            print(
                f"🎯 RESTORE DEBUG: Starting clean slate database restore for backup: {backup_path}"
            )
            logger.info("Starting clean slate database restore")

            # Set a 5-minute timeout for the entire operation
            self._debug_print(
                "⏰ RESTORE DEBUG: Setting 5-minute timeout for restore operation..."
            )
            result = await asyncio.wait_for(restore_operations(), timeout=300.0)
            print(
                "🎉 RESTORE DEBUG: Clean slate database restore completed successfully!"
            )
            logger.info("Clean slate database restore completed successfully")
            return result

        except asyncio.TimeoutError:
            self._debug_print(
                "⏰❌ RESTORE DEBUG: Database restore timed out after 5 minutes!"
            )
            logger.error("Database restore timed out after 5 minutes")
            raise Exception("Database restore timed out - operation took too long")
        except Exception as e:
            error_msg = f"Database restore failed: {str(e)}"
            self._debug_print(f"❌ RESTORE DEBUG: {error_msg}")
            logger.error(error_msg)
            raise Exception(error_msg)

    async def _clear_all_tables(self):
        """Clear all data from existing tables while preserving structure."""
        foreign_keys_disabled = False
        try:
            self._debug_print("🧹 RESTORE DEBUG: Starting table clearing process...")
            logger.info("Clearing existing table data...")

            # Get list of all user tables (excluding system tables)
            tables_query = text(
                """
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename != 'alembic_version'
                ORDER BY tablename
            """
            )

            result = self.db.execute(tables_query).fetchall()
            table_names = [row[0] for row in result]

            if not table_names:
                self._debug_print("❌ RESTORE DEBUG: No tables found to clear")
                logger.info("No tables found to clear")
                return

            print(
                f"📋 RESTORE DEBUG: Found {len(table_names)} tables to clear: {table_names}"
            )

            # Use DELETE instead of TRUNCATE to avoid lock issues
            print(
                "🗑️ RESTORE DEBUG: Deleting data from tables (avoiding TRUNCATE locks)..."
            )
            logger.info("Deleting data from tables (avoiding TRUNCATE locks)...")

            # Disable foreign key checks temporarily
            self._debug_print("🔓 RESTORE DEBUG: Disabling foreign key checks...")
            self.db.execute(text("SET session_replication_role = replica"))
            foreign_keys_disabled = True

            deleted_count = 0
            for table_name in table_names:
                try:
                    self._debug_print(
                        f"   🗑️ RESTORE DEBUG: Deleting from {table_name}..."
                    )
                    result = self.db.execute(text(f"DELETE FROM {table_name}"))
                    # SQLAlchemy Result doesn't always have rowcount, use alternative
                    row_count = getattr(result, "rowcount", 0) or 0
                    deleted_count += row_count
                    print(
                        f"   ✅ RESTORE DEBUG: Deleted {row_count} rows from {table_name}"
                    )
                    logger.debug(f"Deleted {row_count} rows from {table_name}")
                except Exception as e:
                    print(
                        f"   ❌ RESTORE DEBUG: Could not clear table {table_name}: {str(e)}"
                    )
                    logger.warning(f"Could not clear table {table_name}: {str(e)}")

            # Reset sequences manually after DELETE
            self._debug_print("🔢 RESTORE DEBUG: Resetting sequences after DELETE...")
            logger.info("Resetting sequences after DELETE...")
            for table_name in table_names:
                try:
                    # Try to reset the sequence for this table
                    seq_name = f"{table_name}_id_seq"
                    self._debug_print(
                        f"   🔢 RESTORE DEBUG: Resetting sequence {seq_name}..."
                    )
                    self.db.execute(text(f"SELECT setval('{seq_name}', 1, false)"))
                    self._debug_print(f"   ✅ RESTORE DEBUG: Reset sequence {seq_name}")
                except Exception as e:
                    print(
                        f"   ⚠️ RESTORE DEBUG: No sequence to reset for {table_name}: {str(e)}"
                    )
                    logger.debug(f"No sequence to reset for {table_name}: {str(e)}")

            # Commit the changes
            self._debug_print("💾 RESTORE DEBUG: Committing deletion changes...")
            self.db.commit()

            print(
                f"✅ RESTORE DEBUG: Successfully deleted {deleted_count} total rows from {len(table_names)} tables"
            )
            logger.info(
                f"Successfully deleted {deleted_count} total rows from {len(table_names)} tables"
            )

        except Exception as e:
            try:
                self.db.rollback()
            except:
                pass
            logger.error(f"Failed to clear tables: {str(e)}")
            raise
        finally:
            # Always re-enable foreign key checks, even if an error occurred
            if foreign_keys_disabled:
                try:
                    self.db.execute(text("SET session_replication_role = DEFAULT"))
                except Exception as fk_error:
                    logger.warning(
                        f"Could not re-enable foreign key checks: {str(fk_error)}"
                    )

    async def _extract_insert_statements(self, backup_path: Path) -> List[str]:
        """Extract INSERT statements from SQL backup file, supporting both INSERT and COPY formats."""
        try:
            self._debug_print(
                "📄 RESTORE DEBUG: Starting INSERT statement extraction..."
            )
            logger.info("Extracting INSERT statements from backup...")

            self._debug_print(f"📂 RESTORE DEBUG: Reading backup file: {backup_path}")
            with open(backup_path, "r", encoding="utf-8") as f:
                content = f.read()

            self._debug_print(
                f"📊 RESTORE DEBUG: Backup file size: {len(content)} characters"
            )
            lines = content.split("\n")
            self._debug_print(f"📊 RESTORE DEBUG: Backup file has {len(lines)} lines")

            insert_statements = []

            # First, try to find direct INSERT statements
            current_insert = ""
            in_insert = False

            for i, line in enumerate(lines):
                line_stripped = line.strip()

                # Start of INSERT statement
                if line_stripped.startswith("INSERT INTO"):
                    in_insert = True
                    current_insert = line

                    # Extract table name for debugging
                    try:
                        table_name = (
                            line_stripped.split("INSERT INTO")[1].split()[0].strip()
                        )
                        if len(insert_statements) % 10 == 0:  # Log every 10th statement
                            print(
                                f"📝 RESTORE DEBUG: Found INSERT for {table_name} (statement #{len(insert_statements) + 1})"
                            )
                    except:
                        pass

                    # Check if this is a single-line INSERT
                    if line_stripped.endswith(";"):
                        insert_statements.append(current_insert)
                        current_insert = ""
                        in_insert = False

                # Continuation of multi-line INSERT
                elif in_insert:
                    current_insert += "\n" + line

                    # End of multi-line INSERT
                    if line_stripped.endswith(";"):
                        insert_statements.append(current_insert)
                        current_insert = ""
                        in_insert = False

            print(
                f"📝 RESTORE DEBUG: Found {len(insert_statements)} direct INSERT statements"
            )

            # If no INSERT statements found, look for COPY format and convert
            if len(insert_statements) == 0:
                print(
                    "🔄 RESTORE DEBUG: No INSERT statements found, looking for COPY format..."
                )
                copy_inserts = self._convert_copy_to_inserts(lines)
                insert_statements.extend(copy_inserts)
                print(
                    f"🔄 RESTORE DEBUG: Converted {len(copy_inserts)} COPY statements to INSERT format"
                )

            print(
                f"✅ RESTORE DEBUG: Total extracted statements: {len(insert_statements)}"
            )

            # Count statements by table for debugging
            table_counts = {}
            for stmt in insert_statements:
                try:
                    table_name = stmt.split("INSERT INTO")[1].split()[0].strip()
                    table_counts[table_name] = table_counts.get(table_name, 0) + 1
                except:
                    pass

            self._debug_print("📊 RESTORE DEBUG: INSERT statements by table:")
            for table, count in sorted(table_counts.items()):
                self._debug_print(f"   {table}: {count} statements")

            logger.info(f"Extracted {len(insert_statements)} INSERT statements")
            return insert_statements

        except Exception as e:
            logger.error(f"Failed to extract INSERT statements: {str(e)}")
            raise

    def _convert_copy_to_inserts(self, lines: List[str]) -> List[str]:
        """Convert PostgreSQL COPY format to INSERT statements."""
        try:
            self._debug_print(
                "🔄 RESTORE DEBUG: Converting COPY format to INSERT statements..."
            )
            insert_statements = []

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # Look for COPY statement
                if line.startswith("COPY ") and "FROM stdin;" in line:
                    # Parse the COPY statement
                    copy_parts = line.split()
                    table_name = copy_parts[1]  # e.g., "public.users" or "users"

                    # Remove "public." prefix if present
                    if "." in table_name:
                        table_name = table_name.split(".", 1)[1]

                    # Extract column names from COPY statement
                    columns_start = line.find("(")
                    columns_end = line.find(")")

                    if columns_start != -1 and columns_end != -1:
                        columns_str = line[columns_start + 1 : columns_end]
                        # Preserve quotes for mixed-case column names in PostgreSQL
                        columns = []
                        for col in columns_str.split(","):
                            col = col.strip()
                            # Keep quotes if they exist (needed for case-sensitive column names)
                            if col.startswith('"') and col.endswith('"'):
                                columns.append(col)  # Keep the quotes
                            else:
                                columns.append(col.strip('"'))  # Remove quotes if any

                    else:
                        self._debug_print(
                            f"⚠️ RESTORE DEBUG: Could not parse columns for table {table_name}"
                        )
                        i += 1
                        continue

                    self._debug_print(
                        f"📋 RESTORE DEBUG: Processing COPY for table {table_name} with {len(columns)} columns"
                    )

                    # Read data lines until we hit the end marker "\."
                    i += 1
                    data_lines = []
                    while i < len(lines):
                        data_line = lines[i]
                        if data_line.strip() == "\\.":
                            break
                        if data_line.strip():  # Skip empty lines
                            data_lines.append(data_line)
                        i += 1

                    self._debug_print(
                        f"📊 RESTORE DEBUG: Found {len(data_lines)} data rows for {table_name}"
                    )

                    # Convert each data line to an INSERT statement
                    for data_line in data_lines:
                        try:
                            # Split data by tabs (COPY format uses tabs)
                            values = data_line.split("\t")

                            # Convert values to SQL format
                            sql_values = []
                            for value in values:
                                if value == "\\N":  # PostgreSQL NULL marker
                                    sql_values.append("NULL")
                                elif value.isdigit() or (
                                    value.startswith("-") and value[1:].isdigit()
                                ):
                                    # Integer values
                                    sql_values.append(value)
                                elif self._is_float(value):
                                    # Float values
                                    sql_values.append(value)
                                elif value.lower() in ("t", "f"):
                                    # Boolean values
                                    sql_values.append(
                                        "true" if value.lower() == "t" else "false"
                                    )
                                else:
                                    # String values - escape single quotes
                                    escaped_value = value.replace("'", "''")
                                    sql_values.append(f"'{escaped_value}'")

                            # Create INSERT statement
                            columns_str = ", ".join(columns)
                            values_str = ", ".join(sql_values)
                            insert_stmt = f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str});"
                            insert_statements.append(insert_stmt)

                        except Exception as e:
                            self._debug_print(
                                f"❌ RESTORE DEBUG: Failed to convert data line for {table_name}: {str(e)}"
                            )
                            self._debug_print(f"   Data line: {data_line[:100]}...")
                            continue

                i += 1

            self._debug_print(
                f"✅ RESTORE DEBUG: Successfully converted {len(insert_statements)} COPY rows to INSERT statements"
            )
            return insert_statements

        except Exception as e:
            self._debug_print(
                f"❌ RESTORE DEBUG: Failed to convert COPY to INSERT: {str(e)}"
            )
            logger.error(f"Failed to convert COPY to INSERT: {str(e)}")
            return []

    def _is_float(self, value: str) -> bool:
        """Check if a string represents a float value."""
        try:
            float(value)
            return True
        except ValueError:
            return False

    async def _execute_insert_statements(self, insert_statements: List[str]):
        """Execute INSERT statements with proper dependency ordering and error handling"""
        logger.info(
            "💾 RESTORE DEBUG: Starting execution of %d INSERT statements...",
            len(insert_statements),
        )

        # Define table dependency order (dependencies first, then dependents)
        table_order = [
            "alembic_version",  # No dependencies
            "users",  # No dependencies
            "practitioners",  # No dependencies
            "pharmacies",  # No dependencies
            "patients",  # Depends on users
            "allergies",  # Depends on patients
            "conditions",  # Depends on patients, practitioners
            "encounters",  # Depends on patients, practitioners
            "immunizations",  # Depends on patients, practitioners
            "lab_results",  # Depends on patients, practitioners
            "lab_result_files",  # Depends on lab_results
            "medications",  # Depends on patients, practitioners, pharmacies
            "procedures",  # Depends on patients, practitioners
            "treatments",  # Depends on patients, practitioners, conditions
            "vitals",  # Depends on patients, practitioners
            "backup_records",  # No critical dependencies
            "activity_logs",  # Depends on users, patients (insert last)
        ]

        # Group statements by table
        statements_by_table = {}
        for stmt in insert_statements:
            # Extract table name from INSERT statement
            if stmt.strip().upper().startswith("INSERT INTO"):
                table_match = re.search(r"INSERT INTO\s+(\w+)", stmt, re.IGNORECASE)
                if table_match:
                    table_name = table_match.group(1).lower()
                    if table_name not in statements_by_table:
                        statements_by_table[table_name] = []
                    statements_by_table[table_name].append(stmt)

        logger.info("⏰ RESTORE DEBUG: Setting statement timeout to 60s...")
        self.db.execute(text("SET statement_timeout = '60s'"))

        successful_inserts = 0
        failed_inserts = 0
        failed_by_table = {}

        try:
            # Process tables in dependency order
            for table_name in table_order:
                if table_name not in statements_by_table:
                    continue

                table_statements = statements_by_table[table_name]
                logger.info(
                    "📦 RESTORE DEBUG: Processing table '%s' with %d statements...",
                    table_name,
                    len(table_statements),
                )

                # Apply column name fixes and data validation fixes for known schema differences
                fixed_statements = []
                for stmt in table_statements:
                    fixed_stmt = self._fix_column_names(stmt, table_name)
                    fixed_stmt = self._fix_data_validation_issues(
                        fixed_stmt, table_name
                    )
                    fixed_statements.append(fixed_stmt)

                # Process in smaller batches for better error isolation
                batch_size = 25  # Smaller batches for better error handling
                for i in range(0, len(fixed_statements), batch_size):
                    batch = fixed_statements[i : i + batch_size]
                    batch_num = (i // batch_size) + 1

                    logger.info(
                        "📦 RESTORE DEBUG: Processing %s batch %d: statements %d to %d",
                        table_name,
                        batch_num,
                        i + 1,
                        min(i + batch_size, len(fixed_statements)),
                    )

                    # Execute statements without explicit transaction management
                    # (rely on SQLAlchemy's autocommit behavior)
                    batch_successful = 0
                    batch_failed = 0

                    for j, stmt in enumerate(batch):
                        try:
                            self.db.execute(text(stmt))
                            self.db.commit()  # Commit each statement individually
                            batch_successful += 1

                            # Progress logging every 10 statements within batch
                            if (j + 1) % 10 == 0:
                                logger.info(
                                    "   ✅ RESTORE DEBUG: Processed %d/%d statements in batch",
                                    j + 1,
                                    len(batch),
                                )

                        except Exception as e:
                            try:
                                self.db.rollback()  # Rollback failed statement
                            except:
                                pass

                            batch_failed += 1
                            error_msg = (
                                str(e)[:100] + "..." if len(str(e)) > 100 else str(e)
                            )

                            # Log first few errors with more detail for critical tables
                            if (
                                table_name
                                in [
                                    "patients",
                                    "medications",
                                    "encounters",
                                    "lab_results",
                                ]
                                and batch_failed <= 5
                            ):
                                logger.error(
                                    "   ❌ RESTORE DEBUG: Failed to insert into %s: %s\n   Statement: %s",
                                    table_name,
                                    error_msg,
                                    stmt[:200] + "..." if len(stmt) > 200 else stmt,
                                )
                            elif batch_failed <= 3:
                                logger.error(
                                    "   ❌ RESTORE DEBUG: Failed to insert into %s: %s",
                                    table_name,
                                    error_msg,
                                )
                            elif batch_failed == 4:
                                logger.error(
                                    "   ❌ RESTORE DEBUG: Suppressing further error logs for %s (too many failures)",
                                    table_name,
                                )

                    logger.info(
                        "💾 RESTORE DEBUG: Completed %s batch %d (%d successful, %d failed)",
                        table_name,
                        batch_num,
                        batch_successful,
                        batch_failed,
                    )

                    successful_inserts += batch_successful
                    failed_inserts += batch_failed

                    if table_name not in failed_by_table:
                        failed_by_table[table_name] = 0
                    failed_by_table[table_name] += batch_failed

                logger.info(
                    "✅ RESTORE DEBUG: Completed table '%s': %d total statements processed",
                    table_name,
                    len(table_statements),
                )

            # Process any remaining tables not in our order
            remaining_tables = set(statements_by_table.keys()) - set(table_order)
            if remaining_tables:
                logger.warning(
                    "⚠️ RESTORE DEBUG: Found unexpected tables: %s",
                    list(remaining_tables),
                )
                for table_name in remaining_tables:
                    statements = statements_by_table[table_name]
                    logger.info(
                        "📦 RESTORE DEBUG: Processing unexpected table '%s' with %d statements...",
                        table_name,
                        len(statements),
                    )
                    # Process these with basic error handling
                    for stmt in statements:
                        try:
                            self.db.execute(text(stmt))
                            self.db.commit()
                            successful_inserts += 1
                        except Exception as e:
                            try:
                                self.db.rollback()
                            except:
                                pass
                            failed_inserts += 1
                            if table_name not in failed_by_table:
                                failed_by_table[table_name] = 0
                            failed_by_table[table_name] += 1
                            logger.error(
                                "❌ RESTORE DEBUG: Failed unexpected table insert: %s",
                                str(e)[:100],
                            )

        finally:
            # Reset timeout
            try:
                self.db.execute(text("SET statement_timeout = DEFAULT"))
            except:
                pass

        logger.info(
            "✅ RESTORE DEBUG: INSERT execution completed: %d successful, %d failed",
            successful_inserts,
            failed_inserts,
        )

        if failed_by_table:
            logger.info("❌ RESTORE DEBUG: Failed inserts by table:")
            for table, count in failed_by_table.items():
                logger.info("   %s: %d failed inserts", table, count)

    def _fix_column_names(self, statement: str, table_name: str) -> str:
        """Fix known column name mismatches between backup and current schema"""
        if table_name == "patients":
            # The backup and current schema both use birthDate (camelCase), no change needed
            pass

        elif table_name == "conditions":
            # The backup and current schema both use onsetDate (camelCase), no change needed
            pass

        elif table_name == "medications":
            # The backup and current schema both use effectivePeriod_start (camelCase), no change needed
            pass

        # Add more column fixes here as needed
        # if table_name == 'other_table':
        #     statement = re.sub(r'\boldColumnName\b', 'new_column_name', statement, flags=re.IGNORECASE)

        return statement

    def _fix_data_validation_issues(self, statement: str, table_name: str) -> str:
        """Fix data validation issues that would cause insertion failures"""
        if table_name == "practitioners":
            # Fix phone number validation - replace invalid phone numbers with NULL
            # Simple pattern: replace standalone '0' values (which appear to be placeholders)
            statement = re.sub(r"'0'(?=\s*,|\s*\))", "NULL", statement)

        return statement

    async def _reset_sequences(self):
        """Reset all sequences to match the restored data."""
        try:
            self._debug_print("🔢 RESTORE DEBUG: Starting sequence reset...")
            logger.info("Resetting sequences...")

            # Get all sequences (compatible with older PostgreSQL versions)
            sequences_query = text(
                """
                SELECT n.nspname as schemaname, c.relname as sequencename, 
                        CASE WHEN n.nspname = 'public' THEN substring(c.relname from '^(.+)_id_seq$') ELSE NULL END as tablename,
                        'id' as columnname
                FROM pg_class c
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE c.relkind = 'S' 
                AND n.nspname = 'public'
                AND c.relname LIKE '%_id_seq'
            """
            )

            result = self.db.execute(sequences_query).fetchall()
            self._debug_print(
                f"🔢 RESTORE DEBUG: Found {len(result)} sequences to reset"
            )

            sequence_results = {}
            for row in result:
                schema_name, sequence_name, table_name, column_name = row

                try:
                    self._debug_print(
                        f"   🔍 RESTORE DEBUG: Checking max value in {table_name}.{column_name}..."
                    )
                    # Get the maximum value from the table
                    max_query = text(
                        f"SELECT COALESCE(MAX({column_name}), 0) FROM {table_name}"
                    )
                    max_result = self.db.execute(max_query).fetchone()
                    max_value = max_result[0] if max_result else 0

                    self._debug_print(
                        f"   📊 RESTORE DEBUG: Max value in {table_name}.{column_name}: {max_value}"
                    )

                    # Reset sequence to max_value + 1
                    new_sequence_value = max_value + 1
                    reset_query = text(
                        f"SELECT setval('{sequence_name}', {new_sequence_value}, false)"
                    )
                    self.db.execute(reset_query)

                    sequence_results[sequence_name] = {
                        "table": table_name,
                        "max_value": max_value,
                        "new_sequence_value": new_sequence_value,
                    }

                    self._debug_print(
                        f"   ✅ RESTORE DEBUG: Reset sequence {sequence_name} to {new_sequence_value}"
                    )
                    logger.debug(
                        f"Reset sequence {sequence_name} to {new_sequence_value}"
                    )

                except Exception as e:
                    self._debug_print(
                        f"   ❌ RESTORE DEBUG: Could not reset sequence {sequence_name}: {str(e)}"
                    )
                    logger.warning(
                        f"Could not reset sequence {sequence_name}: {str(e)}"
                    )

            self._debug_print("💾 RESTORE DEBUG: Committing sequence changes...")
            self.db.commit()

            self._debug_print("✅ RESTORE DEBUG: Sequence reset completed. Summary:")
            for seq_name, details in sequence_results.items():
                self._debug_print(
                    f"   {seq_name}: {details['table']} (max: {details['max_value']}, new seq: {details['new_sequence_value']})"
                )

            logger.info("Sequence reset completed")

        except Exception as e:
            # Rollback any pending transaction to prevent transaction abort errors
            try:
                self.db.rollback()
                logger.debug("Rolled back transaction after sequence reset failure")
            except Exception as rollback_error:
                logger.warning(f"Could not rollback transaction: {str(rollback_error)}")

            logger.error(f"Failed to reset sequences: {str(e)}")
            # Don't raise - sequence reset is not critical for basic functionality

    def _filter_sql_for_compatibility(self, sql_content: str) -> str:
        """Filter SQL content to remove problematic statements that cause compatibility issues."""
        lines = sql_content.split("\n")
        filtered_lines = []
        in_copy_block = False
        skip_until_semicolon = False

        for line in lines:
            line_lower = line.lower().strip()

            # Handle COPY blocks that might conflict
            if line_lower.startswith("copy ") and "from stdin" in line_lower:
                in_copy_block = True
                logger.debug(f"Filtering out COPY block: {line.strip()}")
                continue
            elif in_copy_block:
                if line.strip() == "\\." or line.strip() == "--":
                    in_copy_block = False
                continue

            # Skip problematic configuration parameters
            if any(
                param in line_lower
                for param in [
                    "transaction_timeout",
                    "idle_in_transaction_session_timeout",
                    "lock_timeout",
                    "statement_timeout",
                    "default_transaction_isolation",
                ]
            ):
                logger.debug(f"Filtering out configuration parameter: {line.strip()}")
                continue

            # Skip role/user creation statements that might conflict
            if any(
                pattern in line_lower
                for pattern in [
                    "create role",
                    "create user",
                    "alter role",
                    "alter user",
                    "grant usage on schema",
                    "grant all on schema",
                ]
            ):
                logger.debug(f"Filtering out role/user statement: {line.strip()}")
                continue

            # Skip database/schema creation if it might conflict
            if any(
                pattern in line_lower
                for pattern in [
                    "create database",
                    "create schema",
                    "\\connect",
                ]
            ):
                logger.debug(f"Filtering out database/schema statement: {line.strip()}")
                continue

            # Convert CREATE TABLE to CREATE TABLE IF NOT EXISTS
            if (
                line_lower.startswith("create table ")
                and "if not exists" not in line_lower
            ):
                line = line.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1)
                logger.debug(f"Converting to IF NOT EXISTS: {line.strip()}")

            # Convert CREATE SEQUENCE to CREATE SEQUENCE IF NOT EXISTS
            if (
                line_lower.startswith("create sequence ")
                and "if not exists" not in line_lower
            ):
                line = line.replace(
                    "CREATE SEQUENCE", "CREATE SEQUENCE IF NOT EXISTS", 1
                )
                logger.debug(f"Converting sequence to IF NOT EXISTS: {line.strip()}")

            # Skip ALTER TABLE OWNER statements that might fail
            if "alter table" in line_lower and "owner to" in line_lower:
                logger.debug(f"Filtering out ALTER TABLE OWNER: {line.strip()}")
                continue

            # Skip ALTER SEQUENCE OWNER statements that might fail
            if "alter sequence" in line_lower and "owner to" in line_lower:
                logger.debug(f"Filtering out ALTER SEQUENCE OWNER: {line.strip()}")
                continue

            # Skip extension creation that might already exist
            if "create extension" in line_lower and "if not exists" not in line_lower:
                # Convert to IF NOT EXISTS version
                line = line.replace(
                    "CREATE EXTENSION", "CREATE EXTENSION IF NOT EXISTS"
                )
                logger.debug(
                    f"Converting extension creation to IF NOT EXISTS: {line.strip()}"
                )

            # Skip SELECT pg_catalog.setval statements that might fail
            if line_lower.startswith("select pg_catalog.setval"):
                logger.debug(f"Filtering out setval statement: {line.strip()}")
                continue

            filtered_lines.append(line)

        return "\n".join(filtered_lines)

    def _is_harmless_error(self, error_line: str) -> bool:
        """Check if an error line represents a harmless compatibility issue."""
        error_lower = error_line.lower()

        harmless_patterns = [
            'relation "',
            "already exists",
            'role "',
            "does not exist",
            "unrecognized configuration parameter",
            "permission denied for",
            "must be owner of",
            'extension "',
            'language "',
            "notice:",
            "warning:",
            "current transaction is aborted",
            "commands ignored until end of transaction block",
            "syntax error at or near",
            "duplicate key value violates unique constraint",
            "constraint",
            "violates",
            "sequence",
            "table",
            "index",
            "column",
        ]

        return any(pattern in error_lower for pattern in harmless_patterns)

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

                # Extract the full backup
                with zipfile.ZipFile(backup_path, "r") as zipf:
                    zipf.extractall(temp_path)

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

                # Restore database first
                logger.info("Restoring database from full backup...")
                db_result = await self._restore_database(db_backup_path)

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
                                    import time

                                    time.sleep(1)
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
        """Analyze SQL backup file content."""
        try:
            with open(backup_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Basic analysis
            lines = content.split("\n")
            insert_lines = [
                line for line in lines if line.strip().startswith("INSERT INTO")
            ]
            create_table_lines = [
                line for line in lines if line.strip().startswith("CREATE TABLE")
            ]

            return {
                "total_lines": len(lines),
                "create_table_statements": len(create_table_lines),
                "insert_statements": len(insert_lines),
                "file_size": backup_path.stat().st_size,
            }

        except Exception as e:
            logger.error(f"Failed to analyze SQL backup: {str(e)}")
            return {"error": str(e)}

    async def _verify_database_connection(self) -> None:
        """Verify database connection after restore."""
        try:
            result = self.db.execute(text("SELECT 1")).fetchone()
            if result is None:
                raise Exception("Database connection test failed")
            logger.info("Database connection verified after restore")
        except Exception as e:
            logger.error(f"Database connection verification failed: {str(e)}")
            raise Exception(f"Database connection verification failed: {str(e)}")

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
