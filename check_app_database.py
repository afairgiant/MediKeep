#!/usr/bin/env python3
"""
Check Application Database Script

This script checks the database exactly as the application sees it,
using the same connection parameters as the Docker application.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set database connection to match the application container
# These should match the environment variables in docker-compose.yml
os.environ["DB_PORT"] = "5433"  # External port for our script
os.environ["DB_HOST"] = "localhost"  # External host for our script
os.environ["DB_USER"] = os.getenv("DB_USER", "medapp")
os.environ["DB_PASSWORD"] = os.getenv("DB_PASSWORD", "")
os.environ["DB_NAME"] = os.getenv("DB_NAME", "medical_records")

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal


def check_connection_info():
    """Show what database connection is being used."""
    print("🔌 Database Connection Info:")
    print("=" * 50)
    print(f"   Database URL: {settings.DATABASE_URL}")
    print(f"   DB_HOST: {os.getenv('DB_HOST')}")
    print(f"   DB_PORT: {os.getenv('DB_PORT')}")
    print(f"   DB_NAME: {os.getenv('DB_NAME')}")
    print(f"   DB_USER: {os.getenv('DB_USER')}")
    print()


def check_medications_api_style():
    """Check medications the same way the API would."""
    db = SessionLocal()
    try:
        print("💊 Checking Medications (API style):")
        print("=" * 50)

        # Check medications table directly
        medications_count = db.execute(
            text("SELECT COUNT(*) FROM medications")
        ).fetchone()[0]
        print(f"   Total medications in DB: {medications_count}")

        if medications_count > 0:
            # Get sample medications
            medications = db.execute(
                text(
                    """
                SELECT id, name, dosage, patient_id, created_at 
                FROM medications 
                ORDER BY id 
                LIMIT 10
            """
                )
            ).fetchall()

            print("   Sample medications:")
            for med_id, name, dosage, patient_id, created_at in medications:
                print(
                    f"     ID {med_id}: {name} ({dosage}) - Patient {patient_id} - {created_at}"
                )

        # Check if there are any filtering issues
        print("\n🔍 Checking for potential filtering issues:")

        # Check if medications belong to existing patients
        orphaned_meds = db.execute(
            text(
                """
            SELECT m.id, m.name, m.patient_id 
            FROM medications m 
            LEFT JOIN patients p ON m.patient_id = p.id 
            WHERE p.id IS NULL
        """
            )
        ).fetchall()

        if orphaned_meds:
            print(
                f"   ⚠️  Found {len(orphaned_meds)} medications with missing patients:"
            )
            for med_id, name, patient_id in orphaned_meds:
                print(
                    f"     Medication ID {med_id} ({name}) references missing patient {patient_id}"
                )
        else:
            print("   ✅ All medications have valid patient references")

        # Check patients that should have medications
        patients_with_meds = db.execute(
            text(
                """
            SELECT p.id, p.first_name, p.last_name, COUNT(m.id) as med_count
            FROM patients p 
            LEFT JOIN medications m ON p.id = m.patient_id 
            GROUP BY p.id, p.first_name, p.last_name
            ORDER BY p.id
        """
            )
        ).fetchall()

        print(f"\n👥 Patients and their medication counts:")
        for patient_id, first_name, last_name, med_count in patients_with_meds:
            print(
                f"   Patient {patient_id} ({first_name} {last_name}): {med_count} medications"
            )

    except Exception as e:
        print(f"❌ Error checking medications: {str(e)}")
    finally:
        db.close()


def test_api_endpoint_simulation():
    """Simulate what the API endpoint does when fetching medications."""
    db = SessionLocal()
    try:
        print("\n🌐 Simulating API Endpoint Logic:")
        print("=" * 50)

        # This mimics what the medications API endpoint does
        # Check if there are any specific filters or joins that might be failing

        query = text(
            """
            SELECT m.id, m.name, m.dosage, m.frequency, m.start_date, m.end_date,
                   m.patient_id, m.practitioner_id, m.created_at, m.updated_at,
                   p.first_name, p.last_name
            FROM medications m
            JOIN patients p ON m.patient_id = p.id
            ORDER BY m.created_at DESC
            LIMIT 25
        """
        )

        result = db.execute(query).fetchall()

        print(f"   Query returned: {len(result)} medications")

        if result:
            print("   Sample results:")
            for i, row in enumerate(result[:3]):  # Show first 3
                (
                    med_id,
                    name,
                    dosage,
                    frequency,
                    start_date,
                    end_date,
                    patient_id,
                    practitioner_id,
                    created_at,
                    updated_at,
                    first_name,
                    last_name,
                ) = row
                print(f"     {i+1}. {name} ({dosage}) for {first_name} {last_name}")
        else:
            print("   ❌ No results returned - this explains the empty API response!")

            # Debug why no results
            print("\n🔍 Debugging empty results:")

            # Check if medications exist
            med_count = db.execute(text("SELECT COUNT(*) FROM medications")).fetchone()[
                0
            ]
            print(f"     Medications in table: {med_count}")

            # Check if patients exist
            patient_count = db.execute(
                text("SELECT COUNT(*) FROM patients")
            ).fetchone()[0]
            print(f"     Patients in table: {patient_count}")

            # Check if the JOIN is the problem
            if med_count > 0 and patient_count > 0:
                print("     Both tables have data, checking JOIN...")
                join_test = db.execute(
                    text(
                        """
                    SELECT m.id, m.patient_id, p.id as patient_exists
                    FROM medications m
                    LEFT JOIN patients p ON m.patient_id = p.id
                """
                    )
                ).fetchall()

                for med_id, patient_id, patient_exists in join_test:
                    if patient_exists is None:
                        print(
                            f"     ❌ Medication {med_id} references missing patient {patient_id}"
                        )
                    else:
                        print(
                            f"     ✅ Medication {med_id} -> Patient {patient_id} (OK)"
                        )

    except Exception as e:
        print(f"❌ Error simulating API: {str(e)}")
    finally:
        db.close()


if __name__ == "__main__":
    print("🔧 Application Database Check Tool")
    print("=" * 40)

    # Show connection info
    check_connection_info()

    # Check medications
    check_medications_api_style()

    # Test API simulation
    test_api_endpoint_simulation()
