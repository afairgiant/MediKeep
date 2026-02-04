"""Add treatment plan relationship tables

Revision ID: add_treatment_plan_tables
Revises: 3a4ccf83e967
Create Date: 2026-02-04 10:00:00.000000

This migration adds:
- medical_equipment: Track medical equipment (CPAP, inhalers, etc.)
- treatment_medications: Junction table for treatment-medication relationships
- treatment_encounters: Junction table for treatment-encounter relationships
- treatment_lab_results: Junction table for treatment-lab result relationships
- treatment_equipment: Junction table for treatment-equipment relationships
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_treatment_plan_tables'
down_revision = 'a9b8c7d6e5f4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create medical_equipment table
    op.create_table('medical_equipment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('patient_id', sa.Integer(), nullable=False),
        sa.Column('practitioner_id', sa.Integer(), nullable=True),
        sa.Column('equipment_name', sa.String(), nullable=False),
        sa.Column('equipment_type', sa.String(), nullable=False),
        sa.Column('manufacturer', sa.String(), nullable=True),
        sa.Column('model_number', sa.String(), nullable=True),
        sa.Column('serial_number', sa.String(), nullable=True),
        sa.Column('prescribed_date', sa.Date(), nullable=True),
        sa.Column('last_service_date', sa.Date(), nullable=True),
        sa.Column('next_service_date', sa.Date(), nullable=True),
        sa.Column('usage_instructions', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('supplier', sa.String(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['practitioner_id'], ['practitioners.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_medical_equipment_patient_id', 'medical_equipment', ['patient_id'], unique=False)
    op.create_index('idx_medical_equipment_status', 'medical_equipment', ['status'], unique=False)

    # Create treatment_medications junction table
    op.create_table('treatment_medications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('treatment_id', sa.Integer(), nullable=False),
        sa.Column('medication_id', sa.Integer(), nullable=False),
        sa.Column('specific_dosage', sa.String(), nullable=True),
        sa.Column('specific_frequency', sa.String(), nullable=True),
        sa.Column('specific_duration', sa.String(), nullable=True),
        sa.Column('timing_instructions', sa.String(), nullable=True),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['treatment_id'], ['treatments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medication_id'], ['medications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('treatment_id', 'medication_id', name='uq_treatment_medication')
    )
    op.create_index('idx_treatment_medication_treatment_id', 'treatment_medications', ['treatment_id'], unique=False)
    op.create_index('idx_treatment_medication_medication_id', 'treatment_medications', ['medication_id'], unique=False)

    # Create treatment_encounters junction table
    op.create_table('treatment_encounters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('treatment_id', sa.Integer(), nullable=False),
        sa.Column('encounter_id', sa.Integer(), nullable=False),
        sa.Column('visit_label', sa.String(), nullable=True),
        sa.Column('visit_sequence', sa.Integer(), nullable=True),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['treatment_id'], ['treatments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('treatment_id', 'encounter_id', name='uq_treatment_encounter')
    )
    op.create_index('idx_treatment_encounter_treatment_id', 'treatment_encounters', ['treatment_id'], unique=False)
    op.create_index('idx_treatment_encounter_encounter_id', 'treatment_encounters', ['encounter_id'], unique=False)

    # Create treatment_lab_results junction table
    op.create_table('treatment_lab_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('treatment_id', sa.Integer(), nullable=False),
        sa.Column('lab_result_id', sa.Integer(), nullable=False),
        sa.Column('purpose', sa.String(), nullable=True),
        sa.Column('expected_frequency', sa.String(), nullable=True),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['treatment_id'], ['treatments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['lab_result_id'], ['lab_results.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('treatment_id', 'lab_result_id', name='uq_treatment_lab_result')
    )
    op.create_index('idx_treatment_lab_result_treatment_id', 'treatment_lab_results', ['treatment_id'], unique=False)
    op.create_index('idx_treatment_lab_result_lab_result_id', 'treatment_lab_results', ['lab_result_id'], unique=False)

    # Create treatment_equipment junction table
    op.create_table('treatment_equipment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('treatment_id', sa.Integer(), nullable=False),
        sa.Column('equipment_id', sa.Integer(), nullable=False),
        sa.Column('usage_frequency', sa.String(), nullable=True),
        sa.Column('specific_settings', sa.String(), nullable=True),
        sa.Column('relevance_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['treatment_id'], ['treatments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['equipment_id'], ['medical_equipment.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('treatment_id', 'equipment_id', name='uq_treatment_equipment')
    )
    op.create_index('idx_treatment_equipment_treatment_id', 'treatment_equipment', ['treatment_id'], unique=False)
    op.create_index('idx_treatment_equipment_equipment_id', 'treatment_equipment', ['equipment_id'], unique=False)


def downgrade() -> None:
    # Drop junction tables first (due to foreign key dependencies)
    op.drop_index('idx_treatment_equipment_equipment_id', table_name='treatment_equipment')
    op.drop_index('idx_treatment_equipment_treatment_id', table_name='treatment_equipment')
    op.drop_table('treatment_equipment')

    op.drop_index('idx_treatment_lab_result_lab_result_id', table_name='treatment_lab_results')
    op.drop_index('idx_treatment_lab_result_treatment_id', table_name='treatment_lab_results')
    op.drop_table('treatment_lab_results')

    op.drop_index('idx_treatment_encounter_encounter_id', table_name='treatment_encounters')
    op.drop_index('idx_treatment_encounter_treatment_id', table_name='treatment_encounters')
    op.drop_table('treatment_encounters')

    op.drop_index('idx_treatment_medication_medication_id', table_name='treatment_medications')
    op.drop_index('idx_treatment_medication_treatment_id', table_name='treatment_medications')
    op.drop_table('treatment_medications')

    # Drop medical_equipment table last
    op.drop_index('idx_medical_equipment_status', table_name='medical_equipment')
    op.drop_index('idx_medical_equipment_patient_id', table_name='medical_equipment')
    op.drop_table('medical_equipment')
