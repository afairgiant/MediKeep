"""Admin settings API and the persisted-settings registry behind it.

Saved settings must survive a restart, and a failed update must not half-apply.
"""

import logging

import pytest

from app.core import auth_mode, persisted_settings
from app.core.auth_mode import SEALED_INSTANCE_EVENT
from app.core.config import Settings, settings
from app.core.persisted_settings import (
    KEY_ALLOW_USER_REGISTRATION,
    KEY_BACKUP_MAX_COUNT,
    KEY_BACKUP_MIN_COUNT,
    KEY_BACKUP_RETENTION_DAYS,
    KEY_RELEASE_CHECK_ENABLED,
    KEY_TRASH_RETENTION_DAYS,
    KEY_WHATS_NEW_POPUP_ENABLED,
    PERSISTED_SETTINGS,
    SettingValidationError,
    apply_setting_changes,
    describe_settings,
    load_persisted_settings,
    persist_setting,
)
from app.crud.system_setting import system_setting

SETTINGS_URL = "/api/v1/admin/settings"

_TOUCHED_ATTRS = (
    "ALLOW_USER_REGISTRATION",
    "SSO_ONLY_MODE",
    "BACKUP_RETENTION_DAYS",
    "TRASH_RETENTION_DAYS",
    "BACKUP_MIN_COUNT",
    "BACKUP_MAX_COUNT",
    "RELEASE_CHECK_ENABLED",
    "WHATS_NEW_POPUP_ENABLED",
)


@pytest.fixture
def restore_settings():
    """Snapshot and restore the mutable Settings attributes touched in tests."""
    snapshot = {attr: getattr(settings, attr) for attr in _TOUCHED_ATTRS}
    try:
        yield
    finally:
        for attr, value in snapshot.items():
            setattr(settings, attr, value)


def _patch(client, changes):
    return client.patch(SETTINGS_URL, json={"changes": changes})


class TestGetSettings:
    def test_lists_every_registry_entry(self, admin_client, restore_settings):
        response = admin_client.get(SETTINGS_URL)

        assert response.status_code == 200
        assert set(response.json()["settings"]) == set(PERSISTED_SETTINGS)

    def test_entry_shape(self, admin_client, restore_settings):
        settings.TRASH_RETENTION_DAYS = 12

        entry = admin_client.get(SETTINGS_URL).json()["settings"][
            KEY_TRASH_RETENTION_DAYS
        ]

        assert entry["value"] == 12
        assert entry["fallback"] == Settings.TRASH_RETENTION_DAYS
        assert entry["min"] == 1
        assert entry["max"] == 365

    def test_bool_stays_bool(self, admin_client, restore_settings):
        entry = admin_client.get(SETTINGS_URL).json()["settings"][
            KEY_ALLOW_USER_REGISTRATION
        ]
        assert isinstance(entry["value"], bool)

    def test_deployment_is_the_fixed_allowlist(self, admin_client):
        from app.api.v1.admin.settings import DEPLOYMENT_SETTINGS

        names = [d["name"] for d in admin_client.get(SETTINGS_URL).json()["deployment"]]

        assert names == list(DEPLOYMENT_SETTINGS)

    def test_non_admin_is_refused(self, authenticated_client):
        assert authenticated_client.get(SETTINGS_URL).status_code == 403
        assert _patch(authenticated_client, {}).status_code == 403


class TestSource:
    def test_default_when_nothing_set(self, db_session, monkeypatch):
        monkeypatch.delenv("TRASH_RETENTION_DAYS", raising=False)

        entry = describe_settings(db_session)[KEY_TRASH_RETENTION_DAYS]

        assert entry["source"] == "default"
        assert entry["fallback_source"] == "default"

    def test_env_when_variable_present(self, db_session, monkeypatch):
        monkeypatch.setenv("TRASH_RETENTION_DAYS", "30")

        entry = describe_settings(db_session)[KEY_TRASH_RETENTION_DAYS]

        assert entry["source"] == "env"
        assert entry["fallback_source"] == "env"

    def test_saved_wins_over_env(self, db_session, monkeypatch, restore_settings):
        monkeypatch.setenv("TRASH_RETENTION_DAYS", "30")
        persist_setting(db_session, KEY_TRASH_RETENTION_DAYS, 9)

        entry = describe_settings(db_session)[KEY_TRASH_RETENTION_DAYS]

        assert entry["source"] == "saved"
        assert entry["fallback_source"] == "env"


class TestPatchPersists:
    def test_disabling_registration_persists(
        self, admin_client, db_session, restore_settings
    ):
        response = _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: False})

        assert response.status_code == 200
        assert (
            system_setting.get_setting(db_session, KEY_ALLOW_USER_REGISTRATION)
            == "false"
        )
        assert settings.ALLOW_USER_REGISTRATION is False

    def test_enabling_registration_persists(
        self, admin_client, db_session, restore_settings
    ):
        settings.ALLOW_USER_REGISTRATION = False

        response = _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: True})

        assert response.status_code == 200
        assert (
            system_setting.get_setting(db_session, KEY_ALLOW_USER_REGISTRATION)
            == "true"
        )
        assert settings.ALLOW_USER_REGISTRATION is True

    def test_release_settings_persist(self, admin_client, db_session, restore_settings):
        response = _patch(
            admin_client,
            {KEY_RELEASE_CHECK_ENABLED: False, KEY_WHATS_NEW_POPUP_ENABLED: False},
        )

        assert response.status_code == 200
        for key in (KEY_RELEASE_CHECK_ENABLED, KEY_WHATS_NEW_POPUP_ENABLED):
            assert system_setting.get_setting(db_session, key) == "false"
        assert settings.RELEASE_CHECK_ENABLED is False
        assert settings.WHATS_NEW_POPUP_ENABLED is False

    def test_retention_days_persist(self, admin_client, db_session, restore_settings):
        response = _patch(
            admin_client,
            {KEY_BACKUP_RETENTION_DAYS: 45, KEY_TRASH_RETENTION_DAYS: 14},
        )

        assert response.status_code == 200
        assert system_setting.get_setting(db_session, KEY_BACKUP_RETENTION_DAYS) == "45"
        assert system_setting.get_setting(db_session, KEY_TRASH_RETENTION_DAYS) == "14"
        assert settings.BACKUP_RETENTION_DAYS == 45
        assert settings.TRASH_RETENTION_DAYS == 14

    def test_backup_counts_persist(self, admin_client, db_session, restore_settings):
        response = _patch(
            admin_client, {KEY_BACKUP_MIN_COUNT: 2, KEY_BACKUP_MAX_COUNT: 20}
        )

        assert response.status_code == 200
        assert settings.BACKUP_MIN_COUNT == 2
        assert settings.BACKUP_MAX_COUNT == 20

    def test_response_reports_updated_keys_and_fresh_state(
        self, admin_client, restore_settings
    ):
        body = _patch(admin_client, {KEY_TRASH_RETENTION_DAYS: 21}).json()

        assert body["updated"] == [KEY_TRASH_RETENTION_DAYS]
        assert body["settings"][KEY_TRASH_RETENTION_DAYS]["value"] == 21
        assert body["settings"][KEY_TRASH_RETENTION_DAYS]["source"] == "saved"

    def test_empty_changes_is_a_no_op(self, admin_client, restore_settings):
        response = _patch(admin_client, {})

        assert response.status_code == 200
        assert response.json()["updated"] == []


class TestPatchValidation:
    @pytest.mark.parametrize(
        "changes",
        [
            {KEY_BACKUP_RETENTION_DAYS: 0},
            {KEY_TRASH_RETENTION_DAYS: 366},
            {KEY_BACKUP_MIN_COUNT: 101},
            {KEY_BACKUP_MAX_COUNT: 501},
        ],
        ids=[
            "below-min",
            "trash-above-max",
            "min-count-above-max",
            "max-count-above-max",
        ],
    )
    def test_out_of_bounds_rejected(
        self, admin_client, db_session, restore_settings, changes
    ):
        response = _patch(admin_client, changes)

        assert response.status_code == 400
        key = next(iter(changes))
        assert system_setting.get_setting(db_session, key) is None

    def test_unknown_key_rejected(self, admin_client, restore_settings):
        response = _patch(admin_client, {"not_a_setting": 1})

        assert response.status_code == 400

    def test_bool_for_int_rejected(self, admin_client, db_session, restore_settings):
        response = _patch(admin_client, {KEY_TRASH_RETENTION_DAYS: True})

        assert response.status_code == 400
        assert system_setting.get_setting(db_session, KEY_TRASH_RETENTION_DAYS) is None

    def test_int_for_bool_rejected(self, admin_client, db_session, restore_settings):
        response = _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: 0})

        assert response.status_code == 400
        assert (
            system_setting.get_setting(db_session, KEY_ALLOW_USER_REGISTRATION) is None
        )

    def test_string_rejected_by_schema(self, admin_client, restore_settings):
        response = _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: "not-a-bool"})

        assert response.status_code == 422

    def test_min_above_max_rejected(self, admin_client, db_session, restore_settings):
        settings.BACKUP_MAX_COUNT = 10

        response = _patch(admin_client, {KEY_BACKUP_MIN_COUNT: 11})

        assert response.status_code == 400
        assert system_setting.get_setting(db_session, KEY_BACKUP_MIN_COUNT) is None

    def test_cross_field_uses_pending_values(self, admin_client, restore_settings):
        settings.BACKUP_MAX_COUNT = 10

        response = _patch(
            admin_client, {KEY_BACKUP_MIN_COUNT: 30, KEY_BACKUP_MAX_COUNT: 40}
        )

        assert response.status_code == 200

    def test_existing_conflict_does_not_block_unrelated_save(
        self, admin_client, restore_settings
    ):
        settings.BACKUP_MIN_COUNT = 20
        settings.BACKUP_MAX_COUNT = 10

        response = _patch(admin_client, {KEY_TRASH_RETENTION_DAYS: 15})

        assert response.status_code == 200

    def test_mid_update_validation_failure_is_atomic(
        self, admin_client, db_session, restore_settings
    ):
        """A valid field plus a later invalid field must not partially persist."""
        before = settings.BACKUP_RETENTION_DAYS

        response = _patch(
            admin_client, {KEY_BACKUP_RETENTION_DAYS: 9, KEY_BACKUP_MIN_COUNT: 0}
        )

        assert response.status_code == 400
        assert system_setting.get_setting(db_session, KEY_BACKUP_RETENTION_DAYS) is None
        assert settings.BACKUP_RETENTION_DAYS == before

    def test_mid_loop_db_failure_rolls_back_all_rows(
        self, admin_client, db_session, restore_settings, monkeypatch
    ):
        """A DB failure after the first row commits nothing and changes no memory."""
        calls = {"n": 0}
        real_persist = persisted_settings.persist_setting

        def flaky_persist(db, key, value, commit=True):
            calls["n"] += 1
            if calls["n"] == 2:
                raise RuntimeError("simulated DB failure")
            return real_persist(db, key, value, commit=commit)

        monkeypatch.setattr(persisted_settings, "persist_setting", flaky_persist)
        before_retention = settings.BACKUP_RETENTION_DAYS
        before_trash = settings.TRASH_RETENTION_DAYS

        response = _patch(
            admin_client, {KEY_BACKUP_RETENTION_DAYS: 77, KEY_TRASH_RETENTION_DAYS: 33}
        )

        assert response.status_code == 500
        assert "simulated" not in response.text
        assert system_setting.get_setting(db_session, KEY_BACKUP_RETENTION_DAYS) is None
        assert system_setting.get_setting(db_session, KEY_TRASH_RETENTION_DAYS) is None
        assert settings.BACKUP_RETENTION_DAYS == before_retention
        assert settings.TRASH_RETENTION_DAYS == before_trash


class TestReset:
    def test_null_deletes_row_and_restores_fallback(
        self, admin_client, db_session, restore_settings, monkeypatch
    ):
        monkeypatch.delenv("TRASH_RETENTION_DAYS", raising=False)
        _patch(admin_client, {KEY_TRASH_RETENTION_DAYS: 5})

        response = _patch(admin_client, {KEY_TRASH_RETENTION_DAYS: None})

        assert response.status_code == 200
        assert system_setting.get_setting(db_session, KEY_TRASH_RETENTION_DAYS) is None
        assert settings.TRASH_RETENTION_DAYS == Settings.TRASH_RETENTION_DAYS
        entry = response.json()["settings"][KEY_TRASH_RETENTION_DAYS]
        assert entry["source"] == "default"

    def test_reset_of_unsaved_key_is_harmless(self, admin_client, restore_settings):
        response = _patch(admin_client, {KEY_TRASH_RETENTION_DAYS: None})

        assert response.status_code == 200
        assert settings.TRASH_RETENTION_DAYS == Settings.TRASH_RETENTION_DAYS

    def test_reset_of_bool_restores_fallback(self, db_session, restore_settings):
        apply_setting_changes(
            db_session,
            {KEY_ALLOW_USER_REGISTRATION: not Settings.ALLOW_USER_REGISTRATION},
        )

        apply_setting_changes(db_session, {KEY_ALLOW_USER_REGISTRATION: None})

        assert settings.ALLOW_USER_REGISTRATION is Settings.ALLOW_USER_REGISTRATION

    def test_reset_is_checked_against_cross_field_rules(
        self, db_session, restore_settings
    ):
        settings.BACKUP_MAX_COUNT = Settings.BACKUP_MIN_COUNT - 1

        with pytest.raises(SettingValidationError):
            apply_setting_changes(db_session, {KEY_BACKUP_MIN_COUNT: None})


class TestLoadPersistedSettings:
    """load_persisted_settings() rehydrates the in-memory Settings on startup."""

    def test_overrides_defaults(self, db_session, restore_settings):
        persist_setting(db_session, KEY_ALLOW_USER_REGISTRATION, False)
        persist_setting(db_session, KEY_BACKUP_RETENTION_DAYS, 99)
        settings.ALLOW_USER_REGISTRATION = True
        settings.BACKUP_RETENTION_DAYS = 1

        load_persisted_settings(db_session)

        assert settings.ALLOW_USER_REGISTRATION is False
        assert settings.BACKUP_RETENTION_DAYS == 99

    def test_noop_when_table_empty(self, db_session, restore_settings):
        settings.ALLOW_USER_REGISTRATION = True
        settings.BACKUP_RETENTION_DAYS = 7

        load_persisted_settings(db_session)

        assert settings.ALLOW_USER_REGISTRATION is True
        assert settings.BACKUP_RETENTION_DAYS == 7

    def test_malformed_int_is_skipped(self, db_session, restore_settings):
        """Bad stored data must not crash startup."""
        system_setting.set_setting(db_session, KEY_BACKUP_RETENTION_DAYS, "not-an-int")
        settings.BACKUP_RETENTION_DAYS = 30

        load_persisted_settings(db_session)

        assert settings.BACKUP_RETENTION_DAYS == 30

    def test_malformed_bool_is_skipped(self, db_session, restore_settings):
        system_setting.set_setting(db_session, KEY_ALLOW_USER_REGISTRATION, "nope")
        settings.ALLOW_USER_REGISTRATION = True

        load_persisted_settings(db_session)

        assert settings.ALLOW_USER_REGISTRATION is True

    def test_semantically_invalid_int_is_skipped(self, db_session, restore_settings):
        system_setting.set_setting(db_session, KEY_BACKUP_RETENTION_DAYS, "0")
        settings.BACKUP_RETENTION_DAYS = 30

        load_persisted_settings(db_session)

        assert settings.BACKUP_RETENTION_DAYS == 30

    def test_value_above_write_bound_still_loads(self, db_session, restore_settings):
        """Bounds apply to admin writes only, so an older stored value is kept."""
        system_setting.set_setting(db_session, KEY_TRASH_RETENTION_DAYS, "730")
        settings.TRASH_RETENTION_DAYS = 30

        load_persisted_settings(db_session)

        assert settings.TRASH_RETENTION_DAYS == 730

    def test_persist_setting_rejects_unknown_key(self, db_session, restore_settings):
        with pytest.raises(KeyError):
            persist_setting(db_session, "not_a_real_setting", "value")


class TestSealedInstanceWarningAtTheToggle:
    """Turning registration off under SSO-only warns, as the boot-time check does."""

    def test_sealing_the_instance_returns_the_warning(
        self, admin_client, restore_settings
    ):
        settings.SSO_ONLY_MODE = True

        response = _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: False})

        assert response.status_code == 200
        codes = [w["code"] for w in response.json()["warnings"]]
        assert codes == [SEALED_INSTANCE_EVENT]

    def test_it_is_logged_as_well_as_returned(
        self, admin_client, restore_settings, caplog
    ):
        settings.SSO_ONLY_MODE = True

        with caplog.at_level(logging.WARNING, logger="medical_records.app"):
            _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: False})

        events = [getattr(record, "event", None) for record in caplog.records]
        assert SEALED_INSTANCE_EVENT in events

    def test_no_warning_when_sso_only_is_off(self, admin_client, restore_settings):
        settings.SSO_ONLY_MODE = False

        response = _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: False})

        assert response.json()["warnings"] == []

    def test_no_warning_when_registration_is_being_enabled(
        self, admin_client, restore_settings
    ):
        settings.SSO_ONLY_MODE = True

        response = _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: True})

        assert response.json()["warnings"] == []

    def test_no_warning_when_registration_is_not_part_of_the_update(
        self, admin_client, restore_settings
    ):
        settings.SSO_ONLY_MODE = True
        settings.ALLOW_USER_REGISTRATION = False

        response = _patch(admin_client, {KEY_TRASH_RETENTION_DAYS: 45})

        assert response.json()["warnings"] == []

    def test_the_toggle_still_succeeds_when_it_warns(
        self, admin_client, db_session, restore_settings
    ):
        """Warn, never refuse: a sealed instance is a legitimate configuration."""
        settings.SSO_ONLY_MODE = True

        _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: False})

        assert settings.ALLOW_USER_REGISTRATION is False
        assert (
            system_setting.get_setting(db_session, KEY_ALLOW_USER_REGISTRATION)
            == "false"
        )

    def test_the_message_matches_the_startup_one(self, admin_client, restore_settings):
        """Compared against the source, so this fails if either wording is edited alone."""
        settings.SSO_ONLY_MODE = True

        response = _patch(admin_client, {KEY_ALLOW_USER_REGISTRATION: False})

        expected = dict(auth_mode.warnings())[SEALED_INSTANCE_EVENT]
        assert response.json()["warnings"][0]["message"] == expected
