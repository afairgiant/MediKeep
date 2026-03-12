"""add notes and side_effects to medications

Revision ID: e2aec3d7ca7e
Revises: 593ad90042d5
Create Date: 2026-03-12 09:15:17.520318

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e2aec3d7ca7e'
down_revision = '593ad90042d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('medications', sa.Column('notes', sa.String(), nullable=True))
    op.add_column('medications', sa.Column('side_effects', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('medications', 'side_effects')
    op.drop_column('medications', 'notes')
