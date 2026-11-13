"""Tests for the database diagnostic CLI's handling of credentials in DATABASE_URL."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import encode_url_credential
from app.scripts import check_database_type as script

PASSWORD = "p@ss w%rd"
URL = (
    f"postgresql://{encode_url_credential('med user')}:"
    f"{encode_url_credential(PASSWORD)}@db.internal:6543/records"
)


@pytest.fixture
def unreachable_postgres():
    engine = MagicMock()
    engine.connect.side_effect = RuntimeError("connection refused")
    with patch.object(
        script, "db_config", SimpleNamespace(database_url=URL)
    ), patch.object(script, "engine", engine):
        yield


@pytest.mark.usefixtures("unreachable_postgres")
class TestCheckDatabaseType:
    def test_reported_url_masks_the_password(self):
        info = script.check_database_type()

        assert PASSWORD not in str(info)
        assert encode_url_credential(PASSWORD) not in str(info)
        assert ":***@" in info["database_url"]

    def test_components_are_decoded(self):
        info = script.check_database_type()

        assert info["user"] == "med user"
        assert info["host"] == "db.internal"
        assert info["port"] == "6543"
        assert info["database_name"] == "records"

    def test_printed_status_masks_the_password(self, capsys, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", URL)

        script.print_database_status()

        out = capsys.readouterr().out
        assert PASSWORD not in out
        assert encode_url_credential(PASSWORD) not in out
