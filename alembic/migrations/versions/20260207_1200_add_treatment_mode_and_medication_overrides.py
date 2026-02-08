"""add treatment mode and medication override fields

Revision ID: add_treatment_enhancements
Revises: 236764e73254
Create Date: 2026-02-07 12:00:00.000000

Adds:
- treatments.mode column (simple/advanced toggle)
- treatment_medications: specific_prescriber_id, specific_pharmacy_id,
  specific_start_date, specific_end_date columns
- Indexes on new foreign key columns
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_treatment_enhancements'
down_revision = '236764e73254'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add mode column to treatments table
    op.add_column(
        'treatments',
        sa.Column('mode', sa.String(), nullable=False, server_default='simple')
    )

    # Add treatment-specific override columns to treatment_medications
    op.add_column(
        'treatment_medications',
        sa.Column('specific_prescriber_id', sa.Integer(), nullable=True)
    )
    op.add_column(
        'treatment_medications',
        sa.Column('specific_pharmacy_id', sa.Integer(), nullable=True)
    )
    op.add_column(
        'treatment_medications',
        sa.Column('specific_start_date', sa.Date(), nullable=True)
    )
    op.add_column(
        'treatment_medications',
        sa.Column('specific_end_date', sa.Date(), nullable=True)
    )

    # Add foreign key constraints
    op.create_foreign_key(
        'fk_treatment_med_prescriber',
        'treatment_medications', 'practitioners',
        ['specific_prescriber_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_treatment_med_pharmacy',
        'treatment_medications', 'pharmacies',
        ['specific_pharmacy_id'], ['id'],
        ondelete='SET NULL'
    )

    # Add indexes for new foreign key columns
    op.create_index(
        'idx_treatment_medication_prescriber_id',
        'treatment_medications',
        ['specific_prescriber_id']
    )
    op.create_index(
        'idx_treatment_medication_pharmacy_id',
        'treatment_medications',
        ['specific_pharmacy_id']
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_treatment_medication_pharmacy_id', table_name='treatment_medications')
    op.drop_index('idx_treatment_medication_prescriber_id', table_name='treatment_medications')

    # Drop foreign key constraints
    op.drop_constraint('fk_treatment_med_pharmacy', 'treatment_medications', type_='foreignkey')
    op.drop_constraint('fk_treatment_med_prescriber', 'treatment_medications', type_='foreignkey')

    # Drop columns from treatment_medications
    op.drop_column('treatment_medications', 'specific_end_date')
    op.drop_column('treatment_medications', 'specific_start_date')
    op.drop_column('treatment_medications', 'specific_pharmacy_id')
    op.drop_column('treatment_medications', 'specific_prescriber_id')

    # Drop mode column from treatments
    op.drop_column('treatments', 'mode')
