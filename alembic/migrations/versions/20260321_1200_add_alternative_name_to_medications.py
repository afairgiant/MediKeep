"""add alternative_name to medications

Revision ID: b1c2d3e4f5a6
Revises: 0e8efac28720
Create Date: 2026-03-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "0e8efac28720"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("medications", sa.Column("alternative_name", sa.String(), nullable=True))


def downgrade():
    op.drop_column("medications", "alternative_name")
