"""add date_format to user_preferences

Revision ID: add_date_format_pref
Revises: 160b1904a84a
Create Date: 2026-01-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_date_format_pref'
down_revision = '160b1904a84a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add date_format column to user_preferences table
    # mdy = MM/DD/YYYY (US), dmy = DD/MM/YYYY (European), ymd = YYYY-MM-DD (ISO)
    op.add_column('user_preferences',
        sa.Column('date_format', sa.String(10), nullable=False, server_default='mdy')
    )

    # Remove the server default after setting initial values
    op.alter_column('user_preferences', 'date_format',
                    server_default=None)


def downgrade() -> None:
    # Remove date_format column from user_preferences table
    op.drop_column('user_preferences', 'date_format')
