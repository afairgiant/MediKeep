"""add_missing_performance_indexes

Revision ID: f32c3fa6d4a7
Revises: 42b59974972e
Create Date: 2025-08-21 07:24:31.787055

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f32c3fa6d4a7'
down_revision = '42b59974972e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create indexes for medical record queries
    op.create_index('idx_medications_patient_id', 'medications', ['patient_id'])
    op.create_index('idx_lab_results_patient_id', 'lab_results', ['patient_id'])
    op.create_index('idx_conditions_patient_id', 'conditions', ['patient_id'])
    op.create_index('idx_encounters_patient_id', 'encounters', ['patient_id'])
    op.create_index('idx_procedures_patient_id', 'procedures', ['patient_id'])
    op.create_index('idx_immunizations_patient_id', 'immunizations', ['patient_id'])
    op.create_index('idx_allergies_patient_id', 'allergies', ['patient_id'])
    op.create_index('idx_vitals_patient_id', 'vitals', ['patient_id'])

    # Create composite indexes for common query patterns
    op.create_index('idx_lab_results_patient_date', 'lab_results', ['patient_id', 'completed_date'])
    op.create_index('idx_medications_patient_status', 'medications', ['patient_id', 'status'])
    op.create_index('idx_conditions_patient_status', 'conditions', ['patient_id', 'status'])

    # Create user and authentication indexes
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_patients_owner_user_id', 'patients', ['owner_user_id'])


def downgrade() -> None:
    # Drop user and authentication indexes
    op.drop_index('idx_patients_owner_user_id', table_name='patients')
    op.drop_index('idx_users_email', table_name='users')

    # Drop composite indexes for common query patterns
    op.drop_index('idx_conditions_patient_status', table_name='conditions')
    op.drop_index('idx_medications_patient_status', table_name='medications')
    op.drop_index('idx_lab_results_patient_date', table_name='lab_results')

    # Drop indexes for medical record queries
    op.drop_index('idx_vitals_patient_id', table_name='vitals')
    op.drop_index('idx_allergies_patient_id', table_name='allergies')
    op.drop_index('idx_immunizations_patient_id', table_name='immunizations')
    op.drop_index('idx_procedures_patient_id', table_name='procedures')
    op.drop_index('idx_encounters_patient_id', table_name='encounters')
    op.drop_index('idx_conditions_patient_id', table_name='conditions')
    op.drop_index('idx_lab_results_patient_id', table_name='lab_results')
    op.drop_index('idx_medications_patient_id', table_name='medications')
