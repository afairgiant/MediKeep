"""
Round-trip test for the tag-sanitization data-cleanup Alembic migration.

Spins up a minimal SQLite schema mirroring every taggable table's `id`/`tags`
shape, inserts legacy tag values that predate the character allowlist (see
app.schemas.base_tags / public issue #1040), runs `upgrade`, and asserts the
stored values now match what the allowlist would produce. `downgrade` is a
no-op (documented as such - the transform is lossy), which is asserted too.
"""

import json

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, Text, create_engine, text

from tests.utils.migrations import run_migration

MIGRATION_FILE = "20260922_2000_53550b9a25a6_sanitize_existing_tag_values.py"

TAGGED_TABLES = [
    "allergies",
    "conditions",
    "encounters",
    "immunizations",
    "injuries",
    "insurances",
    "lab_results",
    "medical_equipment",
    "medications",
    "procedures",
    "symptoms",
    "treatments",
]


@pytest.fixture
def engine_with_tagged_tables():
    """In-memory SQLite engine with every taggable table's id/tags shape."""
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    for table_name in TAGGED_TABLES:
        Table(
            table_name,
            metadata,
            Column("id", Integer, primary_key=True),
            Column("tags", Text, nullable=True),
        )
    metadata.create_all(engine)
    yield engine
    engine.dispose()


def _insert(engine, table, row_id, tags):
    """Insert a row; `tags` is a Python list (JSON-encoded) or None."""
    with engine.begin() as conn:
        conn.execute(
            text(f'INSERT INTO "{table}" (id, tags) VALUES (:id, :tags)'),
            {"id": row_id, "tags": json.dumps(tags) if tags is not None else None},
        )


def _read_tags(engine, table, row_id):
    with engine.connect() as conn:
        raw = conn.execute(
            text(f'SELECT tags FROM "{table}" WHERE id = :id'),
            {"id": row_id},
        ).scalar()
    return json.loads(raw) if raw is not None else None


class TestSanitizeExistingTagValuesMigration:
    def test_strips_disallowed_characters(self, engine_with_tagged_tables):
        engine = engine_with_tagged_tables
        _insert(engine, "allergies", 1, ["crohn's", "covid_19", "a/b"])

        run_migration(engine, MIGRATION_FILE, "upgrade")

        assert _read_tags(engine, "allergies", 1) == ["crohns", "covid19", "ab"]

    def test_drops_tags_that_sanitize_to_nothing(self, engine_with_tagged_tables):
        engine = engine_with_tagged_tables
        _insert(engine, "conditions", 1, ["...", "   ", "diabetes"])

        run_migration(engine, MIGRATION_FILE, "upgrade")

        assert _read_tags(engine, "conditions", 1) == ["diabetes"]

    def test_already_clean_tags_unchanged(self, engine_with_tagged_tables):
        engine = engine_with_tagged_tables
        _insert(engine, "medications", 1, ["diabetes", "sars-cov-2"])

        run_migration(engine, MIGRATION_FILE, "upgrade")

        assert _read_tags(engine, "medications", 1) == ["diabetes", "sars-cov-2"]

    def test_null_tags_left_alone(self, engine_with_tagged_tables):
        engine = engine_with_tagged_tables
        _insert(engine, "treatments", 1, None)

        run_migration(engine, MIGRATION_FILE, "upgrade")

        assert _read_tags(engine, "treatments", 1) is None

    def test_collapsed_duplicates_deduplicated(self, engine_with_tagged_tables):
        engine = engine_with_tagged_tables
        _insert(engine, "procedures", 1, ["crohn's", "crohns"])

        run_migration(engine, MIGRATION_FILE, "upgrade")

        assert _read_tags(engine, "procedures", 1) == ["crohns"]

    @pytest.mark.parametrize(
        "table", ["insurances", "symptoms", "injuries", "medical_equipment"]
    )
    def test_covers_every_tagged_table(self, engine_with_tagged_tables, table):
        engine = engine_with_tagged_tables
        _insert(engine, table, 1, ["crohn's"])

        run_migration(engine, MIGRATION_FILE, "upgrade")

        assert _read_tags(engine, table, 1) == ["crohns"]

    def test_upgrade_is_idempotent(self, engine_with_tagged_tables):
        engine = engine_with_tagged_tables
        _insert(engine, "encounters", 1, ["crohn's"])

        run_migration(engine, MIGRATION_FILE, "upgrade")
        run_migration(engine, MIGRATION_FILE, "upgrade")

        assert _read_tags(engine, "encounters", 1) == ["crohns"]

    def test_downgrade_is_a_no_op(self, engine_with_tagged_tables):
        engine = engine_with_tagged_tables
        _insert(engine, "allergies", 1, ["crohn's"])

        run_migration(engine, MIGRATION_FILE, "upgrade")
        run_migration(engine, MIGRATION_FILE, "downgrade")

        # The transform is lossy (no way to recover "crohn's" from "crohns"),
        # so downgrade leaves the sanitized value as-is rather than raising
        # or attempting a fabricated restoration.
        assert _read_tags(engine, "allergies", 1) == ["crohns"]
