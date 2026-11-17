"""Tests for the SECRET_KEY validation warnings in app.core.config."""

import logging
from unittest.mock import patch

import pytest

from app.core import config

LOGGER_NAME = "app.core.config"


def _resolve(key, caplog):
    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        with patch.object(config, "get_secret", return_value=key):
            result = config._get_secret_key()
    warnings = [r.getMessage() for r in caplog.records if r.name == LOGGER_NAME]
    return result, warnings


class TestSecretKeyWarnings:
    @pytest.mark.parametrize(
        "key, expected",
        [
            ("", "SECRET_KEY is not set."),
            ("change-me", "known insecure default"),
            ("a1234567890123456XX", "shorter than the 32-character minimum"),
            ("x" * 31, "shorter than the 32-character minimum"),
        ],
    )
    def test_warning_names_the_actual_problem(self, key, expected, caplog):
        (resolved, is_ephemeral), warnings = _resolve(key, caplog)

        assert is_ephemeral is True
        assert resolved != key
        assert len(warnings) == 1
        assert expected in warnings[0]

    def test_warning_tells_user_how_to_fix_it(self, caplog):
        _, warnings = _resolve("short", caplog)

        assert "at least 32 characters" in warnings[0]
        assert "secrets.token_urlsafe" in warnings[0]

    def test_warning_does_not_leak_the_configured_key(self, caplog):
        key = "leak-check-marker-too-short"
        _, warnings = _resolve(key, caplog)

        assert warnings
        assert key not in warnings[0]

    def test_key_at_minimum_length_is_accepted_without_warning(self, caplog):
        key = "x" * config.MIN_SECRET_KEY_LENGTH
        (resolved, is_ephemeral), warnings = _resolve(key, caplog)

        assert (resolved, is_ephemeral) == (key, False)
        assert warnings == []
