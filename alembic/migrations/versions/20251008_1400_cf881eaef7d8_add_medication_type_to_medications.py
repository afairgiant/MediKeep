"""add medication_type to medications

Revision ID: cf881eaef7d8
Revises: a818ac170805
Create Date: 2025-10-08 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cf881eaef7d8'
down_revision = 'a818ac170805'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add medication_type column with default value for backward compatibility
    op.add_column('medications',
        sa.Column('medication_type', sa.String(20),
                  nullable=False,
                  server_default='prescription'))

    # Add index for filtering performance (patient_id, medication_type)
    op.create_index('idx_medications_patient_type',
                    'medications',
                    ['patient_id', 'medication_type'])


def downgrade() -> None:
    # Drop index first
    op.drop_index('idx_medications_patient_type', table_name='medications')

    # Drop column
    op.drop_column('medications', 'medication_type')
