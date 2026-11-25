"""store digests of Paperless uploads so their documents can be found by checksum

Revision ID: 7daea8664b24
Revises: a7c2e9d41f53
Create Date: 2026-11-25 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "7daea8664b24"
down_revision = "a7c2e9d41f53"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No backfill: the bytes of earlier uploads are only in Paperless
    with op.batch_alter_table("entity_files") as batch_op:
        batch_op.add_column(
            sa.Column("paperless_sha256", sa.String(length=64), nullable=True)
        )
        batch_op.add_column(
            sa.Column("paperless_md5", sa.String(length=32), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("entity_files") as batch_op:
        batch_op.drop_column("paperless_md5")
        batch_op.drop_column("paperless_sha256")
