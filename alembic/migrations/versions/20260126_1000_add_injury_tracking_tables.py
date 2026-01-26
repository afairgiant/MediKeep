"""add injury tracking tables

Revision ID: add_injury_tracking
Revises: add_date_format_pref
Create Date: 2026-01-26 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_injury_tracking'
down_revision = 'add_date_format_pref'
branch_labels = None
depends_on = None


# Default system injury types to seed
DEFAULT_INJURY_TYPES = [
    {"name": "Sprain/Strain", "description": "Stretching or tearing of ligaments or muscles"},
    {"name": "Fracture", "description": "Broken bone"},
    {"name": "Laceration/Cut", "description": "Open wound from cutting or tearing"},
    {"name": "Burn", "description": "Tissue damage from heat, chemicals, or radiation"},
    {"name": "Contusion/Bruise", "description": "Injury causing discoloration without breaking skin"},
    {"name": "Dislocation", "description": "Bone displaced from its normal position in a joint"},
    {"name": "Concussion", "description": "Traumatic brain injury from impact"},
    {"name": "Abrasion", "description": "Scrape or graze of the skin surface"},
    {"name": "Puncture Wound", "description": "Deep wound from a pointed object"},
    {"name": "Other", "description": "Other type of injury not listed"},
]


def upgrade() -> None:
    # Create injury_types table (reusable injury types)
    op.create_table('injury_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(300), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_injury_types_name')
    )
    op.create_index('idx_injury_types_name', 'injury_types', ['name'])
    op.create_index('idx_injury_types_is_system', 'injury_types', ['is_system'])

    # Seed default injury types
    injury_types_table = sa.table(
        'injury_types',
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('is_system', sa.Boolean),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    op.bulk_insert(
        injury_types_table,
        [
            {
                "name": t["name"],
                "description": t["description"],
                "is_system": True,
                "created_at": now,
                "updated_at": now,
            }
            for t in DEFAULT_INJURY_TYPES
        ]
    )

    # Create injuries table
    op.create_table('injuries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('patient_id', sa.Integer(), nullable=False),
        sa.Column('injury_name', sa.String(300), nullable=False),
        sa.Column('injury_type_id', sa.Integer(), nullable=True),
        sa.Column('body_part', sa.String(100), nullable=False),
        sa.Column('laterality', sa.String(20), nullable=True),
        sa.Column('date_of_injury', sa.Date(), nullable=True),
        sa.Column('mechanism', sa.String(500), nullable=True),
        sa.Column('severity', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, default='active'),
        sa.Column('treatment_received', sa.Text(), nullable=True),
        sa.Column('recovery_notes', sa.Text(), nullable=True),
        sa.Column('practitioner_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),
        sa.ForeignKeyConstraint(['injury_type_id'], ['injury_types.id'], ),
        sa.ForeignKeyConstraint(['practitioner_id'], ['practitioners.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_injuries_patient_id', 'injuries', ['patient_id'])
    op.create_index('idx_injuries_patient_status', 'injuries', ['patient_id', 'status'])
    op.create_index('idx_injuries_injury_type', 'injuries', ['injury_type_id'])
    op.create_index('idx_injuries_date', 'injuries', ['date_of_injury'])

    # Create injury_medications junction table
    op.create_table('injury_medications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('injury_id', sa.Integer(), nullable=False),
        sa.Column('medication_id', sa.Integer(), nullable=False),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['injury_id'], ['injuries.id'], ),
        sa.ForeignKeyConstraint(['medication_id'], ['medications.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('injury_id', 'medication_id', name='uq_injury_medication')
    )
    op.create_index('idx_injury_medication_injury_id', 'injury_medications', ['injury_id'])
    op.create_index('idx_injury_medication_medication_id', 'injury_medications', ['medication_id'])

    # Create injury_conditions junction table
    op.create_table('injury_conditions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('injury_id', sa.Integer(), nullable=False),
        sa.Column('condition_id', sa.Integer(), nullable=False),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['injury_id'], ['injuries.id'], ),
        sa.ForeignKeyConstraint(['condition_id'], ['conditions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('injury_id', 'condition_id', name='uq_injury_condition')
    )
    op.create_index('idx_injury_condition_injury_id', 'injury_conditions', ['injury_id'])
    op.create_index('idx_injury_condition_condition_id', 'injury_conditions', ['condition_id'])

    # Create injury_treatments junction table
    op.create_table('injury_treatments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('injury_id', sa.Integer(), nullable=False),
        sa.Column('treatment_id', sa.Integer(), nullable=False),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['injury_id'], ['injuries.id'], ),
        sa.ForeignKeyConstraint(['treatment_id'], ['treatments.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('injury_id', 'treatment_id', name='uq_injury_treatment')
    )
    op.create_index('idx_injury_treatment_injury_id', 'injury_treatments', ['injury_id'])
    op.create_index('idx_injury_treatment_treatment_id', 'injury_treatments', ['treatment_id'])

    # Create injury_procedures junction table
    op.create_table('injury_procedures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('injury_id', sa.Integer(), nullable=False),
        sa.Column('procedure_id', sa.Integer(), nullable=False),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['injury_id'], ['injuries.id'], ),
        sa.ForeignKeyConstraint(['procedure_id'], ['procedures.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('injury_id', 'procedure_id', name='uq_injury_procedure')
    )
    op.create_index('idx_injury_procedure_injury_id', 'injury_procedures', ['injury_id'])
    op.create_index('idx_injury_procedure_procedure_id', 'injury_procedures', ['procedure_id'])


def downgrade() -> None:
    # Drop junction tables first (due to foreign key constraints)
    op.drop_index('idx_injury_procedure_procedure_id', table_name='injury_procedures')
    op.drop_index('idx_injury_procedure_injury_id', table_name='injury_procedures')
    op.drop_table('injury_procedures')

    op.drop_index('idx_injury_treatment_treatment_id', table_name='injury_treatments')
    op.drop_index('idx_injury_treatment_injury_id', table_name='injury_treatments')
    op.drop_table('injury_treatments')

    op.drop_index('idx_injury_condition_condition_id', table_name='injury_conditions')
    op.drop_index('idx_injury_condition_injury_id', table_name='injury_conditions')
    op.drop_table('injury_conditions')

    op.drop_index('idx_injury_medication_medication_id', table_name='injury_medications')
    op.drop_index('idx_injury_medication_injury_id', table_name='injury_medications')
    op.drop_table('injury_medications')

    # Drop injuries table
    op.drop_index('idx_injuries_date', table_name='injuries')
    op.drop_index('idx_injuries_injury_type', table_name='injuries')
    op.drop_index('idx_injuries_patient_status', table_name='injuries')
    op.drop_index('idx_injuries_patient_id', table_name='injuries')
    op.drop_table('injuries')

    # Drop injury_types table
    op.drop_index('idx_injury_types_is_system', table_name='injury_types')
    op.drop_index('idx_injury_types_name', table_name='injury_types')
    op.drop_table('injury_types')
