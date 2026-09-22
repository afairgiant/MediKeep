"""Tests for the psql invocation used by database restores."""

import subprocess
from unittest.mock import MagicMock, patch

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
