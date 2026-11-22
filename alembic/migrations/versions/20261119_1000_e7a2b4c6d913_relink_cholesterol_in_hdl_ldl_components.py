"""Relink cholesterol-in-HDL/LDL components to their canonical tests

Revision ID: e7a2b4c6d913
Revises: c9d3e6a2f815
Create Date: 2026-11-19 10:00:00.000000

Lab components stored under the new Cholesterol in HDL / Cholesterol in LDL
panel aliases were left unlinked by the one-time canonical migration because
the library had no matching entries. Relink them now that the entries exist.

The upgrade writes each changed row's previous value to a side table, because
NULL and '' mean different things to the UI. The downgrade replays that table
exactly and then drops it.
"""

import re

from alembic import op
import sqlalchemy as sa

revision = "e7a2b4c6d913"
down_revision = "c9d3e6a2f815"
branch_labels = None
depends_on = None

# Frozen copy of the library aliases at this revision; the JSON may change later.
ALIAS_TARGETS = {
    "cholesterol in hdl": "HDL Cholesterol",
    "cholesterol in ldl": "LDL Cholesterol",
    "ldl/hdl cholesterol ratio": "LDL/HDL Ratio",
    "cholesterol in ldl/cholesterol in hdl": "LDL/HDL Ratio",
}

_SNAPSHOT = "relink_e7a2b4c6d913_prior"

_SELECT = sa.text(
    "SELECT id, test_name, canonical_test_name FROM lab_test_components "
    "WHERE canonical_test_name IS NULL OR canonical_test_name = '' "
    "OR canonical_test_name = :to_name"
)
_UPDATE = sa.text(
    "UPDATE lab_test_components SET canonical_test_name = :to_name WHERE id IN :ids"
).bindparams(sa.bindparam("ids", expanding=True))
_SNAPSHOT_INSERT = sa.text(
    f"INSERT INTO {_SNAPSHOT} (id, prior, was_null) VALUES (:id, :prior, :was_null)"
)
_SNAPSHOT_DELETE = sa.text(f"DELETE FROM {_SNAPSHOT} WHERE id IN :ids").bindparams(
    sa.bindparam("ids", expanding=True)
)
_RESTORE = sa.text(
    "UPDATE lab_test_components SET canonical_test_name = "
    "CASE WHEN (SELECT was_null FROM " + _SNAPSHOT + " s WHERE s.id = lab_test_components.id) = 1 "
    "THEN NULL ELSE (SELECT prior FROM " + _SNAPSHOT + " s WHERE s.id = lab_test_components.id) END "
    "WHERE id IN (SELECT id FROM " + _SNAPSHOT + ")"
)


def _normalize(test_name: str) -> str:
    # Mirrors CanonicalTestMatchingService._normalize_input as of this revision.
    return re.sub(r"[,;:]+$", "", test_name.strip()).lower()


def _relink(to_name: str, target_alias_keys: set) -> None:
    bind = op.get_bind()
    rows = bind.execute(_SELECT, {"to_name": to_name}).fetchall()
    changes = [
        (row_id, canonical)
        for row_id, test_name, canonical in rows
        if test_name
        and _normalize(test_name) in target_alias_keys
        and canonical != to_name
    ]
    if not changes:
        return
    ids = [row_id for row_id, _ in changes]
    bind.execute(_SNAPSHOT_DELETE, {"ids": ids})
    bind.execute(
        _SNAPSHOT_INSERT,
        [
            {"id": row_id, "prior": canonical, "was_null": int(canonical is None)}
            for row_id, canonical in changes
        ],
    )
    bind.execute(_UPDATE, {"to_name": to_name, "ids": ids})


def upgrade() -> None:
    op.execute(
        f"CREATE TABLE IF NOT EXISTS {_SNAPSHOT} ("
        "id INTEGER PRIMARY KEY, prior TEXT, was_null INTEGER NOT NULL)"
    )
    for key, to_name in ALIAS_TARGETS.items():
        _relink(to_name, {key})


def downgrade() -> None:
    bind = op.get_bind()
    if not sa.inspect(bind).has_table(_SNAPSHOT):
        return
    bind.execute(_RESTORE)
    op.execute(f"DROP TABLE {_SNAPSHOT}")
