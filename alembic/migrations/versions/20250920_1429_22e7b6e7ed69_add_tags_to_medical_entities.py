"""add_tags_to_medical_entities

Revision ID: 22e7b6e7ed69
Revises: 33b89582fb06
Create Date: 2025-09-20 14:29:24.417607

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '22e7b6e7ed69'
down_revision = '33b89582fb06'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tags column to ALL medical record tables
    op.add_column('allergies', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('conditions', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('encounters', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('immunizations', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('lab_results', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('medications', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('procedures', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('treatments', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Create GIN indexes for tag search performance on ALL tables
    op.execute('CREATE INDEX idx_allergies_tags ON allergies USING GIN (tags)')
    op.execute('CREATE INDEX idx_conditions_tags ON conditions USING GIN (tags)')
    op.execute('CREATE INDEX idx_encounters_tags ON encounters USING GIN (tags)')
    op.execute('CREATE INDEX idx_immunizations_tags ON immunizations USING GIN (tags)')
    op.execute('CREATE INDEX idx_lab_results_tags ON lab_results USING GIN (tags)')
    op.execute('CREATE INDEX idx_medications_tags ON medications USING GIN (tags)')
    op.execute('CREATE INDEX idx_procedures_tags ON procedures USING GIN (tags)')
    op.execute('CREATE INDEX idx_treatments_tags ON treatments USING GIN (tags)')


def downgrade() -> None:
    # Drop GIN indexes for tags
    op.execute('DROP INDEX idx_treatments_tags')
    op.execute('DROP INDEX idx_procedures_tags')
    op.execute('DROP INDEX idx_medications_tags')
    op.execute('DROP INDEX idx_lab_results_tags')
    op.execute('DROP INDEX idx_immunizations_tags')
    op.execute('DROP INDEX idx_encounters_tags')
    op.execute('DROP INDEX idx_conditions_tags')
    op.execute('DROP INDEX idx_allergies_tags')

    # Drop tags columns from ALL medical record tables
    op.drop_column('treatments', 'tags')
    op.drop_column('procedures', 'tags')
    op.drop_column('medications', 'tags')
    op.drop_column('lab_results', 'tags')
    op.drop_column('immunizations', 'tags')
    op.drop_column('encounters', 'tags')
    op.drop_column('conditions', 'tags')
    op.drop_column('allergies', 'tags')
