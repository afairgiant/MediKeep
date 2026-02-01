"""add_canonical_test_name_to_lab_test_components

Revision ID: 4ae4496ad1c6
Revises: add_notification_tables
Create Date: 2026-01-31 16:03:04.240838

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4ae4496ad1c6'
down_revision = 'add_notification_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add canonical_test_name column for linking test variations to a standard name for trending
    op.add_column('lab_test_components', sa.Column('canonical_test_name', sa.String(), nullable=True))
    op.create_index('ix_lab_test_components_canonical_test_name', 'lab_test_components', ['canonical_test_name'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_lab_test_components_canonical_test_name', table_name='lab_test_components')
    op.drop_column('lab_test_components', 'canonical_test_name')
