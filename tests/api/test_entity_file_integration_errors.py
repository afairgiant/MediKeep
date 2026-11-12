"""Paperless/Papra failures reach the user as an explicit, safe message (issue #1200).

Upstream error text is never returned to the client. The message is built from
what we control (our own templates, exception types, an HTTP status number) and
travels with a stable `error_code` that the frontend renders verbatim.

These tests go through the real routes and the global exception handler, since
the body's `message` and `error_code` are what the frontend reads. They stay
HTTP 400: a 401 from this API makes the frontend treat the MediKeep session as
expired and sign the user out.
"""

import asyncio
import errno
from contextlib import asynccontextmanager
from types import SimpleNamespace

import aiohttp
import pytest
from aiohttp.client_reqrep import ConnectionKey

import app.api.v1.endpoints.entity_file as entity_file_module
from app.core.http.integration_errors import (
    PAPERLESS_AUTH_FAILED_MESSAGE,
    PAPRA_AUTH_FAILED_MESSAGE,
    IntegrationErrorCode,
)
from app.models.models import UserPreferences
from app.services.paperless_client import (
    PaperlessClientAuthError,
    PaperlessClientError,
    PaperlessConnectionError,
)
from app.services.paperless_service import PaperlessServiceToken
from app.services.papra_client import (
    PapraClient,
    PapraClientAuthError,
    PapraClientError,
    PapraConnectionError,
)

LINK_PAPERLESS_URL = "/api/v1/entity-files/lab-result/1/link-paperless"
LINK_PAPRA_URL = "/api/v1/entity-files/lab-result/1/link-papra"
UPLOAD_URL = "/api/v1/entity-files/lab-result/1/files"

# Looks like what an attacker wants to read back from an internal service.
SECRET_TEXT = "/srv/medikeep/secret/path SELECT * FROM users <html>admin panel</html>"


def _key() -> ConnectionKey:
    return ConnectionKey("host.test", 80, False, True, None, None, None)


def _refused() -> aiohttp.ClientConnectorError:
    return aiohttp.ClientConnectorError(
        _key(), OSError(errno.ECONNREFUSED, SECRET_TEXT)
    )


def _chained(error_cls, cause: BaseException):
    """The way the clients raise: their own error, chained from the aiohttp one."""
    try:
        try:
            raise cause
        except BaseException as inner:
            raise error_cls(f"Connection error: {inner}")
    except error_cls as wrapped:
        return wrapped


class _FailingClient:
    """Stands in for a Paperless/Papra client whose lookup raises `error`."""

    def __init__(self, error: Exception):
        self._error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get_document_info(self, *args, **kwargs):
        raise self._error


@pytest.fixture
def parent_record(monkeypatch):
    """Skip record and permission lookups: the user may edit lab-result 1."""
    monkeypatch.setattr(
        entity_file_module,
        "get_entity_by_type_and_id",
        lambda db, entity_type, entity_id: SimpleNamespace(patient_id=1),
    )
    monkeypatch.setattr(
        entity_file_module.deps, "verify_patient_access", lambda *a, **k: None
    )


@pytest.fixture
def link_env(monkeypatch, parent_record):
    prefs = SimpleNamespace(
        paperless_enabled=True,
        paperless_url="http://paperless.test",
        paperless_api_token_encrypted="token",
        paperless_username_encrypted=None,
        paperless_password_encrypted=None,
        papra_enabled=True,
        papra_url="http://papra.test",
        papra_api_token_encrypted="token",
        papra_organization_id="org_1",
    )
    monkeypatch.setattr(
        entity_file_module.user_preferences,
        "get_by_user_id",
        lambda db, user_id: prefs,
    )


def _fail_with(monkeypatch, factory_name: str, error: Exception):
    monkeypatch.setattr(
        entity_file_module, factory_name, lambda **kwargs: _FailingClient(error)
    )


def _assert_safe_message(response, code: str, message: str = None):
    body = response.json()
    assert response.status_code == 400
    assert body["error_code"] == code
    assert SECRET_TEXT not in response.text
    assert "admin panel" not in response.text
    if message is not None:
        assert body["message"] == message
    return body["message"]


LINKS = {
    "Paperless": (
        LINK_PAPERLESS_URL,
        "create_paperless_client",
        {"paperless_document_id": "123"},
    ),
    "Papra": (LINK_PAPRA_URL, "create_papra_client", {"papra_document_id": "doc_1"}),
}
CLIENT_ERRORS = {
    "Paperless": (
        PaperlessClientError,
        PaperlessConnectionError,
        PaperlessClientAuthError,
    ),
    "Papra": (PapraClientError, PapraConnectionError, PapraClientAuthError),
}
AUTH_MESSAGES = {
    "Paperless": PAPERLESS_AUTH_FAILED_MESSAGE,
    "Papra": PAPRA_AUTH_FAILED_MESSAGE,
}


@pytest.mark.parametrize("provider", ["Paperless", "Papra"])
class TestLinkFailures:
    def _post(self, client, provider):
        url, _, payload = LINKS[provider]
        return client.post(url, json=payload)

    def test_rejected_credentials(
        self, provider, authenticated_client, link_env, monkeypatch, caplog
    ):
        _, factory, _ = LINKS[provider]
        auth_error = CLIENT_ERRORS[provider][2](f"rejected (HTTP 401) {SECRET_TEXT}")
        _fail_with(monkeypatch, factory, auth_error)

        with caplog.at_level("ERROR"):
            response = self._post(authenticated_client, provider)

        _assert_safe_message(
            response, IntegrationErrorCode.AUTH_FAILED, AUTH_MESSAGES[provider]
        )
        # The full error is in the log, not the response.
        assert any(SECRET_TEXT in str(getattr(r, "error", "")) for r in caplog.records)

    def test_upstream_http_status(
        self, provider, authenticated_client, link_env, monkeypatch
    ):
        _, factory, _ = LINKS[provider]
        error = CLIENT_ERRORS[provider][0](SECRET_TEXT, upstream_status=502)
        _fail_with(monkeypatch, factory, error)

        message = _assert_safe_message(
            self._post(authenticated_client, provider),
            IntegrationErrorCode.HTTP_ERROR,
        )

        assert "HTTP 502" in message
        assert message.startswith(f"{provider} returned an unexpected response")

    def test_unclassified_client_error_stays_generic(
        self, provider, authenticated_client, link_env, monkeypatch
    ):
        _, factory, _ = LINKS[provider]
        _fail_with(monkeypatch, factory, CLIENT_ERRORS[provider][0](SECRET_TEXT))

        _assert_safe_message(
            self._post(authenticated_client, provider),
            IntegrationErrorCode.GENERIC,
            f"{provider} error",
        )

    def test_connection_refused_says_why(
        self, provider, authenticated_client, link_env, monkeypatch
    ):
        _, factory, _ = LINKS[provider]
        _fail_with(
            monkeypatch,
            factory,
            _chained(CLIENT_ERRORS[provider][1], _refused()),
        )

        message = _assert_safe_message(
            self._post(authenticated_client, provider),
            IntegrationErrorCode.CONNECTION_REFUSED,
        )

        assert message.startswith(
            f"Unable to connect to {provider}: connection refused"
        )

    def test_connection_error_without_a_known_cause_keeps_the_old_prefix(
        self, provider, authenticated_client, link_env, monkeypatch
    ):
        _, factory, _ = LINKS[provider]
        _fail_with(monkeypatch, factory, CLIENT_ERRORS[provider][1](SECRET_TEXT))

        _assert_safe_message(
            self._post(authenticated_client, provider),
            IntegrationErrorCode.CONNECTION_FAILED,
            f"Unable to connect to {provider}",
        )

    def test_total_timeout_reaches_the_broad_handler_and_is_still_described(
        self, provider, authenticated_client, link_env, monkeypatch
    ):
        """aiohttp's total timeout is a bare asyncio.TimeoutError, not a ClientError."""
        _, factory, _ = LINKS[provider]
        _fail_with(monkeypatch, factory, asyncio.TimeoutError())

        message = _assert_safe_message(
            self._post(authenticated_client, provider), IntegrationErrorCode.TIMEOUT
        )

        assert "timed out" in message

    def test_truly_unexpected_error_is_a_generic_500(
        self, provider, authenticated_client, link_env, monkeypatch
    ):
        _, factory, _ = LINKS[provider]
        _fail_with(monkeypatch, factory, RuntimeError(SECRET_TEXT))

        response = self._post(authenticated_client, provider)

        assert response.status_code == 500
        assert SECRET_TEXT not in response.text
        assert "admin panel" not in response.text


# ---------------------------------------------------------------- uploads


class _FakeResponse:
    def __init__(self, status, body="", json_body=None):
        self.status = status
        self._body = body
        self._json = json_body

    async def json(self):
        if self._json is None:
            raise aiohttp.ContentTypeError(None, (), message="not json")
        return self._json

    async def text(self):
        return self._body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakeSession:
    def __init__(self, response):
        self._response = response

    def post(self, *args, **kwargs):
        return self._response

    async def close(self):
        return None


@pytest.fixture
def upload_env(db_session, test_user, parent_record):
    """The user has both integrations configured; only the network is faked."""
    db_session.add(
        UserPreferences(
            user_id=test_user.id,
            paperless_enabled=True,
            paperless_url="http://127.0.0.1:9",
            paperless_api_token_encrypted="token",
            papra_enabled=True,
            papra_url="http://127.0.0.1:9",
            papra_api_token_encrypted="token",
            papra_organization_id="org_1",
        )
    )
    db_session.commit()


PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def _upload(client, backend: str):
    return client.post(
        UPLOAD_URL,
        files={"file": ("scan.pdf", PDF, "application/pdf")},
        data={"storage_backend": backend},
    )


def _paperless_answering(monkeypatch, response):
    service = PaperlessServiceToken("http://127.0.0.1:9", "token", 1)

    @asynccontextmanager
    async def fake_request(*args, **kwargs):
        yield response

    service._make_request = fake_request
    monkeypatch.setattr(
        "app.services.paperless_service.create_paperless_service",
        lambda *args, **kwargs: service,
    )


def _papra_answering(monkeypatch, response):
    client = PapraClient(
        SimpleNamespace(url="http://papra.test", organization_id="org_1")
    )
    client._session = _FakeSession(response)
    monkeypatch.setattr(
        "app.services.papra_client.create_papra_client", lambda **kwargs: client
    )


class TestPaperlessUpload:
    """At HEAD the curated upload messages reached the user; they must again."""

    def test_duplicate_is_explained_and_coded(
        self, authenticated_client, upload_env, monkeypatch
    ):
        _paperless_answering(
            monkeypatch,
            _FakeResponse(
                400, json_body={"detail": f"It is a duplicate {SECRET_TEXT}"}
            ),
        )

        message = _assert_safe_message(
            _upload(authenticated_client, "paperless"),
            IntegrationErrorCode.DUPLICATE_DOCUMENT,
        )

        assert "scan.pdf" in message
        assert "appears to be a duplicate" in message

    @pytest.mark.parametrize(
        ("upstream", "code"),
        [
            ("Unsupported file type", IntegrationErrorCode.UNSUPPORTED_FORMAT),
            ("File too large", IntegrationErrorCode.FILE_TOO_LARGE),
            ("Permission denied", IntegrationErrorCode.PERMISSION_DENIED),
            ("No disk space left", IntegrationErrorCode.STORAGE_FULL),
            ("something nobody anticipated", IntegrationErrorCode.UPLOAD_FAILED),
        ],
    )
    def test_other_rejections(
        self, upstream, code, authenticated_client, upload_env, monkeypatch
    ):
        _paperless_answering(
            monkeypatch, _FakeResponse(400, body=f"{upstream} {SECRET_TEXT}")
        )

        _assert_safe_message(_upload(authenticated_client, "paperless"), code)

    def test_rejected_credentials(self, authenticated_client, upload_env, monkeypatch):
        _paperless_answering(monkeypatch, _FakeResponse(401))

        _assert_safe_message(
            _upload(authenticated_client, "paperless"),
            IntegrationErrorCode.AUTH_FAILED,
            PAPERLESS_AUTH_FAILED_MESSAGE,
        )

    def test_unexpected_upstream_status(
        self, authenticated_client, upload_env, monkeypatch
    ):
        _paperless_answering(monkeypatch, _FakeResponse(502, body=SECRET_TEXT))

        message = _assert_safe_message(
            _upload(authenticated_client, "paperless"),
            IntegrationErrorCode.HTTP_ERROR,
        )

        assert "HTTP 502" in message


class TestPapraUpload:
    def test_rejected_token(self, authenticated_client, upload_env, monkeypatch):
        _papra_answering(monkeypatch, _FakeResponse(401, body=SECRET_TEXT))

        _assert_safe_message(
            _upload(authenticated_client, "papra"),
            IntegrationErrorCode.AUTH_FAILED,
            PAPRA_AUTH_FAILED_MESSAGE,
        )

    def test_unexpected_upstream_status(
        self, authenticated_client, upload_env, monkeypatch
    ):
        _papra_answering(monkeypatch, _FakeResponse(503, body=SECRET_TEXT))

        message = _assert_safe_message(
            _upload(authenticated_client, "papra"), IntegrationErrorCode.HTTP_ERROR
        )

        assert "HTTP 503" in message
