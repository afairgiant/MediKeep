"""Add user session version

Revision ID: d7b2f4a8c615
Revises: c4e9a1d2b939
Create Date: 2026-10-25 10:00:00.000000

Adds users.session_version, compared against the "sv" claim of each access token.
"""

from alembic import op
import sqlalchemy as sa

revision = "d7b2f4a8c615"
down_revision = "c4e9a1d2b939"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "session_version")
