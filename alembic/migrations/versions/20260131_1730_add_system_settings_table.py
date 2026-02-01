"""add_system_settings_table

Revision ID: add_system_settings_table
Revises: 4ae4496ad1c6
Create Date: 2026-01-31 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_system_settings_table'
down_revision = '4ae4496ad1c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create system_settings table for storing key-value configuration pairs
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('key')
    )


def downgrade() -> None:
    op.drop_table('system_settings')
