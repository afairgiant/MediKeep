"""Paperless/Papra clients report a rejected credential as a distinct error (issue #1200).

Upstream error text is no longer returned to API clients, so the clients must
signal "the credentials were rejected" themselves for the endpoints to show an
explicit authentication message.
"""

from types import SimpleNamespace

import pytest

from app.services.paperless_client import (
    PaperlessClient,
    PaperlessClientAuthError,
    PaperlessClientError,
)
from app.services.papra_client import (
    PapraClient,
    PapraClientAuthError,
    PapraClientError,
    PapraUploadError,
)


class _FakeResponse:
    def __init__(self, status: int):
        self.status = status

    async def text(self):
        return "upstream body that must never reach a client"

    async def json(self):
        return {"document": {"id": "doc_1"}}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakeSession:
    """Answers every request with one status code."""

    def __init__(self, status: int):
        self._status = status

    def get(self, *args, **kwargs):
        return _FakeResponse(self._status)

    def post(self, *args, **kwargs):
        return _FakeResponse(self._status)

    async def close(self):
        return None


def _papra(status: int) -> PapraClient:
    client = PapraClient(
        SimpleNamespace(url="http://papra.test", organization_id="org_1")
    )
    client._session = _FakeSession(status)
    return client


def _paperless(status: int) -> PaperlessClient:
    client = PaperlessClient(SimpleNamespace(url="http://paperless.test"))
    client._session = _FakeSession(status)
    return client


AUTH_STATUSES = [401, 403]


@pytest.mark.asyncio
class TestPapraClientAuthErrors:
    @pytest.mark.parametrize("status", AUTH_STATUSES)
    async def test_get_document_info_reports_rejected_token(self, status):
        with pytest.raises(PapraClientAuthError):
            await _papra(status).get_document_info("doc_1")

    @pytest.mark.parametrize("status", AUTH_STATUSES)
    async def test_search_reports_rejected_token(self, status):
        with pytest.raises(PapraClientAuthError):
            await _papra(status).search_documents(query="x")

    @pytest.mark.parametrize("status", AUTH_STATUSES)
    async def test_upload_reports_rejected_token_unwrapped(self, status):
        """Must not be re-wrapped as a generic upload error by the broad handler."""
        with pytest.raises(PapraClientAuthError) as raised:
            await _papra(status).upload_document(b"data", "a.pdf")

        assert not isinstance(raised.value, PapraUploadError)

    async def test_auth_error_is_still_a_client_error(self):
        """Existing `except PapraClientError` handlers keep catching it."""
        assert issubclass(PapraClientAuthError, PapraClientError)

    async def test_error_text_carries_status_not_upstream_body(self):
        with pytest.raises(PapraClientAuthError) as raised:
            await _papra(401).get_document_info("doc_1")

        assert "401" in str(raised.value)
        assert "upstream body" not in str(raised.value)

    async def test_other_failures_are_not_reported_as_auth(self):
        with pytest.raises(PapraClientError) as raised:
            await _papra(500).get_document_info("doc_1")

        assert not isinstance(raised.value, PapraClientAuthError)

    async def test_missing_document_still_returns_none(self):
        assert await _papra(404).get_document_info("doc_1") is None


@pytest.mark.asyncio
class TestPaperlessClientAuthErrors:
    @pytest.mark.parametrize("status", AUTH_STATUSES)
    async def test_get_document_info_reports_rejected_credentials(self, status):
        with pytest.raises(PaperlessClientAuthError):
            await _paperless(status).get_document_info("1")

    async def test_auth_error_is_still_a_client_error(self):
        assert issubclass(PaperlessClientAuthError, PaperlessClientError)

    async def test_other_failures_are_not_reported_as_auth(self):
        with pytest.raises(PaperlessClientError) as raised:
            await _paperless(500).get_document_info("1")

        assert not isinstance(raised.value, PaperlessClientAuthError)

    async def test_missing_document_still_returns_none(self):
        assert await _paperless(404).get_document_info("1") is None
