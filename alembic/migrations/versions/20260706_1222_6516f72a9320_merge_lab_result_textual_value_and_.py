"""merge lab result textual_value and vaccine backfill heads

Revision ID: 6516f72a9320
Revises: d4e5f6a7b8c9, a5b6c7d8e9f0
Create Date: 2026-07-06 12:22:26.817611

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6516f72a9320'
down_revision = ('d4e5f6a7b8c9', 'a5b6c7d8e9f0')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
