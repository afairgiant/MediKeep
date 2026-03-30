"""update_default_session_timeout_to_120

Revision ID: f9fc8447c620
Revises: 821203926422
Create Date: 2026-03-30 16:05:07.201166

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'f9fc8447c620'
down_revision = '821203926422'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE user_preferences SET session_timeout_minutes = 120 WHERE session_timeout_minutes = 30"
    )


def downgrade() -> None:
    # Intentionally left as a no-op to avoid overwriting user-configured
    # session_timeout_minutes values that may legitimately be set to 120.
    pass
