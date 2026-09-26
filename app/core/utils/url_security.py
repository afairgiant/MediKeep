"""
SSRF protection helpers for user-configurable integration URLs.

MediKeep lets each user point integrations (Paperless-ngx, Papra) at a URL of
their choosing, and the backend then makes outbound HTTP requests to it. Without
validation this is a Server-Side Request Forgery primitive: an attacker can aim
the backend at internal-only hosts on the deployment's private network.

Because MediKeep is overwhelmingly self-hosted (Paperless/Papra commonly run on
the same Docker network or a LAN IP behind a firewall), reaching a private LAN
address is usually the *intended* behaviour, not an attack. We therefore split
the address space into two tiers:

* **Always blocked**, regardless of configuration: link-local / cloud-metadata
  (169.254.0.0/16, fe80::/10 — e.g. 169.254.169.254 for AWS/GCP credential
  theft), multicast, and unspecified addresses. These are never a valid
  integration target and have catastrophic worst cases, so there is no opt-in.
* **Allow-gated**: RFC1918 private ranges (10/8, 172.16/12, 192.168/16) and
  loopback. Allowed by default so self-hosting works out of the box; a
  security-conscious operator running an internet-exposed, multi-user instance
  can set ``ALLOW_PRIVATE_INTEGRATION_URLS=false`` to lock integrations down to
  public addresses only.

Resolution is done against the *resolved* IP address(es), not just the literal
hostname text, which also closes the DNS-rebinding gap where a public-looking
hostname resolves to an internal IP.

Plain HTTP is only accepted for hosts that resolve to a private/loopback address.
"""

import ipaddress
import socket
from typing import List, Optional, Sequence, Union
from urllib.parse import urlparse

from aiohttp.abc import AbstractResolver, ResolveResult

_IpAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]

# Shown when an allow-gated private/internal address is rejected because the
# deployment has locked integrations down to public addresses.
PRIVATE_URL_ERROR = (
    "This URL points to a private or internal network address. This deployment "
    "has restricted integrations to public addresses; ask your administrator to "
    "set ALLOW_PRIVATE_INTEGRATION_URLS=true to use a private address."
)

# Shown when a link-local / cloud-metadata address is rejected. Always blocked.
METADATA_URL_ERROR = (
    "This URL points to a link-local or cloud-metadata address (e.g. "
    "169.254.169.254), which is never a valid integration target and is always "
    "blocked for security."
)

# Shown when a host cannot be resolved and the caller does not accept unresolved
# (indeterminate) results. Fail closed - such a host cannot be verified as safe.
UNRESOLVED_URL_ERROR = (
    "This URL's host could not be resolved to an IP address, so it cannot be "
    "verified as safe. Check the hostname and that the server is reachable."
)

# Shown when a plain-HTTP URL does not resolve to a private/loopback address.
INSECURE_URL_ERROR = "External URLs must use HTTPS for security"


def _ip_always_blocked(ip: _IpAddress) -> bool:
    """IPs that are never a legitimate integration target, blocked regardless of
    ALLOW_PRIVATE_INTEGRATION_URLS. Notably link-local covers cloud metadata
    (169.254.169.254). ``is_reserved`` is deliberately excluded: it flags IPv6
    loopback (::1) as reserved, which would wrongly block localhost."""
    return ip.is_link_local or ip.is_multicast or ip.is_unspecified


def _ip_is_internal(ip: _IpAddress) -> bool:
    """Any address that is not globally routable - private and loopback ranges
    but also shared CGNAT space (100.64.0.0/10), benchmarking, and documentation
    ranges. Legitimate for self-hosted setups but blocked when private
    integration URLs are not allowed. (Link-local/metadata is handled earlier by
    _ip_always_blocked and always blocked regardless of this.)"""
    return not ip.is_global


def _resolve_ips(url: str) -> Optional[List[_IpAddress]]:
    """Return the IP address(es) a URL's host points to.

    Literal IPs are returned directly. Hostnames are resolved via getaddrinfo.
    Returns ``None`` when the host is missing or cannot be resolved - an
    indeterminate result that callers must treat as unsafe unless they
    explicitly accept unresolved hosts.
    """
    hostname = urlparse(url).hostname
    if not hostname:
        return None

    try:
        return [ipaddress.ip_address(hostname)]
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return None

    ips: List[_IpAddress] = []
    for info in infos:
        try:
            ips.append(ipaddress.ip_address(info[4][0]))
        except ValueError:
            continue
    return ips or None


def _classify_ips(ips: Sequence[_IpAddress]) -> str:
    if any(_ip_always_blocked(ip) for ip in ips):
        return "metadata"
    if any(not _ip_is_internal(ip) for ip in ips):
        return "public"
    return "internal"


def classify_url(url: str) -> str:
    """Classify a URL's target by resolved IP.

    Returns one of:
        "metadata"      - any address is always-blocked (link-local /
                          cloud-metadata / multicast / unspecified)
        "public"        - any address is public
        "internal"      - every address is private/loopback
        "indeterminate" - host is missing or could not be resolved
    """
    ips = _resolve_ips(url)
    return _classify_ips(ips) if ips else "indeterminate"


def validate_integration_url(
    url: Optional[str], *, allow_private: bool, allow_unresolved: bool = False
) -> List[_IpAddress]:
    """Resolve an integration URL's host and return the addresses it may connect to.

    Raises ValueError when:
    - any address is link-local / cloud-metadata (always);
    - any address is private/loopback, unless ``allow_private``;
    - the URL is plain ``http://`` and any address is public;
    - the host cannot be resolved, unless ``allow_unresolved``.
      Save-time validators may pass it; connection-time callers must not.

    Returns an empty list for an empty URL or an accepted unresolved host.
    Connections must be pinned to the returned addresses (see ``PinnedResolver``).
    """
    if not url:
        return []
    ips = _resolve_ips(url)
    if not ips:
        if allow_unresolved:
            return []
        raise ValueError(UNRESOLVED_URL_ERROR)
    classification = _classify_ips(ips)
    if classification == "metadata":
        raise ValueError(METADATA_URL_ERROR)
    if not allow_private and any(_ip_is_internal(ip) for ip in ips):
        raise ValueError(PRIVATE_URL_ERROR)
    if urlparse(url).scheme == "http" and classification == "public":
        raise ValueError(INSECURE_URL_ERROR)
    return ips


class PinnedResolver(AbstractResolver):
    """aiohttp resolver that answers only for one host, with pre-validated addresses.

    Any other host (e.g. a redirect target) fails to resolve.
    """

    def __init__(self, hostname: str, ips: Sequence[_IpAddress]):
        self._hostname = hostname.lower()
        self._ips = list(ips)

    async def resolve(
        self, host: str, port: int = 0, family: socket.AddressFamily = socket.AF_INET
    ) -> List[ResolveResult]:
        if host.lower() != self._hostname:
            raise OSError(f"Refusing to resolve unvalidated host {host!r}")
        results: List[ResolveResult] = []
        for ip in self._ips:
            ip_family = socket.AF_INET if ip.version == 4 else socket.AF_INET6
            if family not in (socket.AF_UNSPEC, ip_family):
                continue
            results.append(
                {
                    "hostname": host,
                    "host": str(ip),
                    "port": port,
                    "family": ip_family,
                    "proto": 0,
                    "flags": socket.AI_NUMERICHOST,
                }
            )
        if not results:
            raise OSError(f"No validated address for {host!r} in requested family")
        return results

    async def close(self) -> None:
        return None
