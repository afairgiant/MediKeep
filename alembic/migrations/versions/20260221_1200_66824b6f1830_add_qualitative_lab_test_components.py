"""add qualitative lab test components support

Revision ID: 66824b6f1830
Revises: add_practices_table
Create Date: 2026-02-21 12:00:00.000000

Adds support for qualitative lab test results (positive/negative, detected/undetected)
used in immunology and microbiology tests (HIV, Hepatitis, ANA, etc.).

Changes:
- Adds result_type column (quantitative/qualitative discriminator)
- Adds qualitative_value column (positive/negative/detected/undetected)
- Alters value and unit columns to nullable (not needed for qualitative tests)
- Backfills existing rows with result_type='quantitative'
- Adds index on result_type column
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '66824b6f1830'
down_revision = 'add_practices_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns
    op.add_column('lab_test_components',
        sa.Column('result_type', sa.String(), nullable=True, server_default='quantitative')
    )
    op.add_column('lab_test_components',
        sa.Column('qualitative_value', sa.String(), nullable=True)
    )

    # Alter value and unit to nullable
    op.alter_column('lab_test_components', 'value',
        existing_type=sa.Float(),
        nullable=True
    )
    op.alter_column('lab_test_components', 'unit',
        existing_type=sa.String(),
        nullable=True
    )

    # Backfill existing rows with result_type='quantitative'
    op.execute("UPDATE lab_test_components SET result_type = 'quantitative' WHERE result_type IS NULL")

    # Add index on result_type
    op.create_index('idx_lab_test_components_result_type', 'lab_test_components', ['result_type'])


def downgrade() -> None:
    # Remove index
    op.drop_index('idx_lab_test_components_result_type', table_name='lab_test_components')

    # Remove qualitative rows before making columns not nullable again
    op.execute("DELETE FROM lab_test_components WHERE result_type = 'qualitative'")

    # Revert value and unit to not nullable
    op.alter_column('lab_test_components', 'value',
        existing_type=sa.Float(),
        nullable=False
    )
    op.alter_column('lab_test_components', 'unit',
        existing_type=sa.String(),
        nullable=False
    )

    # Drop new columns
    op.drop_column('lab_test_components', 'qualitative_value')
    op.drop_column('lab_test_components', 'result_type')
