"""add is_active and last_login_at to users

Revision ID: eb3c5322d096
Revises: add_must_change_password
Create Date: 2026-02-26 14:28:12.412596

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'eb3c5322d096'
down_revision = 'add_must_change_password'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'is_active')
