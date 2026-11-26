"""The imaging studies migration: tables, constraints, and a clean downgrade."""

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect

from tests.utils.migrations import load_migration_module

IMAGING_TABLES = {"imaging_studies", "imaging_series", "imaging_instances"}


@pytest.fixture
def migration():
    return load_migration_module("20261122_1200_a7c2e9d41f53_add_imaging_studies.py")


@pytest.fixture
def connection(migration):
    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        for table in ("patients", "procedures", "encounters", "practitioners"):
            conn.exec_driver_sql(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)")
        conn.commit()
        migration.op = Operations(MigrationContext.configure(conn))
        yield conn
    engine.dispose()


def _tables(conn):
    return set(inspect(conn).get_table_names())


def test_upgrade_creates_tables_and_unique_constraints(migration, connection):
    migration.upgrade()
    connection.commit()

    assert IMAGING_TABLES <= _tables(connection)
    inspector = inspect(connection)
    uniques = {
        table: {
            tuple(c["column_names"]) for c in inspector.get_unique_constraints(table)
        }
        for table in IMAGING_TABLES
    }
    assert ("patient_id", "study_instance_uid") in uniques["imaging_studies"]
    assert ("study_id", "series_instance_uid") in uniques["imaging_series"]
    assert ("series_id", "sop_instance_uid") in uniques["imaging_instances"]
    index_names = {i["name"] for i in inspector.get_indexes("imaging_studies")}
    assert "idx_imaging_studies_patient_date" in index_names


def test_downgrade_removes_every_table(migration, connection):
    migration.upgrade()
    connection.commit()
    migration.downgrade()
    connection.commit()

    assert not IMAGING_TABLES & _tables(connection)
