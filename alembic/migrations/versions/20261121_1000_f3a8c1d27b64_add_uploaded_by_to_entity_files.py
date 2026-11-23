"""record which user uploaded each entity file

Revision ID: f3a8c1d27b64
Revises: b7d3867049ae
Create Date: 2026-11-21 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "f3a8c1d27b64"
down_revision = "b7d3867049ae"
branch_labels = None
depends_on = None

FK_NAME = "fk_entity_files_uploaded_by_user_id"
INDEX_NAME = "idx_entity_files_uploaded_by_user_id"

entity_files = sa.table(
    "entity_files",
    sa.column("id", sa.Integer),
    sa.column("uploaded_by_user_id", sa.Integer),
    sa.column("created_at", sa.DateTime),
)
activity_logs = sa.table(
    "activity_logs",
    sa.column("id", sa.Integer),
    sa.column("user_id", sa.Integer),
    sa.column("action", sa.String),
    sa.column("entity_type", sa.String),
    sa.column("entity_id", sa.Integer),
    sa.column("timestamp", sa.DateTime),
)


def backfill_uploaders(connection) -> None:
    """Fill NULL uploaded_by_user_id from the file's activity-log creation entry.

    Only entries logged since the file row was created count. Files with no such
    entry, or whose entry has no user, stay NULL. Running it again changes nothing.
    """
    created_log = sa.and_(
        activity_logs.c.entity_type == "entity_file",
        activity_logs.c.action == "created",
        activity_logs.c.entity_id == entity_files.c.id,
        # An entry from before the row existed belongs to an earlier file with a reused ID
        activity_logs.c.timestamp >= entity_files.c.created_at,
    )
    logged_uploader = (
        sa.select(activity_logs.c.user_id)
        .where(created_log)
        .order_by(activity_logs.c.timestamp.desc(), activity_logs.c.id.desc())
        .limit(1)
        .scalar_subquery()
    )
    connection.execute(
        entity_files.update()
        .where(
            entity_files.c.uploaded_by_user_id.is_(None),
            sa.exists().where(created_log),
        )
        .values(uploaded_by_user_id=logged_uploader)
    )


def upgrade() -> None:
    with op.batch_alter_table("entity_files") as batch_op:
        batch_op.add_column(
            sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True)
        )
        batch_op.create_foreign_key(
            FK_NAME, "users", ["uploaded_by_user_id"], ["id"], ondelete="SET NULL"
        )
        batch_op.create_index(INDEX_NAME, ["uploaded_by_user_id"])

    backfill_uploaders(op.get_bind())


def downgrade() -> None:
    with op.batch_alter_table("entity_files") as batch_op:
        batch_op.drop_index(INDEX_NAME)
        batch_op.drop_constraint(FK_NAME, type_="foreignkey")
        batch_op.drop_column("uploaded_by_user_id")
