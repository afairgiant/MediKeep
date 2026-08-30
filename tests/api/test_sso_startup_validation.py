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

from app.core import auth_mode, config
from app.core.auth_mode import no_local_password_warning
from app.core.config import settings
from app.main import app
from app.models.user import User

STARTUP_LOGGER = "medical_records.app.core.startup"
AUTH_MODE_LOGGER = "medical_records.app.core.auth_mode"

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


@contextmanager
def configured_and_captured(caplog, level=logging.WARNING, **overrides):
    """configured() plus caplog scoped to the startup logger.

    The pairing every startup-emission test below needs.
    """
    with configured(**overrides):
        with caplog.at_level(level, logger=STARTUP_LOGGER):
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

            events = [event for event, _ in auth_mode.warnings()]

        assert ("sso_only_no_registration_route" in events) is expected

    @staticmethod
    def run_startup(persisted_registration: bool, no_local_password=None):
        """Run startup_event() to completion with the database work stubbed out.

        `persisted_registration` is what the database says, applied by the stubbed
        load_persisted_settings exactly where the real one applies it.
        `no_local_password` stubs 8c's account query - database work too, and a real
        one here leaves a pooled SQLite connection holding the test file open.
        """

        def load(_db):
            settings.ALLOW_USER_REGISTRATION = persisted_registration

        no_local_password_patch = (
            {"side_effect": no_local_password}
            if callable(no_local_password)
            else {"return_value": no_local_password}
        )

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
            "app.core.auth_mode.no_local_password_warning",
            **no_local_password_patch,
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


def make_user(db, username, auth_method, is_active=True):
    """Persist a minimal user with the given auth_method."""
    user = User(
        username=username,
        email=f"{username}@example.test",
        password_hash="not-a-real-hash",
        full_name=username,
        role="user",
        auth_method=auth_method,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    return user


class TestHasUsablePasswordIsQueryable:
    """One definition has to serve both the instance and the filter.

    It was a plain property, so the rule could only be evaluated in Python. 8c needs
    it in SQL, and writing the same auth_method != 'sso' a second time is how the two
    quietly diverge.
    """

    def test_it_resolves_on_an_instance(self, db_session):
        assert make_user(db_session, "alice", "sso").has_usable_password is False
        assert make_user(db_session, "bob", "local").has_usable_password is True
        assert make_user(db_session, "carol", "hybrid").has_usable_password is True

    def test_it_resolves_inside_a_filter(self, db_session):
        make_user(db_session, "alice", "sso")
        make_user(db_session, "bob", "local")
        make_user(db_session, "carol", "hybrid")

        names = {
            u.username
            for u in db_session.query(User).filter(User.has_usable_password).all()
        }

        assert names == {"bob", "carol"}


class TestNoLocalPasswordWarning:
    """SSO_ONLY_MODE on an instance where no account can answer a password prompt.

    Break-glass step 1 says to unset the flag and sign in locally. Where every
    account came from the provider there is no password to sign in with, so that
    step recovers nothing and recovery needs a shell on the host.
    """

    @pytest.fixture(autouse=True)
    def restore_auth_settings(self):
        original = (settings.SSO_ONLY_MODE, settings.ALLOW_USER_REGISTRATION)
        yield
        settings.SSO_ONLY_MODE, settings.ALLOW_USER_REGISTRATION = original

    def test_warns_when_every_account_is_sso(self, db_session):
        make_user(db_session, "alice", "sso")
        make_user(db_session, "bob", "sso")

        with configured(SSO_ONLY_MODE=True):
            warning = no_local_password_warning(db_session)

        assert warning is not None
        assert warning[0] == auth_mode.NO_LOCAL_PASSWORD_EVENT

    @pytest.mark.parametrize("auth_method", ["local", "hybrid"])
    def test_silent_when_one_account_can_answer(self, db_session, auth_method):
        make_user(db_session, "alice", "sso")
        make_user(db_session, "bob", auth_method)

        with configured(SSO_ONLY_MODE=True):
            assert no_local_password_warning(db_session) is None

    def test_a_deactivated_local_admin_still_suppresses_it(self, db_session):
        """Counts accounts, not sessions.

        Being disabled is reversible from the same shell that would run the
        emergency script, so it is not the situation this warns about.
        """
        make_user(db_session, "alice", "sso")
        make_user(db_session, "bob", "local", is_active=False)

        with configured(SSO_ONLY_MODE=True):
            assert no_local_password_warning(db_session) is None

    def test_silent_when_the_flag_is_off(self, db_session):
        make_user(db_session, "alice", "sso")

        with configured(SSO_ONLY_MODE=False):
            assert no_local_password_warning(db_session) is None

    def test_startup_emits_it(self, caplog):
        warning = (
            auth_mode.NO_LOCAL_PASSWORD_EVENT,
            auth_mode.NO_LOCAL_PASSWORD_MESSAGE,
        )
        with configured_and_captured(caplog, SSO_ONLY_MODE=True):
            TestSealedInstanceWarning.run_startup(
                persisted_registration=True, no_local_password=warning
            )

        events = [getattr(record, "event", None) for record in caplog.records]
        assert auth_mode.NO_LOCAL_PASSWORD_EVENT in events

    def test_skip_migrations_stays_silent(self, caplog):
        """No database means no session, so the check that needs one is skipped."""
        with configured_and_captured(caplog, SSO_ONLY_MODE=True):
            settings.ALLOW_USER_REGISTRATION = True
            TestSealedInstanceWarning.run_startup_in_test_mode()

        events = [getattr(record, "event", None) for record in caplog.records]
        assert auth_mode.NO_LOCAL_PASSWORD_EVENT not in events

    def test_a_failing_query_warns_rather_than_aborting_the_boot(self, caplog):
        """Failing the boot here would turn a recoverable instance into a dead one."""

        def boom(_db):
            raise RuntimeError("database is on fire")

        # Scoped to auth_mode, not startup: the collector isolates each check there.
        with configured(SSO_ONLY_MODE=True):
            with caplog.at_level(logging.WARNING, logger=AUTH_MODE_LOGGER):
                TestSealedInstanceWarning.run_startup(
                    persisted_registration=True, no_local_password=boom
                )

        assert "database is on fire" in caplog.text


class TestEffectiveAuthModeLogged:
    """A clean boot has to say which mode it came up in.

    Strict parsing catches a value the app cannot read. It cannot catch a perfectly
    valid value that came from a file the operator was not editing, which is the
    ordinary self-hosted mistake and looks identical in the log without this line.
    """

    @pytest.fixture(autouse=True)
    def restore_registration_setting(self):
        original = settings.ALLOW_USER_REGISTRATION
        yield
        settings.ALLOW_USER_REGISTRATION = original

    @staticmethod
    def auth_mode_record(caplog):
        for record in caplog.records:
            if getattr(record, "event", None) == "auth_mode_configured":
                return record
        return None

    def test_emitted_with_the_flags_off(self, caplog):
        with configured_and_captured(
            caplog,
            logging.INFO,
            SSO_ENABLED=False,
            SSO_ONLY_MODE=False,
            SSO_AUTO_REDIRECT=False,
        ):
            TestSealedInstanceWarning.run_startup(persisted_registration=True)

        record = self.auth_mode_record(caplog)
        assert record is not None
        assert record.sso_only_mode is False

    def test_emitted_with_the_flags_on(self, caplog):
        with configured_and_captured(
            caplog, logging.INFO, SSO_ONLY_MODE=True, SSO_AUTO_REDIRECT=True
        ):
            TestSealedInstanceWarning.run_startup(persisted_registration=True)

        record = self.auth_mode_record(caplog)
        assert record is not None
        assert record.sso_only_mode is True
        assert record.sso_auto_redirect is True

    def test_the_values_are_in_the_message_not_only_the_extras(self, caplog):
        """The console formatter only appends extra fields at WARNING+.

        An info line carrying its values only in extra reaches the JSON log and never
        reaches docker logs, which is the one place a locked-out operator can look.
        """
        with configured_and_captured(caplog, logging.INFO, SSO_ONLY_MODE=True):
            TestSealedInstanceWarning.run_startup(persisted_registration=True)

        message = self.auth_mode_record(caplog).getMessage()
        assert "sso_only_mode=True" in message
        assert "sso_enabled=True" in message

    def test_it_reports_the_persisted_registration_value(self, caplog):
        """Env says on, the database says off; the line must report what is in force."""
        with configured_and_captured(caplog, logging.INFO, SSO_ONLY_MODE=True):
            settings.ALLOW_USER_REGISTRATION = True
            TestSealedInstanceWarning.run_startup(persisted_registration=False)

        assert self.auth_mode_record(caplog).allow_user_registration is False

    def test_it_carries_no_secret(self, caplog):
        with configured_and_captured(
            caplog,
            logging.INFO,
            SSO_ONLY_MODE=True,
            SSO_CLIENT_SECRET="super-secret-value",
        ):
            TestSealedInstanceWarning.run_startup(persisted_registration=True)

        record = self.auth_mode_record(caplog)
        assert "super-secret-value" not in record.getMessage()
        assert "super-secret-value" not in str(record.__dict__)

    def test_emitted_on_the_skip_migrations_path(self, caplog):
        with configured_and_captured(caplog, logging.INFO, SSO_ONLY_MODE=True):
            settings.ALLOW_USER_REGISTRATION = True
            TestSealedInstanceWarning.run_startup_in_test_mode()

        assert self.auth_mode_record(caplog) is not None
