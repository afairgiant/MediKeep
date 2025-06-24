#!/usr/bin/env python3
"""
Check Restored Data Script

This script examines what data exists in the database after a restore operation.
It checks all major tables to see if data was properly restored.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set database port to 5433 for testing container
os.environ["DB_PORT"] = "5433"
os.environ["DB_HOST"] = "localhost"
os.environ["DB_USER"] = "user"
os.environ["DB_PASSWORD"] = "password"
os.environ["DB_NAME"] = "medical_records"

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal


def check_table_counts():
    """Check record counts in all major tables."""
    db = SessionLocal()
    try:
        print("📊 Database Table Counts After Restore:")
        print("=" * 50)

        # List of main tables to check
        tables_to_check = [
            "users",
            "patients",
            "practitioners",
            "conditions",
            "allergies",
            "medications",
            "immunizations",
            "lab_results",
            "procedures",
            "treatments",
            "encounters",
            "vitals",
            "pharmacies",
            "backup_records",
        ]

        total_records = 0
        for table_name in tables_to_check:
            try:
                result = db.execute(
                    text(f"SELECT COUNT(*) FROM {table_name}")
                ).fetchone()
                count = result[0] if result else 0
                total_records += count
                status = "✅" if count > 0 else "⭕"
                print(f"   {status} {table_name:15}: {count:>6} records")
            except Exception as e:
                print(f"   ❌ {table_name:15}: Error - {str(e)}")

        print("-" * 50)
        print(f"   📈 TOTAL RECORDS: {total_records}")

        return total_records

    except Exception as e:
        print(f"❌ Error checking table counts: {str(e)}")
        return 0
    finally:
        db.close()


def check_specific_data():
    """Check for specific data that should exist."""
    db = SessionLocal()
    try:
        print("\n🔍 Checking Specific Data:")
        print("=" * 50)

        # Check users
        users_result = db.execute(
            text("SELECT username, role FROM users ORDER BY id")
        ).fetchall()
        print(f"👥 Users ({len(users_result)}):")
        for username, role in users_result:
            print(f"   - {username} ({role})")

        # Check patients
        patients_result = db.execute(
            text("SELECT first_name, last_name FROM patients ORDER BY id LIMIT 5")
        ).fetchall()
        print(f"\n🏥 Patients ({len(patients_result)} shown, first 5):")
        for first_name, last_name in patients_result:
            print(f"   - {first_name} {last_name}")

        # Check conditions
        conditions_result = db.execute(
            text("SELECT name FROM conditions ORDER BY id LIMIT 5")
        ).fetchall()
        print(f"\n🏥 Conditions ({len(conditions_result)} shown, first 5):")
        for (condition_name,) in conditions_result:
            print(f"   - {condition_name}")

        # Check medications
        medications_result = db.execute(
            text("SELECT name FROM medications ORDER BY id LIMIT 5")
        ).fetchall()
        print(f"\n💊 Medications ({len(medications_result)} shown, first 5):")
        for (med_name,) in medications_result:
            print(f"   - {med_name}")

        # Check backup records
        backups_result = db.execute(
            text(
                "SELECT backup_type, status, created_at FROM backup_records ORDER BY created_at DESC LIMIT 3"
            )
        ).fetchall()
        print(f"\n💾 Recent Backup Records ({len(backups_result)} shown, last 3):")
        for backup_type, status, created_at in backups_result:
            print(f"   - {backup_type} ({status}) - {created_at}")

    except Exception as e:
        print(f"❌ Error checking specific data: {str(e)}")
    finally:
        db.close()


def check_sequences():
    """Check if sequences are properly set."""
    db = SessionLocal()
    try:
        print("\n🔢 Checking Sequence Values:")
        print("=" * 50)

        # Get all sequences
        sequences_result = db.execute(
            text(
                """
            SELECT schemaname, sequencename, last_value 
            FROM pg_sequences 
            WHERE schemaname = 'public'
            ORDER BY sequencename
        """
            )
        ).fetchall()

        for schema, seq_name, last_value in sequences_result:
            print(f"   📈 {seq_name}: {last_value}")

    except Exception as e:
        print(f"❌ Error checking sequences: {str(e)}")
    finally:
        db.close()


if __name__ == "__main__":
    print("🔧 Restored Data Check Tool")
    print("=" * 40)

    # Check table counts
    total_records = check_table_counts()

    # Check specific data samples
    check_specific_data()

    # Check sequences
    check_sequences()

    print("\n" + "=" * 50)
    if total_records == 0:
        print("❌ NO DATA FOUND - Restore may have failed!")
        print("💡 Check restore logs and verify backup file was valid.")
    elif total_records < 10:
        print("⚠️  VERY LITTLE DATA - Restore may be incomplete!")
        print("💡 Check if this matches what you expected from the backup.")
    else:
        print(f"✅ DATA FOUND - {total_records} total records restored!")
        print(
            "💡 If you don't see your expected data, check the frontend cache or restart the app."
        )
