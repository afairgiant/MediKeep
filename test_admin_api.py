#!/usr/bin/env python3
"""
Test Admin API Script

Test what the admin API endpoint is returning vs. what's in the database.
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
from app.crud.patient import patient
from app.models.models import Patient


def test_direct_database_query():
    """Test direct database query for patients."""
    db = SessionLocal()
    try:
        print("🔍 Direct Database Query:")
        print("=" * 50)

        # Direct SQL query
        result = db.execute(
            text("SELECT id, first_name, last_name, user_id FROM patients ORDER BY id")
        ).fetchall()
        print(f"Direct SQL found {len(result)} patients:")
        for row in result:
            print(f"   Patient {row[0]}: {row[1]} {row[2]} (User {row[3]})")

    except Exception as e:
        print(f"❌ Error with direct query: {str(e)}")
    finally:
        db.close()


def test_crud_get_multi():
    """Test CRUD get_multi method."""
    db = SessionLocal()
    try:
        print("\n🔧 CRUD get_multi Test:")
        print("=" * 50)

        # Using CRUD get_multi
        patients = patient.get_multi(db, skip=0, limit=25)
        print(f"CRUD get_multi found {len(patients)} patients:")
        for p in patients:
            print(f"   Patient {p.id}: {p.first_name} {p.last_name} (User {p.user_id})")

    except Exception as e:
        print(f"❌ Error with CRUD get_multi: {str(e)}")
    finally:
        db.close()


def test_sqlalchemy_query():
    """Test SQLAlchemy query like admin API does."""
    db = SessionLocal()
    try:
        print("\n🌐 SQLAlchemy Query (like Admin API):")
        print("=" * 50)

        # Simulate what admin API does
        skip = 0
        per_page = 25

        records = db.query(Patient).offset(skip).limit(per_page).all()
        total = db.query(Patient).count()

        print(f"SQLAlchemy query found {len(records)} patients (total: {total}):")
        for record in records:
            print(
                f"   Patient {record.id}: {record.first_name} {record.last_name} (User {record.user_id})"
            )

        # Test the admin API conversion process
        print(f"\n📊 Converting to Admin API format:")
        items = []
        for record in records:
            item = {}
            # Get all column values like admin API does
            for column in Patient.__table__.columns:
                value = getattr(record, column.name, None)
                item[column.name] = value
            items.append(item)

        print(f"Converted {len(items)} items for API response")
        for item in items[:3]:  # Show first 3
            print(
                f"   API item: {item.get('id')} - {item.get('first_name')} {item.get('last_name')}"
            )

    except Exception as e:
        print(f"❌ Error with SQLAlchemy query: {str(e)}")
    finally:
        db.close()


def check_column_access():
    """Check if there are any issues accessing patient columns."""
    db = SessionLocal()
    try:
        print("\n📋 Testing Column Access:")
        print("=" * 50)

        # Get first patient
        patient_record = db.query(Patient).first()
        if patient_record:
            print(f"Testing column access on Patient {patient_record.id}:")

            # Test each column access
            for column in Patient.__table__.columns:
                try:
                    value = getattr(patient_record, column.name, None)
                    print(f"   ✅ {column.name}: {value}")
                except Exception as e:
                    print(f"   ❌ {column.name}: Error - {str(e)}")
        else:
            print("No patients found to test column access")

    except Exception as e:
        print(f"❌ Error checking column access: {str(e)}")
    finally:
        db.close()


if __name__ == "__main__":
    print("🔧 Admin API Test Tool")
    print("=" * 40)

    test_direct_database_query()
    test_crud_get_multi()
    test_sqlalchemy_query()
    check_column_access()
