"""Upgrade/downgrade of the paperless_auth_method migration."""

import sqlalchemy as sa

from tests.utils.migrations import run_migration

MIGRATION = (
    "20261114_1000_d4a7f1b3c926_add_paperless_auth_method_to_user_preferences.py"
)


def _columns(engine):
    return {c["name"] for c in sa.inspect(engine).get_columns("user_preferences")}


def test_upgrade_adds_nullable_column_and_downgrade_removes_it():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE user_preferences (id INTEGER PRIMARY KEY)"))
        conn.execute(sa.text("INSERT INTO user_preferences VALUES (1)"))

    run_migration(engine, MIGRATION, "upgrade")

    assert "paperless_auth_method" in _columns(engine)
    with engine.connect() as conn:
        value = conn.execute(
            sa.text("SELECT paperless_auth_method FROM user_preferences WHERE id = 1")
        ).scalar()
    assert value is None  # existing rows keep the legacy automatic behaviour

    run_migration(engine, MIGRATION, "downgrade")

    assert "paperless_auth_method" not in _columns(engine)
