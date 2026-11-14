"""Add the chosen Paperless authentication method to user preferences

Revision ID: d4a7f1b3c926
Revises: c9d3e6a2f815
Create Date: 2026-11-14 10:00:00.000000

Stores which saved credential set (API token or username/password) the user
chose to authenticate to Paperless-ngx. Previously the token always won when
both were saved. NULL keeps that behaviour for existing rows, so nothing is
backfilled. There is no CHECK constraint so new methods need no migration.
"""

from alembic import op
import sqlalchemy as sa

revision = "d4a7f1b3c926"
down_revision = "c9d3e6a2f815"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("paperless_auth_method", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "paperless_auth_method")
