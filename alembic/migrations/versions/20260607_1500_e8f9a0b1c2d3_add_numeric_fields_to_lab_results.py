"""Add numeric result fields to lab_results

Revision ID: e8f9a0b1c2d3
Revises: 43c1fba67419
Create Date: 2026-06-07 15:00:00.000000

Adds optional numeric result columns to lab_results so that individual
(non-component) lab results can store a measured value, unit, and reference
range. This mirrors the equivalent fields on lab_test_components and enables
historical charting of stacked individual results.
"""

from alembic import op
import sqlalchemy as sa


revision = "e8f9a0b1c2d3"
down_revision = "43c1fba67419"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lab_results", sa.Column("value", sa.Float(), nullable=True))
    op.add_column("lab_results", sa.Column("unit", sa.String(), nullable=True))
    op.add_column("lab_results", sa.Column("ref_range_min", sa.Float(), nullable=True))
    op.add_column("lab_results", sa.Column("ref_range_max", sa.Float(), nullable=True))
    op.add_column("lab_results", sa.Column("ref_range_text", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("lab_results", "ref_range_text")
    op.drop_column("lab_results", "ref_range_max")
    op.drop_column("lab_results", "ref_range_min")
    op.drop_column("lab_results", "unit")
    op.drop_column("lab_results", "value")
