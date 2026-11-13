"""POST /paperless/test-connection with no new credentials uses the saved ones (issue #1227).

Goes through the real request validation. The handler-level tests call the
endpoint function directly and so never exercised the request schema, which is
what rejected the blank username/password the Settings page sends.
"""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.v1.endpoints import paperless as paperless_endpoint

TEST_CONNECTION_URL = "/api/v1/paperless/test-connection"
PAPERLESS_URL = "http://127.0.0.1:8000"


@pytest.fixture(autouse=True)
def allow_private_urls(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True)


@pytest.fixture
def saved_token_prefs():
    prefs = MagicMock()
    prefs.paperless_api_token_encrypted = "saved-encrypted-token"
    prefs.paperless_username_encrypted = None
    prefs.paperless_password_encrypted = None
    return prefs


@pytest.fixture
def no_saved_credentials_prefs():
    prefs = MagicMock()
    prefs.paperless_api_token_encrypted = None
    prefs.paperless_username_encrypted = None
    prefs.paperless_password_encrypted = None
    return prefs


@pytest.fixture
def service_calls():
    """Records what create_paperless_service was called with."""
    return []


@pytest.fixture
def post_test_connection(authenticated_client, service_calls):
    service = MagicMock()
    service.test_connection = AsyncMock(
        return_value={"status": "connected", "server_version": "2.0.0"}
    )
    service.get_auth_type.return_value = "token"

    @asynccontextmanager
    async def factory(url, **kwargs):
        service_calls.append({"url": url, **kwargs})
        yield service

    def post(payload, prefs):
        with patch.object(
            paperless_endpoint.user_preferences, "get_by_user_id", return_value=prefs
        ), patch.object(paperless_endpoint.user_preferences, "update"), patch.object(
            paperless_endpoint, "create_paperless_service", factory
        ):
            return authenticated_client.post(TEST_CONNECTION_URL, json=payload)

    return post


class TestBlankCredentialsUseSavedCredentials:
    @pytest.mark.parametrize(
        "payload",
        [
            {"paperless_url": PAPERLESS_URL},
            {
                "paperless_url": PAPERLESS_URL,
                "paperless_username": "",
                "paperless_password": "",
            },
            {
                "paperless_url": PAPERLESS_URL,
                "paperless_api_token": "",
                "paperless_username": "",
                "paperless_password": "",
            },
        ],
        ids=["url_only", "blank_basic_credentials", "all_blank"],
    )
    def test_saved_token_is_used(
        self, post_test_connection, service_calls, saved_token_prefs, payload
    ):
        response = post_test_connection(payload, saved_token_prefs)

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] == "connected"
        assert body["used_saved_credentials"] is True
        assert len(service_calls) == 1
        assert service_calls[0]["encrypted_token"] == "saved-encrypted-token"

    def test_nothing_saved_returns_400_without_connecting(
        self, post_test_connection, service_calls, no_saved_credentials_prefs
    ):
        response = post_test_connection(
            {
                "paperless_url": PAPERLESS_URL,
                "paperless_username": "",
                "paperless_password": "",
            },
            no_saved_credentials_prefs,
        )

        assert response.status_code == 400
        assert "No saved authentication credentials" in response.text
        assert service_calls == []

    def test_no_preferences_row_returns_400_without_connecting(
        self, post_test_connection, service_calls
    ):
        response = post_test_connection({"paperless_url": PAPERLESS_URL}, None)

        assert response.status_code == 400
        assert "No saved credentials" in response.text
        assert service_calls == []


class TestProvidedCredentialsAreStillUsed:
    def test_token_in_payload_overrides_saved_credentials(
        self, post_test_connection, service_calls, saved_token_prefs
    ):
        with patch.object(
            paperless_endpoint.credential_encryption,
            "encrypt_token",
            side_effect=lambda value: f"enc:{value}",
        ):
            response = post_test_connection(
                {
                    "paperless_url": PAPERLESS_URL,
                    "paperless_api_token": "brand-new-token-1",
                },
                saved_token_prefs,
            )

        assert response.status_code == 200, response.text
        assert response.json()["used_saved_credentials"] is False
        assert service_calls[0]["encrypted_token"] == "enc:brand-new-token-1"

    def test_username_without_password_is_rejected(
        self, post_test_connection, service_calls, saved_token_prefs
    ):
        response = post_test_connection(
            {"paperless_url": PAPERLESS_URL, "paperless_username": "admin"},
            saved_token_prefs,
        )

        assert response.status_code == 422
        assert service_calls == []
