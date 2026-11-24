"""Advisory lock helper: shared and exclusive modes, and non-Postgres databases."""

from unittest.mock import MagicMock

import pytest

from app.core.database.advisory_lock import try_advisory_lock


def _engine(dialect: str, acquired: bool = True):
    engine = MagicMock()
    engine.dialect.name = dialect
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.scalar.return_value = acquired
    return engine, conn


def _statements(conn):
    return [str(c.args[0]) for c in conn.execute.call_args_list]


@pytest.mark.parametrize(
    "shared, lock, unlock",
    [
        (False, "pg_try_advisory_lock(", "pg_advisory_unlock("),
        (True, "pg_try_advisory_lock_shared(", "pg_advisory_unlock_shared("),
    ],
)
def test_takes_and_releases_the_requested_mode(shared, lock, unlock):
    engine, conn = _engine("postgresql")

    with try_advisory_lock(engine, 1, shared=shared, release_failed_event="e") as ok:
        assert ok

    first, last = _statements(conn)
    assert lock in first and unlock in last


def test_reports_a_lock_held_elsewhere_without_unlocking():
    engine, conn = _engine("postgresql", acquired=False)

    with try_advisory_lock(engine, 1, shared=True, release_failed_event="e") as ok:
        assert not ok

    assert len(_statements(conn)) == 1


def test_other_databases_always_acquire():
    engine, _ = _engine("sqlite")

    with try_advisory_lock(engine, 1, shared=False, release_failed_event="e") as ok:
        assert ok

    engine.connect.assert_not_called()
