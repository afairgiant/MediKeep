"""Make user_preferences.language nullable

Revision ID: e7f4a2b9c1d3
Revises: add_lr_med_proc_tables
Create Date: 2026-09-03 12:00:00.000000

NULL records that the user has never chosen a language, which lets browser
detection apply without overriding a deliberate choice of English.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e7f4a2b9c1d3"
down_revision = "add_lr_med_proc_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Batch mode keeps this migration runnable on SQLite for the round-trip test.
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.alter_column(
            "language",
            existing_type=sa.String(10),
            existing_nullable=False,
            nullable=True,
            server_default=None,
        )


def downgrade() -> None:
    op.execute("UPDATE user_preferences SET language = 'en' WHERE language IS NULL")

    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.alter_column(
            "language",
            existing_type=sa.String(10),
            existing_nullable=True,
            nullable=False,
            server_default="en",
        )
