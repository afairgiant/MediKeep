"""add session timeout to user preferences

Revision ID: add_session_timeout
Revises: f32c3fa6d4a7
Create Date: 2025-08-30 11:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_session_timeout'
down_revision = 'f32c3fa6d4a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add session_timeout_minutes column to user_preferences table
    op.add_column('user_preferences', 
        sa.Column('session_timeout_minutes', sa.Integer(), nullable=False, server_default='30')
    )
    
    # Remove the server default after setting initial values
    op.alter_column('user_preferences', 'session_timeout_minutes',
                    server_default=None)


def downgrade() -> None:
    # Remove session_timeout_minutes column from user_preferences table
    op.drop_column('user_preferences', 'session_timeout_minutes')