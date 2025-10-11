"""change_symptom_dates_to_date_type

Revision ID: e6ced39605fe
Revises: 17068ca95ee4
Create Date: 2025-10-11 09:06:35.742381

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e6ced39605fe'
down_revision = '17068ca95ee4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change recorded_date from TIMESTAMP to DATE
    # PostgreSQL will automatically convert TIMESTAMP to DATE by truncating the time
    op.alter_column('symptom_entries', 'recorded_date',
                    type_=sa.Date(),
                    existing_type=sa.DateTime(),
                    existing_nullable=False,
                    postgresql_using='recorded_date::date')

    # Change resolved_date from TIMESTAMP to DATE
    op.alter_column('symptom_entries', 'resolved_date',
                    type_=sa.Date(),
                    existing_type=sa.DateTime(),
                    existing_nullable=True,
                    postgresql_using='resolved_date::date')


def downgrade() -> None:
    # Revert resolved_date back to TIMESTAMP
    op.alter_column('symptom_entries', 'resolved_date',
                    type_=sa.DateTime(),
                    existing_type=sa.Date(),
                    existing_nullable=True)

    # Revert recorded_date back to TIMESTAMP
    op.alter_column('symptom_entries', 'recorded_date',
                    type_=sa.DateTime(),
                    existing_type=sa.Date(),
                    existing_nullable=False)
