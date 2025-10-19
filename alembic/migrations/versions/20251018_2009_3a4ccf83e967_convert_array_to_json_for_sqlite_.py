"""convert array to json for sqlite compatibility

Revision ID: 3a4ccf83e967
Revises: 9ba5b01fbbd0
Create Date: 2025-10-18 20:09:39.042626

Converts PostgreSQL ARRAY columns to JSON for SQLite compatibility.
This enables the application to run on both PostgreSQL and SQLite databases.

Tables affected:
- standardized_tests.common_names: ARRAY(String) → JSON
- report_generation_audit.categories_included: ARRAY(Text) → JSON

Data is preserved automatically by PostgreSQL during conversion.
Follows the same pattern as migration 9ba5b01fbbd0 (JSONB to JSON).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '3a4ccf83e967'
down_revision = '9ba5b01fbbd0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Convert PostgreSQL ARRAY columns to JSON for SQLite compatibility"""

    # Convert standardized_tests.common_names: ARRAY(String) → JSON
    # Alternative test names like ['CBC', 'Blood Count', 'Hemogram']
    op.alter_column('standardized_tests', 'common_names',
                   type_=sa.JSON,
                   postgresql_using='common_names::json',
                   existing_nullable=True)

    # Convert report_generation_audit.categories_included: ARRAY(Text) → JSON
    # Category list like ['medications', 'lab_results', 'conditions']
    op.alter_column('report_generation_audit', 'categories_included',
                   type_=sa.JSON,
                   postgresql_using='categories_included::json',
                   existing_nullable=True)


def downgrade() -> None:
    """Revert JSON columns back to PostgreSQL ARRAY (for rollback)"""

    # Revert standardized_tests.common_names: JSON → ARRAY(String)
    op.alter_column('standardized_tests', 'common_names',
                   type_=postgresql.ARRAY(sa.String()),
                   postgresql_using='common_names::text[]',
                   existing_nullable=True)

    # Revert report_generation_audit.categories_included: JSON → ARRAY(Text)
    op.alter_column('report_generation_audit', 'categories_included',
                   type_=postgresql.ARRAY(sa.Text()),
                   postgresql_using='categories_included::text[]',
                   existing_nullable=True)
