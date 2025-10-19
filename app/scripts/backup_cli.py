#!/usr/bin/env python3
"""
Backup CLI Script for Medical Records System

This script provides command-line access to the backup functionality,
allowing automation of backups via cron jobs or other scheduling systems.

Usage:
    # Via docker exec (recommended for automation):
    docker exec <container_name> backup_db
    docker exec <container_name> backup_files  
    docker exec <container_name> backup_full

    # Or directly on the server:
    python app/scripts/backup_cli.py database
    python app/scripts/backup_cli.py files --description "Daily files backup"
    python app/scripts/backup_cli.py full

Features:
    - Reuses existing BackupService for consistency
    - Proper error handling and exit codes for automation
    - JSON output option for programmatic use
    - Progress feedback for manual use
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add the project root to Python path so we can import our app modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    from app.core.config import settings
    from app.core.database.database import SessionLocal
    from app.services.backup_service import BackupService
except ImportError as e:
    print(f"Error importing app modules: {e}", file=sys.stderr)
    print(
        "Make sure you're running this script from the project root directory",
        file=sys.stderr,
    )
    sys.exit(1)


def check_database_connection():
    """Check if database is accessible"""
    try:
        from sqlalchemy import text

        db = SessionLocal()
        # Simple query to test connection
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception as e:
        print(f"Database connection failed: {e}", file=sys.stderr)
        return False


async def create_backup(
    backup_type: str,
    description: Optional[str] = None,
    quiet: bool = False,
    json_output: bool = False,
):
    """
    Create a backup of the specified type.

    Args:
        backup_type: Type of backup ('database', 'files', 'full')
        description: Optional description for the backup
        quiet: If True, suppress progress messages
        json_output: If True, output results as JSON

    Returns:
        dict: Backup result information
    """
    if not quiet and not json_output:
        print(f"Creating {backup_type} backup...")

    # Check database connection
    if not check_database_connection():
        error_msg = (
            "Cannot connect to database. Please check your database configuration."
        )
        if json_output:
            print(json.dumps({"success": False, "error": error_msg}))
        else:
            print(f"ERROR: {error_msg}", file=sys.stderr)
        return None

    db = SessionLocal()
    try:
        backup_service = BackupService(db)

        # Generate default description if none provided
        if not description:
            description = f"CLI {backup_type} backup created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

        # Create backup based on type
        if backup_type == "database":
            result = await backup_service.create_database_backup(description)
        elif backup_type == "files":
            result = await backup_service.create_files_backup(description)
        elif backup_type == "full":
            result = await backup_service.create_full_backup(description)
        else:
            raise ValueError(f"Unknown backup type: {backup_type}")

        if not quiet and not json_output:
            print(f"{backup_type.title()} backup completed successfully!")
            print(f"   - Backup ID: {result['id']}")
            print(f"   - Filename: {result['filename']}")
            print(
                f"   - Size: {result['size_bytes']:,} bytes ({result['size_bytes']/1024/1024:.1f} MB)"
            )
            print(f"   - Created: {result['created_at']}")

        if json_output:
            # Add success flag for easier automation parsing
            result["success"] = True
            print(json.dumps(result, indent=2))

        return result

    except Exception as e:
        error_msg = f"Backup creation failed: {str(e)}"
        if json_output:
            print(json.dumps({"success": False, "error": error_msg}))
        else:
            print(f"ERROR: {error_msg}", file=sys.stderr)
        return None
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Create backups for the Medical Records System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Backup Types:
    database    Create database-only backup (SQL dump)
    files       Create files-only backup (uploads directory)
    full        Create complete system backup (database + files)

Examples:
    # Create database backup
    python app/scripts/backup_cli.py database

    # Create files backup with description
    python app/scripts/backup_cli.py files --description "Daily files backup"

    # Create full backup with JSON output (for automation)
    python app/scripts/backup_cli.py full --json

    # Via Docker (recommended for automation)
    docker exec medical-records-app python app/scripts/backup_cli.py database
        """,
    )

    parser.add_argument(
        "type", choices=["database", "files", "full"], help="Type of backup to create"
    )

    parser.add_argument(
        "--description", "-d", help="Optional description for the backup"
    )

    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress progress messages (only show errors)",
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON (useful for automation)",
    )

    args = parser.parse_args()

    # Import asyncio after argument parsing to avoid import overhead for help
    import asyncio

    # Run the backup creation
    try:
        result = asyncio.run(
            create_backup(
                backup_type=args.type,
                description=args.description,
                quiet=args.quiet,
                json_output=args.json,
            )
        )

        # Exit with appropriate code
        if result is not None:
            sys.exit(0)  # Success
        else:
            sys.exit(1)  # Failure

    except KeyboardInterrupt:
        if not args.quiet and not args.json:
            print("\nBackup cancelled by user", file=sys.stderr)
        sys.exit(130)  # Standard exit code for SIGINT
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        if args.json:
            print(json.dumps({"success": False, "error": error_msg}))
        else:
            print(f"ERROR: {error_msg}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
