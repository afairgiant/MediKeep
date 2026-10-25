"""Upgrade/downgrade of the users.session_version migration."""

import sqlalchemy as sa

from tests.utils.migrations import run_migration

MIGRATION = "20261025_1000_d7b2f4a8c615_add_user_session_version.py"


def _columns(engine):
    return {c["name"] for c in sa.inspect(engine).get_columns("users")}


def test_upgrade_backfills_zero_and_downgrade_removes_column():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            sa.text("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)")
        )
        conn.execute(sa.text("INSERT INTO users (id, username) VALUES (1, 'existing')"))

    run_migration(engine, MIGRATION, "upgrade")

    assert "session_version" in _columns(engine)
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT session_version FROM users")).scalar() == 0

    run_migration(engine, MIGRATION, "downgrade")

    assert "session_version" not in _columns(engine)
