"""
Outbound HTTP sessions for user-configured integration URLs (Paperless, Papra).

Every session built here connects only to addresses approved by
``validate_integration_url`` and refuses any request, including a redirect hop,
that leaves the configured host.
"""

from dataclasses import dataclass
from typing import Any, Tuple, Type
from urllib.parse import urlparse

import aiohttp
from aiohttp import ClientHandlerType, ClientRequest, ClientResponse

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.url_security import (
    PinnedResolver,
    _IpAddress,
    validate_integration_url,
)

security_logger = get_logger(__name__, "security")


class UnsafeRedirectError(aiohttp.ClientError):
    """A request targeted a host or scheme other than the validated integration URL."""


@dataclass(frozen=True)
class PinnedTarget:
    """An integration URL with the addresses it was validated against."""

    url: str
    ips: Tuple[_IpAddress, ...]


def pin_integration_url(url: str, error_cls: Type[Exception]) -> PinnedTarget:
    """Validate ``url`` for connecting; raises ``error_cls`` with a user-facing reason."""
    # Authoritative connection-time check; save-time validation tolerates unresolved hosts.
    try:
        ips = validate_integration_url(
            url, allow_private=settings.ALLOW_PRIVATE_INTEGRATION_URLS
        )
    except ValueError as exc:
        raise error_cls(str(exc)) from exc
    return PinnedTarget(url, tuple(ips))


def _hop_guard(hostname: str, scheme: str):
    async def guard(req: ClientRequest, handler: ClientHandlerType) -> ClientResponse:
        target_host = (req.url.host or "").lower()
        # IP-literal hosts skip the resolver entirely, so this check is the only stop for them.
        if target_host != hostname or (scheme == "https" and req.url.scheme != "https"):
            security_logger.warning(
                "Blocked integration request to an unvalidated target",
                extra={
                    LogFields.CATEGORY: "security",
                    LogFields.EVENT: "integration_redirect_blocked",
                },
            )
            raise UnsafeRedirectError(
                "The integration server redirected to a different address. "
                "Save the final URL of the service instead."
            )
        return await handler(req)

    return guard


def build_integration_session(
    target: PinnedTarget, **session_kwargs: Any
) -> aiohttp.ClientSession:
    """Create a ClientSession restricted to ``target``'s host and addresses.

    Callers must not pass per-request ``middlewares``: aiohttp lets them replace the
    session's guard.
    """
    parsed = urlparse(target.url)
    hostname = parsed.hostname or ""
    connector = aiohttp.TCPConnector(
        limit=10,
        limit_per_host=5,
        resolver=PinnedResolver(hostname, target.ips),
    )
    return aiohttp.ClientSession(
        connector=connector,
        middlewares=(_hop_guard(hostname, parsed.scheme),),
        **session_kwargs,
    )
