"""add practices table and practitioner practice_id FK

Revision ID: add_practices_table
Revises: 75c52071a78d
Create Date: 2026-02-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone


# revision identifiers, used by Alembic.
revision = 'add_practices_table'
down_revision = '75c52071a78d'
branch_labels = None
depends_on = None


def get_utc_now():
    return datetime.now(timezone.utc)


def upgrade() -> None:
    # 1. Create practices table
    op.create_table(
        'practices',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False, unique=True),
        sa.Column('phone_number', sa.String(), nullable=True),
        sa.Column('fax_number', sa.String(), nullable=True),
        sa.Column('website', sa.String(), nullable=True),
        sa.Column('patient_portal_url', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('locations', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 2. Add practice_id FK column to practitioners
    op.add_column('practitioners', sa.Column('practice_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_practitioners_practice_id',
        'practitioners',
        'practices',
        ['practice_id'],
        ['id'],
    )
    op.create_index('idx_practitioners_practice_id', 'practitioners', ['practice_id'])

    # 3. Add created_at and updated_at to practitioners (currently missing)
    op.add_column(
        'practitioners',
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )
    op.add_column(
        'practitioners',
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )

    # 4. Migrate existing practice strings to practice records and set practice_id
    # This is done via raw SQL for efficiency
    conn = op.get_bind()

    # Extract unique non-null practice names from practitioners
    result = conn.execute(
        sa.text(
            "SELECT DISTINCT practice FROM practitioners WHERE practice IS NOT NULL AND practice != ''"
        )
    )
    practice_names = [row[0] for row in result]

    # Insert unique practice names into practices table
    for name in practice_names:
        conn.execute(
            sa.text("INSERT INTO practices (name, created_at, updated_at) VALUES (:name, :now, :now)"),
            {"name": name.strip(), "now": get_utc_now()},
        )

    # Update practitioners with matching practice_id
    conn.execute(
        sa.text(
            """
            UPDATE practitioners
            SET practice_id = (
                SELECT p.id FROM practices p WHERE p.name = practitioners.practice
            )
            WHERE practice IS NOT NULL AND practice != ''
            """
        )
    )


def downgrade() -> None:
    # Remove index and FK
    op.drop_index('idx_practitioners_practice_id', table_name='practitioners')
    op.drop_constraint('fk_practitioners_practice_id', 'practitioners', type_='foreignkey')

    # Remove columns from practitioners
    op.drop_column('practitioners', 'practice_id')
    op.drop_column('practitioners', 'updated_at')
    op.drop_column('practitioners', 'created_at')

    # Drop practices table
    op.drop_table('practices')
