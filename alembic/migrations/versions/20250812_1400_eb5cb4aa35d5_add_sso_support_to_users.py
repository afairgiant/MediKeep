"""Add SSO support to users table

Revision ID: eb5cb4aa35d5
Revises: bdb4d433f547
Create Date: 2025-08-12 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eb5cb4aa35d5'
down_revision = 'bdb4d433f547'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add SSO fields to users table
    op.add_column('users', sa.Column('auth_method', sa.String(length=20), nullable=False, server_default='local'))
    op.add_column('users', sa.Column('external_id', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('sso_provider', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('sso_metadata', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('last_sso_login', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('account_linked_at', sa.DateTime(), nullable=True))
    
    # Create indexes for performance
    op.create_index('idx_users_external_id', 'users', ['external_id'], unique=False)
    op.create_index('idx_users_sso_provider', 'users', ['sso_provider'], unique=False) 
    op.create_index('idx_users_auth_method', 'users', ['auth_method'], unique=False)
    
    # Create unique constraint on external_id (excluding nulls)
    op.create_unique_constraint('uq_users_external_id', 'users', ['external_id'])


def downgrade() -> None:
    # Remove indexes and constraints
    op.drop_constraint('uq_users_external_id', 'users', type_='unique')
    op.drop_index('idx_users_auth_method', table_name='users')
    op.drop_index('idx_users_sso_provider', table_name='users')
    op.drop_index('idx_users_external_id', table_name='users')
    
    # Remove SSO columns from users table
    op.drop_column('users', 'account_linked_at')
    op.drop_column('users', 'last_sso_login')
    op.drop_column('users', 'sso_metadata')
    op.drop_column('users', 'sso_provider')
    op.drop_column('users', 'external_id')
    op.drop_column('users', 'auth_method')