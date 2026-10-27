"""Add two-factor tables

Revision ID: e3a9c5d1f742
Revises: d7b2f4a8c615
Create Date: 2026-10-25 11:00:00.000000

Adds user_totp (authenticator secrets) and user_backup_codes (recovery codes).
"""

from alembic import op
import sqlalchemy as sa

revision = "e3a9c5d1f742"
down_revision = "d7b2f4a8c615"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_totp",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column("enabled_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_step", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "user_backup_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(length=100), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_user_backup_codes_user_id", "user_backup_codes", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_user_backup_codes_user_id", table_name="user_backup_codes")
    op.drop_table("user_backup_codes")
    op.drop_table("user_totp")
