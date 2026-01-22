"""add occurrence_time to symptom_occurrences

Revision ID: 160b1904a84a
Revises: 2e64fcd47444
Create Date: 2026-01-22 09:44:55.138164

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '160b1904a84a'
down_revision = '2e64fcd47444'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add the new occurrence_time column
    op.add_column('symptom_occurrences', sa.Column('occurrence_time', sa.Time(), nullable=True))

    # Migrate existing time_of_day values to occurrence_time
    # morning -> 08:00, afternoon -> 14:00, evening -> 20:00, night -> 23:00
    op.execute("""
        UPDATE symptom_occurrences
        SET occurrence_time = CASE time_of_day
            WHEN 'morning' THEN '08:00:00'::time
            WHEN 'afternoon' THEN '14:00:00'::time
            WHEN 'evening' THEN '20:00:00'::time
            WHEN 'night' THEN '23:00:00'::time
            ELSE NULL
        END
        WHERE time_of_day IS NOT NULL AND time_of_day != ''
    """)


def downgrade() -> None:
    op.drop_column('symptom_occurrences', 'occurrence_time')
