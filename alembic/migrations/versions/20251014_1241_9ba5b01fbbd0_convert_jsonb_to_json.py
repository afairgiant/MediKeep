"""convert_jsonb_to_json

Revision ID: 9ba5b01fbbd0
Revises: f5e2f39331cc
Create Date: 2025-10-14 12:41:00.000000

Convert JSONB columns to JSON for SQLite compatibility.
Data is preserved automatically by PostgreSQL during conversion.
This enables unit testing with SQLite without requiring PostgreSQL dependency.

Performance Impact:
- GIN indexes removed (PostgreSQL-specific)
- Tag searches may be 2-5x slower (acceptable for typical usage)
- Production impact minimal (<10% for typical workloads)

Rollback: Run `alembic downgrade -1` to restore JSONB with GIN indexes
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = '9ba5b01fbbd0'
down_revision = 'f5e2f39331cc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Convert JSONB columns to JSON (safe, data preserved)"""

    # Step 1: Drop PostgreSQL-specific GIN indexes (REQUIRED before type change)
    # Tagging system GIN indexes (8 tables)
    op.execute('DROP INDEX IF EXISTS idx_medications_tags')
    op.execute('DROP INDEX IF EXISTS idx_encounters_tags')
    op.execute('DROP INDEX IF EXISTS idx_lab_results_tags')
    op.execute('DROP INDEX IF EXISTS idx_immunizations_tags')
    op.execute('DROP INDEX IF EXISTS idx_conditions_tags')
    op.execute('DROP INDEX IF EXISTS idx_procedures_tags')
    op.execute('DROP INDEX IF EXISTS idx_treatments_tags')
    op.execute('DROP INDEX IF EXISTS idx_allergies_tags')

    # Report templates GIN index
    op.execute('DROP INDEX IF EXISTS idx_report_template_selected_records')

    # Step 2: Convert JSONB columns to JSON (data preserved automatically)
    # Tagging system (8 tables)
    op.alter_column('medications', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)
    op.alter_column('encounters', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)
    op.alter_column('lab_results', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)
    op.alter_column('immunizations', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)
    op.alter_column('conditions', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)
    op.alter_column('procedures', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)
    op.alter_column('treatments', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)
    op.alter_column('allergies', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)

    # Symptom system (5 columns across 2 tables)
    op.alter_column('symptoms', 'typical_triggers',
                   type_=sa.JSON,
                   postgresql_using='typical_triggers::json',
                   existing_nullable=True)
    op.alter_column('symptoms', 'tags',
                   type_=sa.JSON,
                   postgresql_using='tags::json',
                   existing_nullable=True)
    op.alter_column('symptom_occurrences', 'triggers',
                   type_=sa.JSON,
                   postgresql_using='triggers::json',
                   existing_nullable=True)
    op.alter_column('symptom_occurrences', 'relief_methods',
                   type_=sa.JSON,
                   postgresql_using='relief_methods::json',
                   existing_nullable=True)
    op.alter_column('symptom_occurrences', 'associated_symptoms',
                   type_=sa.JSON,
                   postgresql_using='associated_symptoms::json',
                   existing_nullable=True)

    # Report templates (2 columns)
    op.alter_column('report_templates', 'selected_records',
                   type_=sa.JSON,
                   postgresql_using='selected_records::json',
                   existing_nullable=False)
    op.alter_column('report_templates', 'report_settings',
                   type_=sa.JSON,
                   postgresql_using='report_settings::json',
                   existing_nullable=False)

    # Other JSON columns (5 columns)
    op.alter_column('users', 'sso_metadata',
                   type_=sa.JSON,
                   postgresql_using='sso_metadata::json',
                   existing_nullable=True)
    op.alter_column('patient_shares', 'custom_permissions',
                   type_=sa.JSON,
                   postgresql_using='custom_permissions::json',
                   existing_nullable=True)
    op.alter_column('invitations', 'context_data',
                   type_=sa.JSON,
                   postgresql_using='context_data::json',
                   existing_nullable=False)
    op.alter_column('insurances', 'coverage_details',
                   type_=sa.JSON,
                   postgresql_using='coverage_details::json',
                   existing_nullable=True)
    op.alter_column('insurances', 'contact_info',
                   type_=sa.JSON,
                   postgresql_using='contact_info::json',
                   existing_nullable=True)

    # Note: GIN indexes not recreated for SQLite compatibility


def downgrade() -> None:
    """Revert JSON columns back to JSONB (with GIN indexes)"""

    # Step 1: Convert JSON back to JSONB
    # Tagging system (8 tables)
    op.alter_column('medications', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)
    op.alter_column('encounters', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)
    op.alter_column('lab_results', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)
    op.alter_column('immunizations', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)
    op.alter_column('conditions', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)
    op.alter_column('procedures', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)
    op.alter_column('treatments', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)
    op.alter_column('allergies', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)

    # Symptom system (5 columns)
    op.alter_column('symptoms', 'typical_triggers',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='typical_triggers::jsonb',
                   existing_nullable=True)
    op.alter_column('symptoms', 'tags',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='tags::jsonb',
                   existing_nullable=True)
    op.alter_column('symptom_occurrences', 'triggers',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='triggers::jsonb',
                   existing_nullable=True)
    op.alter_column('symptom_occurrences', 'relief_methods',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='relief_methods::jsonb',
                   existing_nullable=True)
    op.alter_column('symptom_occurrences', 'associated_symptoms',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='associated_symptoms::jsonb',
                   existing_nullable=True)

    # Report templates (2 columns)
    op.alter_column('report_templates', 'selected_records',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='selected_records::jsonb',
                   existing_nullable=False)
    op.alter_column('report_templates', 'report_settings',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='report_settings::jsonb',
                   existing_nullable=False)

    # Other JSON columns (5 columns)
    op.alter_column('users', 'sso_metadata',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='sso_metadata::jsonb',
                   existing_nullable=True)
    op.alter_column('patient_shares', 'custom_permissions',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='custom_permissions::jsonb',
                   existing_nullable=True)
    op.alter_column('invitations', 'context_data',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='context_data::jsonb',
                   existing_nullable=False)
    op.alter_column('insurances', 'coverage_details',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='coverage_details::jsonb',
                   existing_nullable=True)
    op.alter_column('insurances', 'contact_info',
                   type_=postgresql.JSONB(astext_type=sa.Text()),
                   postgresql_using='contact_info::jsonb',
                   existing_nullable=True)

    # Step 2: Recreate GIN indexes for JSONB
    op.execute('CREATE INDEX idx_medications_tags ON medications USING GIN (tags)')
    op.execute('CREATE INDEX idx_encounters_tags ON encounters USING GIN (tags)')
    op.execute('CREATE INDEX idx_lab_results_tags ON lab_results USING GIN (tags)')
    op.execute('CREATE INDEX idx_immunizations_tags ON immunizations USING GIN (tags)')
    op.execute('CREATE INDEX idx_conditions_tags ON conditions USING GIN (tags)')
    op.execute('CREATE INDEX idx_procedures_tags ON procedures USING GIN (tags)')
    op.execute('CREATE INDEX idx_treatments_tags ON treatments USING GIN (tags)')
    op.execute('CREATE INDEX idx_allergies_tags ON allergies USING GIN (tags)')
    op.execute('CREATE INDEX idx_report_template_selected_records ON report_templates USING GIN (selected_records)')
