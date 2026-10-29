"""Add trusted devices

Revision ID: f4b8d2e6a913
Revises: e3a9c5d1f742
Create Date: 2026-10-28 10:00:00.000000

Adds trusted_devices: browsers that may skip the second sign-in step for a while.
"""

from alembic import op
import sqlalchemy as sa

revision = "f4b8d2e6a913"
down_revision = "e3a9c5d1f742"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trusted_devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("session_version", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_trusted_devices_user_id", "trusted_devices", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_trusted_devices_user_id", table_name="trusted_devices")
    op.drop_table("trusted_devices")
