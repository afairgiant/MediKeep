"""
Tests for the vaccine library loader (cached JSON reader for
shared/data/vaccine_library.json), mirroring test_library_loader's contract.
"""

import json

import pytest

from app.services import vaccine_library_loader as loader


@pytest.fixture(autouse=True)
def _reset_cache():
    """Every test starts with a cold cache. monkeypatch (where used) restores
    VACCINE_LIBRARY_PATH on its own after each test."""
    loader._vaccine_library_cache = None
    yield
    loader._vaccine_library_cache = None


def _write_library(path, vaccines):
    path.write_text(
        json.dumps({"version": "test", "lastUpdated": "2026-01-01", "vaccines": vaccines}),
        encoding="utf-8",
    )


class TestLoadValidLibrary:
    def test_loads_vaccines_and_version(self):
        # Real library file — exercises the actual production path end to end.
        library = loader.load_vaccine_library()
        assert "vaccines" in library
        assert len(library["vaccines"]) > 0
        assert library.get("version")

    def test_get_vaccine_entries_returns_list(self):
        entries = loader.get_vaccine_entries()
        assert isinstance(entries, list)
        assert all("vaccine_name" in e for e in entries)

    def test_caches_across_calls(self):
        first = loader.load_vaccine_library()
        second = loader.load_vaccine_library()
        assert first is second

    def test_cache_does_not_pick_up_on_disk_changes_within_process_lifetime(
        self, monkeypatch
    ):
        fixture_path = (
            loader._PROJECT_ROOT / "tests" / "services" / "_tmp_loader_fixture.json"
        )
        try:
            _write_library(fixture_path, [{"vaccine_name": "First"}])
            monkeypatch.setattr(loader, "VACCINE_LIBRARY_PATH", fixture_path)

            first = loader.load_vaccine_library()
            assert first["vaccines"][0]["vaccine_name"] == "First"

            _write_library(fixture_path, [{"vaccine_name": "Second"}])
            stale = loader.load_vaccine_library()
            assert stale["vaccines"][0]["vaccine_name"] == "First"
        finally:
            fixture_path.unlink(missing_ok=True)


class TestMissingFile:
    def test_missing_file_raises_file_not_found(self, monkeypatch):
        missing_path = (
            loader._PROJECT_ROOT / "tests" / "services" / "_does_not_exist.json"
        )
        monkeypatch.setattr(loader, "VACCINE_LIBRARY_PATH", missing_path)

        with pytest.raises(FileNotFoundError):
            loader.load_vaccine_library()


class TestPathTraversalGuard:
    def test_path_outside_project_root_is_rejected(self, tmp_path, monkeypatch):
        outside_path = tmp_path / "vaccine_library.json"
        _write_library(outside_path, [{"vaccine_name": "Outside"}])
        monkeypatch.setattr(loader, "VACCINE_LIBRARY_PATH", outside_path)

        with pytest.raises(ValueError):
            loader.load_vaccine_library()
