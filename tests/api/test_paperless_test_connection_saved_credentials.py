"""POST /paperless/test-connection with no new credentials uses the saved ones (issue #1227).

Goes through the real request validation. The handler-level tests call the
endpoint function directly and so never exercised the request schema, which is
what rejected the blank username/password the Settings page sends.
"""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.v1.endpoints import paperless as paperless_endpoint
from app.services.credential_encryption import SecurityError

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


class TestUnreadableSavedCredentials:
    """Saved credentials that cannot be decrypted (for example after SECRET_KEY changed)."""

    @pytest.fixture
    def saved_both_prefs(self):
        prefs = MagicMock()
        prefs.paperless_api_token_encrypted = "saved-encrypted-token"
        prefs.paperless_username_encrypted = "saved-encrypted-username"
        prefs.paperless_password_encrypted = "saved-encrypted-password"
        return prefs

    def test_returns_400_with_clear_message_and_code(
        self, authenticated_client, saved_both_prefs
    ):
        with patch.object(
            paperless_endpoint.user_preferences,
            "get_by_user_id",
            return_value=saved_both_prefs,
        ), patch(
            "app.services.paperless_service.credential_encryption.decrypt_token",
            side_effect=SecurityError("Failed to decrypt API token"),
        ):
            response = authenticated_client.post(
                TEST_CONNECTION_URL, json={"paperless_url": PAPERLESS_URL}
            )

        assert response.status_code == 400, response.text
        assert response.headers["X-Error-Code"] == "integration_credentials_unusable"
        assert "could not be read" in response.text
        assert "re-enter" in response.text
        assert "internal error" not in response.text.lower()
        assert "decrypt" not in response.text.lower()


class TestAuthMethodSelection:
    """The chosen method decides which saved credentials are used."""

    @pytest.fixture
    def both_saved_prefs(self):
        prefs = MagicMock()
        prefs.paperless_api_token_encrypted = "saved-encrypted-token"
        prefs.paperless_username_encrypted = "saved-encrypted-username"
        prefs.paperless_password_encrypted = "saved-encrypted-password"
        prefs.paperless_auth_method = None
        return prefs

    def test_sent_method_overrides_the_stored_one(
        self, post_test_connection, service_calls, both_saved_prefs
    ):
        response = post_test_connection(
            {"paperless_url": PAPERLESS_URL, "paperless_auth_method": "basic_auth"},
            both_saved_prefs,
        )

        assert response.status_code == 200, response.text
        assert service_calls[0]["encrypted_token"] is None
        assert service_calls[0]["encrypted_username"] == "saved-encrypted-username"
        assert service_calls[0]["encrypted_password"] == "saved-encrypted-password"

    def test_stored_method_is_used_when_none_is_sent(
        self, post_test_connection, service_calls, both_saved_prefs
    ):
        both_saved_prefs.paperless_auth_method = "basic_auth"

        response = post_test_connection(
            {"paperless_url": PAPERLESS_URL}, both_saved_prefs
        )

        assert response.status_code == 200, response.text
        assert service_calls[0]["encrypted_token"] is None
        assert service_calls[0]["encrypted_username"] == "saved-encrypted-username"

    def test_method_without_saved_credentials_returns_400(
        self, post_test_connection, service_calls, saved_token_prefs
    ):
        saved_token_prefs.paperless_auth_method = None

        response = post_test_connection(
            {"paperless_url": PAPERLESS_URL, "paperless_auth_method": "basic_auth"},
            saved_token_prefs,
        )

        assert response.status_code == 400
        assert "No saved authentication credentials" in response.text
        assert service_calls == []

    @pytest.mark.parametrize("method", ["sso", "TOKEN", 5, ["token"], {"a": 1}])
    def test_unknown_or_malformed_method_is_rejected(
        self, post_test_connection, service_calls, saved_token_prefs, method
    ):
        response = post_test_connection(
            {"paperless_url": PAPERLESS_URL, "paperless_auth_method": method},
            saved_token_prefs,
        )

        assert response.status_code == 422
        assert service_calls == []


class TestSavingAuthMethod:
    SETTINGS_URL = "/api/v1/paperless/settings"

    @pytest.fixture
    def put_settings(self, authenticated_client):
        def put(payload, prefs):
            with patch.object(
                paperless_endpoint.user_preferences,
                "get_by_user_id",
                return_value=prefs,
            ), patch.object(
                paperless_endpoint.user_preferences, "update", return_value=prefs
            ) as update, patch.object(
                paperless_endpoint.credential_encryption,
                "encrypt_token",
                side_effect=lambda value: f"enc:{value}",
            ):
                response = authenticated_client.put(self.SETTINGS_URL, json=payload)
            return response, update

        return put

    @pytest.fixture
    def token_only_prefs(self):
        prefs = MagicMock()
        prefs.paperless_enabled = True
        prefs.paperless_url = PAPERLESS_URL
        prefs.paperless_api_token_encrypted = "saved-encrypted-token"
        prefs.paperless_username_encrypted = None
        prefs.paperless_password_encrypted = None
        prefs.paperless_auth_method = None
        prefs.paperless_connection_verified = True
        prefs.default_storage_backend = "local"
        prefs.paperless_auto_sync = False
        prefs.paperless_sync_tags = True
        prefs.unit_system = "imperial"
        return prefs

    @pytest.mark.parametrize(
        "method", ["sso", "TOKEN", "", None, 5, ["token"], {"a": 1}]
    )
    def test_unknown_or_malformed_method_returns_400(
        self, put_settings, token_only_prefs, method
    ):
        response, update = put_settings(
            {"paperless_auth_method": method}, token_only_prefs
        )

        assert response.status_code == 400
        assert "Unknown Paperless authentication method" in response.text
        update.assert_not_called()

    def test_method_with_only_a_username_returns_400(
        self, put_settings, token_only_prefs
    ):
        response, update = put_settings(
            {"paperless_auth_method": "basic_auth", "paperless_username": "admin"},
            token_only_prefs,
        )

        assert response.status_code == 400
        update.assert_not_called()

    def test_method_with_credentials_in_the_same_request_is_saved(
        self, put_settings, token_only_prefs
    ):
        response, update = put_settings(
            {
                "paperless_auth_method": "basic_auth",
                "paperless_username": "admin",
                "paperless_password": "secret",
            },
            token_only_prefs,
        )

        assert response.status_code == 200, response.text
        saved = update.call_args.kwargs["obj_in"]
        assert saved["paperless_auth_method"] == "basic_auth"
        assert saved["paperless_username_encrypted"] == "enc:admin"


class TestSavedCredentialCallSites:
    """Other Paperless operations use the chosen method's credentials too."""

    def test_health_check_uses_the_chosen_method_only(
        self, authenticated_client, service_calls
    ):
        prefs = MagicMock()
        prefs.paperless_enabled = True
        prefs.paperless_url = PAPERLESS_URL
        prefs.paperless_api_token_encrypted = "saved-encrypted-token"
        prefs.paperless_username_encrypted = "saved-encrypted-username"
        prefs.paperless_password_encrypted = "saved-encrypted-password"
        prefs.paperless_auth_method = "basic_auth"

        service = MagicMock()
        service.test_connection = AsyncMock(return_value={"status": "connected"})

        @asynccontextmanager
        async def factory(url, **kwargs):
            service_calls.append({"url": url, **kwargs})
            yield service

        with patch.object(
            paperless_endpoint.user_preferences, "get_by_user_id", return_value=prefs
        ), patch.object(paperless_endpoint, "create_paperless_service", factory):
            response = authenticated_client.get("/api/v1/paperless/health/paperless")

        assert response.status_code == 200, response.text
        assert "encrypted_token" not in service_calls[0]
        assert service_calls[0]["encrypted_username"] == "saved-encrypted-username"
