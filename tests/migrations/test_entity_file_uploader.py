"""The uploader column migration: schema, backfill rules, and downgrade."""

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect

from app.models.activity_log import ActionType, EntityType as ActivityEntityType
from tests.utils.migrations import load_migration_module


@pytest.fixture
def migration():
    return load_migration_module(
        "20261121_1000_f3a8c1d27b64_add_uploaded_by_to_entity_files.py"
    )


@pytest.fixture
def connection(migration):
    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        conn.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        conn.exec_driver_sql(
            "CREATE TABLE activity_logs (id INTEGER PRIMARY KEY, user_id INTEGER, "
            "action VARCHAR, entity_type VARCHAR, entity_id INTEGER, timestamp DATETIME)"
        )
        conn.exec_driver_sql("CREATE TABLE entity_files (id INTEGER PRIMARY KEY)")
        conn.exec_driver_sql("INSERT INTO users VALUES (1), (2)")
        conn.commit()
        # The module bound `op` at import time, so the backfill tests rebind it here
        migration.op = Operations(MigrationContext.configure(conn))
        yield conn
    engine.dispose()


def _add_file(conn, file_id):
    conn.exec_driver_sql("INSERT INTO entity_files VALUES (?)", (file_id,))


def _log_created(conn, log_id, file_id, user_id, timestamp="2026-11-01 10:00:00"):
    conn.exec_driver_sql(
        "INSERT INTO activity_logs VALUES (?, ?, ?, ?, ?, ?)",
        (
            log_id,
            user_id,
            ActionType.CREATED,
            ActivityEntityType.ENTITY_FILE,
            file_id,
            timestamp,
        ),
    )


def _upgrade(migration, conn):
    conn.commit()
    migration.upgrade()
    conn.commit()


def _uploaders(conn):
    return dict(
        conn.exec_driver_sql(
            "SELECT id, uploaded_by_user_id FROM entity_files ORDER BY id"
        ).fetchall()
    )


def test_backfill_rules_and_rerun(migration, connection):
    _add_file(connection, 1)
    _log_created(connection, 1, 1, 2)  # an editor uploaded it
    _add_file(connection, 2)  # no entry: uploader unknown
    _add_file(connection, 3)
    _log_created(connection, 2, 3, None)  # uploader was deleted
    _add_file(connection, 4)
    # A reused file ID: the newest entry is the current file's
    _log_created(connection, 3, 4, 2, "2026-11-01 09:00:00")
    _log_created(connection, 4, 4, 1, "2026-11-01 11:00:00")

    _upgrade(migration, connection)
    expected = {1: 2, 2: None, 3: None, 4: 1}
    assert _uploaders(connection) == expected

    migration.backfill_uploaders(connection)
    connection.commit()
    assert _uploaders(connection) == expected


def test_column_clears_when_the_uploader_is_deleted(migration, connection):
    _add_file(connection, 1)
    _log_created(connection, 1, 1, 2)
    _upgrade(migration, connection)

    fk = next(
        fk
        for fk in inspect(connection).get_foreign_keys("entity_files")
        if fk["constrained_columns"] == ["uploaded_by_user_id"]
    )
    assert fk["options"]["ondelete"] == "SET NULL"
    connection.exec_driver_sql("PRAGMA foreign_keys=ON")
    connection.exec_driver_sql("DELETE FROM users WHERE id=2")
    assert _uploaders(connection) == {1: None}


def test_downgrade_removes_the_column(migration, connection):
    _upgrade(migration, connection)
    assert any(
        index["name"] == migration.INDEX_NAME
        for index in inspect(connection).get_indexes("entity_files")
    )

    migration.downgrade()
    connection.commit()

    columns = {c["name"] for c in inspect(connection).get_columns("entity_files")}
    assert "uploaded_by_user_id" not in columns
