"""Backfill standardized_vaccines rows missing from later library additions

Revision ID: a5b6c7d8e9f0
Revises: c4d5e6f7a8b9
Create Date: 2026-07-02 12:00:00.000000

PRs #865, #866, and #893 added new curated entries (Typhoid Ps, Tick-borne
Encephalitis, Meningococcal A+C, DTaP-Hib, DT-IPV, Chikungunya, and several
Tdap/Td combination vaccines) directly to shared/data/vaccine_library.json,
but none of them shipped a migration to INSERT the new rows into
standardized_vaccines. The only migration that ever INSERTs from the JSON is
c1d2e3f4a5b6 (initial table creation, 2026-05-14) — every JSON addition since
is invisible to already-migrated databases, because vaccine_resolver builds
its lookup index purely from the DB table (``db.query(StandardizedVaccine)``),
never from the JSON file directly.

The later d7e8f9a0b1c2 disease_keys migration only ran UPDATE statements, so
for these never-inserted rows it silently matched zero rows and left the
vaccines permanently unresolvable in immunization history grouping — the
regression reported as "still not grouped" on issue #864 after the first fix
attempt (PR #885) shipped.

This migration is an idempotent insert-if-missing pass over the current
library, keyed by who_code when present and by vaccine_name otherwise. It
also re-applies the disease_keys backfill to any already-existing row that
is still missing it, in case a future JSON edit changes disease_keys on an
existing entry without a matching migration.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from alembic import op
import sqlalchemy as sa


revision = "a5b6c7d8e9f0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


SEED_FILE = (
    Path(__file__).resolve().parents[3] / "shared" / "data" / "vaccine_library.json"
)


def upgrade() -> None:
    if not SEED_FILE.exists():
        print(
            f"[vaccine backfill migration] Seed file not found at {SEED_FILE} — "
            f"skipping."
        )
        return

    with SEED_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    bind = op.get_bind()
    existing = bind.execute(
        sa.text("SELECT who_code, vaccine_name FROM standardized_vaccines")
    ).fetchall()
    existing_who_codes = {row[0] for row in existing if row[0]}
    existing_names = {row[1].lower() for row in existing if row[1]}

    seed_table = sa.table(
        "standardized_vaccines",
        sa.column("who_code", sa.String),
        sa.column("vaccine_name", sa.String),
        sa.column("short_name", sa.String),
        sa.column("category", sa.String),
        sa.column("common_names", sa.JSON),
        sa.column("is_combined", sa.Boolean),
        sa.column("components", sa.JSON),
        sa.column("disease_keys", sa.JSON),
        sa.column("default_manufacturer", sa.String),
        sa.column("is_common", sa.Boolean),
        sa.column("display_order", sa.Integer),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )

    now = datetime.now(timezone.utc)
    to_insert = []
    for entry in payload.get("vaccines", []):
        who_code = entry.get("who_code")
        name = entry["vaccine_name"]
        already_present = (
            who_code in existing_who_codes
            if who_code
            else name.lower() in existing_names
        )
        if already_present:
            continue
        to_insert.append(
            {
                "who_code": who_code,
                "vaccine_name": name,
                "short_name": entry.get("short_name"),
                "category": entry.get("category"),
                "common_names": entry.get("common_names"),
                "is_combined": bool(entry.get("is_combined", False)),
                "components": entry.get("components"),
                "disease_keys": entry.get("disease_keys"),
                "default_manufacturer": entry.get("default_manufacturer"),
                "is_common": bool(entry.get("is_common", False)),
                "display_order": entry.get("display_order"),
                "created_at": now,
                "updated_at": now,
            }
        )

    if to_insert:
        op.bulk_insert(seed_table, to_insert)

    # Self-heal disease_keys on rows that already existed but never got
    # backfilled (e.g. inserted between the initial seed and the
    # disease_keys migration, or by this migration's insert pass above).
    updated = 0
    for entry in payload.get("vaccines", []):
        disease_keys = entry.get("disease_keys")
        if not disease_keys:
            continue
        disease_keys_json = json.dumps(disease_keys)
        who_code = entry.get("who_code")
        if who_code:
            result = bind.execute(
                sa.text(
                    "UPDATE standardized_vaccines SET disease_keys = :keys "
                    "WHERE who_code = :who_code AND disease_keys IS NULL"
                ),
                {"keys": disease_keys_json, "who_code": who_code},
            )
        else:
            # Case-insensitive to match the dedup check above (existing_names
            # is lower-cased) — otherwise a row whose vaccine_name differs
            # only in case from the JSON never gets its disease_keys healed.
            result = bind.execute(
                sa.text(
                    "UPDATE standardized_vaccines SET disease_keys = :keys "
                    "WHERE who_code IS NULL AND LOWER(vaccine_name) = LOWER(:name) "
                    "AND disease_keys IS NULL"
                ),
                {"keys": disease_keys_json, "name": entry["vaccine_name"]},
            )
        updated += result.rowcount or 0

    print(
        f"[vaccine backfill migration] Inserted {len(to_insert)} missing vaccines, "
        f"backfilled disease_keys on {updated} existing rows, from "
        f"{SEED_FILE.name} (v{payload.get('version')})."
    )


def downgrade() -> None:
    # Data-only migration. Left intentionally inert rather than deleting rows:
    # by the time anyone downgrades, immunization records may have linked to
    # these rows via standardized_vaccine_id (ON DELETE SET NULL would silently
    # unlink real user data), and reference-catalog rows are not the kind of
    # state a schema downgrade should be destroying.
    pass
