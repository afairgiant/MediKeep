"""Round-trip test for the #1221 total cholesterol/HDL ratio relink migration."""

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, text

from tests.utils.migrations import run_migration

MIGRATION_FILE = "20261109_1000_b8e2d5f1c934_relink_total_cholesterol_hdl_ratio.py"

LDL_HDL = "LDL/HDL Ratio"
TOTAL_CHOL_HDL = "Total Cholesterol/HDL Ratio"


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
    (1, "Cholesterol/HDL Ratio", LDL_HDL),
    (2, " CHOL/HDLC RATIO ", LDL_HDL),
    (3, "cholesterol ratio", LDL_HDL),
    (4, "T. Chol/HDL Ratio", LDL_HDL),
    (5, "LDL/HDL Ratio", LDL_HDL),
    (6, "Cholesterol/HDL Ratio", "My Custom Ratio"),
    (7, "Cholesterol/HDL Ratio", None),
    (8, "Cholesterol Ratio:", LDL_HDL),
    (9, " CHOL/HDLC RATIO,; ", LDL_HDL),
    (10, "LDL/HDL Ratio:", LDL_HDL),
]


def test_upgrade_relinks_only_total_cholesterol_names(engine):
    _insert(engine, ROWS)

    run_migration(engine, MIGRATION_FILE, "upgrade")

    assert _canonical(engine) == {
        1: TOTAL_CHOL_HDL,
        2: TOTAL_CHOL_HDL,
        3: TOTAL_CHOL_HDL,
        4: TOTAL_CHOL_HDL,
        5: LDL_HDL,
        6: "My Custom Ratio",
        7: None,
        8: TOTAL_CHOL_HDL,
        9: TOTAL_CHOL_HDL,
        10: LDL_HDL,
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
