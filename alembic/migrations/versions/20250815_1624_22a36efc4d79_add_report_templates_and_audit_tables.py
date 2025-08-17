"""add_report_templates_and_audit_tables

Revision ID: 22a36efc4d79
Revises: bdb4d433f547
Create Date: 2025-08-15 16:24:03.011408

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '22a36efc4d79'
down_revision = 'bdb4d433f547'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create report_templates table
    op.create_table(
        'report_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('selected_records', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('report_settings', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('shared_with_family', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='unique_user_template_name')
    )
    
    # Create indexes for report_templates
    op.create_index('idx_report_template_user_id', 'report_templates', ['user_id'])
    op.create_index('idx_report_template_is_active', 'report_templates', ['is_active'], 
                   postgresql_where=sa.text('is_active = true'))
    op.create_index('idx_report_template_shared_family', 'report_templates', ['shared_with_family'],
                   postgresql_where=sa.text('shared_with_family = true'))
    op.create_index('idx_report_template_selected_records', 'report_templates', ['selected_records'],
                   postgresql_using='gin')

    # Create report_generation_audit table
    op.create_table(
        'report_generation_audit',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('report_type', sa.String(length=50), nullable=False),
        sa.Column('categories_included', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('total_records', sa.Integer(), nullable=True),
        sa.Column('generation_time_ms', sa.Integer(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='success'),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for report_generation_audit
    op.create_index('idx_report_audit_user_created', 'report_generation_audit', ['user_id', 'created_at'])
    op.create_index('idx_report_audit_status', 'report_generation_audit', ['status'])
    op.create_index('idx_report_audit_created_at', 'report_generation_audit', ['created_at'])


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('idx_report_audit_created_at', table_name='report_generation_audit')
    op.drop_index('idx_report_audit_status', table_name='report_generation_audit')
    op.drop_index('idx_report_audit_user_created', table_name='report_generation_audit')
    
    # Drop report_generation_audit table
    op.drop_table('report_generation_audit')
    
    # Drop report_templates indexes
    op.drop_index('idx_report_template_selected_records', table_name='report_templates')
    op.drop_index('idx_report_template_shared_family', table_name='report_templates')
    op.drop_index('idx_report_template_is_active', table_name='report_templates')
    op.drop_index('idx_report_template_user_id', table_name='report_templates')
    
    # Drop report_templates table
    op.drop_table('report_templates')
