"""add_sso_linking_preference_to_users

Revision ID: c828aa92b108
Revises: eb5cb4aa35d5
Create Date: 2025-08-12 14:49:30.111364

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c828aa92b108'
down_revision = 'eb5cb4aa35d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add SSO linking preference field to users table
    op.add_column('users', sa.Column('sso_linking_preference', sa.String(length=20), nullable=True))


def downgrade() -> None:
    # Remove SSO linking preference field from users table
    op.drop_column('users', 'sso_linking_preference')
