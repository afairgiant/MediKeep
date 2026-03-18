"""add glucose_context to vitals

Revision ID: 0e8efac28720
Revises: a1b2c3d4e5f6
Create Date: 2026-03-17 16:08:41.505766

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0e8efac28720'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('vitals', sa.Column('glucose_context', sa.String(), nullable=True))
    # Migrate any existing 'postprandial' values to 'after_meal'
    op.execute("UPDATE vitals SET glucose_context = 'after_meal' WHERE glucose_context = 'postprandial'")


def downgrade() -> None:
    op.drop_column('vitals', 'glucose_context')
