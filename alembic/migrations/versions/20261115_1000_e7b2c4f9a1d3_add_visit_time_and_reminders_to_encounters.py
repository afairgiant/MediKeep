"""Add visit_time and reminder columns to encounters

Revision ID: e7b2c4f9a1d3
Revises: d4a7f1b3c926
Create Date: 2026-11-15 10:00:00.000000

Optional start time plus per-visit reminder settings for upcoming visits.
The index supports the visit reminder scheduler's per-minute discovery query.
"""

from alembic import op
import sqlalchemy as sa

revision = "e7b2c4f9a1d3"
down_revision = "d4a7f1b3c926"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("encounters", sa.Column("visit_time", sa.Time(), nullable=True))
    op.add_column(
        "encounters",
        sa.Column(
            "reminder_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "encounters",
        sa.Column("reminder_offsets", sa.JSON(), nullable=True),
    )
    op.add_column(
        "encounters",
        sa.Column(
            "reminder_include_details",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index(
        "idx_encounters_reminder_enabled_date",
        "encounters",
        ["reminder_enabled", "date"],
    )


def downgrade() -> None:
    op.drop_index("idx_encounters_reminder_enabled_date", table_name="encounters")
    op.drop_column("encounters", "reminder_include_details")
    op.drop_column("encounters", "reminder_offsets")
    op.drop_column("encounters", "reminder_enabled")
    op.drop_column("encounters", "visit_time")
