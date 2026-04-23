"""Tests that admin retention/registration settings persist across restarts.

Regression coverage for the bug where toggling "New User Registration" in
the admin UI reverted on app restart: the endpoint used to mutate only the
in-memory `settings` object. It now also writes to `system_settings`, and
startup rehydrates `settings` from that table via `load_persisted_settings`.
"""

import pytest

from app.core.config import settings
from app.core.persisted_settings import (
    KEY_ALLOW_USER_REGISTRATION,
    KEY_BACKUP_MAX_COUNT,
    KEY_BACKUP_MIN_COUNT,
    KEY_BACKUP_RETENTION_DAYS,
    KEY_TRASH_RETENTION_DAYS,
    load_persisted_settings,
    persist_setting,
)
from app.crud.system_setting import system_setting


RETENTION_URL = "/api/v1/admin/backups/settings/retention"


@pytest.fixture
def restore_settings():
    """Snapshot and restore the mutable Settings attributes touched in tests."""
    snapshot = {
        "ALLOW_USER_REGISTRATION": settings.ALLOW_USER_REGISTRATION,
        "BACKUP_RETENTION_DAYS": settings.BACKUP_RETENTION_DAYS,
        "TRASH_RETENTION_DAYS": settings.TRASH_RETENTION_DAYS,
        "BACKUP_MIN_COUNT": settings.BACKUP_MIN_COUNT,
        "BACKUP_MAX_COUNT": settings.BACKUP_MAX_COUNT,
    }
    try:
        yield
    finally:
        for attr, value in snapshot.items():
            setattr(settings, attr, value)


class TestEndpointPersistsToDb:
    """POST /api/v1/admin/backups/settings/retention writes to system_settings."""

    def test_disabling_registration_persists(
        self, admin_client, db_session, restore_settings
    ):
        response = admin_client.post(
            RETENTION_URL, json={"allow_user_registration": False}
        )
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
        response = admin_client.post(
            RETENTION_URL, json={"allow_user_registration": True}
        )
        assert response.status_code == 200

        assert (
            system_setting.get_setting(db_session, KEY_ALLOW_USER_REGISTRATION)
            == "true"
        )
        assert settings.ALLOW_USER_REGISTRATION is True

    def test_retention_days_persist(self, admin_client, db_session, restore_settings):
        response = admin_client.post(
            RETENTION_URL,
            json={"backup_retention_days": 45, "trash_retention_days": 14},
        )
        assert response.status_code == 200

        assert system_setting.get_setting(db_session, KEY_BACKUP_RETENTION_DAYS) == "45"
        assert system_setting.get_setting(db_session, KEY_TRASH_RETENTION_DAYS) == "14"
        assert settings.BACKUP_RETENTION_DAYS == 45
        assert settings.TRASH_RETENTION_DAYS == 14

    def test_backup_counts_persist(self, admin_client, db_session, restore_settings):
        response = admin_client.post(
            RETENTION_URL,
            json={"backup_min_count": 2, "backup_max_count": 20},
        )
        assert response.status_code == 200

        assert system_setting.get_setting(db_session, KEY_BACKUP_MIN_COUNT) == "2"
        assert system_setting.get_setting(db_session, KEY_BACKUP_MAX_COUNT) == "20"
        assert settings.BACKUP_MIN_COUNT == 2
        assert settings.BACKUP_MAX_COUNT == 20

    def test_invalid_retention_does_not_persist(
        self, admin_client, db_session, restore_settings
    ):
        """400 validation failures must not leave a row behind."""
        response = admin_client.post(RETENTION_URL, json={"backup_retention_days": 0})
        assert response.status_code == 400
        assert system_setting.get_setting(db_session, KEY_BACKUP_RETENTION_DAYS) is None

    def test_wrong_type_for_bool_rejected(
        self, admin_client, db_session, restore_settings
    ):
        """Pydantic rejects non-bool for allow_user_registration; nothing persisted."""
        response = admin_client.post(
            RETENTION_URL, json={"allow_user_registration": "not-a-bool"}
        )
        assert response.status_code == 422
        assert (
            system_setting.get_setting(db_session, KEY_ALLOW_USER_REGISTRATION) is None
        )

    def test_mid_update_validation_failure_is_atomic(
        self, admin_client, db_session, restore_settings
    ):
        """A valid field plus a later invalid field must not partially persist."""
        response = admin_client.post(
            RETENTION_URL,
            json={"backup_retention_days": 7, "backup_min_count": 0},
        )
        assert response.status_code == 400
        assert system_setting.get_setting(db_session, KEY_BACKUP_RETENTION_DAYS) is None
        assert system_setting.get_setting(db_session, KEY_BACKUP_MIN_COUNT) is None

    def test_mid_loop_db_failure_rolls_back_all_rows(
        self, admin_client, db_session, restore_settings, monkeypatch
    ):
        """A DB-level failure after the first row must not commit earlier rows
        and must not mutate in-memory `settings` for any row."""
        from app.api.v1.admin import backup as backup_module

        call_count = {"n": 0}
        real_persist = backup_module.persist_setting

        def flaky_persist(db, key, value, commit=True):
            call_count["n"] += 1
            if call_count["n"] == 2:
                raise RuntimeError("simulated DB failure")
            return real_persist(db, key, value, commit=commit)

        monkeypatch.setattr(backup_module, "persist_setting", flaky_persist)

        before_retention = settings.BACKUP_RETENTION_DAYS
        before_trash = settings.TRASH_RETENTION_DAYS

        response = admin_client.post(
            RETENTION_URL,
            json={"backup_retention_days": 77, "trash_retention_days": 33},
        )
        assert response.status_code == 500

        assert system_setting.get_setting(db_session, KEY_BACKUP_RETENTION_DAYS) is None
        assert system_setting.get_setting(db_session, KEY_TRASH_RETENTION_DAYS) is None
        assert settings.BACKUP_RETENTION_DAYS == before_retention
        assert settings.TRASH_RETENTION_DAYS == before_trash


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
        """Bool parser rejects non-'true'/'false' strings; the prior default is kept."""
        system_setting.set_setting(db_session, KEY_ALLOW_USER_REGISTRATION, "nope")
        settings.ALLOW_USER_REGISTRATION = True

        load_persisted_settings(db_session)

        assert settings.ALLOW_USER_REGISTRATION is True

    def test_semantically_invalid_int_is_skipped(
        self, db_session, restore_settings
    ):
        """A parseable-but-invalid row (e.g. BACKUP_RETENTION_DAYS=0) must be
        ignored at startup so corrupt values can't override the default."""
        system_setting.set_setting(db_session, KEY_BACKUP_RETENTION_DAYS, "0")
        settings.BACKUP_RETENTION_DAYS = 30

        load_persisted_settings(db_session)

        assert settings.BACKUP_RETENTION_DAYS == 30

    def test_persist_setting_rejects_unknown_key(self, db_session, restore_settings):
        with pytest.raises(KeyError):
            persist_setting(db_session, "not_a_real_setting", "value")
