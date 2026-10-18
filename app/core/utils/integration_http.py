"""
Outbound HTTP sessions for user-configured integration URLs (Paperless, Papra).

Every session built here connects only to addresses approved by
``validate_integration_url`` and refuses any request, including a redirect hop,
that leaves the configured host.
"""

from dataclasses import dataclass
from typing import Any, Tuple, Type

import aiohttp
from aiohttp import ClientHandlerType, ClientRequest, ClientResponse
from yarl import URL

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.url_security import (
    PinnedResolver,
    _IpAddress,
    validate_integration_url,
)

security_logger = get_logger(__name__, "security")

UNSAFE_REDIRECT_MESSAGE = (
    "The integration server redirected to a different address. "
    "Save the final URL of the service instead."
)


class UnsafeRedirectError(aiohttp.ClientError):
    """A request left the validated integration origin or would travel through a proxy."""


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


def _hop_guard(hostname: str, scheme: str, port: int):
    async def guard(req: ClientRequest, handler: ClientHandlerType) -> ClientResponse:
        # A proxy resolves the target itself, bypassing the pinned addresses.
        if req.proxy is not None:
            raise UnsafeRedirectError("Integration requests must not use a proxy.")
        target_host = (req.url.host or "").lower()
        # IP-literal hosts skip the resolver entirely, so this check is the only stop for them.
        if target_host != hostname or req.url.port != port or req.url.scheme != scheme:
            security_logger.warning(
                "Blocked integration request to an unvalidated target",
                extra={
                    LogFields.CATEGORY: "security",
                    LogFields.EVENT: "integration_redirect_blocked",
                },
            )
            raise UnsafeRedirectError(UNSAFE_REDIRECT_MESSAGE)
        return await handler(req)

    return guard


def build_integration_session(
    target: PinnedTarget, **session_kwargs: Any
) -> aiohttp.ClientSession:
    """Create a ClientSession restricted to ``target``'s host and addresses.

    Callers must not pass per-request ``middlewares``: aiohttp lets them replace the
    session's guard.

    Raises:
        ValueError: if ``trust_env`` is enabled.
    """
    if session_kwargs.get("trust_env"):
        raise ValueError("Integration sessions must not read proxy settings from env")
    parsed = URL(target.url)
    hostname = parsed.host or ""
    connector = aiohttp.TCPConnector(
        limit=10,
        limit_per_host=5,
        resolver=PinnedResolver(hostname, target.ips),
    )
    return aiohttp.ClientSession(
        connector=connector,
        middlewares=(_hop_guard(hostname, parsed.scheme, parsed.port),),
        **session_kwargs,
    )
