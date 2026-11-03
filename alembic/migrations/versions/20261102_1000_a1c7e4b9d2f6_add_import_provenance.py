"""Add import provenance

Revision ID: a1c7e4b9d2f6
Revises: f4b8d2e6a913
Create Date: 2026-11-02 10:00:00.000000

Adds import_provenance: which imported file each record came from, and a hash
of what was written so re-imports can tell duplicates from local edits.
"""

from alembic import op
import sqlalchemy as sa

revision = "a1c7e4b9d2f6"
down_revision = "f4b8d2e6a913"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_provenance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "patient_id",
            sa.Integer(),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("record_type", sa.String(), nullable=False),
        sa.Column("record_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("external_id", sa.String(), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("import_batch_id", sa.String(length=32), nullable=False),
        sa.Column("imported_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "record_type", "record_id", name="uq_import_provenance_record"
        ),
    )
    op.create_index(
        "idx_import_provenance_patient_external",
        "import_provenance",
        ["patient_id", "source", "external_id"],
    )
    op.create_index(
        "idx_import_provenance_patient_hash",
        "import_provenance",
        ["patient_id", "record_type", "content_hash"],
    )
    op.create_index(
        "idx_import_provenance_batch", "import_provenance", ["import_batch_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_import_provenance_batch", table_name="import_provenance")
    op.drop_index("idx_import_provenance_patient_hash", table_name="import_provenance")
    op.drop_index(
        "idx_import_provenance_patient_external", table_name="import_provenance"
    )
    op.drop_table("import_provenance")
