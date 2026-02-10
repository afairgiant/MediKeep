"""add outcome column to procedures

Revision ID: 75c52071a78d
Revises: add_treatment_enhancements
Create Date: 2026-02-09 15:42:00.140993

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '75c52071a78d'
down_revision = 'add_treatment_enhancements'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('procedures', sa.Column('outcome', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('procedures', 'outcome')
