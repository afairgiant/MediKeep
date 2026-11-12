"""Tests for the psql invocation used by database restores."""

import subprocess
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.restore_service import RestoreService

PSQL_18 = "/usr/lib/postgresql/18/bin/psql"


@pytest.fixture
def run_restore(tmp_path, conn_params):
    """Run the native restore with psql resolution and subprocess.run patched."""

    async def _run(**run_kwargs):
        service = RestoreService(MagicMock())
        with patch(
            "app.services.restore_service.psql_binary", return_value=PSQL_18
        ), patch("subprocess.run", **run_kwargs) as mock_run:
            await service._restore_with_native_psql(tmp_path / "dump.sql", conn_params)
            return mock_run

    return _run


class TestNativePsqlRestore:
    @pytest.mark.asyncio
    async def test_uses_resolved_binary(self, run_restore, completed_process):
        mock_run = await run_restore(return_value=completed_process())

        assert mock_run.call_args.args[0][0] == PSQL_18

    @pytest.mark.asyncio
    async def test_preserves_transaction_safety_flags(
        self, run_restore, completed_process
    ):
        mock_run = await run_restore(return_value=completed_process())

        cmd = mock_run.call_args.args[0]
        assert "--single-transaction" in cmd
        assert "ON_ERROR_STOP=on" in cmd

    @pytest.mark.asyncio
    async def test_password_passed_via_env_not_argv(
        self, run_restore, completed_process, conn_params
    ):
        mock_run = await run_restore(return_value=completed_process())

        assert conn_params["password"] not in mock_run.call_args.args[0]
        assert mock_run.call_args.kwargs["env"]["PGPASSWORD"] == conn_params["password"]

    @pytest.mark.asyncio
    async def test_restore_failure_surfaces_stderr(self, run_restore):
        error = subprocess.CalledProcessError(1, ["psql"], stderr="syntax error")

        with pytest.raises(Exception) as exc:
            await run_restore(side_effect=error)

        assert "syntax error" in str(exc.value)


class TestPsqlConnectionPreflight:
    @pytest.fixture
    def service(self, tmp_path, conn_params):
        service = RestoreService(MagicMock())
        service.backup_dir = tmp_path
        service._drop_all_tables = AsyncMock()
        service._restore_with_native_psql = AsyncMock()
        with patch(
            "app.services.restore_service.SecurityValidator.validate_connection_params",
            return_value=conn_params,
        ), patch("app.services.restore_service.psql_binary", return_value=PSQL_18):
            yield service

    @pytest.fixture
    def backup_file(self, tmp_path):
        path = tmp_path / "dump.sql"
        path.write_text("SELECT 1;")
        return path

    @pytest.mark.asyncio
    async def test_failed_login_aborts_before_dropping_tables(
        self, service, backup_file
    ):
        error = subprocess.CalledProcessError(
            2, ["psql"], stderr="password authentication failed"
        )

        with patch("subprocess.run", side_effect=error):
            with pytest.raises(Exception) as exc:
                await service._restore_database(backup_file)

        service._drop_all_tables.assert_not_awaited()
        service._restore_with_native_psql.assert_not_awaited()
        assert "before any changes" in str(exc.value)
        assert "password authentication failed" in str(exc.value)

    @pytest.mark.asyncio
    async def test_timeout_aborts_before_dropping_tables(self, service, backup_file):
        with patch(
            "subprocess.run", side_effect=subprocess.TimeoutExpired(["psql"], 30)
        ):
            with pytest.raises(Exception, match="timed out"):
                await service._restore_database(backup_file)

        service._drop_all_tables.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_successful_check_proceeds_to_drop_and_restore(
        self, service, backup_file, completed_process, conn_params
    ):
        with patch("subprocess.run", return_value=completed_process()) as mock_run:
            await service._restore_database(backup_file)

        cmd = mock_run.call_args.args[0]
        assert cmd[0] == PSQL_18
        assert cmd[-2:] == ["--command", "SELECT 1"]
        assert conn_params["password"] not in cmd
        assert mock_run.call_args.kwargs["env"]["PGPASSWORD"] == conn_params["password"]
        service._drop_all_tables.assert_awaited_once()
        service._restore_with_native_psql.assert_awaited_once()
