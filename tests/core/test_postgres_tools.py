"""Tests for PostgreSQL client binary resolution."""

from unittest.mock import MagicMock

import pytest

from app.core.database import postgres_tools
from app.core.database.postgres_tools import (
    PostgresClientError,
    get_server_major,
    installed_client_majors,
    pg_dump_binary,
    psql_binary,
)


@pytest.fixture
def bin_root(tmp_path, monkeypatch):
    """Install fake pg_dump/psql binaries for the given majors and point the module at them."""

    def _make(majors):
        for major in majors:
            bin_dir = tmp_path / str(major) / "bin"
            bin_dir.mkdir(parents=True)
            for tool in ("pg_dump", "psql"):
                binary = bin_dir / tool
                binary.write_text("#!/bin/sh\n")
                binary.chmod(0o755)
        monkeypatch.setattr(postgres_tools, "PG_BIN_ROOT", tmp_path)
        return tmp_path

    return _make


def _session(dialect="postgresql", version_num="180004"):
    db = MagicMock()
    db.bind.dialect.name = dialect
    row = None if version_num is None else (version_num,)
    db.execute.return_value.fetchone.return_value = row
    return db


class TestInstalledClientMajors:
    def test_lists_majors_ascending(self, bin_root):
        bin_root([18, 15, 17])

        assert installed_client_majors() == [15, 17, 18]

    def test_ignores_dirs_without_pg_dump(self, bin_root):
        root = bin_root([15])
        (root / "16" / "bin").mkdir(parents=True)

        assert installed_client_majors() == [15]

    def test_missing_root_returns_empty(self, tmp_path, monkeypatch):
        monkeypatch.setattr(postgres_tools, "PG_BIN_ROOT", tmp_path / "nope")

        assert installed_client_majors() == []


class TestGetServerMajor:
    def test_parses_server_version_num(self):
        assert get_server_major(_session(version_num="180004")) == 18

    def test_parses_two_digit_minor(self):
        assert get_server_major(_session(version_num="150019")) == 15

    def test_non_postgres_dialect_returns_none(self):
        db = _session(dialect="sqlite")

        assert get_server_major(db) is None
        db.execute.assert_not_called()

    def test_no_row_returns_none(self):
        assert get_server_major(_session(version_num=None)) is None

    def test_query_error_returns_none(self):
        db = _session()
        db.execute.side_effect = RuntimeError("connection lost")

        assert get_server_major(db) is None


class TestPgDumpBinary:
    def test_exact_match(self, bin_root):
        root = bin_root([15, 16, 17, 18])

        assert pg_dump_binary(_session(version_num="180004")) == str(
            root / "18" / "bin" / "pg_dump"
        )

    def test_picks_lowest_client_above_server(self, bin_root):
        root = bin_root([15, 16, 17, 18])

        assert pg_dump_binary(_session(version_num="140012")) == str(
            root / "15" / "bin" / "pg_dump"
        )

    def test_server_newer_than_every_client_raises(self, bin_root):
        bin_root([15, 16, 17, 18])

        with pytest.raises(PostgresClientError) as exc:
            pg_dump_binary(_session(version_num="190001"))

        assert "19" in str(exc.value)
        assert "15, 16, 17, 18" in str(exc.value)

    def test_unknown_server_version_uses_path(self, bin_root):
        bin_root([18])

        assert pg_dump_binary(_session(dialect="sqlite")) == "pg_dump"

    def test_no_bundled_client_uses_path(self, tmp_path, monkeypatch):
        monkeypatch.setattr(postgres_tools, "PG_BIN_ROOT", tmp_path / "nope")

        assert pg_dump_binary(_session()) == "pg_dump"


class TestPsqlBinary:
    def test_picks_newest_installed(self, bin_root):
        root = bin_root([15, 16, 17, 18])

        assert psql_binary() == str(root / "18" / "bin" / "psql")

    def test_no_bundled_client_uses_path(self, tmp_path, monkeypatch):
        monkeypatch.setattr(postgres_tools, "PG_BIN_ROOT", tmp_path / "nope")

        assert psql_binary() == "psql"
