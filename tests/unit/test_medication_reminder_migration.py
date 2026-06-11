"""
Round-trip test for the reminders-on-medications Alembic migration.

Spins up a minimal SQLite schema with a ``medications`` table that mirrors the
columns referenced by the migration, runs ``upgrade`` then ``downgrade``, and
asserts the schema changes are applied and reversed cleanly.
"""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
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


# Loaded by file path — the repo's alembic/ directory is shadowed by the
# installed alembic package, so a dotted import cannot reach it.
MIGRATION_FILE = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "migrations"
    / "versions"
    / "20260609_1000_e8f9a0b1c2d3_add_reminders_to_medications.py"
)


def _load_migration_module():
    spec = importlib.util.spec_from_file_location(
        "reminder_migration_under_test", MIGRATION_FILE
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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


def _run_migration(engine, direction: str) -> None:
    """Run upgrade() or downgrade() in a proper Alembic operations context."""
    module = _load_migration_module()
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        ops = Operations(ctx)
        # The migration module reads ``from alembic import op`` at import time;
        # rebinding that module-level name to our scoped Operations instance is
        # the standard pattern for testing migrations in isolation.
        original_op = module.op
        module.op = ops
        try:
            getattr(module, direction)()
        finally:
            module.op = original_op


class TestReminderColumnsMigration:
    """Upgrade adds the columns + index; downgrade removes them."""

    def test_upgrade_adds_columns_and_index(self, engine_with_baseline_medications):
        engine = engine_with_baseline_medications

        _run_migration(engine, "upgrade")

        inspector = inspect(engine)
        column_names = {c["name"] for c in inspector.get_columns("medications")}
        assert "reminder_enabled" in column_names
        assert "reminder_times" in column_names

        index_names = {idx["name"] for idx in inspector.get_indexes("medications")}
        assert "idx_medications_reminder_enabled_status" in index_names

    def test_existing_row_gets_default_false(self, engine_with_baseline_medications):
        engine = engine_with_baseline_medications

        _run_migration(engine, "upgrade")

        with engine.connect() as conn:
            value = conn.exec_driver_sql(
                "SELECT reminder_enabled FROM medications WHERE medication_name = 'Existing'"
            ).scalar()
        assert value in (0, False)

    def test_downgrade_removes_columns_and_index(
        self, engine_with_baseline_medications
    ):
        engine = engine_with_baseline_medications

        _run_migration(engine, "upgrade")
        _run_migration(engine, "downgrade")

        inspector = inspect(engine)
        column_names = {c["name"] for c in inspector.get_columns("medications")}
        assert "reminder_enabled" not in column_names
        assert "reminder_times" not in column_names

        index_names = {idx["name"] for idx in inspector.get_indexes("medications")}
        assert "idx_medications_reminder_enabled_status" not in index_names
