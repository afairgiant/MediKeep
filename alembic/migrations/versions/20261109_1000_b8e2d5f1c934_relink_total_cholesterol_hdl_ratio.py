"""Relink total cholesterol/HDL ratio components

Revision ID: b8e2d5f1c934
Revises: a1c7e4b9d2f6
Create Date: 2026-11-09 10:00:00.000000

Issue #1221: components saved as LDL/HDL Ratio whose lab name is a total
cholesterol/HDL ratio move to the Total Cholesterol/HDL Ratio canonical test.
"""

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

_RELINK = sa.text(
    "UPDATE lab_test_components SET canonical_test_name = :to_name "
    "WHERE canonical_test_name = :from_name "
    "AND LOWER(TRIM(test_name)) IN :names"
).bindparams(sa.bindparam("names", expanding=True))


def _relink(from_name: str, to_name: str) -> None:
    op.get_bind().execute(
        _RELINK,
        {"from_name": from_name, "to_name": to_name, "names": TOTAL_CHOL_HDL_NAMES},
    )


def upgrade() -> None:
    _relink(LDL_HDL, TOTAL_CHOL_HDL)


def downgrade() -> None:
    # The previous library has no Total Cholesterol/HDL Ratio entry to point at.
    _relink(TOTAL_CHOL_HDL, LDL_HDL)
