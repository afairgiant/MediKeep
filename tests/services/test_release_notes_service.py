"""
Tests for ReleaseNotesService.

Covers:
- Cache hit: returns cached data without fetching from GitHub
- Cache expiry: fetches from GitHub when TTL is exceeded
- GitHub API failure: returns empty list when no stale cache exists
- Stale cache fallback: returns stale data when GitHub is unreachable
- Response transformation: maps GitHub API fields to simplified dict
- Limit parameter: slices results to the requested count
- Singleton: get_release_notes_service returns the same instance each call
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.release_notes_service import (
    ReleaseNotesService,
    get_release_notes_service,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_GITHUB_RESPONSE = [
    {
        "tag_name": "v1.0.0",
        "name": "Initial Release",
        "body": "First release notes",
        "published_at": "2024-01-01T00:00:00Z",
        "html_url": "https://github.com/example/repo/releases/tag/v1.0.0",
        "extra_field": "should be ignored",
    },
    {
        "tag_name": "v1.1.0",
        "name": "Second Release",
        "body": "Second release notes",
        "published_at": "2024-02-01T00:00:00Z",
        "html_url": "https://github.com/example/repo/releases/tag/v1.1.0",
    },
    {
        "tag_name": "v1.2.0",
        "name": "Third Release",
        "body": "Third release notes",
        "published_at": "2024-03-01T00:00:00Z",
        "html_url": "https://github.com/example/repo/releases/tag/v1.2.0",
    },
]

EXPECTED_KEYS = {"tag_name", "name", "body", "published_at", "html_url"}


def _make_mock_response(json_data: list, status_code: int = 200) -> MagicMock:
    """Build a mock httpx.Response with the given JSON payload."""
    mock_response = MagicMock()
    mock_response.json.return_value = json_data
    mock_response.status_code = status_code
    if status_code >= 400:
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(),
            response=mock_response,
        )
    else:
        mock_response.raise_for_status.return_value = None
    return mock_response


def _build_async_client_patch(response: MagicMock):
    """Return a patch context that replaces httpx.AsyncClient with one returning *response*."""
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_context_manager = MagicMock()
    mock_context_manager.__aenter__ = AsyncMock(return_value=mock_client)
    mock_context_manager.__aexit__ = AsyncMock(return_value=False)
    return mock_context_manager


# ---------------------------------------------------------------------------
# Cache behaviour
# ---------------------------------------------------------------------------


class TestCacheBehaviour:
    """Tests related to in-memory cache validity and expiry."""

    @pytest.mark.asyncio
    async def test_get_releases_returns_cached_data_when_cache_valid(self):
        """When cache is populated and TTL has not elapsed, no GitHub call is made."""
        service = ReleaseNotesService()
        cached_releases = [
            {
                "tag_name": "v0.9.0",
                "name": "Cached Release",
                "body": "cached",
                "published_at": "2023-12-01T00:00:00Z",
                "html_url": "https://github.com/example/releases/tag/v0.9.0",
            }
        ]
        service._cache = cached_releases
        # Timestamp set to now so cache is fresh
        service._cache_timestamp = time.time()

        with patch.object(
            service, "_fetch_from_github", new_callable=AsyncMock
        ) as mock_fetch:
            result = await service.get_releases(limit=10)

        mock_fetch.assert_not_called()
        assert result == cached_releases

    @pytest.mark.asyncio
    async def test_get_releases_fetches_from_github_when_cache_expired(self):
        """When the cache TTL has elapsed, _fetch_from_github is called."""
        service = ReleaseNotesService()
        stale_releases = [
            {
                "tag_name": "v0.8.0",
                "name": "Old Release",
                "body": "old",
                "published_at": "2023-06-01T00:00:00Z",
                "html_url": "https://github.com/example/releases/tag/v0.8.0",
            }
        ]
        fresh_releases = [
            {
                "tag_name": "v1.0.0",
                "name": "Fresh Release",
                "body": "fresh",
                "published_at": "2024-01-01T00:00:00Z",
                "html_url": "https://github.com/example/releases/tag/v1.0.0",
            }
        ]
        service._cache = stale_releases
        # Timestamp set far in the past so TTL is exceeded
        service._cache_timestamp = time.time() - (ReleaseNotesService.CACHE_TTL_SECONDS + 1)

        with patch.object(
            service,
            "_fetch_from_github",
            new_callable=AsyncMock,
            return_value=fresh_releases,
        ) as mock_fetch:
            result = await service.get_releases(limit=10)

        mock_fetch.assert_called_once()
        assert result == fresh_releases

    @pytest.mark.asyncio
    async def test_get_releases_fetches_from_github_when_cache_is_empty(self):
        """A service with no cached data always calls _fetch_from_github."""
        service = ReleaseNotesService()
        fetched_releases = [
            {
                "tag_name": "v2.0.0",
                "name": "Brand New",
                "body": "new",
                "published_at": "2025-01-01T00:00:00Z",
                "html_url": "https://github.com/example/releases/tag/v2.0.0",
            }
        ]

        with patch.object(
            service,
            "_fetch_from_github",
            new_callable=AsyncMock,
            return_value=fetched_releases,
        ) as mock_fetch:
            result = await service.get_releases()

        mock_fetch.assert_called_once()
        assert result == fetched_releases


# ---------------------------------------------------------------------------
# GitHub API fetch behaviour
# ---------------------------------------------------------------------------


class TestFetchFromGitHub:
    """Tests for _fetch_from_github, covering happy path and error handling."""

    @pytest.mark.asyncio
    async def test_fetch_from_github_returns_transformed_releases(self):
        """Successful GitHub response is mapped to the simplified dict format."""
        service = ReleaseNotesService()
        mock_response = _make_mock_response(SAMPLE_GITHUB_RESPONSE)
        mock_async_client = _build_async_client_patch(mock_response)

        with patch("httpx.AsyncClient", return_value=mock_async_client):
            result = await service._fetch_from_github()

        assert len(result) == len(SAMPLE_GITHUB_RESPONSE)
        for release in result:
            assert set(release.keys()) == EXPECTED_KEYS

    @pytest.mark.asyncio
    async def test_fetch_from_github_maps_fields_correctly(self):
        """Each simplified release contains the correct values from the GitHub payload."""
        service = ReleaseNotesService()
        mock_response = _make_mock_response([SAMPLE_GITHUB_RESPONSE[0]])
        mock_async_client = _build_async_client_patch(mock_response)

        with patch("httpx.AsyncClient", return_value=mock_async_client):
            result = await service._fetch_from_github()

        assert len(result) == 1
        release = result[0]
        assert release["tag_name"] == "v1.0.0"
        assert release["name"] == "Initial Release"
        assert release["body"] == "First release notes"
        assert release["published_at"] == "2024-01-01T00:00:00Z"
        assert release["html_url"] == "https://github.com/example/repo/releases/tag/v1.0.0"
        # Extra fields from GitHub must not be forwarded to consumers
        assert "extra_field" not in release

    @pytest.mark.asyncio
    async def test_fetch_from_github_populates_cache_on_success(self):
        """After a successful fetch the in-memory cache is updated."""
        service = ReleaseNotesService()
        assert service._cache == []
        assert service._cache_timestamp == 0.0

        mock_response = _make_mock_response(SAMPLE_GITHUB_RESPONSE)
        mock_async_client = _build_async_client_patch(mock_response)

        with patch("httpx.AsyncClient", return_value=mock_async_client):
            with patch("time.time", return_value=1_700_000_000.0):
                await service._fetch_from_github()

        assert len(service._cache) == len(SAMPLE_GITHUB_RESPONSE)
        assert service._cache_timestamp == 1_700_000_000.0

    @pytest.mark.asyncio
    async def test_fetch_from_github_returns_empty_list_on_http_error_with_no_cache(self):
        """An httpx.HTTPError with no stale cache results in an empty list, not an exception."""
        service = ReleaseNotesService()
        mock_async_client = MagicMock()
        mock_client_instance = AsyncMock()
        mock_client_instance.get.side_effect = httpx.HTTPError("connection refused")
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_async_client):
            result = await service._fetch_from_github()

        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_from_github_returns_empty_list_on_generic_exception_with_no_cache(self):
        """An unexpected exception with no stale cache results in an empty list."""
        service = ReleaseNotesService()
        mock_async_client = MagicMock()
        mock_client_instance = AsyncMock()
        mock_client_instance.get.side_effect = RuntimeError("unexpected error")
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_async_client):
            result = await service._fetch_from_github()

        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_from_github_returns_stale_cache_when_github_unreachable(self):
        """When a fetch fails but stale cache data exists, the stale data is returned."""
        service = ReleaseNotesService()
        stale = [
            {
                "tag_name": "v0.5.0",
                "name": "Stale",
                "body": "stale body",
                "published_at": "2023-01-01T00:00:00Z",
                "html_url": "https://github.com/example/releases/tag/v0.5.0",
            }
        ]
        # Populate stale cache (expired timestamp)
        service._cache = stale
        service._cache_timestamp = time.time() - (ReleaseNotesService.CACHE_TTL_SECONDS + 100)

        mock_async_client = MagicMock()
        mock_client_instance = AsyncMock()
        mock_client_instance.get.side_effect = httpx.HTTPError("timeout")
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_async_client):
            result = await service._fetch_from_github()

        assert result == stale

    @pytest.mark.asyncio
    async def test_fetch_from_github_returns_stale_cache_on_http_status_error(self):
        """An HTTP 5xx error with stale cache returns the stale cache instead of raising."""
        service = ReleaseNotesService()
        stale = [
            {
                "tag_name": "v0.4.0",
                "name": "Stale v2",
                "body": "stale body v2",
                "published_at": "2022-06-01T00:00:00Z",
                "html_url": "https://github.com/example/releases/tag/v0.4.0",
            }
        ]
        service._cache = stale
        service._cache_timestamp = 1.0  # very old

        mock_response = _make_mock_response([], status_code=503)
        mock_async_client = _build_async_client_patch(mock_response)

        with patch("httpx.AsyncClient", return_value=mock_async_client):
            result = await service._fetch_from_github()

        assert result == stale


# ---------------------------------------------------------------------------
# Limit parameter
# ---------------------------------------------------------------------------


class TestLimitParameter:
    """Tests for the limit parameter in get_releases."""

    @pytest.mark.asyncio
    async def test_limit_slices_cached_results(self):
        """When the cache is valid, only *limit* entries are returned."""
        service = ReleaseNotesService()
        service._cache = [
            {
                "tag_name": f"v{i}.0.0",
                "name": f"Release {i}",
                "body": f"body {i}",
                "published_at": "2024-01-01T00:00:00Z",
                "html_url": f"https://github.com/example/releases/tag/v{i}.0.0",
            }
            for i in range(15)
        ]
        service._cache_timestamp = time.time()

        result = await service.get_releases(limit=5)

        assert len(result) == 5
        assert result[0]["tag_name"] == "v0.0.0"
        assert result[4]["tag_name"] == "v4.0.0"

    @pytest.mark.asyncio
    async def test_limit_slices_fetched_results(self):
        """When data is fetched from GitHub, only *limit* entries are returned."""
        service = ReleaseNotesService()
        fetched = [
            {
                "tag_name": f"v{i}.0.0",
                "name": f"Release {i}",
                "body": f"body {i}",
                "published_at": "2024-01-01T00:00:00Z",
                "html_url": f"https://github.com/example/releases/tag/v{i}.0.0",
            }
            for i in range(10)
        ]

        with patch.object(
            service,
            "_fetch_from_github",
            new_callable=AsyncMock,
            return_value=fetched,
        ):
            result = await service.get_releases(limit=3)

        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_limit_larger_than_available_results_returns_all(self):
        """A limit larger than the cache size returns all available releases."""
        service = ReleaseNotesService()
        service._cache = [
            {
                "tag_name": "v1.0.0",
                "name": "Only Release",
                "body": "sole entry",
                "published_at": "2024-01-01T00:00:00Z",
                "html_url": "https://github.com/example/releases/tag/v1.0.0",
            }
        ]
        service._cache_timestamp = time.time()

        result = await service.get_releases(limit=100)

        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_default_limit_is_ten(self):
        """Calling get_releases with no limit argument returns at most 10 entries."""
        service = ReleaseNotesService()
        service._cache = [
            {
                "tag_name": f"v{i}.0.0",
                "name": f"Release {i}",
                "body": f"body {i}",
                "published_at": "2024-01-01T00:00:00Z",
                "html_url": f"https://github.com/example/releases/tag/v{i}.0.0",
            }
            for i in range(20)
        ]
        service._cache_timestamp = time.time()

        result = await service.get_releases()

        assert len(result) == 10


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------


class TestSingleton:
    """Tests for the get_release_notes_service factory function."""

    def test_get_release_notes_service_returns_release_notes_service_instance(self):
        """get_release_notes_service returns a ReleaseNotesService object."""
        import app.services.release_notes_service as module

        # Reset singleton so the test is independent
        module._service_instance = None
        try:
            instance = get_release_notes_service()
            assert isinstance(instance, ReleaseNotesService)
        finally:
            module._service_instance = None

    def test_get_release_notes_service_returns_same_instance_on_repeated_calls(self):
        """Repeated calls return the identical object, sharing the cache."""
        import app.services.release_notes_service as module

        module._service_instance = None
        try:
            first = get_release_notes_service()
            second = get_release_notes_service()
            assert first is second
        finally:
            module._service_instance = None

    def test_singleton_cache_is_shared_across_callers(self):
        """Mutations to the cache via one reference are visible through another."""
        import app.services.release_notes_service as module

        module._service_instance = None
        try:
            first = get_release_notes_service()
            second = get_release_notes_service()

            first._cache = [{"tag_name": "v9.9.9"}]
            assert second._cache == [{"tag_name": "v9.9.9"}]
        finally:
            module._service_instance = None
