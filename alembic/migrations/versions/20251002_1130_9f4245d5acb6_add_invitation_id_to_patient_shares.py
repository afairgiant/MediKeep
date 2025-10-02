"""Add invitation_id to patient_shares

Revision ID: 9f4245d5acb6
Revises: f7b3b520eaa8
Create Date: 2025-10-02 11:30:04.710705

Migration Overview:
- Adds a nullable invitation_id column to patient_shares
- Creates a foreign key to the invitations table
- Adds an index for performance optimization
- Supports backward compatibility with existing shares
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9f4245d5acb6'
down_revision = 'f7b3b520eaa8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add invitation_id column to patient_shares table
    This links patient shares to the invitation that created them
    Nullable for backward compatibility with existing shares

    Key Design Considerations:
    - Nullable column prevents breaking existing data
    - Foreign key ensures referential integrity
    - Soft delete via SET NULL protects against invitation deletion
    - Index improves query performance for invitation-based lookups
    """
    # Add invitation_id column (nullable for backward compatibility)
    op.add_column('patient_shares',
        sa.Column('invitation_id', sa.Integer(),
                  nullable=True,
                  comment='Invitation that created this patient share'))

    # Create foreign key constraint
    op.create_foreign_key(
        'fk_patient_share_invitation',
        'patient_shares', 'invitations',
        ['invitation_id'], ['id'],
        ondelete='SET NULL'  # If invitation deleted, share remains but loses reference
    )

    # Create index for performance
    op.create_index(
        'idx_patient_shares_invitation_id',
        'patient_shares',
        ['invitation_id']
    )


def downgrade() -> None:
    """
    Remove invitation_id column from patient_shares table
    Reverses all changes made in the upgrade function

    Safe rollback strategy:
    1. Drop index first
    2. Remove foreign key constraint
    3. Drop column
    """
    # Drop index
    op.drop_index('idx_patient_shares_invitation_id', table_name='patient_shares')

    # Drop foreign key
    op.drop_constraint('fk_patient_share_invitation', 'patient_shares', type_='foreignkey')

    # Drop column
    op.drop_column('patient_shares', 'invitation_id')