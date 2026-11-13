"""Test-then-save keeps Paperless/Papra connections verified (issue #1164).

A connection test can run before the settings are saved. The saved URL then
differs from the stored one, which used to reset the verified flag and re-lock
the Default Storage Location radio. These tests go through the real endpoints
and database, mocking only the outbound connection.
"""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest

import app.api.v1.endpoints.papra as papra_module
from app.api.v1.endpoints import paperless as paperless_endpoint
from app.core.utils.integration_verification import (
    normalize_integration_url,
    verification_after_test,
    verification_after_url_change,
)

PREFS_URL = "/api/v1/users/me/preferences"
URL_A = "https://docs.example.com"
URL_B = "https://other.example.com"
TOKEN = "a-valid-token-0123456789"


@pytest.fixture(autouse=True)
def allow_private_urls(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True)


@pytest.fixture(autouse=True)
def preferences_row(authenticated_client):
    """The Settings page loads preferences first, which creates the row."""
    assert authenticated_client.get(PREFS_URL).status_code == 200


@pytest.fixture
def paperless_connects(monkeypatch):
    service = MagicMock()
    service.test_connection = AsyncMock(return_value={"status": "connected"})
    service.get_auth_type.return_value = "token"

    @asynccontextmanager
    async def factory(url, **kwargs):
        yield service

    monkeypatch.setattr(paperless_endpoint, "create_paperless_service", factory)


@pytest.fixture
def papra_connects(monkeypatch):
    class FakeAuth:
        def __init__(self, **kwargs):
            pass

        async def test_connection(self):
            return True, "ok"

        async def list_organizations(self):
            return []

    monkeypatch.setattr(papra_module, "PapraAuth", FakeAuth)


def _verified(client, service):
    response = client.get(PREFS_URL)
    assert response.status_code == 200
    return response.json()[f"{service}_connection_verified"]


def _paperless_test(client, url):
    response = client.post(
        "/api/v1/paperless/test-connection",
        json={"paperless_url": url, "paperless_api_token": TOKEN},
    )
    assert response.status_code == 200, response.text


def _paperless_save(client, url):
    response = client.put(
        "/api/v1/paperless/settings",
        json={"paperless_url": url, "paperless_enabled": True},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _papra_test(client, url):
    response = client.post(
        "/api/v1/papra/test-connection",
        json={"papra_url": url, "papra_api_token": TOKEN},
    )
    assert response.status_code == 200, response.text


def _papra_save(client, url):
    response = client.put(
        "/api/v1/papra/settings",
        json={"papra_url": url, "papra_enabled": True},
    )
    assert response.status_code == 200, response.text
    return response.json()


class TestPaperlessVerifiedUrl:
    def test_test_then_save_stays_verified(
        self, authenticated_client, paperless_connects
    ):
        _paperless_test(authenticated_client, URL_A)
        # Nothing saved yet, so nothing is verified yet
        assert _verified(authenticated_client, "paperless") is False

        saved = _paperless_save(authenticated_client, URL_A)

        assert saved["paperless_connection_verified"] is True
        assert _verified(authenticated_client, "paperless") is True

    def test_save_then_test_becomes_verified(
        self, authenticated_client, paperless_connects
    ):
        saved = _paperless_save(authenticated_client, URL_A)
        assert saved["paperless_connection_verified"] is False

        _paperless_test(authenticated_client, URL_A)

        assert _verified(authenticated_client, "paperless") is True

    def test_testing_another_url_does_not_verify_the_saved_one(
        self, authenticated_client, paperless_connects
    ):
        _paperless_save(authenticated_client, URL_A)

        _paperless_test(authenticated_client, URL_B)

        assert _verified(authenticated_client, "paperless") is False

    def test_saving_a_different_url_than_tested_is_unverified(
        self, authenticated_client, paperless_connects
    ):
        _paperless_test(authenticated_client, URL_A)

        saved = _paperless_save(authenticated_client, URL_B)

        assert saved["paperless_connection_verified"] is False

    def test_switching_away_and_back_requires_a_new_test(
        self, authenticated_client, paperless_connects
    ):
        _paperless_test(authenticated_client, URL_A)
        _paperless_save(authenticated_client, URL_A)
        _paperless_save(authenticated_client, URL_B)

        saved = _paperless_save(authenticated_client, URL_A)

        assert saved["paperless_connection_verified"] is False

    def test_saving_without_changing_the_url_keeps_verified(
        self, authenticated_client, paperless_connects
    ):
        _paperless_test(authenticated_client, URL_A)
        _paperless_save(authenticated_client, URL_A)

        saved = _paperless_save(authenticated_client, URL_A)

        assert saved["paperless_connection_verified"] is True

    def test_trailing_slash_does_not_defeat_the_match(
        self, authenticated_client, paperless_connects
    ):
        _paperless_test(authenticated_client, URL_A)

        saved = _paperless_save(authenticated_client, URL_A + "/")

        assert saved["paperless_connection_verified"] is True


    def test_resaving_the_same_url_with_a_trailing_slash_changes_nothing(
        self, authenticated_client, paperless_connects
    ):
        _paperless_test(authenticated_client, URL_A)
        _paperless_save(authenticated_client, URL_A)
        # Testing another URL records it as the last tested one; the saved URL
        # stays verified until the saved URL itself changes
        _paperless_test(authenticated_client, URL_B)

        saved = _paperless_save(authenticated_client, URL_A + "/")

        assert saved["paperless_connection_verified"] is True


class TestPapraVerifiedUrl:
    def test_test_then_save_stays_verified(self, authenticated_client, papra_connects):
        _papra_test(authenticated_client, URL_A)
        assert _verified(authenticated_client, "papra") is False

        saved = _papra_save(authenticated_client, URL_A)

        assert saved["papra_connection_verified"] is True
        assert _verified(authenticated_client, "papra") is True

    def test_save_then_test_becomes_verified(
        self, authenticated_client, papra_connects
    ):
        saved = _papra_save(authenticated_client, URL_A)
        assert saved["papra_connection_verified"] is False

        _papra_test(authenticated_client, URL_A)

        assert _verified(authenticated_client, "papra") is True

    def test_testing_another_url_does_not_verify_the_saved_one(
        self, authenticated_client, papra_connects
    ):
        _papra_save(authenticated_client, URL_A)

        _papra_test(authenticated_client, URL_B)

        assert _verified(authenticated_client, "papra") is False

    def test_saving_a_different_url_than_tested_is_unverified(
        self, authenticated_client, papra_connects
    ):
        _papra_test(authenticated_client, URL_A)

        saved = _papra_save(authenticated_client, URL_B)

        assert saved["papra_connection_verified"] is False

    def test_resaving_the_same_url_with_a_trailing_slash_changes_nothing(
        self, authenticated_client, papra_connects
    ):
        _papra_test(authenticated_client, URL_A)
        _papra_save(authenticated_client, URL_A)
        _papra_test(authenticated_client, URL_B)

        saved = _papra_save(authenticated_client, URL_A + "/")

        assert saved["papra_connection_verified"] is True


class TestVerificationHelpers:
    @pytest.mark.parametrize(
        "value, expected",
        [
            (None, ""),
            ("", ""),
            ("  https://x.example.com/  ", "https://x.example.com"),
            ("https://x.example.com//", "https://x.example.com"),
            ("https://x.example.com/paperless/", "https://x.example.com/paperless"),
        ],
    )
    def test_normalize(self, value, expected):
        assert normalize_integration_url(value) == expected

    def test_after_test_matching_stored_url_verifies(self):
        assert verification_after_test("papra", URL_A, URL_A + "/") == {
            "papra_verified_url": URL_A,
            "papra_connection_verified": True,
        }

    def test_after_test_without_stored_url_only_records_the_url(self):
        assert verification_after_test("papra", URL_A, None) == {
            "papra_verified_url": URL_A
        }

    def test_after_test_with_other_stored_url_does_not_verify(self):
        assert "paperless_connection_verified" not in verification_after_test(
            "paperless", URL_A, URL_B
        )

    def test_after_url_change_to_verified_url_keeps_it_verified(self):
        assert verification_after_url_change("papra", URL_A, URL_A) == {
            "papra_connection_verified": True
        }

    @pytest.mark.parametrize("verified_url", [None, "", URL_B])
    def test_after_url_change_to_untested_url_resets_everything(self, verified_url):
        assert verification_after_url_change("papra", URL_A, verified_url) == {
            "papra_connection_verified": False,
            "papra_verified_url": None,
        }

    def test_clearing_the_url_is_never_verified(self):
        assert verification_after_url_change("papra", "", "") == {
            "papra_connection_verified": False,
            "papra_verified_url": None,
        }
