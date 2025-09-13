"""merge custom reports with main

Revision ID: 42b59974972e
Revises: c828aa92b108, 22a36efc4d79
Create Date: 2025-08-15 16:35:14.088441

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '42b59974972e'
down_revision = ('c828aa92b108', '22a36efc4d79')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
