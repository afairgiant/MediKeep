#!/usr/bin/env python3
"""
Simple Restore CLI for Medical Records System

Usage:
    restore list                     # List backups
    restore preview <backup_id>      # Preview restore
    restore restore <backup_id>      # Execute restore (with confirmation)
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    from app.core.database.database import SessionLocal
    from app.services.backup_service import BackupService
    from app.services.restore_service import RestoreService
except ImportError as e:
    print(f"Error importing app modules: {e}", file=sys.stderr)
    sys.exit(1)


def check_database():
    """Quick database check"""
    try:
        from sqlalchemy import text

        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception:
        print("ERROR: Cannot connect to database", file=sys.stderr)
        return False


async def list_backups(backup_type: Optional[str] = None):
    """List available backups (simplified)"""
    if not check_database():
        return False

    db = SessionLocal()
    try:
        backup_service = BackupService(db)
        backups = await backup_service.list_backups()

        if backup_type:
            backups = [b for b in backups if b["backup_type"] == backup_type]

        if not backups:
            print("No backups found")
            return True

        print(f"Available backups ({len(backups)} total):")
        for backup in backups:
            size_mb = backup["size_bytes"] / 1024 / 1024 if backup["size_bytes"] else 0
            status = "OK" if backup["file_exists"] else "MISSING"
            print(
                f"  {backup['id']}: {backup['backup_type']} - {backup['filename']} ({size_mb:.1f}MB) - {status}"
            )

        return True
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return False
    finally:
        db.close()


async def preview_restore(backup_id: int):
    """Preview restore (simplified)"""
    if not check_database():
        return False

    db = SessionLocal()
    try:
        restore_service = RestoreService(db)
        preview = await restore_service.preview_restore(backup_id)

        print(f"Restore Preview for Backup {backup_id}:")
        print(f"  Type: {preview['backup_type']}")
        print(f"  Size: {preview['backup_size']:,} bytes")
        print(f"  Created: {preview['backup_created']}")

        if preview.get("warnings"):
            print("  Warnings:")
            for warning in preview["warnings"][:3]:  # Show max 3 warnings
                print(f"    - {warning}")

        # Generate simple confirmation
        confirm_code = f"{backup_id}_{datetime.now().strftime('%H%M')}"
        print(f"\nTo execute restore, run:")
        print(f"  restore restore {backup_id} {confirm_code}")

        return True
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return False
    finally:
        db.close()


async def execute_restore(backup_id: int, confirm_code: Optional[str] = None):
    """Execute restore with simple confirmation"""
    if not check_database():
        return False

    # Simple confirmation check
    expected_code = f"{backup_id}_{datetime.now().strftime('%H%M')}"
    if confirm_code != expected_code:
        print("ERROR: Invalid or expired confirmation code", file=sys.stderr)
        print(
            "Run 'preview' command first to get current confirmation code",
            file=sys.stderr,
        )
        return False

    db = SessionLocal()
    try:
        restore_service = RestoreService(db)

        print(f"Starting restore of backup {backup_id}...")
        print("Creating safety backup...")

        # Use the existing confirmation token system but simplified
        token = restore_service.generate_confirmation_token(backup_id)
        result = await restore_service.execute_restore(backup_id, token)

        print("Restore completed successfully!")
        print(f"Safety backup ID: {result['safety_backup_id']}")

        return True
    except Exception as e:
        print(f"ERROR: Restore failed - {e}", file=sys.stderr)
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Simple restore tool")
    parser.add_argument(
        "action", choices=["list", "preview", "restore"], help="Action to perform"
    )
    parser.add_argument(
        "backup_id", nargs="?", type=int, help="Backup ID (for preview/restore)"
    )
    parser.add_argument(
        "confirm_code", nargs="?", help="Confirmation code (for restore)"
    )
    parser.add_argument(
        "--type",
        choices=["database", "files", "full"],
        help="Filter backup type (for list)",
    )

    args = parser.parse_args()

    import asyncio

    try:
        success = False
        if args.action == "list":
            success = asyncio.run(list_backups(args.type))
        elif args.action == "preview":
            if not args.backup_id:
                print("ERROR: backup_id required for preview", file=sys.stderr)
                sys.exit(1)
            success = asyncio.run(preview_restore(args.backup_id))
        elif args.action == "restore":
            if not args.backup_id or not args.confirm_code:
                print(
                    "ERROR: backup_id and confirm_code required for restore",
                    file=sys.stderr,
                )
                print(
                    "Usage: restore restore <backup_id> <confirm_code>",
                    file=sys.stderr,
                )
                sys.exit(1)
            success = asyncio.run(execute_restore(args.backup_id, args.confirm_code))

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print("\nCancelled by user", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
