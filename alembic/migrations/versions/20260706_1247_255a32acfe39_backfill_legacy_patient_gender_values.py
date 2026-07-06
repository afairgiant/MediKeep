"""backfill legacy patient gender values

Revision ID: 255a32acfe39
Revises: 6516f72a9320
Create Date: 2026-07-06 12:47:19.333036

Issue #913: the /patient-management PUT endpoint's gender validator
normalizes submitted values to canonical short codes (M, F, OTHER, U), but
the corresponding POST (create) endpoint had no such validator at all until
this fix, so patients created before this fix may have full-word or
non-canonical gender values (e.g. "Male", "Female", "Unknown", or the old
frontend's "Prefer not to say" literal) stored as-is. Both frontend Select
components only offer canonical M/F/OTHER/U values, so these legacy rows
render as "no gender selected" when editing, and as "Not specified" in the
read-only patient view. This is a one-time, idempotent normalization pass
so existing patients display and edit correctly without requiring a re-save.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '255a32acfe39'
down_revision = '6516f72a9320'
branch_labels = None
depends_on = None


GENDER_BACKFILL_MAP = {
    "MALE": "M",
    "FEMALE": "F",
    "UNKNOWN": "U",
    "PREFER NOT TO SAY": "U",
}


def upgrade() -> None:
    bind = op.get_bind()
    total_updated = 0
    for old_value, new_value in GENDER_BACKFILL_MAP.items():
        result = bind.execute(
            sa.text(
                "UPDATE patients SET gender = :new_value "
                "WHERE UPPER(gender) = :old_value"
            ),
            {"new_value": new_value, "old_value": old_value},
        )
        total_updated += result.rowcount or 0

    print(
        f"[patient gender backfill migration] Normalized {total_updated} "
        f"patient row(s) with legacy gender values to canonical codes."
    )


def downgrade() -> None:
    # Data-only migration. Left intentionally inert: the original full-word
    # vs. abbreviation distinction carried no meaning worth preserving, and
    # re-expanding "M" back to "Male" could incorrectly touch rows that were
    # created with the canonical short code from the start.
    pass
