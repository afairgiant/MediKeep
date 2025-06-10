#!/usr/bin/env python3
"""
Database migration script to update LabResult table structure
to the simplified model (test tracking only)
"""

import sqlite3
import os
from datetime import datetime

DATABASE_PATH = "medical_records.db"


def backup_database():
    """Create a backup of the current database"""
    if os.path.exists(DATABASE_PATH):
        backup_path = (
            f"medical_records_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        )
        import shutil

        shutil.copy2(DATABASE_PATH, backup_path)
        print(f"✅ Database backed up to: {backup_path}")
        return backup_path
    return None


def migrate_lab_results_table():
    """Migrate the lab_results table to the new simplified structure"""

    # Check if database exists
    if not os.path.exists(DATABASE_PATH):
        print(
            "❌ Database file not found. Please run the application first to create the database."
        )
        return False

    backup_path = backup_database()

    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        # Check if lab_results table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='lab_results'
        """)

        if not cursor.fetchone():
            print("❌ lab_results table not found. Creating new table...")
            create_new_table(cursor)
        else:
            print("📋 Found existing lab_results table. Migrating...")
            migrate_existing_table(cursor)

        conn.commit()
        print("✅ Migration completed successfully!")
        return True

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if backup_path:
            print(f"🔄 You can restore from backup: {backup_path}")
        return False
    finally:
        if "conn" in locals():
            conn.close()


def create_new_table(cursor):
    """Create the new simplified lab_results table"""
    cursor.execute("""
        CREATE TABLE lab_results (
            id INTEGER PRIMARY KEY,
            patient_id INTEGER NOT NULL,
            practitioner_id INTEGER,
            test_name VARCHAR NOT NULL,
            test_code VARCHAR,
            test_category VARCHAR,
            status VARCHAR NOT NULL DEFAULT 'ordered',
            ordered_date DATETIME NOT NULL,
            completed_date DATETIME,
            notes TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (practitioner_id) REFERENCES practitioners (id)
        )
    """)
    print("✅ Created new lab_results table with simplified structure")


def migrate_existing_table(cursor):
    """Migrate existing table to new structure"""

    # Get current table schema
    cursor.execute("PRAGMA table_info(lab_results)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"📊 Current columns: {columns}")

    # Check if we need to migrate (if old columns exist)
    old_columns = [
        "code",
        "display",
        "value_quantity",
        "value_unit",
        "value_string",
        "reference_range",
        "interpretation",
        "effective_date",
        "issued_date",
        "category",
    ]

    has_old_structure = any(col in columns for col in old_columns)

    if not has_old_structure:
        print("✅ Table already has the new structure. No migration needed.")
        return

    print("🔄 Migrating from old structure to new structure...")

    # Create new table with temporary name
    cursor.execute("""
        CREATE TABLE lab_results_new (
            id INTEGER PRIMARY KEY,
            patient_id INTEGER NOT NULL,
            practitioner_id INTEGER,
            test_name VARCHAR NOT NULL,
            test_code VARCHAR,
            test_category VARCHAR,
            status VARCHAR NOT NULL DEFAULT 'ordered',
            ordered_date DATETIME NOT NULL,
            completed_date DATETIME,
            notes TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (practitioner_id) REFERENCES practitioners (id)
        )
    """)

    # Migrate existing data
    cursor.execute("""
        INSERT INTO lab_results_new (
            id, patient_id, practitioner_id, test_name, test_code, test_category,
            status, ordered_date, completed_date, notes, created_at, updated_at
        )
        SELECT 
            id,
            patient_id,
            practitioner_id,
            COALESCE(display, code, 'Unknown Test') as test_name,
            code as test_code,
            CASE 
                WHEN category = 'laboratory' THEN 'blood work'
                WHEN category = 'imaging' THEN 'imaging'
                WHEN category = 'pathology' THEN 'pathology'
                WHEN category = 'microbiology' THEN 'microbiology'
                WHEN category = 'chemistry' THEN 'blood work'
                WHEN category = 'hematology' THEN 'blood work'
                WHEN category = 'immunology' THEN 'blood work'
                WHEN category = 'genetics' THEN 'genetics'
                ELSE 'other'
            END as test_category,
            CASE 
                WHEN status = 'final' THEN 'completed'
                WHEN status = 'preliminary' THEN 'in-progress'
                WHEN status = 'cancelled' THEN 'cancelled'
                WHEN status = 'entered-in-error' THEN 'cancelled'
                ELSE 'ordered'
            END as status,
            COALESCE(effective_date || ' 09:00:00', datetime('now')) as ordered_date,
            CASE 
                WHEN status = 'final' THEN COALESCE(issued_date, effective_date || ' 17:00:00')
                ELSE NULL
            END as completed_date,
            CASE 
                WHEN value_string IS NOT NULL THEN 'Result: ' || value_string
                WHEN value_quantity IS NOT NULL AND value_unit IS NOT NULL THEN 
                    'Result: ' || value_quantity || ' ' || value_unit || 
                    CASE WHEN reference_range IS NOT NULL THEN ' (Ref: ' || reference_range || ')' ELSE '' END ||
                    CASE WHEN interpretation IS NOT NULL THEN ' - ' || interpretation ELSE '' END
                WHEN interpretation IS NOT NULL THEN 'Interpretation: ' || interpretation
                ELSE NULL
            END as notes,
            created_at,
            updated_at
        FROM lab_results
    """)

    # Get count of migrated records
    cursor.execute("SELECT COUNT(*) FROM lab_results_new")
    migrated_count = cursor.fetchone()[0]

    # Drop old table and rename new one
    cursor.execute("DROP TABLE lab_results")
    cursor.execute("ALTER TABLE lab_results_new RENAME TO lab_results")

    print(f"✅ Migrated {migrated_count} lab result records to new structure")
    print("📝 Old detailed results have been preserved in the 'notes' field")


def verify_migration():
    """Verify the migration was successful"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        # Check table structure
        cursor.execute("PRAGMA table_info(lab_results)")
        columns = [row[1] for row in cursor.fetchall()]

        expected_columns = [
            "id",
            "patient_id",
            "practitioner_id",
            "test_name",
            "test_code",
            "test_category",
            "status",
            "ordered_date",
            "completed_date",
            "notes",
            "created_at",
            "updated_at",
        ]

        missing_columns = set(expected_columns) - set(columns)
        if missing_columns:
            print(f"⚠️ Missing expected columns: {missing_columns}")
            return False

        # Check data count
        cursor.execute("SELECT COUNT(*) FROM lab_results")
        count = cursor.fetchone()[0]
        print(f"📊 Table verification: {count} lab result records found")

        # Show sample data
        cursor.execute("SELECT test_name, test_code, status FROM lab_results LIMIT 3")
        samples = cursor.fetchall()
        if samples:
            print("📋 Sample migrated data:")
            for sample in samples:
                print(f"   - {sample[0]} ({sample[1]}) - {sample[2]}")

        print("✅ Migration verification successful!")
        return True

    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False
    finally:
        if "conn" in locals():
            conn.close()


if __name__ == "__main__":
    print("🔄 Lab Results Table Migration")
    print("=" * 50)
    print("This will update the lab_results table to use a simplified structure")
    print("for test tracking only (detailed results go in files).")
    print()

    # Ask for confirmation
    response = (
        input("Do you want to proceed with the migration? (y/N): ").lower().strip()
    )
    if response != "y":
        print("❌ Migration cancelled.")
        exit(0)

    success = migrate_lab_results_table()

    if success:
        print("\n🔍 Verifying migration...")
        verify_migration()
        print("\n✅ Migration completed successfully!")
        print("\n📝 Next steps:")
        print("1. Test the backend: python test_lab_results.py")
        print("2. Start the frontend and test lab results UI")
        print("3. Upload test result files to verify file handling")
    else:
        print("\n❌ Migration failed. Please check the error messages above.")
