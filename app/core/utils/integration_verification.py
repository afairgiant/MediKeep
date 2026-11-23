"""Connection-verification bookkeeping shared by the Paperless and Papra settings.

A connection test can run before the settings are saved, so a bare "verified"
flag cannot tell which URL was actually tested. Each integration therefore
stores the URL its last successful test reached (``<service>_verified_url``)
and the flag is derived from comparing URLs.
"""

from typing import Any, Dict, Optional
from urllib.parse import urlsplit, urlunsplit

_DEFAULT_PORTS = {"http": 80, "https": 443}


def normalize_integration_url(url: Optional[str]) -> str:
    """Normalise a URL for comparison (whitespace and trailing slashes)."""
    return (url or "").strip().rstrip("/")


def integration_instance_key(url: Optional[str]) -> str:
    """``url`` as an instance identity: scheme and host lowercased, default port dropped.

    The path stays case-sensitive. A URL that cannot be parsed is only normalised.
    """
    normalized = normalize_integration_url(url)
    try:
        parts = urlsplit(normalized)
        port = parts.port
    except ValueError:
        return normalized
    if not parts.scheme or not parts.hostname:
        return normalized
    scheme = parts.scheme.lower()
    host = f"[{parts.hostname}]" if ":" in parts.hostname else parts.hostname
    if port is not None and port != _DEFAULT_PORTS.get(scheme):
        host = f"{host}:{port}"
    userinfo = parts.netloc.rpartition("@")[0]
    netloc = f"{userinfo}@{host}" if userinfo else host
    return urlunsplit((scheme, netloc, parts.path, parts.query, parts.fragment))


def verification_after_test(
    service: str, tested_url: Optional[str], stored_url: Optional[str]
) -> Dict[str, Any]:
    """Column updates to persist after a successful connection test.

    The tested URL is always recorded. The stored connection is only marked
    verified when it is the URL that was tested, so testing an unsaved URL
    never vouches for a different saved one.
    """
    tested = normalize_integration_url(tested_url)
    updates: Dict[str, Any] = {f"{service}_verified_url": tested or None}
    if tested and tested == normalize_integration_url(stored_url):
        updates[f"{service}_connection_verified"] = True
    return updates


def verification_after_save(
    service: str,
    new_url: Optional[str],
    stored_url: Optional[str],
    verified_url: Optional[str],
) -> Dict[str, Any]:
    """Column updates a settings save must apply alongside the new URL.

    Empty when the save leaves the URL as it was, so verification is untouched.
    """
    if normalize_integration_url(new_url) == normalize_integration_url(stored_url):
        return {}
    return verification_after_url_change(service, new_url, verified_url)


def verification_after_url_change(
    service: str, new_url: Optional[str], verified_url: Optional[str]
) -> Dict[str, Any]:
    """Column updates to persist when a save changes the stored URL.

    The connection stays verified only when the new URL is the one a test
    already succeeded against. Any other URL is unverified and forgets the old
    record, so switching away and back requires a fresh test.
    """
    new = normalize_integration_url(new_url)
    if new and new == normalize_integration_url(verified_url):
        return {f"{service}_connection_verified": True}
    return {
        f"{service}_connection_verified": False,
        f"{service}_verified_url": None,
    }
