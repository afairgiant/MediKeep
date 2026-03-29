"""add connection_verified flags for paperless and papra

Revision ID: 821203926422
Revises: b1c2d3e4f5a6
Create Date: 2026-03-29 12:48:38.450643

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '821203926422'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user_preferences', sa.Column('paperless_connection_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('user_preferences', sa.Column('papra_connection_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # Backfill: auto-verify for users who already have working credentials saved
    op.execute(
        """
        UPDATE user_preferences
        SET paperless_connection_verified = true
        WHERE paperless_enabled = true
          AND paperless_url IS NOT NULL
          AND paperless_url != ''
          AND (paperless_api_token_encrypted IS NOT NULL
               OR (paperless_username_encrypted IS NOT NULL AND paperless_password_encrypted IS NOT NULL))
        """
    )
    op.execute(
        """
        UPDATE user_preferences
        SET papra_connection_verified = true
        WHERE papra_enabled = true
          AND papra_url IS NOT NULL
          AND papra_url != ''
          AND papra_api_token_encrypted IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column('user_preferences', 'papra_connection_verified')
    op.drop_column('user_preferences', 'paperless_connection_verified')
