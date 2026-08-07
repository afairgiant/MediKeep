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
"""

import ipaddress
import socket
from typing import List, Optional, Union
from urllib.parse import urlparse

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


def classify_url(url: str) -> str:
    """Classify a URL's target by resolved IP.

    Returns one of:
        "metadata"      - resolves to an always-blocked address (link-local /
                          cloud-metadata / multicast / unspecified)
        "internal"      - resolves to a private/loopback address
        "public"        - resolves only to public addresses
        "indeterminate" - host is missing or could not be resolved

    "metadata" takes precedence over "internal" so the always-blocked case is
    never masked by a co-resolved private address.
    """
    ips = _resolve_ips(url)
    if not ips:
        return "indeterminate"
    reason = "public"
    for ip in ips:
        if _ip_always_blocked(ip):
            return "metadata"
        if _ip_is_internal(ip):
            reason = "internal"
    return reason


def validate_no_ssrf(
    url: Optional[str], *, allow_private: bool, allow_unresolved: bool = False
) -> None:
    """Raise ValueError if ``url`` targets a disallowed address.

    - Link-local / cloud-metadata addresses are always rejected.
    - Private/loopback addresses are rejected unless ``allow_private``.
    - Hosts that cannot be resolved are rejected unless ``allow_unresolved``.
      This fails closed by default (an unresolvable host cannot be verified and
      cannot be connected to anyway); save-time validators may pass
      ``allow_unresolved=True`` so a config can be stored for a host that is not
      currently resolvable, leaving the strict check to the connection-time
      boundary.

    No-op for empty URLs. Callers in the service layer should catch ValueError
    and re-raise as their own connection error type; Pydantic validators can let
    it surface as a validation error.
    """
    if not url:
        return
    classification = classify_url(url)
    if classification == "metadata":
        raise ValueError(METADATA_URL_ERROR)
    if classification == "internal" and not allow_private:
        raise ValueError(PRIVATE_URL_ERROR)
    if classification == "indeterminate" and not allow_unresolved:
        raise ValueError(UNRESOLVED_URL_ERROR)
