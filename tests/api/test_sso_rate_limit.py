"""Tests for the rate limit on POST /auth/sso/initiate and the /test-connection guard.

/initiate is unauthenticated and mints an in-memory state entry per call, so the
limit is what bounds the state store against an anonymous caller. The assertion
that a limited request mints *no* state entry is the point of the whole exercise.
"""

import logging
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import sso as sso_endpoint
from app.services import sso_service as sso_module
from app.services.sso_service import _state_storage

INITIATE_URL = "/api/v1/auth/sso/initiate"
TEST_CONNECTION_URL = "/api/v1/auth/sso/test-connection"

SSO_ENDPOINT_LOGGER = "medical_records.sso.api.v1.endpoints.sso"


pytestmark = pytest.mark.usefixtures("clean_sso_state")


@pytest.fixture
def limit_of(limiter_ceiling):
    """Set the live limiter's ceiling, restoring the configured value afterwards."""
    return lambda n: limiter_ceiling(sso_endpoint._initiate_limiter, n)


@pytest.fixture
def sso_working():
    """SSO enabled with a provider that builds an auth URL."""
    with patch.object(sso_module.settings, "SSO_ENABLED", True):
        with patch.object(sso_module, "create_sso_provider") as factory:
            factory.return_value.get_auth_url.return_value = "https://idp/authorize"
            yield factory


class TestInitiateRateLimit:
    def test_requests_up_to_the_limit_succeed(
        self, client: TestClient, sso_working, limit_of
    ):
        limit_of(3)

        for _ in range(3):
            assert client.post(INITIATE_URL).status_code == 200

    def test_the_next_request_is_rejected_with_429(
        self, client: TestClient, sso_working, limit_of
    ):
        limit_of(2)
        for _ in range(2):
            client.post(INITIATE_URL)

        response = client.post(INITIATE_URL)

        assert response.status_code == 429

    def test_429_carries_retry_after_and_rate_limit_headers(
        self, client: TestClient, sso_working, limit_of
    ):
        limit_of(1)
        client.post(INITIATE_URL)

        response = client.post(INITIATE_URL)

        assert int(response.headers["Retry-After"]) >= 1
        assert response.headers["X-RateLimit-Limit"] == "1"
        assert response.headers["X-RateLimit-Remaining"] == "0"
        assert "X-RateLimit-Reset" in response.headers

    def test_429_is_machine_distinguishable_from_other_sso_failures(
        self, client: TestClient, sso_working, limit_of
    ):
        """PR 5 must be able to branch on this without matching the message text."""
        limit_of(1)
        client.post(INITIATE_URL)

        response = client.post(INITIATE_URL)

        assert response.headers["X-Error-Code"] == "sso_rate_limited"

    def test_429_emits_a_security_event(
        self, client: TestClient, sso_working, limit_of, caplog
    ):
        limit_of(1)
        client.post(INITIATE_URL)

        with caplog.at_level(logging.WARNING, logger=SSO_ENDPOINT_LOGGER):
            client.post(INITIATE_URL)

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "sso_initiate_rate_limited" in events

    def test_a_limited_request_mints_no_state_entry(
        self, client: TestClient, sso_working, limit_of
    ):
        """The whole point of pairing the limit with the state store sweep."""
        limit_of(1)
        client.post(INITIATE_URL)
        assert len(_state_storage) == 1

        response = client.post(INITIATE_URL)

        assert response.status_code == 429
        assert len(_state_storage) == 1

    def test_limits_are_per_ip(self, client: TestClient, sso_working, limit_of):
        limit_of(1)
        client.post(INITIATE_URL, headers={"X-Forwarded-For": "198.51.100.1"})

        exhausted = client.post(
            INITIATE_URL, headers={"X-Forwarded-For": "198.51.100.1"}
        )
        other_ip = client.post(
            INITIATE_URL, headers={"X-Forwarded-For": "198.51.100.2"}
        )

        assert exhausted.status_code == 429
        assert other_ip.status_code == 200

    def test_window_reset_allows_the_next_request(
        self, client: TestClient, sso_working, limit_of
    ):
        limit_of(1)

        with patch("app.core.utils.rate_limit.time.time", return_value=5000.0):
            assert client.post(INITIATE_URL).status_code == 200
            assert client.post(INITIATE_URL).status_code == 429

        window = sso_endpoint._initiate_limiter.window_seconds
        with patch(
            "app.core.utils.rate_limit.time.time", return_value=5000.0 + window + 1
        ):
            assert client.post(INITIATE_URL).status_code == 200


class TestTestConnectionRequiresAdmin:
    """The endpoint makes the server do outbound network I/O on demand and can echo
    provider configuration detail, so it must not be anonymous."""

    def test_anonymous_caller_is_rejected(self, client: TestClient):
        response = client.post(TEST_CONNECTION_URL)

        assert response.status_code in (401, 403)

    def test_non_admin_user_is_rejected(self, authenticated_client: TestClient):
        response = authenticated_client.post(TEST_CONNECTION_URL)

        assert response.status_code == 403

    def test_admin_still_reaches_the_endpoint(self, admin_client: TestClient):
        with patch.object(
            sso_endpoint.sso_service,
            "test_connection",
            return_value={"success": True, "message": "ok"},
        ) as mocked:
            mocked.return_value = {"success": True, "message": "ok"}
            response = admin_client.post(TEST_CONNECTION_URL)

        assert response.status_code == 200
        assert response.json()["success"] is True
