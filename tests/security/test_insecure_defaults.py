"""Regression tests for insecure default configurations.

Covers GHSA-xx23-8fx5-ph4q findings 3, 11, 12.
Finding 5 (admin password) intentionally kept as-is per project decision.
"""
import inspect


KNOWN_INSECURE_SECRETS = [
    "your_default_secret_key",
    "your-secret-key-here",
    "change-me",
    "secret",
]


class TestSecretKeyDefaults:
    """Finding 3: SECRET_KEY must not use known defaults."""

    def test_default_secret_key_is_not_well_known(self):
        """The fallback SECRET_KEY must not be a publicly known value."""
        from app.core.config import Settings

        settings = Settings()
        for insecure in KNOWN_INSECURE_SECRETS:
            assert settings.SECRET_KEY != insecure, (
                f"SECRET_KEY must not be '{insecure}'"
            )

    def test_secret_key_minimum_length(self):
        """SECRET_KEY must be at least 32 characters."""
        from app.core.config import Settings

        settings = Settings()
        assert len(settings.SECRET_KEY) >= 32, (
            "SECRET_KEY must be at least 32 characters"
        )


class TestDebugDefault:
    """Finding 11: DEBUG must default to False."""

    def test_debug_default_string_is_false(self):
        """Verify the source code default for DEBUG is 'False', not 'True'."""
        from app.core import config as config_module

        source = inspect.getsource(config_module)
        assert (
            'os.getenv("DEBUG", "False")' in source
            or "os.getenv('DEBUG', 'False')" in source
        ), "DEBUG must default to 'False' in the source code"


class TestEnableApiDocsDefault:
    """ENABLE_API_DOCS must default to False."""

    def test_enable_api_docs_defaults_to_false(self):
        """ENABLE_API_DOCS should be False when not set in environment."""
        from app.core.config import Settings

        settings = Settings()
        assert settings.ENABLE_API_DOCS is False, (
            "ENABLE_API_DOCS must default to False"
        )


class TestIntegrationSaltDefaults:
    """Finding 12: Integration salts must not use hardcoded defaults."""

    def test_paperless_salt_is_not_hardcoded_default(self):
        """PAPERLESS_SALT must not be the publicly known default."""
        from app.core.config import Settings

        settings = Settings()
        assert settings.PAPERLESS_SALT != "paperless_integration_salt_v1", (
            "PAPERLESS_SALT must not use the hardcoded default"
        )

    def test_papra_salt_is_not_hardcoded_default(self):
        """PAPRA_SALT must not be the publicly known default."""
        from app.core.config import Settings

        settings = Settings()
        assert settings.PAPRA_SALT != "papra_integration_salt_v1", (
            "PAPRA_SALT must not use the hardcoded default"
        )

    def test_salts_are_different_from_each_other(self):
        """Each integration salt should be unique."""
        from app.core.config import Settings

        settings = Settings()
        assert settings.PAPERLESS_SALT != settings.PAPRA_SALT, (
            "PAPERLESS_SALT and PAPRA_SALT must be different"
        )
