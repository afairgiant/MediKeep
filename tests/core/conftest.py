import tempfile

import pytest


@pytest.fixture
def unwritable_tempdir(monkeypatch, tmp_path):
    """Point tempfile at a directory that does not exist; yields that path."""
    missing = tmp_path / "missing"
    monkeypatch.setattr(tempfile, "tempdir", str(missing))
    return missing
