"""Tests for restoring custom-format (.dump) database archives through pg_restore."""

import json
import os
import subprocess
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.database.postgres_tools import PostgresClientError
from app.services.restore_service import RestoreService, _check_backup_readable

PG_RESTORE_18 = "/usr/lib/postgresql/18/bin/pg_restore"
TOO_NEW = "pg_restore: error: unsupported version (1.17) in file header"
TOC = """;
; Archive created at 2026-11-27 10:00:00 UTC
;     dbname: medical_records
;
216; 1259 16390 TABLE public allergies medapp
217; 1259 16391 SEQUENCE public allergies_id_seq medapp
218; 1259 16392 TABLE public patients medapp
3400; 0 16390 TABLE DATA public allergies medapp
3401; 0 16392 TABLE DATA public patients medapp
"""


def _zip(path: Path, members: dict) -> Path:
    with zipfile.ZipFile(path, "w") as zipf:
        for name, content in members.items():
            zipf.writestr(name, content)
    return path


@pytest.fixture(autouse=True)
def resolved_binaries():
    with patch(
        "app.services.restore_service.pg_restore_binary", return_value=PG_RESTORE_18
    ), patch(
        "app.core.database.postgres_tools.installed_client_majors", return_value=[18]
    ):
        yield


@pytest.fixture
def service(tmp_path, conn_params):
    service = RestoreService(MagicMock())
    service.backup_dir = tmp_path
    with patch(
        "app.services.restore_service.SecurityValidator.validate_connection_params",
        return_value=conn_params,
    ):
        yield service


@pytest.fixture
def dump_file(tmp_path):
    path = tmp_path / "database_backup_20261127_100000.dump"
    path.write_bytes(b"PGDMP")
    return path


class TestPgRestoreCommand:
    @pytest.fixture
    def run_restore(self, service, dump_file, conn_params):
        async def _run(**run_kwargs):
            with patch("subprocess.run", **run_kwargs) as mock_run:
                await service._restore_with_pg_restore(dump_file, conn_params)
                return mock_run

        return _run

    @pytest.mark.asyncio
    async def test_restores_in_one_transaction_with_resolved_binary(
        self, run_restore, completed_process, dump_file
    ):
        mock_run = await run_restore(return_value=completed_process())

        cmd = mock_run.call_args.args[0]
        assert cmd[0] == PG_RESTORE_18
        for flag in (
            "--single-transaction",
            "--exit-on-error",
            "--no-owner",
            "--no-privileges",
        ):
            assert flag in cmd
        assert cmd[-1] == str(dump_file)

    @pytest.mark.asyncio
    async def test_password_passed_via_env_not_argv(
        self, run_restore, completed_process, conn_params
    ):
        mock_run = await run_restore(return_value=completed_process())

        assert conn_params["password"] not in mock_run.call_args.args[0]
        assert mock_run.call_args.kwargs["env"]["PGPASSWORD"] == conn_params["password"]

    @pytest.mark.asyncio
    async def test_failure_surfaces_stderr(self, run_restore):
        error = subprocess.CalledProcessError(
            1, ["pg_restore"], stderr="relation exists"
        )

        with pytest.raises(Exception, match="relation exists"):
            await run_restore(side_effect=error)

    @pytest.mark.asyncio
    async def test_failure_output_leaves_out_row_data(self, run_restore):
        error = subprocess.CalledProcessError(
            1,
            ["pg_restore"],
            stderr='ERROR:  invalid input\nCONTEXT:  COPY patients, line 1: "Jane"',
        )

        with pytest.raises(Exception) as raised:
            await run_restore(side_effect=error)

        assert "invalid input" in str(raised.value)
        assert "Jane" not in str(raised.value)

    @pytest.mark.asyncio
    async def test_too_new_archive_names_the_client(self, run_restore):
        error = subprocess.CalledProcessError(1, ["pg_restore"], stderr=TOO_NEW)

        with pytest.raises(PostgresClientError, match="PostgreSQL 18"):
            await run_restore(side_effect=error)


class TestDatabaseRestoreDispatch:
    @pytest.fixture(autouse=True)
    def _stub_steps(self, service):
        service._drop_all_tables = AsyncMock()
        service._check_psql_connection = AsyncMock()
        service._restore_with_native_psql = AsyncMock()
        service._restore_with_pg_restore = AsyncMock()

    @pytest.mark.asyncio
    async def test_dump_is_checked_then_restored_with_pg_restore(
        self, service, dump_file, completed_process
    ):
        with patch("subprocess.run", return_value=completed_process()) as mock_run:
            await service._restore_database(dump_file)

        assert mock_run.call_args.args[0] == [
            PG_RESTORE_18,
            "--file",
            os.devnull,
            str(dump_file),
        ]
        service._drop_all_tables.assert_awaited_once()
        service._restore_with_pg_restore.assert_awaited_once()
        service._restore_with_native_psql.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_archive_renamed_to_sql_still_goes_to_pg_restore(
        self, service, tmp_path, completed_process
    ):
        renamed = tmp_path / "database_backup_20261127_100000.sql"
        renamed.write_bytes(b"PGDMP\x01\x0e")

        with patch("subprocess.run", return_value=completed_process()):
            await service._restore_database(renamed)

        service._restore_with_pg_restore.assert_awaited_once()
        service._restore_with_native_psql.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_truncated_dump_aborts_before_dropping_tables(
        self, service, dump_file
    ):
        error = subprocess.CalledProcessError(
            1, ["pg_restore"], stderr="pg_restore: error: could not read input file"
        )

        with patch("subprocess.run", side_effect=error):
            with pytest.raises(Exception, match="could not read input file"):
                await service._restore_database(dump_file)

        service._drop_all_tables.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unreadable_dump_aborts_before_dropping_tables(
        self, service, dump_file
    ):
        error = subprocess.CalledProcessError(
            1, ["pg_restore"], stderr="input file does not appear to be a valid archive"
        )

        with patch("subprocess.run", side_effect=error):
            with pytest.raises(Exception, match="not appear to be a valid archive"):
                await service._restore_database(dump_file)

        service._drop_all_tables.assert_not_awaited()
        service._restore_with_pg_restore.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_too_new_dump_aborts_before_dropping_tables(self, service, dump_file):
        error = subprocess.CalledProcessError(1, ["pg_restore"], stderr=TOO_NEW)

        with patch("subprocess.run", side_effect=error):
            with pytest.raises(Exception, match="newer pg_dump"):
                await service._restore_database(dump_file)

        service._drop_all_tables.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_legacy_sql_still_restores_with_psql(self, service, tmp_path):
        legacy = tmp_path / "database_backup_20250101_000000.sql"
        legacy.write_text("SELECT 1;")

        with patch("subprocess.run") as mock_run:
            await service._restore_database(legacy)

        mock_run.assert_not_called()
        service._restore_with_native_psql.assert_awaited_once()
        service._restore_with_pg_restore.assert_not_awaited()


class TestDumpPreview:
    @pytest.mark.asyncio
    async def test_counts_objects_from_the_table_of_contents(
        self, service, dump_file, completed_process
    ):
        with patch("subprocess.run", return_value=completed_process(TOC)):
            stats = await service._analyze_dump_backup(dump_file)

        assert stats["total_objects"] == 5
        assert stats["table_count"] == 2
        assert stats["file_size"] == dump_file.stat().st_size

    @pytest.mark.asyncio
    async def test_unreadable_dump_reports_an_error(self, service, dump_file):
        error = subprocess.CalledProcessError(1, ["pg_restore"], stderr="bad archive")

        with patch("subprocess.run", side_effect=error):
            stats = await service._analyze_dump_backup(dump_file)

        assert "error" in stats
        assert "total_objects" not in stats

    @pytest.mark.asyncio
    async def test_database_preview_uses_the_table_of_contents(
        self, service, dump_file, completed_process
    ):
        service._get_database_stats = AsyncMock(return_value={})

        with patch("subprocess.run", return_value=completed_process(TOC)):
            preview = await service._preview_database_restore(dump_file)

        assert preview["affected_data"]["backup_content"]["total_objects"] == 5


class TestFullArchiveWithDump:
    @pytest.fixture
    def full_backup(self, tmp_path):
        manifest = json.dumps({"components": {"database": "database.dump"}})
        return _zip(
            tmp_path / "full.zip",
            {"database.dump": "PGDMP", "backup_manifest.json": manifest},
        )

    @pytest.mark.asyncio
    async def test_restores_the_dump_member(self, service, full_backup, tmp_path):
        service.upload_dir = tmp_path / "uploads"
        service._restore_database = AsyncMock(return_value={"restored_size": 0})

        await service._restore_full_backup(full_backup)

        (dump,) = service._restore_database.await_args.args
        assert dump.name == "database.dump"

    @pytest.mark.asyncio
    async def test_prefers_the_dump_when_both_formats_are_present(
        self, service, tmp_path
    ):
        service.upload_dir = tmp_path / "uploads"
        service._restore_database = AsyncMock(return_value={"restored_size": 0})
        backup = _zip(
            tmp_path / "both.zip",
            {"database.sql": "-- dump", "database.dump": "PGDMP"},
        )

        await service._restore_full_backup(backup)

        (dump,) = service._restore_database.await_args.args
        assert dump.name == "database.dump"

    def test_is_readable_as_a_full_backup(self, full_backup, completed_process):
        with patch("subprocess.run", return_value=completed_process()) as mock_run:
            _check_backup_readable(full_backup, "full")

        cmd = mock_run.call_args.args[0]
        assert cmd[:3] == [PG_RESTORE_18, "--file", os.devnull]
        assert Path(cmd[-1]).name == "database.dump"

    def test_unreadable_dump_member_fails_the_check(self, full_backup):
        error = subprocess.CalledProcessError(1, ["pg_restore"], stderr="bad archive")

        with patch("subprocess.run", side_effect=error):
            with pytest.raises(Exception, match="bad archive"):
                _check_backup_readable(full_backup, "full")

    @pytest.mark.asyncio
    async def test_previews_a_database_component(self, service, full_backup, tmp_path):
        service.upload_dir = tmp_path / "uploads"
        service._get_database_stats = AsyncMock(return_value={})

        preview = await service._preview_full_restore(full_backup)

        assert "Database" in preview["affected_data"]["backup_components"]


class TestUploadedDump:
    @pytest.mark.asyncio
    async def test_dump_file_is_a_database_backup(self, service, dump_file):
        assert await service._determine_backup_type(dump_file) == "database"

    @pytest.mark.asyncio
    async def test_zip_with_dump_and_manifest_is_a_full_backup(self, service, tmp_path):
        backup = _zip(
            tmp_path / "full.zip",
            {"database.dump": "PGDMP", "backup_manifest.json": "{}"},
        )

        assert await service._determine_backup_type(backup) == "full"

    @pytest.mark.asyncio
    async def test_uploaded_dump_is_recorded_as_compressed(
        self, service, dump_file, tmp_path
    ):
        service.backup_dir = tmp_path / "backups"

        record = await service.process_uploaded_backup(dump_file, "admin")

        assert record.backup_type == "database"
        assert record.status == "uploaded"
        assert record.compression_used is True


class TestDatabaseBackupReadable:
    def test_dump_is_read_in_full(self, dump_file, completed_process):
        with patch("subprocess.run", return_value=completed_process()) as mock_run:
            _check_backup_readable(dump_file, "database")

        assert mock_run.call_args.args[0] == [
            PG_RESTORE_18,
            "--file",
            os.devnull,
            str(dump_file),
        ]

    def test_unreadable_dump_fails_the_check(self, dump_file):
        error = subprocess.CalledProcessError(1, ["pg_restore"], stderr="bad archive")

        with patch("subprocess.run", side_effect=error):
            with pytest.raises(Exception, match="bad archive"):
                _check_backup_readable(dump_file, "database")

    def test_legacy_sql_is_not_read_by_pg_restore(self, tmp_path):
        legacy = tmp_path / "database_backup_20250101_000000.sql"
        legacy.write_text("SELECT 1;")

        with patch("subprocess.run") as mock_run:
            _check_backup_readable(legacy, "database")

        mock_run.assert_not_called()
