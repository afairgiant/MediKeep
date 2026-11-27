"""Resolve the PostgreSQL client binaries used by backup and restore.

pg_dump refuses to dump a server newer than itself, so the container bundles one
client per supported major and callers pick the matching one at runtime.
"""

import re
from pathlib import Path
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database.utils import get_database_type
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__, "app")

# Debian/PGDG layout: <root>/<major>/bin/<tool>
PG_BIN_ROOT = Path("/usr/lib/postgresql")

# Server and client lines that quote row values or statement text from the dump.
_DATA_BEARING_LINE = re.compile(
    r"\b(?:DETAIL|CONTEXT|STATEMENT|LINE \d+):|^\s*Command was:"
)


class PostgresClientError(Exception):
    """Every bundled client is older than the connected server."""


def get_server_major(db: Session) -> Optional[int]:
    """Server major version, or None when it cannot be determined.

    Returns None for non-PostgreSQL dialects so callers fall back to PATH.
    """
    try:
        if get_database_type(db) != "postgresql":
            return None

        row = db.execute(text("SHOW server_version_num")).fetchone()
        if row is None or row[0] is None:
            logger.warning(
                "PostgreSQL version query returned no result",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "postgres_version_unknown",
                },
            )
            return None

        return int(row[0]) // 10000
    except Exception as e:
        logger.warning(
            "Could not detect PostgreSQL server version",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "postgres_version_unknown",
                LogFields.ERROR: str(e),
            },
        )
        return None


def installed_client_majors() -> List[int]:
    """Bundled client majors that provide pg_dump, ascending."""
    majors = []
    try:
        for entry in PG_BIN_ROOT.iterdir():
            if entry.name.isdigit() and (entry / "bin" / "pg_dump").is_file():
                majors.append(int(entry.name))
    except OSError:
        return []

    return sorted(majors)


def _client_path(tool: str, major: int) -> str:
    return str(PG_BIN_ROOT / str(major) / "bin" / tool)


def pg_dump_binary(db: Session) -> str:
    """pg_dump for the connected server, or the bare name when none is bundled.

    Raises:
        PostgresClientError: every bundled client is older than the server.
    """
    server_major = get_server_major(db)
    installed = installed_client_majors()
    if server_major is None or not installed:
        return "pg_dump"

    # Lowest client at or above the server keeps the dump loadable by that server
    candidates = [major for major in installed if major >= server_major]
    if not candidates:
        listed = ", ".join(str(major) for major in installed)
        raise PostgresClientError(
            f"PostgreSQL {server_major} is newer than any bundled pg_dump client "
            f"(available: {listed}). Upgrade MediKeep to a build that includes a "
            f"PostgreSQL {server_major} client, or run a server this build supports."
        )

    chosen = candidates[0]
    exact = chosen == server_major
    log = logger.info if exact else logger.warning
    log(
        "Resolved pg_dump client" if exact else "No exact pg_dump client for server",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "postgres_client_resolved",
            "server_major": server_major,
            "client_major": chosen,
        },
    )
    return _client_path("pg_dump", chosen)


def _newest_client(tool: str) -> str:
    installed = installed_client_majors()
    return _client_path(tool, installed[-1]) if installed else tool


def psql_binary() -> str:
    """Newest bundled psql, which reads dumps from every supported server."""
    return _newest_client("psql")


def pg_restore_binary() -> str:
    """Newest bundled pg_restore, which reads archives from every supported server."""
    return _newest_client("pg_restore")


def redact_client_output(output: Optional[str]) -> str:
    """psql or pg_restore output without the lines that can quote row data."""
    lines = (output or "").splitlines()
    return "\n".join(
        line for line in lines if not _DATA_BEARING_LINE.search(line)
    ).strip()


def archive_version_error(stderr: str) -> Optional[PostgresClientError]:
    """The named-version error when pg_restore rejected an archive as too new, else None."""
    if "unsupported version" not in (stderr or ""):
        return None
    installed = installed_client_majors()
    client = f"PostgreSQL {installed[-1]}" if installed else "the installed PostgreSQL"
    return PostgresClientError(
        f"This backup was written by a newer pg_dump than the bundled pg_restore "
        f"({client}) can read. Upgrade MediKeep to a build that includes a newer "
        f"PostgreSQL client."
    )
