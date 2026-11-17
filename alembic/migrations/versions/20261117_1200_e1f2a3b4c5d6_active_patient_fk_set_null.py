"""active patient foreign key on delete set null

Revision ID: e1f2a3b4c5d6
Revises: c9d3e6a2f815
Create Date: 2026-11-17 12:00:00.000000

"""

from alembic import op

revision = "e1f2a3b4c5d6"
down_revision = "c9d3e6a2f815"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table(
        "users", naming_convention={"fk": "fk_%(table_name)s_%(column_0_name)s"}
    ) as batch_op:
        batch_op.drop_constraint("fk_users_active_patient_id", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_users_active_patient_id",
            "patients",
            ["active_patient_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table(
        "users", naming_convention={"fk": "fk_%(table_name)s_%(column_0_name)s"}
    ) as batch_op:
        batch_op.drop_constraint("fk_users_active_patient_id", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_users_active_patient_id",
            "patients",
            ["active_patient_id"],
            ["id"],
        )
