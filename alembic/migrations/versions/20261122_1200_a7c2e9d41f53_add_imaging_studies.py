"""Add imaging studies

Revision ID: a7c2e9d41f53
Revises: f3a8c1d27b64
Create Date: 2026-11-22 12:00:00.000000

Adds imaging_studies, imaging_series and imaging_instances for stored DICOM studies.
"""

from alembic import op
import sqlalchemy as sa

revision = "a7c2e9d41f53"
down_revision = "f3a8c1d27b64"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "imaging_studies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "patient_id",
            sa.Integer(),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("study_instance_uid", sa.String(length=64), nullable=False),
        sa.Column("study_date", sa.Date(), nullable=True),
        sa.Column("modalities", sa.JSON(), nullable=True),
        sa.Column("body_part", sa.String(length=64), nullable=True),
        sa.Column("study_description", sa.String(length=255), nullable=True),
        sa.Column("accession_number", sa.String(length=64), nullable=True),
        sa.Column("institution_name", sa.String(length=255), nullable=True),
        sa.Column("referring_physician", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("report_text", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column(
            "procedure_id",
            sa.Integer(),
            sa.ForeignKey("procedures.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "encounter_id",
            sa.Integer(),
            sa.ForeignKey("encounters.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "practitioner_id",
            sa.Integer(),
            sa.ForeignKey("practitioners.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("series_count", sa.Integer(), nullable=False),
        sa.Column("instance_count", sa.Integer(), nullable=False),
        sa.Column("total_size", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "patient_id",
            "study_instance_uid",
            name="uq_imaging_studies_patient_study_uid",
        ),
    )
    op.create_index(
        "idx_imaging_studies_patient_date",
        "imaging_studies",
        ["patient_id", "study_date"],
    )
    op.create_index(
        "idx_imaging_studies_procedure_id", "imaging_studies", ["procedure_id"]
    )
    op.create_index(
        "idx_imaging_studies_encounter_id", "imaging_studies", ["encounter_id"]
    )
    op.create_index(
        "idx_imaging_studies_practitioner_id", "imaging_studies", ["practitioner_id"]
    )

    op.create_table(
        "imaging_series",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "study_id",
            sa.Integer(),
            sa.ForeignKey("imaging_studies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("series_instance_uid", sa.String(length=64), nullable=False),
        sa.Column("modality", sa.String(length=16), nullable=True),
        sa.Column("series_number", sa.Integer(), nullable=True),
        sa.Column("series_description", sa.String(length=255), nullable=True),
        sa.Column("instance_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "study_id",
            "series_instance_uid",
            name="uq_imaging_series_study_series_uid",
        ),
    )

    op.create_table(
        "imaging_instances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "series_id",
            sa.Integer(),
            sa.ForeignKey("imaging_series.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sop_instance_uid", sa.String(length=64), nullable=False),
        sa.Column("instance_number", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("transfer_syntax_uid", sa.String(length=64), nullable=True),
        sa.Column("rows", sa.Integer(), nullable=True),
        sa.Column("cols", sa.Integer(), nullable=True),
        sa.Column("number_of_frames", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "series_id",
            "sop_instance_uid",
            name="uq_imaging_instances_series_sop_uid",
        ),
    )


def downgrade() -> None:
    op.drop_table("imaging_instances")
    op.drop_table("imaging_series")
    op.drop_index("idx_imaging_studies_practitioner_id", table_name="imaging_studies")
    op.drop_index("idx_imaging_studies_encounter_id", table_name="imaging_studies")
    op.drop_index("idx_imaging_studies_procedure_id", table_name="imaging_studies")
    op.drop_index("idx_imaging_studies_patient_date", table_name="imaging_studies")
    op.drop_table("imaging_studies")
