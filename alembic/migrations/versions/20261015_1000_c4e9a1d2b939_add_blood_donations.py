"""Add blood donations

Revision ID: c4e9a1d2b939
Revises: 9a3d5e7f1b24
Create Date: 2026-10-15 10:00:00.000000

Adds the blood_donations table and user_preferences.blood_donation_intervals
and user_preferences.hemoglobin_unit.
"""

from alembic import op
import sqlalchemy as sa

revision = "c4e9a1d2b939"
down_revision = "9a3d5e7f1b24"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blood_donations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "patient_id",
            sa.Integer(),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("donation_date", sa.Date(), nullable=False),
        sa.Column("donation_type", sa.String(length=50), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("systolic_bp", sa.Integer(), nullable=True),
        sa.Column("diastolic_bp", sa.Integer(), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("hemoglobin", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "idx_blood_donations_patient_date",
        "blood_donations",
        ["patient_id", "donation_date"],
    )
    op.add_column(
        "user_preferences",
        sa.Column("blood_donation_intervals", sa.JSON(), nullable=True),
    )
    op.add_column(
        "user_preferences",
        sa.Column("hemoglobin_unit", sa.String(10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "hemoglobin_unit")
    op.drop_column("user_preferences", "blood_donation_intervals")
    op.drop_index("idx_blood_donations_patient_date", table_name="blood_donations")
    op.drop_table("blood_donations")
