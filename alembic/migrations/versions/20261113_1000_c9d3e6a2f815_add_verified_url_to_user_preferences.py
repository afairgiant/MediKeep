"""Add verified URL tracking for Paperless and Papra connections

Revision ID: c9d3e6a2f815
Revises: b8e2d5f1c934
Create Date: 2026-11-13 10:00:00.000000

Records which URL each integration's last successful connection test reached,
so saving settings right after testing keeps the connection verified instead
of resetting it because the URL looked new.
"""

from alembic import op
import sqlalchemy as sa

revision = "c9d3e6a2f815"
down_revision = "b8e2d5f1c934"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("paperless_verified_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "user_preferences",
        sa.Column("papra_verified_url", sa.String(length=500), nullable=True),
    )

    # Rows already marked verified were verified against their current URL
    op.execute("""
        UPDATE user_preferences
        SET paperless_verified_url = paperless_url
        WHERE paperless_connection_verified = true
        """)
    op.execute("""
        UPDATE user_preferences
        SET papra_verified_url = papra_url
        WHERE papra_connection_verified = true
        """)


def downgrade() -> None:
    op.drop_column("user_preferences", "papra_verified_url")
    op.drop_column("user_preferences", "paperless_verified_url")
