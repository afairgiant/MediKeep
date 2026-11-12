"""Tests for the DATABASE_URL parsing that feeds pg_dump and psql."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

from app.core.config import encode_url_credential
from app.core.utils.security import SecurityValidator

REPO_ROOT = Path(__file__).resolve().parents[2]

SPECIAL_PASSWORDS = [
    "ab%cd",
    "p@ss:word",
    "a/b#c?d",
    "x&y+z=w",
    "dollar$bang!",
    "has space",
    "100%",
    "plain",
]


def _url(user: str, password: str, host: str = "db", database: str = "medapp") -> str:
    return (
        f"postgresql://{encode_url_credential(user)}:"
        f"{encode_url_credential(password)}@{host}:5432/{database}"
    )


class TestEncodeUrlCredential:
    @pytest.mark.parametrize("password", SPECIAL_PASSWORDS)
    def test_engine_decodes_back_to_original(self, password):
        assert make_url(_url("medapp", password)).password == password


class TestComposedDatabaseUrl:
    def test_settings_url_round_trips_db_credentials(self):
        """Settings builds DATABASE_URL at import, so read it in a clean interpreter."""
        user, password = "med user", "p@ss w%rd:/#?&+=$!"
        env = {
            k: v
            for k, v in os.environ.items()
            if k not in ("DATABASE_URL", "DATABASE_URL_FILE")
            and not k.startswith("DB_")
        }
        env.update(
            DB_USER=user,
            DB_PASSWORD=password,
            DB_HOST="db",
            DB_PORT="5432",
            DB_NAME="medapp",
        )
        script = (
            "import json, dotenv;"
            "dotenv.load_dotenv = lambda *a, **k: None;"
            "from sqlalchemy.engine import make_url;"
            "from app.core.config import settings;"
            "u = make_url(settings.DATABASE_URL);"
            "print('URL=' + json.dumps([u.username, u.password, u.host]))"
        )

        result = subprocess.run(
            [sys.executable, "-c", script],
            env=env,
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )

        line = next(
            (ln for ln in result.stdout.splitlines() if ln.startswith("URL=")), None
        )
        assert line, result.stdout + result.stderr
        assert json.loads(line[4:]) == [user, password, "db"]


class TestValidateConnectionParams:
    @pytest.mark.parametrize("password", SPECIAL_PASSWORDS)
    def test_password_is_decoded(self, password):
        params = SecurityValidator.validate_connection_params(_url("medapp", password))

        assert params["password"] == password

    def test_extracts_components(self):
        params = SecurityValidator.validate_connection_params(
            "postgresql://medapp:secret@db.example:6543/records"
        )

        assert params["hostname"] == "db.example"
        assert params["port"] == "6543"
        assert params["username"] == "medapp"
        assert params["database"] == "records"

    def test_accepts_driver_suffix(self):
        params = SecurityValidator.validate_connection_params(
            "postgresql+psycopg2://medapp:secret@db:5432/medapp"
        )

        assert params["password"] == "secret"

    def test_missing_password_is_empty(self):
        params = SecurityValidator.validate_connection_params(
            "postgresql://medapp@db:5432/medapp"
        )

        assert params["password"] == ""

    def test_defaults_port(self):
        params = SecurityValidator.validate_connection_params(
            "postgresql://medapp:secret@db/medapp"
        )

        assert params["port"] == "5432"

    def test_empty_url_raises(self):
        with pytest.raises(ValueError, match="not configured"):
            SecurityValidator.validate_connection_params("")

    def test_malformed_url_raises(self):
        with pytest.raises(ValueError, match="Invalid DATABASE_URL"):
            SecurityValidator.validate_connection_params("not a url")

    def test_unsafe_username_rejected(self):
        with pytest.raises(ValueError, match="Unsafe username"):
            SecurityValidator.validate_connection_params(_url("bad;user", "secret"))

    def test_unsafe_database_rejected(self):
        with pytest.raises(ValueError, match="Unsafe database name"):
            SecurityValidator.validate_connection_params(
                "postgresql://medapp:secret@db:5432/bad-db"
            )
