"""Verify active patient references survive migration and clear on delete."""

import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
from sqlalchemy import create_engine, inspect


@pytest.mark.parametrize("named", [True, False])
def test_active_patient_fk_upgrade_and_downgrade(named):
    migration_path = (
        Path(__file__).resolve().parents[2]
        / "alembic/migrations/versions"
        / "20261117_1200_e1f2a3b4c5d6_active_patient_fk_set_null.py"
    )
    spec = importlib.util.spec_from_file_location("active_patient_fk", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("CREATE TABLE patients (id INTEGER PRIMARY KEY)")
            name = "CONSTRAINT fk_users_active_patient_id " if named else ""
            connection.exec_driver_sql(
                "CREATE TABLE users (id INTEGER PRIMARY KEY, active_patient_id INTEGER, "
                + name
                + "FOREIGN KEY (active_patient_id) REFERENCES patients(id))"
            )
            connection.exec_driver_sql("INSERT INTO patients VALUES (1)")
            connection.exec_driver_sql("INSERT INTO users VALUES (1, 1)")
            connection.commit()
            migration.op = Operations(MigrationContext.configure(connection))
            migration.upgrade()
            connection.commit()
            fk = inspect(connection).get_foreign_keys("users")[0]
            assert fk["options"]["ondelete"] == "SET NULL"
            assert (
                connection.exec_driver_sql(
                    "SELECT active_patient_id FROM users"
                ).scalar()
                == 1
            )
            connection.commit()
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.exec_driver_sql("DELETE FROM patients WHERE id=1")
            assert (
                connection.exec_driver_sql(
                    "SELECT active_patient_id FROM users"
                ).scalar()
                is None
            )
            connection.commit()
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            migration.downgrade()
            connection.commit()
            fk = inspect(connection).get_foreign_keys("users")[0]
            assert "ondelete" not in fk["options"]
    finally:
        engine.dispose()
