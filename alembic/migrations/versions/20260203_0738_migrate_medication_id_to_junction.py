"""Migrate legacy medication_id to junction table

This migration copies existing medication_id values from the conditions table
to the ConditionMedication junction table. This is a data-only migration that
preserves the original medication_id column for safety.

Revision ID: f8a2c3d4e5b6
Revises: 4ae4496ad1c6
Create Date: 2026-02-03 07:38:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'f8a2c3d4e5b6'
down_revision = 'add_system_settings_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Copy medication_id from conditions to junction table."""
    # Get database connection
    conn = op.get_bind()

    # Find all conditions with a medication_id that don't already have
    # a corresponding entry in the junction table
    result = conn.execute(text("""
        SELECT c.id as condition_id, c.medication_id
        FROM conditions c
        WHERE c.medication_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM condition_medications cm
            WHERE cm.condition_id = c.id
            AND cm.medication_id = c.medication_id
        )
    """))

    rows = result.fetchall()

    if rows:
        # Insert into junction table with migration note
        for row in rows:
            condition_id = row[0]
            medication_id = row[1]
            conn.execute(text("""
                INSERT INTO condition_medications
                (condition_id, medication_id, relevance_note, created_at, updated_at)
                VALUES (:condition_id, :medication_id, :note, NOW(), NOW())
            """), {
                'condition_id': condition_id,
                'medication_id': medication_id,
                'note': 'Migrated from legacy single medication link'
            })

        print(f"Migrated {len(rows)} condition-medication relationships to junction table")
    else:
        print("No legacy medication_id values to migrate")


def downgrade() -> None:
    """Remove migrated entries from junction table.

    Note: This only removes entries that were created by this migration
    (identified by the specific relevance_note).
    """
    conn = op.get_bind()

    result = conn.execute(text("""
        DELETE FROM condition_medications
        WHERE relevance_note = 'Migrated from legacy single medication link'
    """))

    print(f"Removed migrated entries from junction table")
