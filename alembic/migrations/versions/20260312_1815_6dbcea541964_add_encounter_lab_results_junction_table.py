"""add encounter_lab_results junction table

Revision ID: 6dbcea541964
Revises: e2aec3d7ca7e
Create Date: 2026-03-12 18:15:55.331632

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '6dbcea541964'
down_revision = 'e2aec3d7ca7e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('encounter_lab_results',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('encounter_id', sa.Integer(), nullable=False),
    sa.Column('lab_result_id', sa.Integer(), nullable=False),
    sa.Column('purpose', sa.String(), nullable=True),
    sa.Column('relevance_note', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['lab_result_id'], ['lab_results.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('encounter_id', 'lab_result_id', name='uq_encounter_lab_result')
    )
    op.create_index('idx_encounter_lab_result_encounter_id', 'encounter_lab_results', ['encounter_id'], unique=False)
    op.create_index('idx_encounter_lab_result_lab_result_id', 'encounter_lab_results', ['lab_result_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_encounter_lab_result_lab_result_id', table_name='encounter_lab_results')
    op.drop_index('idx_encounter_lab_result_encounter_id', table_name='encounter_lab_results')
    op.drop_table('encounter_lab_results')
