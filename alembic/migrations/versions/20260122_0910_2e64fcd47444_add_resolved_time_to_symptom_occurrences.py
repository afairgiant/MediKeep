"""add resolved_time to symptom_occurrences

Revision ID: 2e64fcd47444
Revises: 0578a62e2157
Create Date: 2026-01-22 09:10:09.146027

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2e64fcd47444'
down_revision = '0578a62e2157'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('symptom_occurrences', sa.Column('resolved_time', sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column('symptom_occurrences', 'resolved_time')
