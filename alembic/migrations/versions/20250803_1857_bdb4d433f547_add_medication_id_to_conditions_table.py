"""Add medication_id to conditions table

Revision ID: bdb4d433f547
Revises: ecb8117c18d8
Create Date: 2025-08-03 18:57:20.937363

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bdb4d433f547'
down_revision = 'ecb8117c18d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add medication_id column to conditions table
    op.add_column('conditions', sa.Column('medication_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'conditions', 'medications', ['medication_id'], ['id'])


def downgrade() -> None:
    # Remove medication_id column from conditions table
    op.drop_constraint(None, 'conditions', type_='foreignkey')
    op.drop_column('conditions', 'medication_id')
