"""Initial migration - create all tables

Revision ID: b0192437ef34
Revises:
Create Date: 2025-06-11 10:30:09.668061

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b0192437ef34"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )

    # Create practitioners table
    op.create_table(
        "practitioners",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("specialty", sa.String(), nullable=False),
        sa.Column("practice", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create patients table
    op.create_table(
        "patients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("birthDate", sa.Date(), nullable=False),
        sa.Column("physician_id", sa.Integer(), nullable=True),
        sa.Column("bloodType", sa.String(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("gender", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["physician_id"],
            ["practitioners.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create conditions table
    op.create_table(
        "conditions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("practitioner_id", sa.Integer(), nullable=True),
        sa.Column("condition_name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("onsetDate", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.ForeignKeyConstraint(
            ["practitioner_id"],
            ["practitioners.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create encounters table
    op.create_table(
        "encounters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("practitioner_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.ForeignKeyConstraint(
            ["practitioner_id"],
            ["practitioners.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create medications table
    op.create_table(
        "medications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("practitioner_id", sa.Integer(), nullable=True),
        sa.Column("medication_name", sa.String(), nullable=False),
        sa.Column("dosage", sa.String(), nullable=False),
        sa.Column("frequency", sa.String(), nullable=False),
        sa.Column("effectivePeriod_start", sa.Date(), nullable=True),
        sa.Column("effectivePeriod_end", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.ForeignKeyConstraint(
            ["practitioner_id"],
            ["practitioners.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create allergies table
    op.create_table(
        "allergies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("substance", sa.String(), nullable=False),
        sa.Column("reaction", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("onsetDate", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create immunizations table
    op.create_table(
        "immunizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("practitioner_id", sa.Integer(), nullable=True),
        sa.Column("vaccine_name", sa.String(), nullable=False),
        sa.Column("date_administered", sa.Date(), nullable=False),
        sa.Column("lot_number", sa.String(), nullable=True),
        sa.Column("site", sa.String(), nullable=True),
        sa.Column("route", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.ForeignKeyConstraint(
            ["practitioner_id"],
            ["practitioners.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create lab_results table
    op.create_table(
        "lab_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("practitioner_id", sa.Integer(), nullable=True),
        sa.Column("test_name", sa.String(), nullable=False),
        sa.Column("test_type", sa.String(), nullable=True),
        sa.Column("facility", sa.String(), nullable=True),
        sa.Column("result_value", sa.String(), nullable=False),
        sa.Column("unit", sa.String(), nullable=True),
        sa.Column("reference_range", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("date_ordered", sa.Date(), nullable=True),
        sa.Column("date_performed", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.ForeignKeyConstraint(
            ["practitioner_id"],
            ["practitioners.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create lab_result_files table
    op.create_table(
        "lab_result_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lab_result_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["lab_result_id"],
            ["lab_results.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create procedures table
    op.create_table(
        "procedures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("practitioner_id", sa.Integer(), nullable=True),
        sa.Column("procedure_name", sa.String(), nullable=False),
        sa.Column("date_performed", sa.Date(), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("outcome", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.ForeignKeyConstraint(
            ["practitioner_id"],
            ["practitioners.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create treatments table
    op.create_table(
        "treatments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("practitioner_id", sa.Integer(), nullable=True),
        sa.Column("treatment_name", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.ForeignKeyConstraint(
            ["practitioner_id"],
            ["practitioners.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column("users", "updated_at", existing_type=sa.DATETIME(), nullable=True)
    op.alter_column("users", "created_at", existing_type=sa.DATETIME(), nullable=True)
    op.alter_column("patients", "address", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column("patients", "gender", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column(
        "immunizations",
        "id",
        existing_type=sa.INTEGER(),
        nullable=True,
        autoincrement=True,
    )
    # ### end Alembic commands ###
