"""Add reminder_enabled and reminder_times columns to medications

Revision ID: b3f7c1d9e2a4
Revises: becc1fa4e5ab
Create Date: 2026-06-09 10:00:00.000000

Adds storage for per-medication reminder configuration so users can be notified
at custom times of day (e.g., ``["08:00", "20:00"]``) via their existing
notification channels. The composite index supports the per-minute discovery
query in the new MedicationReminderSchedulerService, which filters by
reminder_enabled AND status='active'.

``reminder_enabled`` is NOT NULL with a false server_default so existing rows
pass the constraint without backfill. ``reminder_times`` is nullable JSON; the
SQLAlchemy model defaults it to an empty list at the Python layer.
"""

from alembic import op
import sqlalchemy as sa


revision = "b3f7c1d9e2a4"
down_revision = "becc1fa4e5ab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "medications",
        sa.Column(
            "reminder_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "medications",
        sa.Column("reminder_times", sa.JSON(), nullable=True),
    )
    op.create_index(
        "idx_medications_reminder_enabled_status",
        "medications",
        ["reminder_enabled", "status"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_medications_reminder_enabled_status", table_name="medications"
    )
    op.drop_column("medications", "reminder_times")
    op.drop_column("medications", "reminder_enabled")
