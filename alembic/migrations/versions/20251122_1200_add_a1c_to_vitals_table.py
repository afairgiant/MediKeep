"""Add a1c to vitals table

Revision ID: add_a1c_to_vitals
Revises: c57de5762af1
Create Date: 2025-11-22 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_a1c_to_vitals'
down_revision = 'c57de5762af1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add a1c column to vitals table (Hemoglobin A1C percentage)
    op.add_column(
        'vitals',
        sa.Column('a1c', sa.Float(), nullable=True)
    )


def downgrade() -> None:
    # Remove a1c column from vitals table
    op.drop_column('vitals', 'a1c')
