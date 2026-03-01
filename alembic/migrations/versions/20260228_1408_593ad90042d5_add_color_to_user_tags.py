"""add_color_to_user_tags

Revision ID: 593ad90042d5
Revises: 455b28eb17e9
Create Date: 2026-02-28 14:08:35.175860

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '593ad90042d5'
down_revision = '455b28eb17e9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user_tags', sa.Column('color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column('user_tags', 'color')
