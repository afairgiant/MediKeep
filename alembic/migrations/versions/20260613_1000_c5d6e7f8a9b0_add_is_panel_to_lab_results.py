"""Add is_panel column to lab_results

Revision ID: c5d6e7f8a9b0
Revises: b3f7c1d9e2a4
Create Date: 2026-06-13 10:00:00.000000

Adds an ``is_panel`` boolean flag to ``lab_results`` so panel records created
via the "Add Lab Panel" dialog can be reliably identified even when they have
no child ``LabTestComponent`` rows yet.  Without this flag, a newly created
panel with no components is indistinguishable from an incomplete singleton
lab result, which prevented the panel-specific card layout (no Test Code /
Test Type, rolled-up status) from taking effect.

``is_panel`` is NOT NULL with a false server_default so existing rows pass
the constraint without a backfill migration.
"""

from alembic import op
import sqlalchemy as sa


revision = "c5d6e7f8a9b0"
down_revision = "b3f7c1d9e2a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lab_results",
        sa.Column(
            "is_panel",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("lab_results", "is_panel")
