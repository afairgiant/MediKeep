"""
Tests for GET /api/v1/system/releases endpoint.

Covers:
- Response structure: releases list, current_version, timestamp fields present
- Limit parameter: capped at 20 by the endpoint regardless of query value
- current_version reflects the application settings
- Empty releases list is returned on service error rather than raising 500

Patch strategy note:
  The endpoint imports get_release_notes_service inside the function body:
      from app.services.release_notes_service import get_release_notes_service
  Because the import is local (not module-level), the name is not bound in the
  system module's namespace. The correct patch target is therefore the original
  definition site: "app.services.release_notes_service.get_release_notes_service".
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

# Target for all service patches in this module
_SERVICE_PATCH_TARGET = "app.services.release_notes_service.get_release_notes_service"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client() -> TestClient:
    """Provide a TestClient without any database dependency.

    The releases endpoint does not touch the database, so a plain client is
    sufficient and avoids the overhead of the db_session fixture.
    """
    with TestClient(app, raise_server_exceptions=True) as client:
        yield client


def _make_sample_releases(count: int) -> list[dict]:
    """Build *count* minimal release dicts in the format returned by the service."""
    return [
        {
            "tag_name": f"v{i}.0.0",
            "name": f"Release {i}",
            "body": f"Release notes for version {i}",
            "published_at": "2024-01-01T00:00:00Z",
            "html_url": f"https://github.com/example/repo/releases/tag/v{i}.0.0",
        }
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# Response structure
# ---------------------------------------------------------------------------


class TestReleasesResponseStructure:
    """Tests that verify the shape and required fields of the response."""

    def test_endpoint_returns_200(self, api_client: TestClient):
        """GET /releases returns HTTP 200."""
        mock_releases = _make_sample_releases(3)

        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=mock_releases)
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert response.status_code == 200

    def test_response_contains_releases_key(self, api_client: TestClient):
        """Response body must include a 'releases' key with a list value."""
        mock_releases = _make_sample_releases(2)

        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=mock_releases)
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        body = response.json()
        assert "releases" in body
        assert isinstance(body["releases"], list)

    def test_response_contains_current_version_key(self, api_client: TestClient):
        """Response body must include a 'current_version' key."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=[])
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert "current_version" in response.json()

    def test_response_contains_timestamp_key(self, api_client: TestClient):
        """Response body must include a 'timestamp' key."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=[])
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert "timestamp" in response.json()

    def test_releases_list_contains_expected_fields(self, api_client: TestClient):
        """Each entry in 'releases' must contain the five standard fields."""
        expected_fields = {"tag_name", "name", "body", "published_at", "html_url"}
        mock_releases = _make_sample_releases(1)

        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=mock_releases)
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        releases = response.json()["releases"]
        assert len(releases) == 1
        assert expected_fields.issubset(set(releases[0].keys()))


# ---------------------------------------------------------------------------
# current_version field
# ---------------------------------------------------------------------------


class TestCurrentVersion:
    """Tests that verify current_version matches the application settings."""

    def test_current_version_matches_settings_version(self, api_client: TestClient):
        """The 'current_version' field must equal settings.VERSION."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=[])
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert response.json()["current_version"] == settings.VERSION


# ---------------------------------------------------------------------------
# Limit parameter
# ---------------------------------------------------------------------------


class TestLimitParameter:
    """Tests for the limit query parameter and its cap at 20."""

    def test_limit_parameter_is_forwarded_to_service(self, api_client: TestClient):
        """The endpoint passes the limit value on to service.get_releases."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=[])
            mock_factory.return_value = mock_service

            api_client.get("/api/v1/system/releases?limit=5")

        mock_service.get_releases.assert_called_once_with(limit=5)

    def test_limit_is_capped_at_20(self, api_client: TestClient):
        """When limit exceeds 20, the endpoint passes min(limit, 20) to the service."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=_make_sample_releases(20))
            mock_factory.return_value = mock_service

            api_client.get("/api/v1/system/releases?limit=100")

        mock_service.get_releases.assert_called_once_with(limit=20)

    def test_limit_equal_to_20_is_accepted(self, api_client: TestClient):
        """A limit of exactly 20 is passed through without modification."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=_make_sample_releases(20))
            mock_factory.return_value = mock_service

            api_client.get("/api/v1/system/releases?limit=20")

        mock_service.get_releases.assert_called_once_with(limit=20)

    def test_default_limit_is_10(self, api_client: TestClient):
        """When no limit is provided, the endpoint defaults to 10."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=_make_sample_releases(10))
            mock_factory.return_value = mock_service

            api_client.get("/api/v1/system/releases")

        mock_service.get_releases.assert_called_once_with(limit=10)


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    """Tests that verify graceful degradation when the service fails."""

    def test_endpoint_returns_empty_releases_on_service_exception(
        self, api_client: TestClient
    ):
        """When the service raises an exception, releases is an empty list."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(
                side_effect=Exception("GitHub unavailable")
            )
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert response.status_code == 200
        body = response.json()
        assert body["releases"] == []

    def test_endpoint_still_returns_current_version_on_service_exception(
        self, api_client: TestClient
    ):
        """Even when the service fails, current_version is included in the response."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(
                side_effect=RuntimeError("unexpected failure")
            )
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        body = response.json()
        assert body["current_version"] == settings.VERSION

    def test_endpoint_still_returns_timestamp_on_service_exception(
        self, api_client: TestClient
    ):
        """Even when the service fails, a timestamp is included in the response."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(
                side_effect=ValueError("bad data")
            )
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert "timestamp" in response.json()

    def test_endpoint_does_not_return_500_on_service_exception(
        self, api_client: TestClient
    ):
        """Service failures must never propagate a 500 to the caller."""
        with patch(
            _SERVICE_PATCH_TARGET
        ) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(
                side_effect=Exception("network error")
            )
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert response.status_code != 500
