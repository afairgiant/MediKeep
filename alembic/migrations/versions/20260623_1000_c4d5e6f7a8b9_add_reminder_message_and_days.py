"""Add reminder_message and reminder_days columns to medications

Revision ID: c4d5e6f7a8b9
Revises: b3f7c1d9e2a4
Create Date: 2026-06-23 10:00:00.000000

Adds two per-medication reminder customisation fields:

``reminder_message`` (Text, nullable) — an optional note the user writes,
e.g. "Take with food". Surfaced in the notification body alongside the
medication name and dosage.

``reminder_days`` (JSON, nullable) — an optional list of weekday integers
(0 = Monday … 6 = Sunday, matching Python's ``datetime.weekday()``). When
null or empty the scheduler fires on every day; when populated it fires only
on the listed days. This mirrors the existing ``reminder_times`` field which
stores a list of HH:MM strings.
"""

from alembic import op
import sqlalchemy as sa


revision = "c4d5e6f7a8b9"
down_revision = "b3f7c1d9e2a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "medications",
        sa.Column("reminder_message", sa.Text(), nullable=True),
    )
    op.add_column(
        "medications",
        sa.Column("reminder_days", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("medications", "reminder_days")
    op.drop_column("medications", "reminder_message")
