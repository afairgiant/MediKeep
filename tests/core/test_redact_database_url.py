"""Tests for masking the password in DATABASE_URL before it is logged or printed."""

import pytest

from app.core.config import encode_url_credential
from app.core.utils.security import redact_database_url


class TestRedactDatabaseUrl:
    @pytest.mark.parametrize("password", ["secret", "ab%cd", "p@ss:w/d#?", "a b"])
    def test_password_is_masked(self, password):
        url = f"postgresql://medapp:{encode_url_credential(password)}@db:5432/medapp"

        rendered = redact_database_url(url)

        assert password not in rendered
        assert encode_url_credential(password) not in rendered
        assert rendered == "postgresql://medapp:***@db:5432/medapp"

    def test_url_without_password_is_unchanged(self):
        url = "postgresql://medapp@db:5432/medapp"

        assert redact_database_url(url) == url

    def test_unparseable_url_is_not_echoed(self):
        assert redact_database_url("not a url") == "<unparseable DATABASE_URL>"
