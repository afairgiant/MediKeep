"""Add practitioner_id to insurances

Revision ID: 9d5bf1e4e1ef
Revises: e7f4a2b9c1d3
Create Date: 2026-09-21 14:00:00.000000

Adds an optional foreign key from insurances to practitioners so the
"Primary Care Physician" field can be linked to a Practitioner record
via the same autocomplete/inline-create picker used for the lab result
Ordering Practitioner field. Legacy records keep their free-text PCP name
inside coverage_details untouched; new records link a real practitioner_id
here and fall back to the legacy string at read time when unset.
"""

from alembic import op
import sqlalchemy as sa

revision = "9d5bf1e4e1ef"
down_revision = "e7f4a2b9c1d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "insurances", sa.Column("practitioner_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_insurances_practitioner_id",
        "insurances",
        "practitioners",
        ["practitioner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("idx_insurances_practitioner_id", "insurances", ["practitioner_id"])


def downgrade() -> None:
    op.drop_index("idx_insurances_practitioner_id", table_name="insurances")
    op.drop_constraint(
        "fk_insurances_practitioner_id", "insurances", type_="foreignkey"
    )
    op.drop_column("insurances", "practitioner_id")
