"""
Round-trip test for the reminders-on-medications Alembic migration.

Spins up a minimal SQLite schema with a ``medications`` table that mirrors the
columns referenced by the migration, runs ``upgrade`` then ``downgrade``, and
asserts the schema changes are applied and reversed cleanly.
"""

import pytest
from sqlalchemy import (
    Column,
    Date,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    inspect,
)

from tests.utils.migrations import run_migration

MIGRATION_FILE = "20260609_1000_b3f7c1d9e2a4_add_reminders_to_medications.py"


@pytest.fixture
def engine_with_baseline_medications():
    """Create an in-memory SQLite engine with a minimal medications table."""
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    Table(
        "medications",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("medication_name", String, nullable=False),
        Column("status", String, nullable=True),
        Column("effective_period_start", Date, nullable=True),
        Column("effective_period_end", Date, nullable=True),
        # Add an existing row so we can prove server_default=false() backfills it
        # without failing the new NOT NULL constraint.
    )
    metadata.create_all(engine)

    with engine.begin() as conn:
        conn.exec_driver_sql(
            "INSERT INTO medications (medication_name) VALUES ('Existing')"
        )

    yield engine
    engine.dispose()


class TestReminderColumnsMigration:
    """Upgrade adds the columns + index; downgrade removes them."""

    def test_upgrade_adds_columns_and_index(self, engine_with_baseline_medications):
        engine = engine_with_baseline_medications

        run_migration(engine, MIGRATION_FILE, "upgrade")

        inspector = inspect(engine)
        column_names = {c["name"] for c in inspector.get_columns("medications")}
        assert "reminder_enabled" in column_names
        assert "reminder_times" in column_names

        index_names = {idx["name"] for idx in inspector.get_indexes("medications")}
        assert "idx_medications_reminder_enabled_status" in index_names

    def test_existing_row_gets_default_false(self, engine_with_baseline_medications):
        engine = engine_with_baseline_medications

        run_migration(engine, MIGRATION_FILE, "upgrade")

        with engine.connect() as conn:
            value = conn.exec_driver_sql(
                "SELECT reminder_enabled FROM medications WHERE medication_name = 'Existing'"
            ).scalar()
        assert value in (0, False)

    def test_downgrade_removes_columns_and_index(
        self, engine_with_baseline_medications
    ):
        engine = engine_with_baseline_medications

        run_migration(engine, MIGRATION_FILE, "upgrade")
        run_migration(engine, MIGRATION_FILE, "downgrade")

        inspector = inspect(engine)
        column_names = {c["name"] for c in inspector.get_columns("medications")}
        assert "reminder_enabled" not in column_names
        assert "reminder_times" not in column_names

        index_names = {idx["name"] for idx in inspector.get_indexes("medications")}
        assert "idx_medications_reminder_enabled_status" not in index_names
