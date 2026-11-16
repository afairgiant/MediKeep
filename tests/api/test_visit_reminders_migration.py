"""Upgrade/downgrade of the encounter visit_time and reminders migration."""

import sqlalchemy as sa

from tests.utils.migrations import run_migration

MIGRATION = "20261115_1000_e7b2c4f9a1d3_add_visit_time_and_reminders_to_encounters.py"
NEW_COLUMNS = {
    "visit_time",
    "reminder_enabled",
    "reminder_offsets",
    "reminder_include_details",
}


def _columns(engine):
    return {c["name"] for c in sa.inspect(engine).get_columns("encounters")}


def _indexes(engine):
    return {i["name"] for i in sa.inspect(engine).get_indexes("encounters")}


def test_upgrade_adds_columns_with_reminders_off_and_downgrade_removes_them():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            sa.text("CREATE TABLE encounters (id INTEGER PRIMARY KEY, date DATE)")
        )
        conn.execute(sa.text("INSERT INTO encounters VALUES (1, '2026-12-10')"))

    run_migration(engine, MIGRATION, "upgrade")

    assert NEW_COLUMNS <= _columns(engine)
    assert "idx_encounters_reminder_enabled_date" in _indexes(engine)
    with engine.connect() as conn:
        row = conn.execute(
            sa.text(
                "SELECT visit_time, reminder_enabled, reminder_include_details "
                "FROM encounters WHERE id = 1"
            )
        ).one()
    assert tuple(row) == (None, 0, 0)

    run_migration(engine, MIGRATION, "downgrade")

    assert not NEW_COLUMNS & _columns(engine)
    assert "idx_encounters_reminder_enabled_date" not in _indexes(engine)
