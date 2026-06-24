"""Add textual_value column to lab_test_components

Revision ID: d4e5f6a7b8c9
Revises: c5d6e7f8a9b0
Create Date: 2026-06-14 10:00:00.000000

Adds ``textual_value`` (nullable String) to ``lab_test_components`` to support
a third result type — "textual" — for imaging and radiology reports where the
result is a free-text narrative rather than a numeric value or a
positive/negative flag.

Existing rows are unaffected (column defaults to NULL).
"""

from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c5d6e7f8a9b0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'lab_test_components',
        sa.Column('textual_value', sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column('lab_test_components', 'textual_value')
