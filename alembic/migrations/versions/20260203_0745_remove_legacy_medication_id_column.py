"""Remove legacy medication_id column from conditions table

IMPORTANT: Only run this migration AFTER verifying that:
1. The data migration (f8a2c3d4e5b6) has run successfully
2. All legacy medication_id values have been migrated to the junction table
3. The frontend no longer uses the medication_id field

Verification query (should return 0):
SELECT COUNT(*) FROM conditions c
WHERE c.medication_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM condition_medications cm
    WHERE cm.condition_id = c.id
    AND cm.medication_id = c.medication_id
);

Revision ID: a9b8c7d6e5f4
Revises: f8a2c3d4e5b6
Create Date: 2026-02-03 07:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'a9b8c7d6e5f4'
down_revision = 'f8a2c3d4e5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove the legacy medication_id column and foreign key."""
    conn = op.get_bind()

    # Safety check: verify no unmigrated data exists
    result = conn.execute(text("""
        SELECT COUNT(*) FROM conditions c
        WHERE c.medication_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM condition_medications cm
            WHERE cm.condition_id = c.id
            AND cm.medication_id = c.medication_id
        )
    """))
    unmigrated_count = result.scalar()

    if unmigrated_count > 0:
        raise RuntimeError(
            f"Cannot remove medication_id column: {unmigrated_count} conditions "
            "have medication_id values not migrated to junction table. "
            "Run migration f8a2c3d4e5b6 first."
        )

    # Drop the foreign key constraint first (if it exists)
    # SQLite doesn't support dropping constraints directly,
    # so we use batch mode
    with op.batch_alter_table('conditions') as batch_op:
        # Try to drop foreign key if it exists
        try:
            batch_op.drop_constraint(
                'conditions_medication_id_fkey',
                type_='foreignkey'
            )
        except Exception:
            pass  # Constraint may not exist or have different name

        # Drop the column
        batch_op.drop_column('medication_id')

    print("Successfully removed medication_id column from conditions table")


def downgrade() -> None:
    """Re-add the medication_id column (without restoring data)."""
    with op.batch_alter_table('conditions') as batch_op:
        batch_op.add_column(
            sa.Column('medication_id', sa.Integer(), nullable=True)
        )
        batch_op.create_foreign_key(
            'conditions_medication_id_fkey',
            'medications',
            ['medication_id'],
            ['id']
        )

    print("Re-added medication_id column to conditions table")
    print("NOTE: Legacy data was not restored. Manual intervention may be needed.")
