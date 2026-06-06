"""Add disease_keys column to standardized_vaccines and backfill from library

Revision ID: d7e8f9a0b1c2
Revises: 43c1fba67419
Create Date: 2026-06-02 14:00:00.000000

Adds a ``disease_keys`` JSON column that gives the immunization-history "By
Disease" view a stable grouping key per vaccine. Without this, the resolver
emitted raw component strings for combos ("Polio (Inactivated)") and full
canonical names for singles ("Polio Vaccine - Inactivated (IPV)"), splitting
the same disease into multiple buckets (issue #864).

Backfill reads ``shared/data/vaccine_library.json`` (v1.3.0+) and matches each
row by ``who_code`` when present, falling back to ``vaccine_name`` for the
~16 curated entries without a WHO code. Operators with custom rows not in the
JSON keep ``disease_keys = NULL`` — the resolver treats that as "matched but
no disease data," which leaves the record visible in the By Date view.
"""

import json
from pathlib import Path

from alembic import op
import sqlalchemy as sa


revision = "d7e8f9a0b1c2"
down_revision = "43c1fba67419"
branch_labels = None
depends_on = None


SEED_FILE = (
    Path(__file__).resolve().parents[3] / "shared" / "data" / "vaccine_library.json"
)


def upgrade() -> None:
    op.add_column(
        "standardized_vaccines",
        sa.Column("disease_keys", sa.JSON(), nullable=True),
    )

    if not SEED_FILE.exists():
        print(
            f"[disease_keys migration] Seed file not found at {SEED_FILE} — "
            f"leaving disease_keys NULL. Run a re-seed manually."
        )
        return

    with SEED_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    bind = op.get_bind()
    updated = 0
    skipped_missing = 0
    for entry in payload.get("vaccines", []):
        disease_keys = entry.get("disease_keys")
        if not disease_keys:
            skipped_missing += 1
            continue

        # JSON-encode here so SQLAlchemy sends a string to the JSON column on
        # backends (SQLite) that don't have a native JSON adapter wired up.
        disease_keys_json = json.dumps(disease_keys)

        who_code = entry.get("who_code")
        if who_code:
            result = bind.execute(
                sa.text(
                    "UPDATE standardized_vaccines SET disease_keys = :keys "
                    "WHERE who_code = :who_code"
                ),
                {"keys": disease_keys_json, "who_code": who_code},
            )
        else:
            # Curated entries (Tdap, MMRV, Twinrix, DT-IPV, DTaP-Hib, ...) have
            # no WHO code; fall back to canonical vaccine_name.
            result = bind.execute(
                sa.text(
                    "UPDATE standardized_vaccines SET disease_keys = :keys "
                    "WHERE who_code IS NULL AND vaccine_name = :name"
                ),
                {"keys": disease_keys_json, "name": entry["vaccine_name"]},
            )
        updated += result.rowcount or 0

    print(
        f"[disease_keys migration] Backfilled disease_keys on {updated} rows "
        f"from {SEED_FILE.name} (v{payload.get('version')}); "
        f"{skipped_missing} entries had no disease_keys."
    )


def downgrade() -> None:
    op.drop_column("standardized_vaccines", "disease_keys")
