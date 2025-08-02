"""add paperless fields to user preferences and entity files

Revision ID: b37b4e5cfd0b
Revises: 2c95ef997278
Create Date: 2025-07-30 19:24:55.780491

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b37b4e5cfd0b'
down_revision = '2c95ef997278'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add paperless fields to user_preferences table
    op.add_column('user_preferences', sa.Column('paperless_enabled', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('user_preferences', sa.Column('paperless_url', sa.String(500), nullable=True))
    op.add_column('user_preferences', sa.Column('paperless_api_token_encrypted', sa.Text(), nullable=True))
    op.add_column('user_preferences', sa.Column('default_storage_backend', sa.String(20), nullable=False, server_default='local'))
    op.add_column('user_preferences', sa.Column('paperless_auto_sync', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('user_preferences', sa.Column('paperless_sync_tags', sa.Boolean(), nullable=False, server_default='1'))
    
    # Add storage backend fields to entity_files table
    op.add_column('entity_files', sa.Column('storage_backend', sa.String(20), nullable=False, server_default='local'))
    op.add_column('entity_files', sa.Column('paperless_document_id', sa.Integer(), nullable=True))
    op.add_column('entity_files', sa.Column('sync_status', sa.String(20), nullable=False, server_default='synced'))
    op.add_column('entity_files', sa.Column('last_sync_at', sa.DateTime(), nullable=True))
    
    # Add indexes for performance
    op.create_index('idx_storage_backend', 'entity_files', ['storage_backend'])
    op.create_index('idx_paperless_document_id', 'entity_files', ['paperless_document_id'])
    op.create_index('idx_sync_status', 'entity_files', ['sync_status'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_sync_status', 'entity_files')
    op.drop_index('idx_paperless_document_id', 'entity_files')
    op.drop_index('idx_storage_backend', 'entity_files')
    
    # Drop entity_files columns
    op.drop_column('entity_files', 'last_sync_at')
    op.drop_column('entity_files', 'sync_status')
    op.drop_column('entity_files', 'paperless_document_id')
    op.drop_column('entity_files', 'storage_backend')
    
    # Drop user_preferences columns
    op.drop_column('user_preferences', 'paperless_sync_tags')
    op.drop_column('user_preferences', 'paperless_auto_sync')
    op.drop_column('user_preferences', 'default_storage_backend')
    op.drop_column('user_preferences', 'paperless_api_token_encrypted')
    op.drop_column('user_preferences', 'paperless_url')
    op.drop_column('user_preferences', 'paperless_enabled')
