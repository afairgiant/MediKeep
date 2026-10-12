"""add purpose to lab result links for conditions and procedures

Revision ID: 9a3d5e7f1b24
Revises: 7c1e4a9b2d35
Create Date: 2026-10-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9a3d5e7f1b24'
down_revision = '7c1e4a9b2d35'
branch_labels = None
depends_on = None

LINK_TABLES = ['lab_result_conditions', 'lab_result_procedures']


def upgrade() -> None:
    for table in LINK_TABLES:
        op.add_column(table, sa.Column('purpose', sa.String(length=50), nullable=True))


def downgrade() -> None:
    for table in reversed(LINK_TABLES):
        op.drop_column(table, 'purpose')
