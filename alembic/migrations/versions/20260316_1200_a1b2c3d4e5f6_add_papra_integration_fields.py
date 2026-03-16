"""add papra integration fields

Revision ID: a1b2c3d4e5f6
Revises: 6dbcea541964
Create Date: 2026-03-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '6dbcea541964'
branch_labels = None
depends_on = None


def upgrade():
    # Add Papra columns to entity_files
    op.add_column('entity_files', sa.Column('papra_document_id', sa.String(255), nullable=True))
    op.add_column('entity_files', sa.Column('papra_organization_id', sa.String(255), nullable=True))
    op.create_index('idx_papra_document_id', 'entity_files', ['papra_document_id'])

    # Add Papra columns to user_preferences
    op.add_column('user_preferences', sa.Column('papra_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('user_preferences', sa.Column('papra_url', sa.String(500), nullable=True))
    op.add_column('user_preferences', sa.Column('papra_api_token_encrypted', sa.Text(), nullable=True))
    op.add_column('user_preferences', sa.Column('papra_organization_id', sa.String(255), nullable=True))


def downgrade():
    # Remove Papra columns from user_preferences
    op.drop_column('user_preferences', 'papra_organization_id')
    op.drop_column('user_preferences', 'papra_api_token_encrypted')
    op.drop_column('user_preferences', 'papra_url')
    op.drop_column('user_preferences', 'papra_enabled')

    # Remove Papra columns from entity_files
    op.drop_index('idx_papra_document_id', table_name='entity_files')
    op.drop_column('entity_files', 'papra_organization_id')
    op.drop_column('entity_files', 'papra_document_id')
