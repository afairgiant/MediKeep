"""Round-trip test for the Cholesterol in HDL/LDL relink migration."""

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, text

from tests.utils.migrations import run_migration

MIGRATION_FILE = (
    "20261119_1000_e7a2b4c6d913_relink_cholesterol_in_hdl_ldl_components.py"
)

HDL = "HDL Cholesterol"
LDL = "LDL Cholesterol"
LDL_HDL = "LDL/HDL Ratio"


@pytest.fixture
def engine():
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    Table(
        "lab_test_components",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("test_name", String, nullable=False),
        Column("canonical_test_name", String, nullable=True),
    )
    metadata.create_all(engine)
    yield engine
    engine.dispose()


def _insert(engine, rows):
    with engine.begin() as conn:
        for row_id, test_name, canonical in rows:
            conn.execute(
                text(
                    "INSERT INTO lab_test_components (id, test_name, canonical_test_name) "
                    "VALUES (:id, :name, :canonical)"
                ),
                {"id": row_id, "name": test_name, "canonical": canonical},
            )


def _canonical(engine):
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, canonical_test_name FROM lab_test_components")
        )
        return dict(rows.fetchall())


ROWS = [
    (1, "Cholesterol in HDL", None),
    (2, " cholesterol in ldl ", None),
    (3, "Cholesterol in LDL/Cholesterol in HDL", ""),
    (4, "LDL/HDL Cholesterol Ratio", None),
    (5, "Cholesterol in HDL:", HDL),
    (6, "Hemoglobin", None),
    (7, "Some Custom Panel", ""),
]


def test_upgrade_relinks_only_new_alias_names(engine):
    _insert(engine, ROWS)

    run_migration(engine, MIGRATION_FILE, "upgrade")

    assert _canonical(engine) == {
        1: HDL,
        2: LDL,
        3: LDL_HDL,
        4: LDL_HDL,
        5: HDL,
        6: None,
        7: "",
    }


def test_downgrade_restores_previous_links(engine):
    _insert(engine, ROWS)

    run_migration(engine, MIGRATION_FILE, "upgrade")
    run_migration(engine, MIGRATION_FILE, "downgrade")

    assert _canonical(engine) == {row_id: canonical for row_id, _, canonical in ROWS}


def test_upgrade_is_idempotent(engine):
    _insert(engine, ROWS)

    run_migration(engine, MIGRATION_FILE, "upgrade")
    first = _canonical(engine)
    run_migration(engine, MIGRATION_FILE, "upgrade")

    assert _canonical(engine) == first
