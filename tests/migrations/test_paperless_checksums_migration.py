"""The Paperless checksum columns migration: upgrade keeps existing rows, downgrade removes the columns."""

from sqlalchemy import create_engine, inspect

from tests.utils.migrations import run_migration

MIGRATION = "20261125_1200_7daea8664b24_add_paperless_checksums_to_entity_files.py"
CHECKSUM_COLUMNS = {"paperless_sha256", "paperless_md5"}


def _columns(engine):
    return {c["name"]: c for c in inspect(engine).get_columns("entity_files")}


def test_upgrade_adds_empty_columns_and_downgrade_removes_them():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "CREATE TABLE entity_files (id INTEGER PRIMARY KEY, file_name VARCHAR)"
        )
        conn.exec_driver_sql("INSERT INTO entity_files VALUES (1, 'scan.pdf')")

    run_migration(engine, MIGRATION, "upgrade")

    columns = _columns(engine)
    assert all(columns[name]["nullable"] for name in CHECKSUM_COLUMNS)
    with engine.connect() as conn:
        row = conn.exec_driver_sql(
            "SELECT file_name, paperless_sha256, paperless_md5 FROM entity_files"
        ).one()
    assert tuple(row) == ("scan.pdf", None, None)

    run_migration(engine, MIGRATION, "downgrade")

    assert CHECKSUM_COLUMNS.isdisjoint(_columns(engine))
    engine.dispose()
