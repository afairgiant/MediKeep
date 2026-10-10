"""
Round-trip test for the migration that adds a purpose to the condition and procedure
lab result links (#1128).

Spins up a minimal SQLite schema that mirrors the two link tables before the migration,
runs ``upgrade`` then ``downgrade``, and checks the column is added without touching
existing rows, and removed again.
"""

import pytest
from sqlalchemy import (
    Column,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    inspect,
)

from tests.utils.migrations import run_migration

MIGRATION_FILE = (
    "20261010_1200_9a3d5e7f1b24_add_purpose_to_lab_result_condition_and_"
    "procedure_links.py"
)
LINK_TABLES = ["lab_result_conditions", "lab_result_procedures"]


@pytest.fixture
def engine_with_baseline_links():
    """In-memory SQLite engine with the link tables as they were before the migration."""
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    for table in LINK_TABLES:
        Table(
            table,
            metadata,
            Column("id", Integer, primary_key=True),
            Column("lab_result_id", Integer, nullable=False),
            Column("record_id", Integer, nullable=False),
            Column("relevance_note", String, nullable=True),
        )
    metadata.create_all(engine)
    with engine.begin() as conn:
        for table in LINK_TABLES:
            conn.exec_driver_sql(
                f"INSERT INTO {table} (lab_result_id, record_id, relevance_note) "
                "VALUES (1, 2, 'kept')"
            )
    yield engine
    engine.dispose()


def _columns(engine, table):
    return {c["name"]: c for c in inspect(engine).get_columns(table)}


@pytest.mark.parametrize("table", LINK_TABLES)
class TestLabResultLinkPurposeMigration:
    def test_upgrade_adds_a_nullable_purpose_column(
        self, engine_with_baseline_links, table
    ):
        engine = engine_with_baseline_links
        assert "purpose" not in _columns(engine, table)

        run_migration(engine, MIGRATION_FILE, "upgrade")

        purpose = _columns(engine, table)["purpose"]
        assert purpose["nullable"] is True
        assert purpose["type"].length == 50

    def test_upgrade_keeps_existing_links_without_a_purpose(
        self, engine_with_baseline_links, table
    ):
        engine = engine_with_baseline_links
        run_migration(engine, MIGRATION_FILE, "upgrade")

        with engine.connect() as conn:
            row = conn.exec_driver_sql(
                f"SELECT relevance_note, purpose FROM {table}"
            ).one()
        assert tuple(row) == ("kept", None)

    def test_downgrade_removes_the_column_and_keeps_the_rest(
        self, engine_with_baseline_links, table
    ):
        engine = engine_with_baseline_links
        run_migration(engine, MIGRATION_FILE, "upgrade")
        with engine.begin() as conn:
            conn.exec_driver_sql(f"UPDATE {table} SET purpose = 'baseline'")

        run_migration(engine, MIGRATION_FILE, "downgrade")

        assert "purpose" not in _columns(engine, table)
        with engine.connect() as conn:
            note = conn.exec_driver_sql(f"SELECT relevance_note FROM {table}").scalar()
        assert note == "kept"


def test_migration_follows_the_previous_head():
    from tests.utils.migrations import load_migration_module

    module = load_migration_module(MIGRATION_FILE)
    assert module.revision == "9a3d5e7f1b24"
    assert module.down_revision == "7c1e4a9b2d35"
