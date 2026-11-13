"""Upgrade/downgrade of the user_preferences verified-URL migration."""

import sqlalchemy as sa

from tests.utils.migrations import run_migration

MIGRATION = "20261113_1000_c9d3e6a2f815_add_verified_url_to_user_preferences.py"


def _columns(engine):
    return {c["name"] for c in sa.inspect(engine).get_columns("user_preferences")}


def test_upgrade_backfills_verified_rows_and_downgrade_removes_columns():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE user_preferences ("
                "id INTEGER PRIMARY KEY, "
                "paperless_url TEXT, paperless_connection_verified BOOLEAN, "
                "papra_url TEXT, papra_connection_verified BOOLEAN)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO user_preferences VALUES "
                "(1, 'https://p.example.com', 1, 'https://a.example.com', 0), "
                "(2, 'https://p.example.com', 0, 'https://a.example.com', 1)"
            )
        )

    run_migration(engine, MIGRATION, "upgrade")

    assert {"paperless_verified_url", "papra_verified_url"} <= _columns(engine)
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                "SELECT id, paperless_verified_url, papra_verified_url "
                "FROM user_preferences ORDER BY id"
            )
        ).all()
    assert rows == [
        (1, "https://p.example.com", None),
        (2, None, "https://a.example.com"),
    ]

    run_migration(engine, MIGRATION, "downgrade")

    assert not {"paperless_verified_url", "papra_verified_url"} & _columns(engine)
