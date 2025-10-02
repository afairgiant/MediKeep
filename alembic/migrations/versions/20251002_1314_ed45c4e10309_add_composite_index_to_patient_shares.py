"""add_composite_index_to_patient_shares

Revision ID: ed45c4e10309
Revises: 9f4245d5acb6
Create Date: 2025-10-02 13:14:41.690440

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ed45c4e10309'
down_revision = '9f4245d5acb6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add composite index for common patient share lookup query
    # This index optimizes queries that filter by patient_id, shared_with_user_id, and is_active
    op.create_index(
        'idx_patient_shares_lookup',
        'patient_shares',
        ['patient_id', 'shared_with_user_id', 'is_active'],
        unique=False
    )


def downgrade() -> None:
    # Remove the composite index
    op.drop_index('idx_patient_shares_lookup', table_name='patient_shares')
