"""Add language preference to user_preferences

Revision ID: c57de5762af1
Revises: 3a4ccf83e967
Create Date: 2025-10-21 08:39:15.696977

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c57de5762af1'
down_revision = '3a4ccf83e967'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add language column to user_preferences table
    op.add_column(
        'user_preferences',
        sa.Column('language', sa.String(10), nullable=False, server_default='en')
    )


def downgrade() -> None:
    # Remove language column from user_preferences table
    op.drop_column('user_preferences', 'language')
