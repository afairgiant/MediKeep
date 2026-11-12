"""Papra test-connection and document search describe their failures safely (issue #1200).

The upstream text never reaches the client; the message and `error_code` are
built from information we control (see app/core/http/integration_errors.py).
"""

import asyncio
import errno
from types import SimpleNamespace

import aiohttp
import pytest
from aiohttp.client_reqrep import ConnectionKey

import app.api.v1.endpoints.papra as papra_module
from app.core.http.integration_errors import (
    PAPRA_AUTH_FAILED_MESSAGE,
    IntegrationErrorCode,
)
from app.core.utils.integration_http import pin_integration_url
from app.core.utils.url_security import METADATA_URL_ERROR
from app.services.papra_client import (
    PapraClientAuthError,
    PapraClientError,
    PapraConnectionError,
)

TEST_CONNECTION_URL = "/api/v1/papra/test-connection"
SEARCH_URL = "/api/v1/papra/documents/search"

# Looks like what an attacker wants to read back from an internal service.
SECRET_TEXT = "/srv/medikeep/secret/path SELECT * FROM users <html>admin panel</html>"


def _refused() -> aiohttp.ClientConnectorError:
    key = ConnectionKey("papra.test", 80, False, True, None, None, None)
    return aiohttp.ClientConnectorError(key, OSError(errno.ECONNREFUSED, SECRET_TEXT))


class _FailingClient:
    def __init__(self, error: Exception):
        self._error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def search_documents(self, *args, **kwargs):
        raise self._error


def _assert_safe(response, code: str):
    body = response.json()
    assert response.status_code == 400
    assert body["error_code"] == code
    assert SECRET_TEXT not in response.text
    assert "admin panel" not in response.text
    return body["message"]


class TestConnectionTestBlocked:
    def test_blocked_address_explains_why(self, authenticated_client, monkeypatch):
        """The URL-validation reason is authored text and tells the user how to fix it."""

        def blocked_auth(**kwargs):
            # The real check, against an address that is always refused.
            pin_integration_url("http://169.254.169.254/", PapraConnectionError)

        monkeypatch.setattr(papra_module, "PapraAuth", blocked_auth)

        response = authenticated_client.post(
            TEST_CONNECTION_URL,
            json={
                "papra_url": "http://127.0.0.1:9",
                "papra_api_token": "token-long-enough",
                "papra_organization_id": "org_1",
            },
        )

        assert _assert_safe(response, IntegrationErrorCode.URL_BLOCKED) == (
            METADATA_URL_ERROR
        )


@pytest.fixture
def search_env(monkeypatch):
    prefs = SimpleNamespace(
        papra_enabled=True,
        papra_url="http://papra.test",
        papra_api_token_encrypted="token",
        papra_organization_id="org_1",
    )
    monkeypatch.setattr(
        papra_module.user_preferences, "get_by_user_id", lambda db, user_id: prefs
    )
    monkeypatch.setattr(papra_module, "decrypt_papra_token", lambda token: "raw-token")


def _search_fails_with(monkeypatch, error: Exception):
    monkeypatch.setattr(
        papra_module, "create_papra_client", lambda **kwargs: _FailingClient(error)
    )


class TestSearchFailures:
    def test_rejected_token(self, authenticated_client, search_env, monkeypatch):
        _search_fails_with(
            monkeypatch, PapraClientAuthError(f"rejected (HTTP 403) {SECRET_TEXT}")
        )

        message = _assert_safe(
            authenticated_client.get(SEARCH_URL), IntegrationErrorCode.AUTH_FAILED
        )

        assert message == PAPRA_AUTH_FAILED_MESSAGE

    def test_connection_refused_says_why(
        self, authenticated_client, search_env, monkeypatch
    ):
        try:
            try:
                raise _refused()
            except aiohttp.ClientError as inner:
                raise PapraConnectionError(f"Connection error: {inner}")
        except PapraConnectionError as wrapped:
            _search_fails_with(monkeypatch, wrapped)

        message = _assert_safe(
            authenticated_client.get(SEARCH_URL),
            IntegrationErrorCode.CONNECTION_REFUSED,
        )

        assert message.startswith("Unable to connect to Papra: connection refused")

    def test_upstream_status(self, authenticated_client, search_env, monkeypatch):
        _search_fails_with(
            monkeypatch, PapraClientError(SECRET_TEXT, upstream_status=500)
        )

        message = _assert_safe(
            authenticated_client.get(SEARCH_URL), IntegrationErrorCode.HTTP_ERROR
        )

        assert "HTTP 500" in message

    def test_total_timeout(self, authenticated_client, search_env, monkeypatch):
        """A bare asyncio.TimeoutError reaches the broad handler and is still described."""
        _search_fails_with(monkeypatch, asyncio.TimeoutError())

        _assert_safe(authenticated_client.get(SEARCH_URL), IntegrationErrorCode.TIMEOUT)

    def test_unclassified_client_error_stays_generic(
        self, authenticated_client, search_env, monkeypatch
    ):
        _search_fails_with(monkeypatch, PapraClientError(SECRET_TEXT))

        message = _assert_safe(
            authenticated_client.get(SEARCH_URL), IntegrationErrorCode.GENERIC
        )

        assert message == "Papra error"

    def test_unexpected_error_is_a_generic_500(
        self, authenticated_client, search_env, monkeypatch
    ):
        _search_fails_with(monkeypatch, RuntimeError(SECRET_TEXT))

        response = authenticated_client.get(SEARCH_URL)

        assert response.status_code == 500
        assert SECRET_TEXT not in response.text
