"""Tests for the startup warning about an unwritable temp directory (#1255)."""

import tempfile

from app.core.startup import _warn_if_temp_dir_unwritable
from tests.utils.log_output import records_with_event


def test_warns_when_temp_dir_unwritable(unwritable_tempdir, caplog):
    with caplog.at_level("WARNING"):
        _warn_if_temp_dir_unwritable()

    warnings = records_with_event(caplog, "temp_dir_unwritable")
    assert len(warnings) == 1
    assert "/tmp" in warnings[0].getMessage()


def test_silent_when_temp_dir_writable(monkeypatch, tmp_path, caplog):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))

    with caplog.at_level("WARNING"):
        _warn_if_temp_dir_unwritable()

    assert not records_with_event(caplog, "temp_dir_unwritable")
