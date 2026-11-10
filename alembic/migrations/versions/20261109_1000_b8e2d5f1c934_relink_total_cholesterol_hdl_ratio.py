"""Relink total cholesterol/HDL ratio components

Revision ID: b8e2d5f1c934
Revises: a1c7e4b9d2f6
Create Date: 2026-11-09 10:00:00.000000

Issue #1221: components saved as LDL/HDL Ratio whose lab name is a total
cholesterol/HDL ratio move to the Total Cholesterol/HDL Ratio canonical test.
"""

import re

from alembic import op
import sqlalchemy as sa

revision = "b8e2d5f1c934"
down_revision = "a1c7e4b9d2f6"
branch_labels = None
depends_on = None

LDL_HDL = "LDL/HDL Ratio"
TOTAL_CHOL_HDL = "Total Cholesterol/HDL Ratio"

# Frozen copy of the library aliases at this revision; the JSON may change later.
TOTAL_CHOL_HDL_NAMES = (
    "total cholesterol/hdl ratio",
    "cholesterol/hdl ratio",
    "chol/hdlc ratio",
    "cholesterol ratio",
    "chol/hdl ratio",
    "t. chol/hdl ratio",
    "tc/hdl ratio",
    "tc/hdl",
    "chol/hdl",
)

_SELECT = sa.text(
    "SELECT id, test_name FROM lab_test_components "
    "WHERE canonical_test_name = :from_name"
)
_UPDATE = sa.text(
    "UPDATE lab_test_components SET canonical_test_name = :to_name WHERE id IN :ids"
).bindparams(sa.bindparam("ids", expanding=True))


def _normalize(test_name: str) -> str:
    # Mirrors CanonicalTestMatchingService._normalize_input as of this revision.
    return re.sub(r"[,;:]+$", "", test_name.strip()).lower()


def _relink(from_name: str, to_name: str) -> None:
    bind = op.get_bind()
    rows = bind.execute(_SELECT, {"from_name": from_name}).fetchall()
    ids = [
        row_id
        for row_id, test_name in rows
        if test_name and _normalize(test_name) in TOTAL_CHOL_HDL_NAMES
    ]
    if ids:
        bind.execute(_UPDATE, {"to_name": to_name, "ids": ids})


def upgrade() -> None:
    _relink(LDL_HDL, TOTAL_CHOL_HDL)


def downgrade() -> None:
    # The previous library has no Total Cholesterol/HDL Ratio entry to point at.
    _relink(TOTAL_CHOL_HDL, LDL_HDL)
