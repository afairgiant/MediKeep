"""Add notification framework tables

Revision ID: add_notification_tables
Revises: add_injury_tracking
Create Date: 2026-01-27 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_notification_tables'
down_revision = 'add_injury_tracking'
branch_labels = None
depends_on = None


def upgrade():
    # Create notification_channels table
    op.create_table(
        'notification_channels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('channel_type', sa.String(length=20), nullable=False),
        sa.Column('config_encrypted', sa.Text(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_verified', sa.Boolean(), nullable=False, default=False),
        sa.Column('last_test_at', sa.DateTime(), nullable=True),
        sa.Column('last_test_status', sa.String(length=20), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('total_notifications_sent', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_notification_channels_user_id', 'notification_channels', ['user_id'])
    op.create_unique_constraint('uq_user_channel_name', 'notification_channels', ['user_id', 'name'])

    # Create notification_preferences table
    op.create_table(
        'notification_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('remind_before_minutes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['channel_id'], ['notification_channels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_notification_prefs_user_id', 'notification_preferences', ['user_id'])
    op.create_index('idx_notification_prefs_channel_id', 'notification_preferences', ['channel_id'])
    op.create_index('idx_notification_prefs_event_type', 'notification_preferences', ['event_type'])
    op.create_unique_constraint('uq_user_channel_event', 'notification_preferences', ['user_id', 'channel_id', 'event_type'])

    # Create notification_history table
    op.create_table(
        'notification_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('channel_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('event_data', sa.JSON(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message_preview', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('attempt_count', sa.Integer(), nullable=False, default=1),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['channel_id'], ['notification_channels.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_notification_history_user_id', 'notification_history', ['user_id'])
    op.create_index('idx_notification_history_status', 'notification_history', ['status'])
    op.create_index('idx_notification_history_created_at', 'notification_history', ['created_at'])
    op.create_index('idx_notification_history_event_type', 'notification_history', ['event_type'])


def downgrade():
    # Drop notification_history table
    op.drop_index('idx_notification_history_event_type', table_name='notification_history')
    op.drop_index('idx_notification_history_created_at', table_name='notification_history')
    op.drop_index('idx_notification_history_status', table_name='notification_history')
    op.drop_index('idx_notification_history_user_id', table_name='notification_history')
    op.drop_table('notification_history')

    # Drop notification_preferences table
    op.drop_constraint('uq_user_channel_event', 'notification_preferences', type_='unique')
    op.drop_index('idx_notification_prefs_event_type', table_name='notification_preferences')
    op.drop_index('idx_notification_prefs_channel_id', table_name='notification_preferences')
    op.drop_index('idx_notification_prefs_user_id', table_name='notification_preferences')
    op.drop_table('notification_preferences')

    # Drop notification_channels table
    op.drop_constraint('uq_user_channel_name', 'notification_channels', type_='unique')
    op.drop_index('idx_notification_channels_user_id', table_name='notification_channels')
    op.drop_table('notification_channels')
