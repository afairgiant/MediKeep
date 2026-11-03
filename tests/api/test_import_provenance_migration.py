"""Upgrade/downgrade of the import_provenance migration."""

import sqlalchemy as sa

from tests.utils.migrations import run_migration

MIGRATION = "20261102_1000_a1c7e4b9d2f6_add_import_provenance.py"


def _tables(engine):
    return set(sa.inspect(engine).get_table_names())


def _indexes(engine):
    return {i["name"] for i in sa.inspect(engine).get_indexes("import_provenance")}


def test_upgrade_creates_table_and_downgrade_removes_it():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE patients (id INTEGER PRIMARY KEY)"))

    run_migration(engine, MIGRATION, "upgrade")

    assert "import_provenance" in _tables(engine)
    assert _indexes(engine) == {
        "idx_import_provenance_patient_external",
        "idx_import_provenance_patient_hash",
        "idx_import_provenance_batch",
    }
    external = next(
        i
        for i in sa.inspect(engine).get_indexes("import_provenance")
        if i["name"] == "idx_import_provenance_patient_external"
    )
    assert external["column_names"] == [
        "patient_id",
        "record_type",
        "source",
        "external_id",
    ]
    columns = {c["name"] for c in sa.inspect(engine).get_columns("import_provenance")}
    assert columns == {
        "id",
        "patient_id",
        "record_type",
        "record_id",
        "source",
        "external_id",
        "content_hash",
        "import_batch_id",
        "imported_at",
    }

    inspector = sa.inspect(engine)
    uniques = inspector.get_unique_constraints("import_provenance")
    assert [u["column_names"] for u in uniques] == [["record_type", "record_id"]]
    foreign_keys = inspector.get_foreign_keys("import_provenance")
    assert [(f["constrained_columns"], f["referred_table"]) for f in foreign_keys] == [
        (["patient_id"], "patients")
    ]
    assert foreign_keys[0]["options"].get("ondelete") == "CASCADE"

    run_migration(engine, MIGRATION, "downgrade")

    assert "import_provenance" not in _tables(engine)
