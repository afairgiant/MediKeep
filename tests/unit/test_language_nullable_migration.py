"""
Round-trip test for the nullable-language Alembic migration.

Spins up a minimal SQLite schema with a ``user_preferences`` table that mirrors the
original NOT NULL DEFAULT 'en' column, runs ``upgrade`` then ``downgrade``, and
asserts the nullability change is applied and reversed cleanly.
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

MIGRATION_FILE = "20260903_1200_e7f4a2b9c1d3_make_user_preferences_language_nullable.py"


@pytest.fixture
def engine_with_baseline_preferences():
    """In-memory SQLite engine with the pre-migration user_preferences shape."""
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    Table(
        "user_preferences",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, nullable=False, unique=True),
        Column("unit_system", String, nullable=False, server_default="imperial"),
        Column("language", String(10), nullable=False, server_default="en"),
    )
    metadata.create_all(engine)

    with engine.begin() as conn:
        conn.exec_driver_sql(
            "INSERT INTO user_preferences (user_id, language) VALUES (1, 'en')"
        )

    yield engine
    engine.dispose()


def _language_column(engine):
    return next(
        c
        for c in inspect(engine).get_columns("user_preferences")
        if c["name"] == "language"
    )


class TestLanguageNullableMigration:
    """Upgrade makes language nullable and default-free; downgrade restores it."""

    def test_upgrade_makes_language_nullable(self, engine_with_baseline_preferences):
        engine = engine_with_baseline_preferences

        run_migration(engine, MIGRATION_FILE, "upgrade")

        column = _language_column(engine)
        assert column["nullable"] is True
        assert column["default"] is None

    def test_upgrade_preserves_existing_values(self, engine_with_baseline_preferences):
        engine = engine_with_baseline_preferences

        run_migration(engine, MIGRATION_FILE, "upgrade")

        with engine.connect() as conn:
            value = conn.exec_driver_sql(
                "SELECT language FROM user_preferences WHERE user_id = 1"
            ).scalar()
        assert value == "en"

    def test_upgrade_accepts_null_language(self, engine_with_baseline_preferences):
        engine = engine_with_baseline_preferences

        run_migration(engine, MIGRATION_FILE, "upgrade")

        with engine.begin() as conn:
            conn.exec_driver_sql(
                "INSERT INTO user_preferences (user_id, language) VALUES (2, NULL)"
            )
            value = conn.exec_driver_sql(
                "SELECT language FROM user_preferences WHERE user_id = 2"
            ).scalar()
        assert value is None

    def test_downgrade_restores_not_null_and_backfills(
        self, engine_with_baseline_preferences
    ):
        engine = engine_with_baseline_preferences

        run_migration(engine, MIGRATION_FILE, "upgrade")
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "INSERT INTO user_preferences (user_id, language) VALUES (2, NULL)"
            )

        run_migration(engine, MIGRATION_FILE, "downgrade")

        column = _language_column(engine)
        assert column["nullable"] is False

        with engine.connect() as conn:
            value = conn.exec_driver_sql(
                "SELECT language FROM user_preferences WHERE user_id = 2"
            ).scalar()
        assert value == "en"
