"""Add standardized_vaccine_id FK to immunizations

Revision ID: 43c1fba67419
Revises: c1d2e3f4a5b6
Create Date: 2026-05-29 12:00:00.000000

Adds an optional foreign key from immunizations to standardized_vaccines so
new records created via the autocomplete picker can be linked back to the
library entry that was selected. Legacy records and free-text entries retain
NULL here and fall back to name matching at read time.
"""

from alembic import op
import sqlalchemy as sa


revision = "43c1fba67419"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "immunizations",
        sa.Column("standardized_vaccine_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_immunizations_standardized_vaccine",
        "immunizations",
        "standardized_vaccines",
        ["standardized_vaccine_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_immunizations_standardized_vaccine_id",
        "immunizations",
        ["standardized_vaccine_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_immunizations_standardized_vaccine_id",
        table_name="immunizations",
    )
    op.drop_constraint(
        "fk_immunizations_standardized_vaccine",
        "immunizations",
        type_="foreignkey",
    )
    op.drop_column("immunizations", "standardized_vaccine_id")
