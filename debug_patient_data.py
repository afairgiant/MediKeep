#!/usr/bin/env python3
"""
Debug Patient Data Script

Check why only 1 patient is showing when there should be 4 patients.
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


def check_patients_and_users():
    """Check patients and their user relationships."""
    db = SessionLocal()
    try:
        print("👥 Checking Patient-User Relationships:")
        print("=" * 60)

        # Check all patients with their user info
        result = db.execute(
            text(
                """
            SELECT p.id, p.first_name, p.last_name, p.user_id,
                   u.id as user_exists, u.username, u.role
            FROM patients p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.id
        """
            )
        ).fetchall()

        print(f"Found {len(result)} patients:")
        for (
            patient_id,
            first_name,
            last_name,
            user_id,
            user_exists,
            username,
            role,
        ) in result:
            user_status = (
                f"✅ User {user_exists} ({username}, {role})"
                if user_exists
                else f"❌ Missing user {user_id}"
            )
            print(f"   Patient {patient_id}: {first_name} {last_name} -> {user_status}")

        # Check for orphaned patients (no user)
        orphaned = db.execute(
            text(
                """
            SELECT p.id, p.first_name, p.last_name, p.user_id
            FROM patients p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE u.id IS NULL
        """
            )
        ).fetchall()

        if orphaned:
            print(f"\n⚠️  Found {len(orphaned)} orphaned patients (no user):")
            for patient_id, first_name, last_name, user_id in orphaned:
                print(
                    f"   Patient {patient_id}: {first_name} {last_name} (missing user {user_id})"
                )
        else:
            print("\n✅ All patients have valid user references")

    except Exception as e:
        print(f"❌ Error checking patients: {str(e)}")
    finally:
        db.close()


def check_user_patient_mapping():
    """Check the reverse - users and their patients."""
    db = SessionLocal()
    try:
        print("\n👤 Checking User-Patient Mapping:")
        print("=" * 60)

        result = db.execute(
            text(
                """
            SELECT u.id, u.username, u.role,
                   p.id as patient_id, p.first_name, p.last_name
            FROM users u
            LEFT JOIN patients p ON u.id = p.user_id
            ORDER BY u.id
        """
            )
        ).fetchall()

        for user_id, username, role, patient_id, first_name, last_name in result:
            patient_info = (
                f"Patient {patient_id} ({first_name} {last_name})"
                if patient_id
                else "No patient record"
            )
            print(f"   User {user_id} ({username}, {role}): {patient_info}")

    except Exception as e:
        print(f"❌ Error checking user-patient mapping: {str(e)}")
    finally:
        db.close()


def simulate_patient_api():
    """Simulate what the patient API endpoint might be doing."""
    db = SessionLocal()
    try:
        print("\n🌐 Simulating Patient API Logic:")
        print("=" * 60)

        # This is likely what the patient API does - get patients with valid users
        result = db.execute(
            text(
                """
            SELECT p.id, p.first_name, p.last_name, p.user_id,
                   p.birthDate, p.gender, p.address,
                   u.username, u.role
            FROM patients p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.id
        """
            )
        ).fetchall()

        print(f"API would return {len(result)} patients:")
        for row in result:
            (
                patient_id,
                first_name,
                last_name,
                user_id,
                birth_date,
                gender,
                address,
                username,
                role,
            ) = row
            print(f"   {patient_id}: {first_name} {last_name} (User: {username})")

        if len(result) == 1:
            print("\n🔍 This explains why you only see 1 patient!")
            print("   The other patients are probably missing their user references.")

    except Exception as e:
        print(f"❌ Error simulating API: {str(e)}")
    finally:
        db.close()


if __name__ == "__main__":
    print("🔧 Patient Data Debug Tool")
    print("=" * 40)

    check_patients_and_users()
    check_user_patient_mapping()
    simulate_patient_api()
