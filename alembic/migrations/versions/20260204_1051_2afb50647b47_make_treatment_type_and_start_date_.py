"""make_treatment_type_and_start_date_optional

Revision ID: 2afb50647b47
Revises: add_treatment_plan_tables
Create Date: 2026-02-04 10:51:35.227585

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2afb50647b47'
down_revision = 'add_treatment_plan_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make treatment_type and start_date optional (nullable=True)
    op.alter_column('treatments', 'treatment_type',
               existing_type=sa.VARCHAR(),
               nullable=True)
    op.alter_column('treatments', 'start_date',
               existing_type=sa.DATE(),
               nullable=True)


def downgrade() -> None:
    # Revert to non-nullable (will fail if NULL values exist)
    op.alter_column('treatments', 'start_date',
               existing_type=sa.DATE(),
               nullable=False)
    op.alter_column('treatments', 'treatment_type',
               existing_type=sa.VARCHAR(),
               nullable=False)
