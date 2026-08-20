"""Regression cover for the two endpoints migrated onto the shared rate limiter.

Both previously had their own hand-rolled limiter class. Neither had a test, which
is why the migration needs one: the observable behavior at each call site must be
unchanged.
"""

import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import medical_specialty as specialty_endpoint
from app.api.v1.endpoints import system as system_endpoint

LOG_LEVEL_URL = "/api/v1/system/log-level"
SPECIALTY_URL = "/api/v1/medical-specialties/"


@pytest.fixture
def system_limit(limiter_ceiling):
    """Set the log-level limiter's ceiling, restoring the shipped value after."""
    return lambda n: limiter_ceiling(system_endpoint.rate_limiter, n)


@pytest.fixture
def specialty_limit(limiter_ceiling):
    return lambda n: limiter_ceiling(specialty_endpoint._create_limiter, n)


class TestSystemLogLevelStillRateLimits:
    def test_requests_under_the_limit_succeed(self, client: TestClient, system_limit):
        system_limit(2)

        assert client.get(LOG_LEVEL_URL).status_code == 200
        assert client.get(LOG_LEVEL_URL).status_code == 200

    def test_over_the_limit_returns_429(self, client: TestClient, system_limit):
        system_limit(1)
        client.get(LOG_LEVEL_URL)

        assert client.get(LOG_LEVEL_URL).status_code == 429

    def test_429_still_returns_the_rate_limit_headers(
        self, client: TestClient, system_limit
    ):
        system_limit(1)
        client.get(LOG_LEVEL_URL)

        response = client.get(LOG_LEVEL_URL)

        # The limit reported must be the limiter's own, not a hardcoded constant.
        assert response.headers["X-RateLimit-Limit"] == "1"
        assert response.headers["X-RateLimit-Remaining"] == "0"
        assert "X-RateLimit-Reset" in response.headers
        assert int(response.headers["Retry-After"]) >= 1

    def test_successful_response_still_reports_rate_limit_info(
        self, client: TestClient, system_limit
    ):
        system_limit(5)

        body = client.get(LOG_LEVEL_URL).json()

        assert "rate_limit_info" in body

    def test_limits_are_per_ip(self, client: TestClient, system_limit):
        system_limit(1)
        client.get(LOG_LEVEL_URL, headers={"X-Forwarded-For": "198.51.100.30"})

        exhausted = client.get(
            LOG_LEVEL_URL, headers={"X-Forwarded-For": "198.51.100.30"}
        )
        other = client.get(LOG_LEVEL_URL, headers={"X-Forwarded-For": "198.51.100.31"})

        assert exhausted.status_code == 429
        assert other.status_code == 200


class TestSpecialtyCreateStillRateLimits:
    def test_creates_under_the_limit_succeed(
        self, authenticated_client: TestClient, specialty_limit
    ):
        specialty_limit(2)

        first = authenticated_client.post(SPECIALTY_URL, json={"name": "Cardiology"})
        second = authenticated_client.post(SPECIALTY_URL, json={"name": "Neurology"})

        assert first.status_code in (200, 201)
        assert second.status_code in (200, 201)

    def test_over_the_limit_returns_429_with_retry_after(
        self, authenticated_client: TestClient, specialty_limit
    ):
        specialty_limit(1)
        authenticated_client.post(SPECIALTY_URL, json={"name": "Dermatology"})

        response = authenticated_client.post(SPECIALTY_URL, json={"name": "Oncology"})

        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) >= 1

    def test_limit_is_keyed_per_user_not_per_ip(
        self, authenticated_client: TestClient, specialty_limit, admin_token_headers
    ):
        """Users behind a shared NAT must not be limited collectively."""
        specialty_limit(1)
        authenticated_client.post(SPECIALTY_URL, json={"name": "Radiology"})
        assert (
            authenticated_client.post(SPECIALTY_URL, json={"name": "Urology"})
        ).status_code == 429

        other_user = authenticated_client.post(
            SPECIALTY_URL, json={"name": "Pathology"}, headers=admin_token_headers
        )

        assert other_user.status_code in (200, 201)
