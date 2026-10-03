"""Upgrade/downgrade of the encounter link junction tables migration.

Runs the real migration functions against an in-memory SQLite database and checks
the result against the SQLAlchemy models, so a renamed index or constraint in one
place but not the other fails here instead of at deploy time.
"""

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.models.associations import (
    EncounterCondition,
    EncounterInjury,
    EncounterMedication,
    EncounterProcedure,
    EncounterSymptom,
)

MIGRATION_PATH = next(
    Path(__file__)
    .resolve()
    .parents[2]
    .glob("alembic/migrations/versions/*_add_encounter_link_junction_tables.py")
)

MODELS = [
    EncounterProcedure,
    EncounterSymptom,
    EncounterInjury,
    EncounterMedication,
    EncounterCondition,
]


def _load_migration():
    spec = importlib.util.spec_from_file_location("encounter_links_mig", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _engine_with_parent_tables():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        for table in (
            "encounters",
            "procedures",
            "symptoms",
            "injuries",
            "medications",
            "conditions",
        ):
            conn.execute(sa.text(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)"))
    return engine


def _run(engine, fn):
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            fn()


def test_upgrade_matches_models_and_downgrade_removes_tables():
    migration = _load_migration()
    engine = _engine_with_parent_tables()

    _run(engine, migration.upgrade)
    inspector = sa.inspect(engine)

    for model in MODELS:
        table = model.__table__
        assert table.name in inspector.get_table_names()

        db_columns = {c["name"]: c for c in inspector.get_columns(table.name)}
        assert set(db_columns) == {c.name for c in table.columns}
        for column in table.columns:
            assert db_columns[column.name]["nullable"] == column.nullable

        db_indexes = {i["name"] for i in inspector.get_indexes(table.name)}
        assert db_indexes == {i.name for i in table.indexes}

        db_uniques = {u["name"] for u in inspector.get_unique_constraints(table.name)}
        model_uniques = {
            c.name for c in table.constraints if isinstance(c, sa.UniqueConstraint)
        }
        assert db_uniques == model_uniques

        db_fks = {
            (tuple(fk["constrained_columns"]), fk["referred_table"])
            for fk in inspector.get_foreign_keys(table.name)
        }
        model_fks = {
            ((fk.parent.name,), fk.column.table.name) for fk in table.foreign_keys
        }
        assert db_fks == model_fks

    _run(engine, migration.downgrade)
    remaining = set(sa.inspect(engine).get_table_names())
    assert not remaining & {model.__table__.name for model in MODELS}


def test_upgrade_after_downgrade_is_repeatable():
    migration = _load_migration()
    engine = _engine_with_parent_tables()
    _run(engine, migration.upgrade)
    _run(engine, migration.downgrade)
    _run(engine, migration.upgrade)
    assert "encounter_procedures" in sa.inspect(engine).get_table_names()
