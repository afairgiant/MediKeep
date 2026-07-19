"""Add lab result medication/procedure relationship tables

Revision ID: add_lr_med_proc_tables
Revises: 255a32acfe39
Create Date: 2026-07-18 12:00:00.000000

This migration adds:
- lab_result_medications: Junction table for lab result-medication relationships
- lab_result_procedures: Junction table for lab result-procedure relationships
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_lr_med_proc_tables'
down_revision = '255a32acfe39'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create lab_result_medications junction table
    op.create_table('lab_result_medications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lab_result_id', sa.Integer(), nullable=False),
        sa.Column('medication_id', sa.Integer(), nullable=False),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['lab_result_id'], ['lab_results.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medication_id'], ['medications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lab_result_id', 'medication_id', name='uq_lab_result_medication')
    )
    op.create_index('idx_lab_result_medication_lab_result_id', 'lab_result_medications', ['lab_result_id'], unique=False)
    op.create_index('idx_lab_result_medication_medication_id', 'lab_result_medications', ['medication_id'], unique=False)

    # Create lab_result_procedures junction table
    op.create_table('lab_result_procedures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lab_result_id', sa.Integer(), nullable=False),
        sa.Column('procedure_id', sa.Integer(), nullable=False),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['lab_result_id'], ['lab_results.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['procedure_id'], ['procedures.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lab_result_id', 'procedure_id', name='uq_lab_result_procedure')
    )
    op.create_index('idx_lab_result_procedure_lab_result_id', 'lab_result_procedures', ['lab_result_id'], unique=False)
    op.create_index('idx_lab_result_procedure_procedure_id', 'lab_result_procedures', ['procedure_id'], unique=False)


def downgrade() -> None:
    # Drop junction tables in reverse dependency order
    op.drop_index('idx_lab_result_procedure_procedure_id', table_name='lab_result_procedures')
    op.drop_index('idx_lab_result_procedure_lab_result_id', table_name='lab_result_procedures')
    op.drop_table('lab_result_procedures')

    op.drop_index('idx_lab_result_medication_medication_id', table_name='lab_result_medications')
    op.drop_index('idx_lab_result_medication_lab_result_id', table_name='lab_result_medications')
    op.drop_table('lab_result_medications')
