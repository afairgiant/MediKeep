"""Per-thread DNS pinning for libraries that resolve hosts themselves (requests, smtplib).

Inside ``pinned_resolution`` the current thread resolves the pinned hostname only to the
validated addresses and fails to resolve any other host; other threads are unaffected.
The URL keeps its hostname, so TLS SNI, certificate checks and the Host header still use it.
"""

import socket
import threading
from contextlib import contextmanager
from typing import Dict, Iterator, Optional, Sequence, Tuple

from app.core.utils.url_security import _IpAddress

_original_getaddrinfo = socket.getaddrinfo
_state = threading.local()
_install_lock = threading.Lock()


def _host_key(host) -> str:
    if isinstance(host, bytes):
        host = host.decode("ascii", "ignore")
    return (host or "").strip("[]").lower()


# Keeps socket.getaddrinfo's parameter names; asyncio passes type by keyword
def _pinned_getaddrinfo(
    host, port, family=0, type=0, proto=0, flags=0  # pylint: disable=redefined-builtin
):
    pins: Optional[Dict[str, Tuple[_IpAddress, ...]]] = getattr(_state, "pins", None)
    if pins is None:
        return _original_getaddrinfo(host, port, family, type, proto, flags)

    ips = pins.get(_host_key(host))
    if ips is None:
        raise socket.gaierror(
            socket.EAI_NONAME, "Refusing to resolve an unvalidated host"
        )

    results = []
    for ip in ips:
        ip_family = socket.AF_INET if ip.version == 4 else socket.AF_INET6
        if family not in (0, socket.AF_UNSPEC, ip_family):
            continue
        results.extend(
            _original_getaddrinfo(
                str(ip), port, ip_family, type, proto, flags | socket.AI_NUMERICHOST
            )
        )
    if not results:
        raise socket.gaierror(socket.EAI_NONAME, "No validated address for host")
    return results


def _install() -> None:
    with _install_lock:
        if socket.getaddrinfo is not _pinned_getaddrinfo:
            socket.getaddrinfo = _pinned_getaddrinfo


@contextmanager
def pinned_resolution(hostname: str, ips: Sequence[_IpAddress]) -> Iterator[None]:
    """Resolve ``hostname`` only to ``ips`` in this thread; any other host fails to resolve.

    ``ips`` must already be validated, for example by ``validate_integration_url``.
    """
    _install()
    previous = getattr(_state, "pins", None)
    _state.pins = {_host_key(hostname): tuple(ips)}
    try:
        yield
    finally:
        _state.pins = previous
