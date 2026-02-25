"""add must_change_password to users

Revision ID: add_must_change_password
Revises: 66824b6f1830
Create Date: 2026-02-23 12:00:00.000000

Adds a flag to force a password change on the next login.
Used for accounts created with a known default password (e.g. the
emergency admin account created by create_emergency_admin.py).
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_must_change_password'
down_revision = '66824b6f1830'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'must_change_password',
            sa.Boolean(),
            nullable=False,
            server_default='false',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'must_change_password')
