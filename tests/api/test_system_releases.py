"""
Tests for GET /api/v1/system/releases endpoint.

Covers:
- Response structure: releases list, current_version, timestamp fields present
- Limit parameter: capped at 20 by the endpoint regardless of query value
- current_version reflects the application settings
- Empty releases list is returned on service error rather than raising 500

Patch strategy note:
  The endpoint module imports get_release_notes_service at module scope, so the
  bound name lives in the system module's namespace. The correct patch target is
  "app.api.v1.endpoints.system.get_release_notes_service".
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

# Target for all service patches in this module
_SERVICE_PATCH_TARGET = "app.api.v1.endpoints.system.get_release_notes_service"


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

        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=mock_releases)
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert response.status_code == 200

    def test_response_contains_releases_key(self, api_client: TestClient):
        """Response body must include a 'releases' key with a list value."""
        mock_releases = _make_sample_releases(2)

        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=mock_releases)
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        body = response.json()
        assert "releases" in body
        assert isinstance(body["releases"], list)

    def test_response_contains_current_version_key(self, api_client: TestClient):
        """Response body must include a 'current_version' key."""
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=[])
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert "current_version" in response.json()

    def test_response_contains_timestamp_key(self, api_client: TestClient):
        """Response body must include a 'timestamp' key."""
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=[])
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert "timestamp" in response.json()

    def test_releases_list_contains_expected_fields(self, api_client: TestClient):
        """Each entry in 'releases' must contain the five standard fields."""
        expected_fields = {"tag_name", "name", "body", "published_at", "html_url"}
        mock_releases = _make_sample_releases(1)

        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
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
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=[])
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert response.json()["current_version"] == settings.VERSION


# ---------------------------------------------------------------------------
# Limit parameter
# ---------------------------------------------------------------------------


class TestLimitParameter:
    """Tests for the limit query parameter validated via Query(ge=1, le=20)."""

    def test_limit_caps_the_returned_releases(self, api_client: TestClient):
        """The endpoint returns at most `limit` releases."""
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(
                return_value=_make_sample_releases(20)
            )
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases?limit=5")

        assert len(response.json()["releases"]) == 5

    def test_scans_more_releases_than_it_returns(self, api_client: TestClient):
        """A small limit must not hide a newer release from the update check."""
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(return_value=[])
            mock_factory.return_value = mock_service

            api_client.get("/api/v1/system/releases?limit=1")

        mock_service.get_releases.assert_called_once_with(limit=None)

    def test_limit_above_20_returns_422(self, api_client: TestClient):
        """When limit exceeds 20, FastAPI returns a 422 validation error."""
        response = api_client.get("/api/v1/system/releases?limit=100")
        assert response.status_code == 422

    def test_limit_below_1_returns_422(self, api_client: TestClient):
        """When limit is less than 1, FastAPI returns a 422 validation error."""
        response = api_client.get("/api/v1/system/releases?limit=0")
        assert response.status_code == 422

    def test_limit_equal_to_20_is_accepted(self, api_client: TestClient):
        """A limit of exactly 20 is passed through without modification."""
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(
                return_value=_make_sample_releases(20)
            )
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases?limit=20")

        assert len(response.json()["releases"]) == 20

    def test_default_limit_is_10(self, api_client: TestClient):
        """When no limit is provided, the endpoint defaults to 10."""
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(
                return_value=_make_sample_releases(15)
            )
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert len(response.json()["releases"]) == 10


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    """Tests that verify graceful degradation when the service fails."""

    def test_endpoint_returns_empty_releases_on_service_exception(
        self, api_client: TestClient
    ):
        """When the service raises an exception, releases is an empty list."""
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
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
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
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
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(side_effect=ValueError("bad data"))
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert "timestamp" in response.json()

    def test_endpoint_does_not_return_500_on_service_exception(
        self, api_client: TestClient
    ):
        """Service failures must never propagate a 500 to the caller."""
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_service = AsyncMock()
            mock_service.get_releases = AsyncMock(
                side_effect=Exception("network error")
            )
            mock_factory.return_value = mock_service

            response = api_client.get("/api/v1/system/releases")

        assert response.status_code != 500


# ---------------------------------------------------------------------------
# Admin release settings and update check
# ---------------------------------------------------------------------------


def _release(tag: str, prerelease: bool = False) -> dict:
    return {
        "tag_name": tag,
        "name": tag,
        "body": "",
        "published_at": "2024-01-01T00:00:00Z",
        "html_url": f"https://github.com/example/repo/releases/tag/{tag}",
        "prerelease": prerelease,
    }


def _get(api_client, releases, path="/api/v1/system/releases"):
    with patch(_SERVICE_PATCH_TARGET) as mock_factory, patch.object(
        settings, "VERSION", "0.72.0"
    ):
        mock_factory.return_value.get_releases = AsyncMock(return_value=releases)
        return api_client.get(path).json()


class TestAdminReleaseSettings:
    def test_update_check_off_hides_latest_but_keeps_release_notes(
        self, api_client: TestClient, monkeypatch
    ):
        monkeypatch.setattr(settings, "RELEASE_CHECK_ENABLED", False)

        body = _get(api_client, [_release("v0.73.0"), _release("v0.72.0")])

        assert body["latest_version"] is None
        assert [r["tag_name"] for r in body["releases"]] == ["v0.73.0", "v0.72.0"]

    def test_popup_flag_is_independent_of_the_update_check(
        self, api_client: TestClient, monkeypatch
    ):
        monkeypatch.setattr(settings, "RELEASE_CHECK_ENABLED", False)
        monkeypatch.setattr(settings, "WHATS_NEW_POPUP_ENABLED", True)

        assert _get(api_client, [])["whats_new_popup_enabled"] is True

    def test_popup_flag_reflects_setting(self, api_client: TestClient, monkeypatch):
        monkeypatch.setattr(settings, "WHATS_NEW_POPUP_ENABLED", False)

        assert _get(api_client, [])["whats_new_popup_enabled"] is False


class TestUpdateAvailable:
    @pytest.fixture(autouse=True)
    def _check_on(self, monkeypatch):
        monkeypatch.setattr(settings, "RELEASE_CHECK_ENABLED", True)

    def test_newer_release_is_reported(self, api_client):
        releases = [_release("v0.73.0"), _release("v0.72.0")]
        body = _get(api_client, releases, "/api/v1/system/releases?limit=1")
        assert body["latest_version"] == "v0.73.0"

    def test_no_update_on_latest(self, api_client):
        assert _get(api_client, [_release("v0.72.0")])["latest_version"] is None

    def test_prerelease_is_not_an_update(self, api_client):
        body = _get(api_client, [_release("v0.80.0", prerelease=True)])
        assert body["latest_version"] is None

    def test_no_update_when_github_fails(self, api_client):
        with patch(_SERVICE_PATCH_TARGET) as mock_factory:
            mock_factory.return_value.get_releases = AsyncMock(
                side_effect=RuntimeError("down")
            )
            body = api_client.get("/api/v1/system/releases").json()
        assert body["latest_version"] is None
