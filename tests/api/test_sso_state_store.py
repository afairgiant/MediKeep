"""Tests for the in-memory SSO state store: expiry sweeping and the hard cap.

The store holds three unrelated entry shapes - the CSRF ``state`` for the
authorization redirect, ``sso_conflict_*`` for a pending account conflict, and
``github_manual_link_*`` for a pending GitHub link. They were written with two
different expiry conventions, so a sweep that only ever saw ``state`` entries in
tests would raise on the first real conflict flow. Every sweep test below runs
against a store holding all three.
"""

import logging
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.services import sso_service as sso_module
from app.services.sso_service import (
    _STATE_STORE_MAX_ENTRIES,
    _STATE_TTL,
    SSOService,
    _state_storage,
    _sweep_expired_states,
)
from app.auth.sso.exceptions import SSOAuthenticationError

pytestmark = pytest.mark.usefixtures("clean_sso_state")


def put_state(key: str, *, age: timedelta = timedelta(0), return_url=None) -> str:
    """Insert a CSRF state entry created ``age`` ago."""
    created_at = datetime.utcnow() - age
    _state_storage[key] = {
        "created_at": created_at,
        "expires_at": created_at + _STATE_TTL,
        "return_url": return_url,
    }
    return key


def put_conflict(token: str, *, age: timedelta = timedelta(0)) -> str:
    """Insert an account-conflict entry created ``age`` ago."""
    created_at = datetime.utcnow() - age
    key = f"sso_conflict_{token}"
    _state_storage[key] = {
        "created_at": created_at,
        "existing_user_id": 1,
        "sso_user_info": {
            "sub": "external-1",
            "email": "conflict@example.com",
            "name": "Conflict User",
        },
        "expires_at": created_at + _STATE_TTL,
    }
    return key


def put_github_link(token: str, *, age: timedelta = timedelta(0)) -> str:
    """Insert a GitHub manual-link entry created ``age`` ago."""
    created_at = datetime.utcnow() - age
    key = f"github_manual_link_{token}"
    _state_storage[key] = {
        "created_at": created_at,
        "sso_user_info": {
            "sub": "github-1",
            "email": None,
            "name": "GitHub User",
        },
        "expires_at": created_at + _STATE_TTL,
    }
    return key


EXPIRED = _STATE_TTL + timedelta(minutes=1)

# get_logger() namespaces by category, so the module's logger is not named after
# its import path.
SSO_LOGGER_NAME = "medical_records.sso.services.sso_service"


@pytest.fixture
def service():
    """An SSOService, constructed with SSO disabled.

    The constructor no longer validates provider configuration - startup_event()
    owns that now - so this is a plain construction. SSO stays off here to keep the
    tests focused on the state store rather than on provider config.
    """
    with patch.object(sso_module.settings, "SSO_ENABLED", False):
        instance = SSOService()
    return instance


@pytest.fixture
def sso_enabled():
    with patch.object(sso_module.settings, "SSO_ENABLED", True):
        yield


@pytest.fixture
def working_provider():
    with patch.object(sso_module, "create_sso_provider") as factory:
        factory.return_value.get_auth_url.return_value = "https://idp/authorize"
        yield factory


class TestSweep:
    def test_sweep_of_empty_store_does_not_raise(self):
        assert _sweep_expired_states() == 0

    def test_expired_entry_is_reclaimed(self):
        put_state("stale", age=EXPIRED)

        assert _sweep_expired_states() == 1
        assert "stale" not in _state_storage

    def test_live_entry_survives(self):
        put_state("fresh")

        assert _sweep_expired_states() == 0
        assert "fresh" in _state_storage

    def test_mixed_store_drops_only_expired_entries_of_each_kind(self):
        """A sweep must handle all three shapes in one pass without raising."""
        stale_state = put_state("stale-state", age=EXPIRED)
        stale_conflict = put_conflict("stale", age=EXPIRED)
        stale_github = put_github_link("stale", age=EXPIRED)
        live_state = put_state("live-state")
        live_conflict = put_conflict("live")
        live_github = put_github_link("live")

        assert _sweep_expired_states() == 3

        for key in (stale_state, stale_conflict, stale_github):
            assert key not in _state_storage
        for key in (live_state, live_conflict, live_github):
            assert key in _state_storage

    def test_expired_conflict_entry_retains_no_pii(self):
        """conflict entries carry email and display name - reclaiming them matters."""
        key = put_conflict("stale", age=EXPIRED)

        _sweep_expired_states()

        assert key not in _state_storage
        assert not any(
            "conflict@example.com" in str(value) for value in _state_storage.values()
        )


class TestSweepOnWrite:
    """get_authorization_url is the only sweep trigger."""

    @pytest.mark.asyncio
    async def test_write_reclaims_expired_entries_of_every_kind(
        self, service, sso_enabled, working_provider
    ):
        put_state("stale-state", age=EXPIRED)
        put_conflict("stale", age=EXPIRED)
        put_github_link("stale", age=EXPIRED)

        result = await service.get_authorization_url()

        # Only the entry just minted remains.
        assert list(_state_storage) == [result["state"]]

    @pytest.mark.asyncio
    async def test_live_entry_survives_another_users_write(
        self, service, sso_enabled, working_provider
    ):
        put_state("someone-elses-live-flow")

        await service.get_authorization_url()

        assert "someone-elses-live-flow" in _state_storage

    @pytest.mark.asyncio
    async def test_new_entry_carries_expires_at_and_return_url(
        self, service, sso_enabled, working_provider
    ):
        result = await service.get_authorization_url("/dashboard")

        entry = _state_storage[result["state"]]
        assert entry["return_url"] == "/dashboard"
        assert entry["expires_at"] == entry["created_at"] + _STATE_TTL

    @pytest.mark.asyncio
    async def test_consumed_state_is_still_single_use_after_a_sweep(
        self, service, sso_enabled, working_provider
    ):
        result = await service.get_authorization_url()
        state = result["state"]

        service._validate_and_consume_state(state)

        # A later sweep must not resurrect it or mask the second consumption.
        _sweep_expired_states()
        with pytest.raises(SSOAuthenticationError):
            service._validate_and_consume_state(state)


class TestOrphanOnFailure:
    """A failed initiate must leave no entry behind - nothing would ever delete it."""

    @pytest.mark.asyncio
    async def test_provider_construction_failure_stores_nothing(
        self, service, sso_enabled
    ):
        with patch.object(
            sso_module, "create_sso_provider", side_effect=ValueError("bad config")
        ):
            with pytest.raises(SSOAuthenticationError):
                await service.get_authorization_url()

        assert len(_state_storage) == 0

    @pytest.mark.asyncio
    async def test_auth_url_failure_stores_nothing(self, service, sso_enabled):
        with patch.object(sso_module, "create_sso_provider") as factory:
            factory.return_value.get_auth_url.side_effect = ValueError("no issuer")
            with pytest.raises(SSOAuthenticationError):
                await service.get_authorization_url()

        assert len(_state_storage) == 0


class TestCapacityCap:
    def fill_to_cap(self):
        """Fill the store to the ceiling with entries that are all still live.

        Ages are microseconds apart so ordering is well-defined while every entry
        stays inside the TTL - otherwise the sweep would reclaim them and the cap
        would never be reached.
        """
        base = datetime.utcnow()
        for i in range(_STATE_STORE_MAX_ENTRIES):
            created_at = base - timedelta(microseconds=_STATE_STORE_MAX_ENTRIES - i)
            _state_storage[f"live-{i}"] = {
                "created_at": created_at,
                "expires_at": created_at + _STATE_TTL,
                "return_url": None,
            }

    @pytest.mark.asyncio
    async def test_exceeding_the_cap_evicts_oldest_first(
        self, service, sso_enabled, working_provider
    ):
        self.fill_to_cap()

        result = await service.get_authorization_url()

        assert len(_state_storage) == _STATE_STORE_MAX_ENTRIES
        assert "live-0" not in _state_storage  # oldest evicted
        assert "live-1" in _state_storage
        assert result["state"] in _state_storage  # the new entry survives

    @pytest.mark.asyncio
    async def test_cap_breach_emits_security_event(
        self, service, sso_enabled, working_provider, caplog
    ):
        self.fill_to_cap()

        with caplog.at_level(logging.WARNING, logger=SSO_LOGGER_NAME):
            await service.get_authorization_url()

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "sso_state_store_capacity_exceeded" in events

    @pytest.mark.asyncio
    async def test_evicted_state_fails_with_the_normal_invalid_state_error(
        self, service, sso_enabled, working_provider
    ):
        """Eviction must look like expiry to the caller, not like a 500."""
        victim = await service.get_authorization_url()
        # Make the victim the oldest entry, then overfill.
        _state_storage[victim["state"]]["created_at"] = datetime.utcnow() - timedelta(
            minutes=1
        )
        self.fill_to_cap()

        await service.get_authorization_url()

        assert victim["state"] not in _state_storage
        with pytest.raises(SSOAuthenticationError, match="Invalid or expired state"):
            service._validate_and_consume_state(victim["state"])

    def test_under_the_cap_evicts_nothing(self):
        put_state("keep-me")

        assert sso_module._enforce_state_store_cap() == 0
        assert "keep-me" in _state_storage


class TestConsumedStateReturnsEntry:
    """spec 8.8 - the consumed entry is returned so return_url can be threaded out."""

    def test_returns_the_stored_entry(self):
        put_state("with-url", return_url="/patients/5")

        entry = SSOService()._validate_and_consume_state("with-url")

        assert entry["return_url"] == "/patients/5"
        assert "with-url" not in _state_storage

    def test_flow_started_without_a_return_url_yields_none(self):
        put_state("no-url")

        entry = SSOService()._validate_and_consume_state("no-url")

        assert entry["return_url"] is None

    def test_expired_state_is_rejected_and_deleted(self):
        put_state("stale", age=EXPIRED)

        with pytest.raises(SSOAuthenticationError, match="State parameter expired"):
            SSOService()._validate_and_consume_state("stale")

        assert "stale" not in _state_storage

    def test_unknown_state_is_rejected(self):
        with pytest.raises(SSOAuthenticationError, match="Invalid or expired state"):
            SSOService()._validate_and_consume_state("never-existed")


class TestNormalizedWritesStillExpireCorrectly:
    """Regression cover for the two read sites the normalization touched."""

    def test_expired_conflict_token_is_rejected_and_deleted(self, db_session):
        key = put_conflict("stale", age=EXPIRED)

        with pytest.raises(SSOAuthenticationError, match="expired"):
            SSOService().resolve_account_conflict(
                "stale", "link", "auto_link", db_session
            )

        assert key not in _state_storage

    def test_expired_github_link_token_is_rejected_and_deleted(self, db_session):
        key = put_github_link("stale", age=EXPIRED)

        with pytest.raises(SSOAuthenticationError, match="expired"):
            SSOService().resolve_github_manual_link(
                "stale", "someuser", "somepassword", db_session
            )

        assert key not in _state_storage

    def test_live_conflict_token_passes_the_expiry_check(self, db_session):
        """A live token gets past expiry and fails later, on the missing user."""
        put_conflict("live")
        _state_storage["sso_conflict_live"]["existing_user_id"] = 999999

        with pytest.raises(SSOAuthenticationError, match="Existing user not found"):
            SSOService().resolve_account_conflict(
                "live", "link", "auto_link", db_session
            )

    def test_live_github_token_passes_the_expiry_check(self, db_session):
        """A live token gets past expiry and fails later, on the unknown username."""
        put_github_link("live")

        with pytest.raises(
            SSOAuthenticationError, match="Invalid username or password"
        ):
            SSOService().resolve_github_manual_link(
                "live", "nosuchuser", "somepassword", db_session
            )
