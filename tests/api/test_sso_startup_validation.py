"""Tests for the startup validation of SSO_ONLY_MODE / SSO_AUTO_REDIRECT.

The case that matters most is SSO_ONLY_MODE=true with SSO_ENABLED unset. Until this
work it was guarded out twice over - validate_sso_config() returns early when
SSO_ENABLED is false, and its only caller was gated on the same flag - so the
instance booted cleanly into a state where the login form was hidden and SSO did not
exist. That is the compose-file typo the whole validation exists to catch.

Failures are asserted through TestClient's lifespan rather than by calling the
validator directly: the point is that the *app* refuses to come up, and that it does
so from the lifespan hook rather than as an import traceback.
"""

import asyncio
import logging
import os
from contextlib import ExitStack, contextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core import config
from app.core.config import settings
from app.main import app

STARTUP_LOGGER = "medical_records.app.core.startup"

# A provider configuration complete enough for validate_sso_config() to pass.
VALID_SSO = {
    "SSO_ENABLED": True,
    "SSO_PROVIDER_TYPE": "keycloak",
    "SSO_CLIENT_ID": "client-id",
    "SSO_CLIENT_SECRET": "client-secret",
    "SSO_REDIRECT_URI": "https://medikeep.example/auth/sso/callback",
    "SSO_ISSUER_URL": "https://idp.example/realms/medikeep",
}


@contextmanager
def configured(**overrides):
    """Patch settings with a valid SSO config plus the given overrides.

    A context manager rather than a fixture because the patches have to be in
    place *before* TestClient(app) is constructed - the lifespan, and so the
    validation under test, runs on __enter__.
    """
    values = {**VALID_SSO, **overrides}
    with ExitStack() as stack:
        for name, value in values.items():
            stack.enter_context(patch.object(settings, name, value))
        yield


class TestBootFailure:
    @pytest.mark.parametrize("flag", ["SSO_ONLY_MODE", "SSO_AUTO_REDIRECT"])
    def test_a_flag_without_sso_enabled_aborts_the_boot(self, flag):
        with configured(SSO_ENABLED=False, **{flag: True}):
            with pytest.raises(RuntimeError) as excinfo:
                with TestClient(app):
                    pass

        # The message is the deliverable - it is read by a self-hoster whose
        # medical records app will not start - so it has to name the variable.
        assert flag in str(excinfo.value)
        assert "SSO_ENABLED" in str(excinfo.value)

    def test_the_failure_is_logged_before_it_is_raised(self, caplog):
        with configured(SSO_ENABLED=False, SSO_ONLY_MODE=True):
            with caplog.at_level(logging.ERROR, logger=STARTUP_LOGGER):
                with pytest.raises(RuntimeError):
                    with TestClient(app):
                        pass

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "auth_mode_config_invalid" in events
        assert any("STARTUP FAILED" in record.message for record in caplog.records)

    def test_a_flag_with_an_incomplete_provider_config_aborts_the_boot(self):
        with configured(SSO_ONLY_MODE=True, SSO_CLIENT_SECRET=""):
            with pytest.raises(RuntimeError) as excinfo:
                with TestClient(app):
                    pass

        assert "SSO_CLIENT_SECRET" in str(excinfo.value)

    def test_an_incomplete_provider_config_aborts_the_boot_without_any_flag(self):
        """Unchanged behavior, moved. This used to raise at import time.

        SSOService.__init__ validated on construction, and endpoints/sso.py builds
        one at module import, so an operator saw a traceback instead of the
        actionable startup error. The boot must still fail - just from the lifespan.
        """
        with configured(SSO_ISSUER_URL=""):
            with pytest.raises(RuntimeError) as excinfo:
                with TestClient(app):
                    pass

        assert "SSO_ISSUER_URL" in str(excinfo.value)


class TestBootSuccess:
    def test_a_coherent_sso_only_configuration_boots(self):
        with configured(SSO_ONLY_MODE=True, SSO_AUTO_REDIRECT=True):
            with TestClient(app) as booted:
                assert booted.get("/api/v1/auth/sso/config").json()["sso_only"] is True

    def test_the_flags_default_off_and_do_not_affect_startup(self):
        # The regression that matters: an existing deployment sees no change.
        # Every other test in the suite boots this way already.
        assert settings.SSO_ONLY_MODE is False
        assert settings.SSO_AUTO_REDIRECT is False

        with TestClient(app):
            pass


class TestFlagParsing:
    """An unrecognized value fails the boot rather than reading as False.

    `.lower() == "true"` - the idiom every other boolean in config.py uses - reads
    every value other than "true" as False. Here False means password login is still
    accepted, so a silent misparse is a security control failing open, and the
    pairing check above cannot catch it: that only fires when the flag parses True.

    `1`, `yes`, `on` and surrounding whitespace are accepted rather than refused, so
    the cases below are the ones that genuinely cannot be read: a typo, and a `#`
    note that survived its transport. Docker Compose strips unquoted ` #` comments
    and trims whitespace (measured on Compose v5, PR 6), so the note survives only
    when quoted, when no space precedes the hash, or when it arrives by a vehicle
    that does no parsing at all - `docker run -e`, an Unraid field.
    """

    @pytest.fixture(autouse=True)
    def clean_parse_errors(self):
        """_strict_bool records into module state; do not leak it between tests."""
        original = dict(config._AUTH_FLAG_PARSE_ERRORS)
        config._AUTH_FLAG_PARSE_ERRORS.clear()
        yield
        config._AUTH_FLAG_PARSE_ERRORS.clear()
        config._AUTH_FLAG_PARSE_ERRORS.update(original)

    @pytest.mark.parametrize(
        "raw", ["true", "TRUE", "True", "1", "yes", "on", " true "]
    )
    def test_the_spellings_that_mean_on(self, raw):
        with patch.dict(os.environ, {"SSO_ONLY_MODE": raw}):
            assert config._strict_bool("SSO_ONLY_MODE") is True

        assert config._AUTH_FLAG_PARSE_ERRORS == {}

    @pytest.mark.parametrize("raw", ["false", "FALSE", "0", "no", "off", ""])
    def test_the_spellings_that_mean_off(self, raw):
        with patch.dict(os.environ, {"SSO_ONLY_MODE": raw}):
            assert config._strict_bool("SSO_ONLY_MODE") is False

        # "" included deliberately: `SSO_ONLY_MODE=` in a compose file is an unset
        # variable, not a typo, and must not fail anyone's boot.
        assert config._AUTH_FLAG_PARSE_ERRORS == {}

    def test_an_unset_variable_takes_the_default(self):
        with patch.dict(os.environ):
            os.environ.pop("SSO_ONLY_MODE", None)
            assert config._strict_bool("SSO_ONLY_MODE") is False

        assert config._AUTH_FLAG_PARSE_ERRORS == {}

    @pytest.mark.parametrize("raw", ["true # sso only", "1 # sso only", "maybe", "tru"])
    def test_an_unrecognized_value_is_recorded_rather_than_guessed(self, raw):
        with patch.dict(os.environ, {"SSO_ONLY_MODE": raw}):
            config._strict_bool("SSO_ONLY_MODE")

        assert config._AUTH_FLAG_PARSE_ERRORS == {"SSO_ONLY_MODE": raw}

    def test_a_recorded_value_aborts_the_boot(self):
        with configured(AUTH_FLAG_PARSE_ERRORS={"SSO_ONLY_MODE": "true # sso only"}):
            with pytest.raises(RuntimeError) as excinfo:
                with TestClient(app):
                    pass

        # Both halves are the deliverable: the operator has to know which variable
        # and what it was actually set to, or the inline-comment case is invisible.
        message = str(excinfo.value)
        assert "SSO_ONLY_MODE" in message
        assert "true # sso only" in message

    def test_it_aborts_even_though_the_flag_itself_reads_false(self):
        """The case the pairing check cannot reach.

        Everything else in this file is reachable only once a flag parses True. A
        value that failed to parse is not a flag that is off - it is a flag whose
        state nobody knows - and the configuration is otherwise entirely valid, so
        without this check the instance boots clean.
        """
        with configured(
            SSO_ONLY_MODE=False,
            AUTH_FLAG_PARSE_ERRORS={"SSO_ONLY_MODE": "maybe"},
        ):
            with pytest.raises(RuntimeError):
                with TestClient(app):
                    pass

    def test_the_failure_is_logged_before_it_is_raised(self, caplog):
        with configured(AUTH_FLAG_PARSE_ERRORS={"SSO_AUTO_REDIRECT": "maybe"}):
            with caplog.at_level(logging.ERROR, logger=STARTUP_LOGGER):
                with pytest.raises(RuntimeError):
                    with TestClient(app):
                        pass

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "auth_mode_config_invalid" in events

    def test_a_clean_environment_records_nothing(self):
        """The default state: the real settings object carries no parse errors."""
        assert settings.AUTH_FLAG_PARSE_ERRORS == {}


class TestValidationRunsFromTheLifespanNotAtImport:
    def test_importing_the_sso_endpoints_with_an_invalid_config_does_not_raise(self):
        """An invalid config must surface as a logged startup failure, not an
        import traceback.

        Re-importing the module with a broken config is what used to blow up, via
        the module-level SSOService() construction.
        """
        import importlib

        from app.api.v1.endpoints import sso as sso_endpoint

        try:
            with configured(SSO_CLIENT_ID=""):
                importlib.reload(sso_endpoint)
        finally:
            # Reload again with the real config so the module other tests import
            # is not left holding the broken one.
            importlib.reload(sso_endpoint)

    def test_constructing_the_service_with_an_invalid_config_does_not_raise(self):
        from app.services.sso_service import SSOService

        with configured(SSO_CLIENT_SECRET=""):
            SSOService()


class TestSealedInstanceWarning:
    """SSO_ONLY_MODE with registration disabled: warn, never fail.

    The policy itself is a pure method on Settings, so most of this is cheap. What
    is not cheap, and is tested separately below, is *when* startup calls it:
    ALLOW_USER_REGISTRATION is admin-toggleable and persisted in system_settings,
    and the stored value only overrides the env default part-way through startup, so
    a call placed beside the boot-failure validation would report on a value that is
    not in effect.
    """

    @pytest.fixture(autouse=True)
    def restore_registration_setting(self):
        """These tests write ALLOW_USER_REGISTRATION directly; put it back."""
        original = settings.ALLOW_USER_REGISTRATION
        yield
        settings.ALLOW_USER_REGISTRATION = original

    @pytest.mark.parametrize(
        "sso_only, registration_enabled, expected",
        [
            (True, False, True),
            (True, True, False),
            (False, False, False),
            (False, True, False),
        ],
    )
    def test_the_policy(self, sso_only, registration_enabled, expected):
        with configured(SSO_ONLY_MODE=sso_only):
            settings.ALLOW_USER_REGISTRATION = registration_enabled

            events = [event for event, _ in settings.auth_mode_warnings()]

        assert ("sso_only_no_registration_route" in events) is expected

    @staticmethod
    def run_startup(persisted_registration: bool):
        """Run startup_event() to completion with the database work stubbed out.

        `persisted_registration` is what the database says, applied by the stubbed
        load_persisted_settings exactly where the real one applies it.
        """

        def load(_db):
            settings.ALLOW_USER_REGISTRATION = persisted_registration

        scheduler = MagicMock()
        scheduler.start = AsyncMock()

        with patch.dict("os.environ", {"SKIP_MIGRATIONS": "false"}), patch(
            "app.core.database.database.check_database_connection", return_value=True
        ), patch(
            "app.core.startup.check_database_connection", return_value=True
        ), patch(
            "app.core.startup.database_migrations", return_value=True
        ), patch(
            "app.core.startup.create_default_user"
        ), patch(
            "app.core.startup.check_sequences_on_startup", new_callable=AsyncMock
        ), patch(
            "app.core.startup.run_startup_data_migrations"
        ), patch(
            "app.core.persisted_settings.load_persisted_settings", side_effect=load
        ), patch(
            "app.core.utils.test_initialization.ensure_tests_initialized"
        ), patch(
            "app.services.backup_scheduler_service.BackupSchedulerService.get_instance",
            return_value=scheduler,
        ), patch(
            "app.services.medication_reminder_scheduler."
            "MedicationReminderSchedulerService.get_instance",
            return_value=scheduler,
        ):
            from app.core.startup import startup_event

            asyncio.run(startup_event())

    def test_startup_reads_the_value_the_database_supplied(self, caplog):
        """The ordering test, and the reason the mock stack above is worth paying for.

        Env says registration is on; the stored setting says otherwise. If the
        warning were emitted beside the boot-failure validation it would see the env
        value and stay silent.
        """
        with configured(SSO_ONLY_MODE=True):
            settings.ALLOW_USER_REGISTRATION = True
            with caplog.at_level(logging.WARNING, logger=STARTUP_LOGGER):
                self.run_startup(persisted_registration=False)

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "sso_only_no_registration_route" in events

    @staticmethod
    def run_startup_in_test_mode():
        """Run startup_event() with SKIP_MIGRATIONS set, as the test compose file does.

        Barely any stubbing: that flag *is* an early return, and everything above it
        is in-memory.
        """
        with patch.dict("os.environ", {"SKIP_MIGRATIONS": "true"}):
            from app.core.startup import startup_event

            asyncio.run(startup_event())

    def test_skip_migrations_still_warns(self, caplog):
        """The early return must not swallow the warning.

        SKIP_MIGRATIONS returns from startup_event() above the warning site, so a
        deployment running with it set - `tests/docker-compose.test.yml` does, and
        operators can - got no warning at all for the sealed-instance combination.
        That is exactly the configuration that needs saying out loud: nobody can
        create an account by any self-service route.

        Reading the env value here is correct rather than a compromise: with no
        database there is no stored ALLOW_USER_REGISTRATION to override it.
        """
        with configured(SSO_ONLY_MODE=True):
            settings.ALLOW_USER_REGISTRATION = False
            with caplog.at_level(logging.WARNING, logger=STARTUP_LOGGER):
                self.run_startup_in_test_mode()

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "sso_only_no_registration_route" in events

    def test_skip_migrations_stays_silent_when_there_is_nothing_to_warn_about(
        self, caplog
    ):
        with configured(SSO_ONLY_MODE=True):
            settings.ALLOW_USER_REGISTRATION = True
            with caplog.at_level(logging.WARNING, logger=STARTUP_LOGGER):
                self.run_startup_in_test_mode()

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "sso_only_no_registration_route" not in events

    def test_the_sealed_combination_does_not_fail_the_boot(self):
        with configured(SSO_ONLY_MODE=True, SSO_ENABLED=True):
            settings.ALLOW_USER_REGISTRATION = False
            with TestClient(app):
                pass
