"""
Release Notes Service

Fetches GitHub release notes for the MediKeep application and caches them
in memory to avoid exceeding GitHub API rate limits on repeated requests.
"""

import time

import httpx

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__, "app")


class ReleaseNotesService:
    """
    Fetches and caches GitHub release data for the MediKeep application.

    Uses a simple in-memory cache with a configurable TTL to reduce GitHub
    API calls. If a fetch fails but stale cache data is available, the stale
    data is returned rather than propagating an error to the caller.
    """

    GITHUB_API_URL = (
        "https://api.github.com/repos/afairgiant/MediKeep/releases"
    )
    CACHE_TTL_SECONDS = 3600  # 1 hour

    def __init__(self) -> None:
        self._cache: list[dict] = []
        self._cache_timestamp: float = 0.0

    def _is_cache_valid(self) -> bool:
        """Return True if the cache is populated and has not yet expired."""
        if not self._cache:
            return False
        return (time.time() - self._cache_timestamp) < self.CACHE_TTL_SECONDS

    async def _fetch_from_github(self) -> list[dict]:
        """
        Retrieve release data from the GitHub API.

        Maps each release to a simplified dict containing only the fields
        consumed by the frontend. On any network or HTTP error, logs a warning
        and returns an empty list (or the existing stale cache when available).

        Returns:
            A list of simplified release dicts, or an empty list on failure.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.GITHUB_API_URL,
                    headers={
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "MediKeep",
                    },
                )
                response.raise_for_status()

            releases = [
                {
                    "tag_name": release.get("tag_name"),
                    "name": release.get("name"),
                    "body": release.get("body"),
                    "published_at": release.get("published_at"),
                    "html_url": release.get("html_url"),
                }
                for release in response.json()
            ]

            self._cache = releases
            self._cache_timestamp = time.time()

            logger.info(
                "GitHub releases fetched and cached",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "github_releases_fetched",
                    LogFields.COUNT: len(releases),
                },
            )

            return releases

        except httpx.HTTPError as exc:
            logger.warning(
                "Failed to fetch releases from GitHub",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "github_releases_fetch_failed",
                    LogFields.ERROR: str(exc),
                },
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(
                "Unexpected error while fetching GitHub releases",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "github_releases_fetch_error",
                    LogFields.ERROR: str(exc),
                },
            )

        # Return stale cache when available rather than surfacing an error.
        if self._cache:
            logger.info(
                "Returning stale cached releases after fetch failure",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "github_releases_stale_cache_used",
                    LogFields.COUNT: len(self._cache),
                },
            )
            return self._cache

        return []

    async def get_releases(self, limit: int = 10) -> list[dict]:
        """
        Return the most recent GitHub releases up to *limit* entries.

        Serves from cache when the cached data is still valid; otherwise
        triggers a fresh fetch from the GitHub API.

        Args:
            limit: Maximum number of releases to return. Defaults to 10.

        Returns:
            A list of release dicts, each containing tag_name, name, body,
            published_at, and html_url.
        """
        if self._is_cache_valid():
            return self._cache[:limit]

        releases = await self._fetch_from_github()
        return releases[:limit]


_service_instance: ReleaseNotesService | None = None


def get_release_notes_service() -> ReleaseNotesService:
    """
    Return the module-level singleton ReleaseNotesService instance.

    Creates the instance on first call and reuses it on subsequent calls,
    ensuring the in-memory cache is shared across all callers.
    """
    global _service_instance  # pylint: disable=global-statement
    if _service_instance is None:
        _service_instance = ReleaseNotesService()
    return _service_instance
