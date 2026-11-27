"""Tests for the pg_dump invocation used by database and full backups."""

import json
import subprocess
import zipfile
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import settings
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
    async def test_writes_a_custom_format_archive(self, run_dump, completed_process):
        mock_run = await run_dump(return_value=completed_process())

        assert "--format=custom" in mock_run.call_args.args[0]

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


class TestBackupArtifacts:
    @pytest.fixture
    def service(self, tmp_path, conn_params, monkeypatch):
        db = MagicMock()
        db.add.side_effect = lambda record: setattr(
            record, "created_at", datetime.now()
        )
        service = BackupService(db)
        service.backup_dir = tmp_path / "backups"
        monkeypatch.setattr(settings, "UPLOAD_DIR", tmp_path / "uploads")

        async def _dump(path, _conn_params):
            path.write_bytes(b"PGDMP-archive")

        service._create_native_database_dump = _dump
        with patch(
            "app.services.backup_service.SecurityValidator.validate_connection_params",
            return_value=conn_params,
        ):
            yield service

    @pytest.mark.asyncio
    async def test_database_backup_is_a_compressed_dump_file(self, service):
        result = await service.create_database_backup("test")

        assert result["filename"].endswith(".dump")
        (record,) = [call.args[0] for call in service.db.add.call_args_list]
        assert record.compression_used is True

    @pytest.mark.asyncio
    async def test_full_backup_holds_database_dump_named_in_manifest(self, service):
        result = await service.create_full_backup("test")

        with zipfile.ZipFile(result["file_path"]) as zipf:
            assert zipf.read("database.dump") == b"PGDMP-archive"
            assert zipf.getinfo("database.dump").compress_type == zipfile.ZIP_STORED
            assert "database.sql" not in zipf.namelist()
            manifest = json.loads(zipf.read("backup_manifest.json"))
        assert manifest["components"]["database"] == "database.dump"
