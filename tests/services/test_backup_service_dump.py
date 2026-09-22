"""Tests for the pg_dump invocation used by database and full backups."""

import subprocess
from unittest.mock import MagicMock, patch

import pytest

from app.core.database.postgres_tools import PostgresClientError
from app.services.backup_service import BackupService

PG_DUMP_18 = "/usr/lib/postgresql/18/bin/pg_dump"


@pytest.fixture
def run_dump(tmp_path, conn_params):
    """Run the native dump with pg_dump resolution and subprocess.run patched."""

    async def _run(**run_kwargs):
        service = BackupService(MagicMock())
        with patch(
            "app.services.backup_service.pg_dump_binary", return_value=PG_DUMP_18
        ), patch("subprocess.run", **run_kwargs) as mock_run:
            await service._create_native_database_dump(
                tmp_path / "dump.sql", conn_params
            )
            return mock_run

    return _run


class TestNativeDatabaseDump:
    @pytest.mark.asyncio
    async def test_uses_resolved_binary(self, run_dump, completed_process):
        mock_run = await run_dump(return_value=completed_process())

        assert mock_run.call_args.args[0][0] == PG_DUMP_18

    @pytest.mark.asyncio
    async def test_preserves_dump_flags(self, run_dump, completed_process, conn_params):
        mock_run = await run_dump(return_value=completed_process())

        cmd = mock_run.call_args.args[0]
        for flag in ("--no-owner", "--no-privileges", "--no-password", "--verbose"):
            assert flag in cmd
        excluded = [arg for arg in cmd if arg.startswith("--exclude-table=")]
        assert len(excluded) == 2
        assert conn_params["hostname"] in cmd
        assert conn_params["database"] in cmd

    @pytest.mark.asyncio
    async def test_password_passed_via_env_not_argv(
        self, run_dump, completed_process, conn_params
    ):
        mock_run = await run_dump(return_value=completed_process())

        assert conn_params["password"] not in mock_run.call_args.args[0]
        assert mock_run.call_args.kwargs["env"]["PGPASSWORD"] == conn_params["password"]

    @pytest.mark.asyncio
    async def test_dump_has_a_timeout(self, run_dump, completed_process):
        mock_run = await run_dump(return_value=completed_process())

        assert mock_run.call_args.kwargs["timeout"] == 1800

    @pytest.mark.asyncio
    async def test_dump_failure_surfaces_stderr(self, run_dump):
        error = subprocess.CalledProcessError(
            1, ["pg_dump"], stderr="permission denied"
        )

        with pytest.raises(Exception) as exc:
            await run_dump(side_effect=error)

        assert "permission denied" in str(exc.value)

    @pytest.mark.asyncio
    async def test_timeout_reported_as_timeout(self, run_dump):
        expired = subprocess.TimeoutExpired(["pg_dump"], 1800)

        with pytest.raises(Exception) as exc:
            await run_dump(side_effect=expired)

        assert "timed out" in str(exc.value)

    @pytest.mark.asyncio
    async def test_version_mismatch_message_is_not_wrapped(self, tmp_path, conn_params):
        message = "PostgreSQL 19 is newer than any bundled pg_dump client"
        service = BackupService(MagicMock())

        with patch(
            "app.services.backup_service.pg_dump_binary",
            side_effect=PostgresClientError(message),
        ), patch("subprocess.run") as mock_run:
            with pytest.raises(PostgresClientError) as exc:
                await service._create_native_database_dump(
                    tmp_path / "dump.sql", conn_params
                )

        assert str(exc.value) == message
        mock_run.assert_not_called()
