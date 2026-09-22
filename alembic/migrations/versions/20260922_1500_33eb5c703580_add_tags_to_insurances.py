"""Add tags to insurances

Revision ID: 33eb5c703580
Revises: 9d5bf1e4e1ef
Create Date: 2026-09-22 15:00:00.000000

The Add/Edit Insurance form has offered a Tags field since it adopted the
shared TagInput component, but insurances never had a tags column, so
anything typed there was silently discarded on save. This adds the column
to match every other medical record table (allergies, conditions,
medications, etc.), which already store tags as a plain JSON list.
"""

from alembic import op
import sqlalchemy as sa

revision = "33eb5c703580"
down_revision = "9d5bf1e4e1ef"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("insurances", sa.Column("tags", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("insurances", "tags")
