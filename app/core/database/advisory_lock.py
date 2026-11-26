"""PostgreSQL advisory locks shared by every process using one database."""

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__, "app")

# Arbitrary app-wide key; restores hold it exclusively, imaging imports share it.
UPLOADS_RESTORE_LOCK_KEY = 0x4D4B5253

_LOCK_SQL = {
    False: ("SELECT pg_try_advisory_lock(:key)", "SELECT pg_advisory_unlock(:key)"),
    True: (
        "SELECT pg_try_advisory_lock_shared(:key)",
        "SELECT pg_advisory_unlock_shared(:key)",
    ),
}


@contextmanager
def try_advisory_lock(
    bind: Engine, key: int, *, shared: bool, release_failed_event: str
) -> Iterator[bool]:
    """Try once to take a session-level advisory lock; yields whether it was taken.

    The lock is held on its own connection until the block ends. Yields True without
    locking on databases other than PostgreSQL.
    """
    if bind.dialect.name != "postgresql":
        yield True
        return
    lock_sql, unlock_sql = _LOCK_SQL[shared]
    with bind.connect() as conn:
        # Without autocommit the session sits idle in a transaction while the lock is held.
        conn.execution_options(isolation_level="AUTOCOMMIT")
        acquired = conn.execute(text(lock_sql), {"key": key}).scalar()
        if not acquired:
            yield False
            return
        try:
            yield True
        finally:
            try:
                conn.execute(text(unlock_sql), {"key": key})
            except Exception as e:
                # Closing the connection releases a session-level lock.
                logger.error(
                    f"Could not release an advisory lock: {e}",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: release_failed_event,
                    },
                )
                conn.invalidate()
