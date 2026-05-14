"""Add standardized_vaccines table and seed from WHO PCMT + curated library

Revision ID: c1d2e3f4a5b6
Revises: b4c5d6e7f8a9
Create Date: 2026-05-11 11:30:00.000000

Adds the standardized_vaccines reference table backing the new vaccine
autocomplete on the Immunization form (issue #812). Seed data is loaded from
``shared/data/vaccine_library.json`` (WHO PreQualVaccineType plus curated
additions for common US/Western vaccines not in the WHO list).

The immunizations.vaccine_name column is intentionally left as free text —
this catalog only powers autocomplete suggestions.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c1d2e3f4a5b6"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


SEED_FILE = (
    Path(__file__).resolve().parents[3]
    / "shared"
    / "data"
    / "vaccine_library.json"
)


def upgrade() -> None:
    op.create_table(
        "standardized_vaccines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("who_code", sa.String(length=100), nullable=True),
        sa.Column("vaccine_name", sa.String(length=255), nullable=False),
        sa.Column("short_name", sa.String(length=100), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("common_names", sa.JSON(), nullable=True),
        sa.Column(
            "is_combined",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("components", sa.JSON(), nullable=True),
        sa.Column("default_manufacturer", sa.String(length=100), nullable=True),
        sa.Column(
            "is_common",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("display_order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_standardized_vaccines_who_code",
        "standardized_vaccines",
        ["who_code"],
        unique=True,
    )
    op.create_index(
        "idx_standardized_vaccines_vaccine_name",
        "standardized_vaccines",
        ["vaccine_name"],
    )
    op.create_index(
        "idx_standardized_vaccines_short_name",
        "standardized_vaccines",
        ["short_name"],
    )
    op.create_index(
        "idx_standardized_vaccines_category",
        "standardized_vaccines",
        ["category"],
    )
    op.create_index(
        "idx_standardized_vaccines_is_common",
        "standardized_vaccines",
        ["is_common"],
    )
    op.create_index(
        "idx_standardized_vaccines_is_combined",
        "standardized_vaccines",
        ["is_combined"],
    )

    if not SEED_FILE.exists():
        print(
            f"[standardized_vaccines migration] Seed file not found at "
            f"{SEED_FILE} — leaving table empty. Run a re-seed manually."
        )
        return

    with SEED_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    vaccines = payload.get("vaccines", [])
    now = datetime.now(timezone.utc)
    seed_table = sa.table(
        "standardized_vaccines",
        sa.column("who_code", sa.String),
        sa.column("vaccine_name", sa.String),
        sa.column("short_name", sa.String),
        sa.column("category", sa.String),
        sa.column("common_names", sa.JSON),
        sa.column("is_combined", sa.Boolean),
        sa.column("components", sa.JSON),
        sa.column("default_manufacturer", sa.String),
        sa.column("is_common", sa.Boolean),
        sa.column("display_order", sa.Integer),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )
    rows = [
        {
            "who_code": v.get("who_code"),
            "vaccine_name": v["vaccine_name"],
            "short_name": v.get("short_name"),
            "category": v.get("category"),
            "common_names": v.get("common_names"),
            "is_combined": bool(v.get("is_combined", False)),
            "components": v.get("components"),
            "default_manufacturer": v.get("default_manufacturer"),
            "is_common": bool(v.get("is_common", False)),
            "display_order": v.get("display_order"),
            "created_at": now,
            "updated_at": now,
        }
        for v in vaccines
    ]
    op.bulk_insert(seed_table, rows)

    print(
        f"[standardized_vaccines migration] Seeded {len(rows)} vaccines from "
        f"{SEED_FILE.name} (version {payload.get('version')})."
    )


def downgrade() -> None:
    op.drop_index(
        "idx_standardized_vaccines_is_combined",
        table_name="standardized_vaccines",
    )
    op.drop_index(
        "idx_standardized_vaccines_is_common",
        table_name="standardized_vaccines",
    )
    op.drop_index(
        "idx_standardized_vaccines_category",
        table_name="standardized_vaccines",
    )
    op.drop_index(
        "idx_standardized_vaccines_short_name",
        table_name="standardized_vaccines",
    )
    op.drop_index(
        "idx_standardized_vaccines_vaccine_name",
        table_name="standardized_vaccines",
    )
    op.drop_index(
        "idx_standardized_vaccines_who_code",
        table_name="standardized_vaccines",
    )
    op.drop_table("standardized_vaccines")
