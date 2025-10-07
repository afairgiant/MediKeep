"""add_standardized_tests_table

Revision ID: df53ab5473dd
Revises: ed45c4e10309
Create Date: 2025-10-05 14:50:47.321495

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'df53ab5473dd'
down_revision = 'ed45c4e10309'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create standardized_tests table
    op.create_table(
        'standardized_tests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('loinc_code', sa.String(length=20), nullable=True),
        sa.Column('test_name', sa.String(length=255), nullable=False),
        sa.Column('short_name', sa.String(length=100), nullable=True),
        sa.Column('default_unit', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('common_names', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('is_common', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('system', sa.String(length=100), nullable=True),
        sa.Column('loinc_class', sa.String(length=100), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for efficient searching
    op.create_index('idx_standardized_tests_loinc_code', 'standardized_tests', ['loinc_code'], unique=True)
    op.create_index('idx_standardized_tests_test_name', 'standardized_tests', ['test_name'])
    op.create_index('idx_standardized_tests_category', 'standardized_tests', ['category'])
    op.create_index('idx_standardized_tests_is_common', 'standardized_tests', ['is_common'])

    # Create full-text search index on test_name
    op.execute(
        "CREATE INDEX idx_standardized_tests_test_name_fts ON standardized_tests "
        "USING GIN (to_tsvector('english', test_name))"
    )

    # Create index on short_name
    op.create_index('idx_standardized_tests_short_name', 'standardized_tests', ['short_name'])


def downgrade() -> None:
    op.drop_index('idx_standardized_tests_short_name', table_name='standardized_tests')
    op.drop_index('idx_standardized_tests_test_name_fts', table_name='standardized_tests')
    op.drop_index('idx_standardized_tests_is_common', table_name='standardized_tests')
    op.drop_index('idx_standardized_tests_category', table_name='standardized_tests')
    op.drop_index('idx_standardized_tests_test_name', table_name='standardized_tests')
    op.drop_index('idx_standardized_tests_loinc_code', table_name='standardized_tests')
    op.drop_table('standardized_tests')
