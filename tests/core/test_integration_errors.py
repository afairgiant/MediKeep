"""Describing Paperless/Papra failures without exposing upstream text (issue #1200)."""

import asyncio
import errno
import socket
import ssl
from contextlib import asynccontextmanager

import aiohttp
import pytest
from aiohttp.client_reqrep import ConnectionKey

from app.core.http.integration_errors import (
    CODE_PREFIX,
    IntegrationErrorCode,
    IntegrationFailure,
    IntegrationFailureInfo,
    classify_connection_failure,
    describe_integration_failure,
    integration_error_response,
    integration_http_exception,
    raise_if_integration_failure,
    upstream_status_failure,
)
from app.core.utils import integration_http
from app.core.utils.integration_http import UNSAFE_REDIRECT_MESSAGE, UnsafeRedirectError
from app.core.utils.url_security import (
    METADATA_URL_ERROR,
    URL_VALIDATION_MESSAGES,
)
from app.services.paperless_service import (
    PaperlessConnectionError,
    PaperlessService,
    PaperlessServiceToken,
    PaperlessUploadError,
    parse_upload_error,
)

# Looks like what an attacker wants to read back from an internal service.
SECRET = "SECRET-internal-admin-panel /etc/passwd SELECT * FROM users"


def _key() -> ConnectionKey:
    return ConnectionKey("paperless.test", 8000, False, True, None, None, None)


async def _real_refused_error() -> BaseException:
    """A genuine aiohttp error from connecting to a closed local port."""
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=3)) as s:
            async with s.get("http://127.0.0.1:1/"):
                pass
    except BaseException as error:  # noqa: BLE001 - we want exactly what aiohttp raises
        return error
    raise AssertionError("expected a connection failure")


class TestClassifyConnectionFailure:
    @pytest.mark.asyncio
    async def test_connection_refused_from_real_aiohttp(self):
        failure = classify_connection_failure(await _real_refused_error(), "Paperless")

        assert failure.code == IntegrationErrorCode.CONNECTION_REFUSED
        assert failure.message.startswith("Unable to connect to Paperless:")
        assert "refused" in failure.message

    @pytest.mark.parametrize(
        ("error", "code"),
        [
            (
                aiohttp.ClientConnectorDNSError(_key(), socket.gaierror(-2, "x")),
                IntegrationErrorCode.DNS_FAILED,
            ),
            (
                aiohttp.ClientConnectorCertificateError(
                    _key(), ssl.SSLCertVerificationError("x")
                ),
                IntegrationErrorCode.TLS_ERROR,
            ),
            (
                aiohttp.ClientConnectorError(_key(), OSError(errno.EHOSTUNREACH, "x")),
                IntegrationErrorCode.HOST_UNREACHABLE,
            ),
            (
                aiohttp.ClientConnectorError(_key(), OSError(errno.ENETUNREACH, "x")),
                IntegrationErrorCode.HOST_UNREACHABLE,
            ),
            (aiohttp.ConnectionTimeoutError("x"), IntegrationErrorCode.TIMEOUT),
            (aiohttp.ServerTimeoutError("x"), IntegrationErrorCode.TIMEOUT),
            (UnsafeRedirectError("x"), IntegrationErrorCode.REDIRECT_BLOCKED),
            (
                aiohttp.ServerDisconnectedError("x"),
                IntegrationErrorCode.CONNECTION_FAILED,
            ),
        ],
    )
    def test_classified_by_type_and_errno(self, error, code):
        assert classify_connection_failure(error, "Papra").code == code

    @pytest.mark.parametrize("timeout", [asyncio.TimeoutError(), TimeoutError()])
    def test_total_timeout_is_not_a_client_error_but_is_classified(self, timeout):
        """aiohttp raises a bare asyncio.TimeoutError when ClientTimeout(total=) expires."""
        assert not isinstance(timeout, aiohttp.ClientError)
        assert classify_connection_failure(timeout, "Paperless").code == (
            IntegrationErrorCode.TIMEOUT
        )

    @pytest.mark.asyncio
    async def test_wrapped_error_is_classified_through_its_cause(self):
        """The clients re-raise aiohttp errors as their own connection error."""
        refused = await _real_refused_error()
        try:
            try:
                raise refused
            except aiohttp.ClientError as error:
                raise PaperlessConnectionError(f"Connection error: {error}")
        except PaperlessConnectionError as wrapped:
            failure = classify_connection_failure(wrapped, "Paperless")

        assert failure.code == IntegrationErrorCode.CONNECTION_REFUSED

    def test_redirect_failure_uses_the_authored_constant(self):
        failure = classify_connection_failure(UnsafeRedirectError(SECRET), "Papra")

        assert UNSAFE_REDIRECT_MESSAGE in failure.message
        assert SECRET not in failure.message

    def test_unrecognised_error_is_not_classified(self):
        assert classify_connection_failure(ValueError(SECRET), "Papra") is None

    def test_cancelled_error_in_the_chain_is_skipped(self):
        error = asyncio.TimeoutError()
        error.__cause__ = asyncio.CancelledError()

        assert classify_connection_failure(error, "Papra").code == (
            IntegrationErrorCode.TIMEOUT
        )

    def test_self_referencing_chain_terminates(self):
        error = ValueError("x")
        error.__cause__ = error

        assert classify_connection_failure(error, "Papra") is None


class _Authored(IntegrationFailureInfo, Exception):
    pass


class TestNeverExposesUpstreamText:
    """The property the whole change depends on: no branch returns str(exc) or a cause's text."""

    def _assert_clean(self, failure: IntegrationFailure):
        assert failure is not None
        assert SECRET not in failure.message
        assert SECRET not in failure.code

    def test_authored_message_branch(self):
        error = _Authored(
            SECRET,
            integration_message="Duplicate document.",
            integration_code=IntegrationErrorCode.DUPLICATE_DOCUMENT,
        )
        error.__cause__ = ValueError(SECRET)

        failure = describe_integration_failure(error, "Paperless")

        self._assert_clean(failure)
        assert failure == IntegrationFailure(
            IntegrationErrorCode.DUPLICATE_DOCUMENT, "Duplicate document."
        )

    @pytest.mark.parametrize(
        "error",
        [
            aiohttp.ClientConnectorError(_key(), OSError(errno.ECONNREFUSED, SECRET)),
            aiohttp.ClientConnectorDNSError(_key(), socket.gaierror(-2, SECRET)),
            aiohttp.ClientConnectorCertificateError(
                _key(), ssl.SSLCertVerificationError(SECRET)
            ),
            aiohttp.ConnectionTimeoutError(SECRET),
            asyncio.TimeoutError(SECRET),
            aiohttp.ServerDisconnectedError(SECRET),
            aiohttp.ClientOSError(SECRET),
        ],
    )
    def test_connection_branch(self, error):
        wrapper = PaperlessConnectionError(f"Connection error: {SECRET}")
        wrapper.__cause__ = error

        self._assert_clean(describe_integration_failure(wrapper, "Paperless"))
        self._assert_clean(describe_integration_failure(error, "Paperless"))

    def test_status_branch(self):
        error = _Authored(SECRET, upstream_status=502)
        error.__cause__ = ValueError(SECRET)

        failure = describe_integration_failure(error, "Papra")

        self._assert_clean(failure)
        assert "HTTP 502" in failure.message
        assert failure.code == IntegrationErrorCode.HTTP_ERROR

    def test_unknown_branch_returns_nothing(self):
        error = RuntimeError(SECRET)
        error.__cause__ = ValueError(SECRET)

        assert describe_integration_failure(error, "Papra") is None

    def test_fallback_response_is_the_fixed_text(self):
        response = integration_error_response(
            RuntimeError(SECRET), "Papra", "Papra error"
        )

        assert response.detail == "Papra error"
        assert SECRET not in str(response.headers)

    @pytest.mark.parametrize("status", ["502", True, 99, 600, None, 502.5])
    def test_untrusted_status_values_are_ignored(self, status):
        error = _Authored(SECRET)
        error.upstream_status = status

        assert describe_integration_failure(error, "Papra") is None

    def test_unrelated_exception_attributes_are_not_trusted(self):
        """Other libraries use status_code/error_code/message; only our names count."""
        error = RuntimeError(SECRET)
        error.status_code = 500
        error.error_code = "boom"
        error.message = SECRET

        assert describe_integration_failure(error, "Papra") is None

    def test_a_non_integration_code_is_replaced(self):
        error = _Authored(
            "x", integration_message="Fine.", integration_code="something_else"
        )

        assert describe_integration_failure(error, "Papra").code == (
            IntegrationErrorCode.GENERIC
        )


class TestResponses:
    def test_code_travels_in_the_error_code_header(self):
        response = integration_http_exception(
            IntegrationFailure(IntegrationErrorCode.TIMEOUT, "Timed out.")
        )

        assert response.status_code == 400
        assert response.detail == "Timed out."
        assert response.headers == {"X-Error-Code": IntegrationErrorCode.TIMEOUT}

    def test_401_is_refused_because_it_signs_the_user_out(self):
        with pytest.raises(ValueError):
            integration_http_exception(
                IntegrationFailure(IntegrationErrorCode.AUTH_FAILED, "x"), 401
            )

    def test_raise_if_integration_failure_falls_through_when_unknown(self):
        raise_if_integration_failure(RuntimeError(SECRET), "Papra")

    def test_raise_if_integration_failure_raises_when_known(self):
        with pytest.raises(Exception) as raised:
            raise_if_integration_failure(asyncio.TimeoutError(), "Papra")

        assert raised.value.status_code == 400
        assert raised.value.headers["X-Error-Code"] == IntegrationErrorCode.TIMEOUT

    def test_upstream_status_message(self):
        assert "HTTP 503" in upstream_status_failure("Paperless", 503).message

    def test_every_code_has_the_prefix_the_frontend_matches_on(self):
        codes = [
            value
            for name, value in vars(IntegrationErrorCode).items()
            if name.isupper()
        ]
        assert codes
        assert all(code.startswith(CODE_PREFIX) for code in codes)
        assert len(codes) == len(set(codes))


class TestUrlBlockedReasons:
    def test_literal_code_in_integration_http_matches_the_constant(self):
        """integration_http cannot import the constant (it would be a cycle)."""
        error = _raise_pin("http://169.254.169.254/")

        assert error.integration_code == IntegrationErrorCode.URL_BLOCKED

    def test_fixed_validation_reason_is_relayed(self):
        error = _raise_pin("http://169.254.169.254/")

        assert error.integration_message == METADATA_URL_ERROR
        assert error.integration_message in URL_VALIDATION_MESSAGES
        assert (
            describe_integration_failure(error, "Papra").message == METADATA_URL_ERROR
        )

    def test_any_other_validation_error_gets_a_generic_reason(self, monkeypatch):
        def explode(*args, **kwargs):
            raise ValueError(f"Port could not be cast: {SECRET}")

        monkeypatch.setattr(integration_http, "validate_integration_url", explode)

        error = _raise_pin("http://anything.test/")

        assert SECRET not in error.integration_message
        assert (
            error.integration_message == "The integration URL could not be validated."
        )

    def test_validation_messages_name_no_address(self):
        for message in URL_VALIDATION_MESSAGES:
            assert "{" not in message


def _raise_pin(url: str) -> Exception:
    with pytest.raises(PaperlessConnectionError) as raised:
        integration_http.pin_integration_url(url, PaperlessConnectionError)
    return raised.value


class TestParseUploadError:
    @pytest.mark.parametrize(
        ("upstream", "code"),
        [
            (
                {"detail": "Not consuming x: It is a duplicate of y"},
                "duplicate_document",
            ),
            (
                {"non_field_errors": ["Document with this checksum exists"]},
                "duplicate_document",
            ),
            ("Unsupported file type", "unsupported_format"),
            ({"detail": "File too large"}, "file_too_large"),
            ({"detail": "Permission denied"}, "permission_denied"),
            ({"detail": "No space left, disk space"}, "storage_full"),
            ({"detail": "OCR failed on page 1"}, "processing_failed"),
            ({"detail": "Connection timeout"}, "network_error"),
            ({"detail": "something nobody anticipated"}, "upload_failed"),
        ],
    )
    def test_classified_into_a_template(self, upstream, code):
        result_code, message = parse_upload_error(upstream, "scan.pdf")

        assert result_code == f"integration_{code}"
        assert "scan.pdf" in message

    @pytest.mark.parametrize(
        "upstream",
        [
            {"detail": f"duplicate {SECRET}"},
            {"detail": f"unmatched {SECRET}"},
            {"error": SECRET},
            {"non_field_errors": [SECRET]},
            {"other": SECRET},
            SECRET,
            f"<html>500 {SECRET}</html>",
        ],
    )
    def test_never_quotes_upstream_text(self, upstream):
        _, message = parse_upload_error(upstream, "scan.pdf")

        assert SECRET not in message

    def test_default_template_names_the_http_status(self):
        _, message = parse_upload_error({"detail": "zzz"}, "scan.pdf", 400)

        assert "HTTP 400" in message

    @pytest.mark.parametrize("detail", [["a", "b"], {"nested": 1}, None, 5])
    def test_non_string_detail_does_not_crash(self, detail):
        code, _ = parse_upload_error({"detail": detail}, "scan.pdf")

        assert code.startswith(CODE_PREFIX)

    def test_braces_in_the_file_name_are_safe(self):
        _, message = parse_upload_error({"detail": "duplicate"}, "{evil}.pdf")

        assert "{evil}.pdf" in message


class _FakeResponse:
    def __init__(self, status, body, json_body):
        self.status = status
        self._body = body
        self._json = json_body

    async def json(self):
        if self._json is None:
            raise aiohttp.ContentTypeError(None, (), message="not json")
        return self._json

    async def text(self):
        return self._body


def _service_with_response(service, response):
    @asynccontextmanager
    async def fake_request(*args, **kwargs):
        yield response

    service._make_request = fake_request
    return service


SERVICES = [
    pytest.param(
        lambda: PaperlessServiceToken("http://127.0.0.1:9", "token", 1), id="token"
    ),
    pytest.param(
        lambda: PaperlessService("http://127.0.0.1:9", "user", "pw", 1), id="basic"
    ),
]


@pytest.mark.parametrize("make_service", SERVICES)
class TestUploadRaisesTheAuthoredMessage:
    """The final raised error must carry the message, whichever way the 400 body parses."""

    @pytest.mark.asyncio
    async def test_json_body(self, make_service):
        service = _service_with_response(
            make_service(),
            _FakeResponse(400, "", {"detail": f"It is a duplicate {SECRET}"}),
        )

        with pytest.raises(PaperlessUploadError) as raised:
            await service.upload_document(b"x", "scan.pdf", "lab-result", 1)

        assert raised.value.integration_code == IntegrationErrorCode.DUPLICATE_DOCUMENT
        assert "scan.pdf" in raised.value.integration_message
        assert SECRET not in raised.value.integration_message
        assert raised.value.upstream_status == 400

    @pytest.mark.asyncio
    async def test_plain_text_body(self, make_service):
        service = _service_with_response(
            make_service(), _FakeResponse(400, f"Unsupported file {SECRET}", None)
        )

        with pytest.raises(PaperlessUploadError) as raised:
            await service.upload_document(b"x", "scan.pdf", "lab-result", 1)

        assert raised.value.integration_code == IntegrationErrorCode.UNSUPPORTED_FORMAT
        assert SECRET not in raised.value.integration_message

    @pytest.mark.asyncio
    async def test_other_status_keeps_the_body_out_of_the_user_message(
        self, make_service
    ):
        service = _service_with_response(
            make_service(), _FakeResponse(502, f"<html>{SECRET}</html>", None)
        )

        with pytest.raises(PaperlessUploadError) as raised:
            await service.upload_document(b"x", "scan.pdf", "lab-result", 1)

        assert raised.value.integration_message is None
        assert raised.value.upstream_status == 502
        failure = describe_integration_failure(raised.value, "Paperless")
        assert SECRET not in failure.message
        assert "HTTP 502" in failure.message
