"""add import_source to vitals

Revision ID: 455b28eb17e9
Revises: eb3c5322d096
Create Date: 2026-02-27 12:19:43.230322

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '455b28eb17e9'
down_revision = 'eb3c5322d096'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('vitals', sa.Column('import_source', sa.String(), nullable=True))
    op.create_index(op.f('ix_vitals_import_source'), 'vitals', ['import_source'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vitals_import_source'), table_name='vitals')
    op.drop_column('vitals', 'import_source')
