"""Safe, user-facing descriptions of Paperless/Papra failures (issue #1200).

The integration URL is configured by the user and, by default, may point at any
private-network service. Text from the other end (response bodies, library
error strings) must therefore never reach an API client: it would let a user
read back whatever answers at that address.

A failure is instead described from information we control:

* ``integration_message`` - text *we* wrote, set on the exception that is raised.
* the exception *type* and errno - used to say why a connection failed.
* an upstream HTTP status number.

``str(exc)``, ``exc.__cause__`` text and ``exc.__context__`` text are never
returned. The error ``integration_code`` travels in ``X-Error-Code`` and arrives
in the response body's ``error_code`` field. Codes are stable: add rather than
rename. The frontend treats every ``integration_`` code as "show the message".

Status codes: never answer with 401 for an upstream failure. The frontend treats
any 401 from this API as an expired MediKeep session and signs the user out.
"""

import asyncio
import errno
import socket
import ssl
from dataclasses import dataclass
from typing import Iterator, Optional

import aiohttp
from fastapi import HTTPException

from app.core.utils.integration_http import UNSAFE_REDIRECT_MESSAGE, UnsafeRedirectError

CODE_PREFIX = "integration_"


class IntegrationErrorCode:
    """Codes for Paperless/Papra failures whose message a client renders."""

    # Credentials
    AUTH_FAILED = "integration_auth_failed"
    CREDENTIALS_UNUSABLE = "integration_credentials_unusable"

    # Connection
    CONNECTION_FAILED = "integration_connection_failed"
    CONNECTION_REFUSED = "integration_connection_refused"
    HOST_UNREACHABLE = "integration_host_unreachable"
    DNS_FAILED = "integration_dns_failed"
    TIMEOUT = "integration_timeout"
    TLS_ERROR = "integration_tls_error"
    REDIRECT_BLOCKED = "integration_redirect_blocked"
    URL_BLOCKED = "integration_url_blocked"

    # Upstream answered, but not usefully
    HTTP_ERROR = "integration_http_error"

    # Upload rejected, with the reason Paperless gave (classified, not quoted)
    DUPLICATE_DOCUMENT = "integration_duplicate_document"
    UNSUPPORTED_FORMAT = "integration_unsupported_format"
    FILE_TOO_LARGE = "integration_file_too_large"
    PERMISSION_DENIED = "integration_permission_denied"
    STORAGE_FULL = "integration_storage_full"
    PROCESSING_FAILED = "integration_processing_failed"
    NETWORK_ERROR = "integration_network_error"
    UPLOAD_FAILED = "integration_upload_failed"

    # Nothing more specific is known
    GENERIC = "integration_error"


PAPERLESS_AUTH_FAILED_MESSAGE = (
    "Paperless authentication failed. Please check your credentials and permissions."
)
PAPERLESS_CREDENTIALS_UNUSABLE_MESSAGE = (
    "The saved Paperless credentials could not be read. "
    "Please re-enter your API token or username and password, save, and try again."
)
PAPRA_AUTH_FAILED_MESSAGE = (
    "Papra authentication failed. Please check your API token and permissions."
)


class IntegrationFailureInfo:
    """Mixin for exceptions that carry text we wrote.

    ``integration_message`` must only ever hold text authored in this codebase
    (plus values we control, such as the user's own file name or an HTTP status
    number). Never assign anything derived from an upstream response or from
    ``str(exc)`` of a library error.
    """

    integration_message: Optional[str] = None
    integration_code: Optional[str] = None
    upstream_status: Optional[int] = None

    def __init__(
        self,
        message: str = "",
        *,
        integration_message: Optional[str] = None,
        integration_code: Optional[str] = None,
        upstream_status: Optional[int] = None,
    ):
        super().__init__(message)
        if integration_message is not None:
            self.integration_message = integration_message
        if integration_code is not None:
            self.integration_code = integration_code
        if upstream_status is not None:
            self.upstream_status = upstream_status


@dataclass(frozen=True)
class IntegrationFailure:
    code: str
    message: str


def upstream_status_failure(provider: str, status: int) -> IntegrationFailure:
    """The upstream answered with an unexpected HTTP status."""
    return IntegrationFailure(
        IntegrationErrorCode.HTTP_ERROR,
        f"{provider} returned an unexpected response (HTTP {int(status)}). "
        f"Check the {provider} server and any reverse proxy in front of it.",
    )


_MAX_CHAIN_DEPTH = 6


def _chain(exc: BaseException) -> Iterator[BaseException]:
    """The exception followed by its causes, bounded and cycle-safe."""
    seen = set()
    node: Optional[BaseException] = exc
    while node is not None and id(node) not in seen and len(seen) < _MAX_CHAIN_DEPTH:
        seen.add(id(node))
        yield node
        node = node.__cause__ or node.__context__


def _connection_failure(code: str, provider: str, reason: str) -> IntegrationFailure:
    return IntegrationFailure(code, f"Unable to connect to {provider}: {reason}")


def _classify_node(node: Exception, provider: str) -> Optional[IntegrationFailure]:
    """Classify one exception by its type and errno only, never by its text."""
    if isinstance(node, UnsafeRedirectError):
        return _connection_failure(
            IntegrationErrorCode.REDIRECT_BLOCKED, provider, UNSAFE_REDIRECT_MESSAGE
        )

    if isinstance(node, (aiohttp.ClientSSLError, ssl.SSLError)):
        return _connection_failure(
            IntegrationErrorCode.TLS_ERROR,
            provider,
            "the TLS certificate could not be verified. Check the certificate "
            "and that the URL matches it.",
        )

    os_error = getattr(node, "os_error", None)
    if os_error is None and isinstance(node, OSError):
        os_error = node
    os_errno = getattr(os_error, "errno", None)

    if isinstance(node, aiohttp.ClientConnectorDNSError) or isinstance(
        os_error, socket.gaierror
    ):
        return _connection_failure(
            IntegrationErrorCode.DNS_FAILED,
            provider,
            "the host name could not be resolved. Check the URL.",
        )

    if isinstance(os_error, ConnectionRefusedError) or os_errno == errno.ECONNREFUSED:
        return _connection_failure(
            IntegrationErrorCode.CONNECTION_REFUSED,
            provider,
            f"connection refused. Check that {provider} is running and that the "
            "URL and port are correct.",
        )

    if os_errno in (errno.EHOSTUNREACH, errno.ENETUNREACH):
        return _connection_failure(
            IntegrationErrorCode.HOST_UNREACHABLE,
            provider,
            "the host could not be reached. Check the URL and your network.",
        )

    if isinstance(
        node, (asyncio.TimeoutError, TimeoutError, aiohttp.ServerTimeoutError)
    ):
        return _connection_failure(
            IntegrationErrorCode.TIMEOUT,
            provider,
            f"the request timed out. Check that the URL is reachable and that "
            f"{provider} is responding.",
        )

    if isinstance(node, aiohttp.ClientConnectionError):
        return _connection_failure(
            IntegrationErrorCode.CONNECTION_FAILED,
            provider,
            f"the connection failed. Check the URL and that {provider} is running.",
        )

    return None


def classify_connection_failure(
    exc: BaseException, provider: str
) -> Optional[IntegrationFailure]:
    """Why a connection failed, from exception types in the cause chain."""
    for node in _chain(exc):
        if not isinstance(node, Exception):
            continue  # CancelledError sits under asyncio timeouts
        failure = _classify_node(node, provider)
        if failure is not None:
            return failure
    return None


def describe_integration_failure(
    exc: BaseException, provider: str
) -> Optional[IntegrationFailure]:
    """Describe a Paperless/Papra failure without exposing upstream text.

    Returns None when nothing safe is known; callers then use their own fixed
    message. The result never contains ``str(exc)`` or any chained exception text.
    """
    message = getattr(exc, "integration_message", None)
    if isinstance(message, str) and message:
        code = getattr(exc, "integration_code", None)
        if not (isinstance(code, str) and code.startswith(CODE_PREFIX)):
            code = IntegrationErrorCode.GENERIC
        return IntegrationFailure(code, message)

    failure = classify_connection_failure(exc, provider)
    if failure is not None:
        return failure

    status = getattr(exc, "upstream_status", None)
    if (
        isinstance(status, int)
        and not isinstance(status, bool)
        and 100 <= status <= 599
    ):
        return upstream_status_failure(provider, status)

    return None


def integration_http_exception(
    failure: IntegrationFailure, status_code: int = 400
) -> HTTPException:
    """An HTTPException whose body carries the message and ``error_code``."""
    if status_code == 401:
        raise ValueError(
            "Upstream integration failures must not use 401; the frontend treats "
            "it as an expired MediKeep session."
        )
    return HTTPException(
        status_code=status_code,
        detail=failure.message,
        headers={"X-Error-Code": failure.code},
    )


def integration_error_response(
    exc: BaseException,
    provider: str,
    fallback_message: str,
    *,
    fallback_code: str = IntegrationErrorCode.GENERIC,
    status_code: int = 400,
) -> HTTPException:
    """The response for a handler that always answers: described, else a fixed message."""
    failure = describe_integration_failure(exc, provider) or IntegrationFailure(
        fallback_code, fallback_message
    )
    return integration_http_exception(failure, status_code)


def raise_if_integration_failure(
    exc: BaseException, provider: str, status_code: int = 400
) -> None:
    """For broad handlers: raise a described failure, or return so the caller can
    fall through to its own generic response."""
    failure = describe_integration_failure(exc, provider)
    if failure is not None:
        raise integration_http_exception(failure, status_code)
