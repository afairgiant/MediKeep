"""Resolve the address a request came from, for rate-limit keys and audit logs.

One resolver for the whole app: a limiter that buckets by one value while the
security log records another cannot be reasoned about after the fact.
"""

import ipaddress
from typing import List, Optional

from fastapi import Request

from app.core.config import settings
from app.core.logging.constants import sanitize_log_input

# IPv6 maximum textual length.
_MAX_IP_LENGTH = 45

UNKNOWN_IP = "unknown"


def _parse_ip(value: str) -> Optional[ipaddress._BaseAddress]:
    """Read one forwarded-header entry as an address, or None.

    Anything unreadable is rejected rather than passed through, since the result
    becomes a rate-limit key and an audit-log address.
    """
    try:
        return ipaddress.ip_address(value.strip())
    except ValueError:
        return None


def _is_trusted(address: Optional[ipaddress._BaseAddress], networks: List) -> bool:
    if address is None:
        return False
    return any(address in network for network in networks)


def _forwarded_client(request: Request, networks: List) -> Optional[str]:
    """The nearest address in the forwarded chain that is not infrastructure.

    Walks X-Forwarded-For right to left because only the rightmost entries were
    written by peers we trust - everything left of the first untrusted hop is
    whatever that hop chose to send. A CDN edge is skipped like a trusted proxy,
    since the deployment's own proxy appended it and the visitor sits to its left.
    Falls back to X-Real-IP, which the proxy must overwrite - see below.
    """
    skippable = list(networks) + settings.CDN_FORWARDER_NETWORKS

    forwarded_for = request.headers.get("x-forwarded-for", "")
    for entry in reversed(forwarded_for.split(",")):
        address = _parse_ip(entry)
        if address is None:
            continue
        if _is_trusted(address, skippable):
            continue
        return str(address)

    # Reached only when the peer sent no usable chain. Unlike X-Forwarded-For, this
    # carries one value the proxy is required to overwrite (04-deployment.md) - there
    # is no appended hop here to discard a forgery against, so a proxy that forwards
    # the caller's copy lets the caller choose this value.
    real_ip = _parse_ip(request.headers.get("x-real-ip", ""))
    if real_ip is not None and not _is_trusted(real_ip, networks):
        return str(real_ip)

    return None


def get_client_ip(request: Request) -> str:
    """The client's address: the socket peer, or what a trusted proxy says.

    Forwarded headers are read only when the peer is in TRUSTED_PROXY_IPS, so an
    unproxied deployment cannot be told who its callers are. Returns ``unknown``
    when there is no peer at all.
    """
    peer = getattr(request.client, "host", None) if request.client else None
    if not peer:
        return UNKNOWN_IP

    networks = settings.TRUSTED_PROXY_NETWORKS
    if _is_trusted(_parse_ip(peer), networks):
        forwarded = _forwarded_client(request, networks)
        if forwarded is not None:
            return sanitize_log_input(forwarded, max_length=_MAX_IP_LENGTH)

    return sanitize_log_input(peer, max_length=_MAX_IP_LENGTH)
