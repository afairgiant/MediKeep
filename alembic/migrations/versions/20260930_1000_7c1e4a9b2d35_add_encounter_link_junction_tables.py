"""add encounter junction tables for procedures, symptoms, injuries, medications, conditions

Revision ID: 7c1e4a9b2d35
Revises: 53550b9a25a6
Create Date: 2026-09-30 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7c1e4a9b2d35'
down_revision = '53550b9a25a6'
branch_labels = None
depends_on = None

# (entity key, entity table)
LINK_TABLES = [
    ('procedure', 'procedures'),
    ('symptom', 'symptoms'),
    ('injury', 'injuries'),
    ('medication', 'medications'),
    ('condition', 'conditions'),
]


def upgrade() -> None:
    for key, entity_table in LINK_TABLES:
        table = f'encounter_{entity_table}'
        fk_column = f'{key}_id'
        op.create_table(
            table,
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('encounter_id', sa.Integer(), nullable=False),
            sa.Column(fk_column, sa.Integer(), nullable=False),
            sa.Column('relevance_note', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint([fk_column], [f'{entity_table}.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('encounter_id', fk_column, name=f'uq_encounter_{key}'),
        )
        op.create_index(f'idx_encounter_{key}_encounter_id', table, ['encounter_id'], unique=False)
        op.create_index(f'idx_encounter_{key}_{key}_id', table, [fk_column], unique=False)


def downgrade() -> None:
    for key, entity_table in reversed(LINK_TABLES):
        table = f'encounter_{entity_table}'
        op.drop_index(f'idx_encounter_{key}_{key}_id', table_name=table)
        op.drop_index(f'idx_encounter_{key}_encounter_id', table_name=table)
        op.drop_table(table)
