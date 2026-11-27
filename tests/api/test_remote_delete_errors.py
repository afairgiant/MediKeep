"""A Paperless or Papra delete that fails says why (issue #1281).

The clients classify the failure where the HTTP status is known, and the delete
endpoint answers with that message and an ``integration_`` error code. Before,
every failure but 404 became a generic 500, which the frontend showed as
"service unavailable".
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import aiohttp
import pytest
from fastapi.testclient import TestClient

from app.core.http.integration_errors import (
    PAPERLESS_DELETE_PERMISSION_MESSAGE,
    PAPRA_DELETE_PERMISSION_MESSAGE,
    IntegrationErrorCode,
    describe_integration_failure,
)
from app.models.models import EntityFile
from app.services.generic_entity_file_service import GenericEntityFileService
from app.services.paperless_client import PaperlessClient, PaperlessClientError
from app.services.papra_client import PapraClient, PapraClientError
from tests.utils.paperless_uploads import member, patient_for, remote_file
from tests.utils.user import create_user_token_headers


class _FakeResponse:
    def __init__(self, status: int):
        self.status = status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakeSession:
    """Answers each delete with ``status`` or raises ``error``; answers each read with 404."""

    def __init__(self, status: int = 204, error: Exception = None):
        self._status = status
        self._error = error

    def get(self, *args, **kwargs):
        return _FakeResponse(404)

    def delete(self, *args, **kwargs):
        if self._error is not None:
            raise self._error
        return _FakeResponse(self._status)

    async def close(self):
        return None


def _paperless(session: _FakeSession) -> PaperlessClient:
    client = PaperlessClient(SimpleNamespace(url="http://paperless.test"))
    client._session = session
    return client


def _papra(session: _FakeSession) -> PapraClient:
    client = PapraClient(
        SimpleNamespace(url="http://papra.test", organization_id="org-1")
    )
    client._session = session
    return client


CLIENTS = {
    "Paperless": (_paperless, PaperlessClientError),
    "Papra": (_papra, PapraClientError),
}
PERMISSION_MESSAGES = {
    "Paperless": PAPERLESS_DELETE_PERMISSION_MESSAGE,
    "Papra": PAPRA_DELETE_PERMISSION_MESSAGE,
}


async def _failure(provider: str, session: _FakeSession):
    make_client, error_type = CLIENTS[provider]
    with pytest.raises(error_type) as raised:
        await make_client(session).delete_document("42")
    return describe_integration_failure(raised.value, provider)


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", list(CLIENTS))
class TestClientDeleteFailures:
    @pytest.mark.parametrize(
        "status, code",
        [
            (401, IntegrationErrorCode.AUTH_FAILED),
            (403, IntegrationErrorCode.DELETE_PERMISSION_DENIED),
            (500, IntegrationErrorCode.HTTP_ERROR),
        ],
    )
    async def test_refused_delete_is_described(self, provider, status, code):
        failure = await _failure(provider, _FakeSession(status))
        assert failure.code == code

    async def test_refusal_names_the_delete_permission(self, provider):
        failure = await _failure(provider, _FakeSession(403))
        assert failure.message == PERMISSION_MESSAGES[provider]

    async def test_unexpected_status_is_named(self, provider):
        failure = await _failure(provider, _FakeSession(500))
        assert "HTTP 500" in failure.message

    async def test_lost_connection_is_described(self, provider):
        session = _FakeSession(error=aiohttp.ClientConnectionError())
        failure = await _failure(provider, session)
        assert failure.code == IntegrationErrorCode.CONNECTION_FAILED

    async def test_missing_document_counts_as_deleted(self, provider):
        make_client, _ = CLIENTS[provider]
        assert await make_client(_FakeSession(404)).delete_document("42") is True


@pytest.fixture
def owner(db_session):
    return member(db_session)


def _stored_file(db_session, owner, backend: str) -> int:
    patient = patient_for(db_session, owner.id)
    return remote_file(db_session, patient.id, backend, owner.id).id


def _delete(client: TestClient, user, file_id: int):
    return client.delete(
        f"/api/v1/entity-files/files/{file_id}",
        headers=create_user_token_headers(user.username),
    )


class TestDeleteEndpoint:
    def _delete_from_paperless(self, client, db_session, owner, session):
        file_id = _stored_file(db_session, owner, "paperless")
        # A fresh client per call: the identity check closes its session first
        with patch.object(
            GenericEntityFileService,
            "_create_paperless_client",
            AsyncMock(side_effect=lambda *args: _paperless(session)),
        ):
            response = _delete(client, owner, file_id)
        return response, file_id

    def _assert_kept(self, db_session, file_id):
        db_session.expire_all()
        assert db_session.get(EntityFile, file_id) is not None

    def test_paperless_refusal_names_the_missing_permission(
        self, client: TestClient, db_session, owner
    ):
        response, file_id = self._delete_from_paperless(
            client, db_session, owner, _FakeSession(403)
        )

        assert response.status_code == 400, response.text
        body = response.json()
        assert body["error_code"] == IntegrationErrorCode.DELETE_PERMISSION_DENIED
        assert body["message"] == PAPERLESS_DELETE_PERMISSION_MESSAGE
        self._assert_kept(db_session, file_id)

    def test_paperless_timeout_is_reported_as_a_timeout(
        self, client: TestClient, db_session, owner
    ):
        # aiohttp's total timeout is not an aiohttp.ClientError, so it reaches the service as is
        response, file_id = self._delete_from_paperless(
            client, db_session, owner, _FakeSession(error=asyncio.TimeoutError())
        )

        assert response.status_code == 400, response.text
        assert response.json()["error_code"] == IntegrationErrorCode.TIMEOUT
        self._assert_kept(db_session, file_id)

    def test_papra_refusal_names_the_missing_permission(
        self, client: TestClient, db_session, owner
    ):
        file_id = _stored_file(db_session, owner, "papra")
        with patch(
            "app.services.papra_client.create_papra_client",
            return_value=_papra(_FakeSession(403)),
        ):
            response = _delete(client, owner, file_id)

        assert response.status_code == 400, response.text
        body = response.json()
        assert body["error_code"] == IntegrationErrorCode.DELETE_PERMISSION_DENIED
        assert body["message"] == PAPRA_DELETE_PERMISSION_MESSAGE
        self._assert_kept(db_session, file_id)
