"""Paperless task-status and search record why they failed (issue #1200).

The responses are fixed messages, so the log is the only place the cause is
recorded. These handlers previously logged nothing.
"""

from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import paperless as paperless_endpoint
from app.api.v1.endpoints.paperless import (
    get_paperless_task_status,
    search_paperless_documents,
)
from app.services.paperless_service import (
    PaperlessAuthenticationError,
    PaperlessConnectionError,
)
from tests.utils.log_output import persisted_causes

TASK_UUID = "4a8e8eee-bc89-4290-a7a5-5d01cb08d54d"
CAUSE = "CAUSE-DETAIL internal-paperless.lan:8000 refused"


@pytest.fixture
def paperless_user_prefs():
    prefs = MagicMock()
    prefs.paperless_enabled = True
    prefs.paperless_url = "https://paperless.example.com"
    prefs.paperless_api_token_encrypted = "encrypted-token"
    prefs.paperless_username_encrypted = None
    prefs.paperless_password_encrypted = None
    return prefs


def _failing_factory(error: Exception):
    @asynccontextmanager
    async def factory(*args, **kwargs):
        raise error
        yield  # pragma: no cover - makes this an async generator

    return factory


async def _call(endpoint, error, prefs, db):
    user = MagicMock(id=2)
    with patch.object(
        paperless_endpoint.user_preferences, "get_by_user_id", return_value=prefs
    ), patch.object(
        paperless_endpoint, "create_paperless_service", _failing_factory(error)
    ):
        if endpoint is get_paperless_task_status:
            return await endpoint(task_uuid=TASK_UUID, current_user=user, db=db)
        return await endpoint(db=db, current_user=user, query="x")


def _causes(caplog):
    """The causes as app.log stores them, not as the LogRecord holds them."""
    return persisted_causes(caplog)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("endpoint", "operation"),
    [
        (get_paperless_task_status, "task_status"),
        (search_paperless_documents, "document_search"),
    ],
)
class TestPaperlessHandlersLogTheirCause:
    async def test_connection_failure(
        self, endpoint, operation, paperless_user_prefs, db_session, caplog
    ):
        with caplog.at_level("WARNING"):
            with pytest.raises(HTTPException) as raised:
                await _call(
                    endpoint,
                    PaperlessConnectionError(CAUSE),
                    paperless_user_prefs,
                    db_session,
                )

        assert raised.value.status_code == 400
        assert CAUSE not in str(raised.value.detail)
        assert any(CAUSE in cause for cause in _causes(caplog))
        assert any(
            getattr(record, "event", None) == f"paperless_{operation}"
            for record in caplog.records
        )

    async def test_rejected_credentials(
        self, endpoint, operation, paperless_user_prefs, db_session, caplog
    ):
        with caplog.at_level("WARNING"):
            with pytest.raises(HTTPException) as raised:
                await _call(
                    endpoint,
                    PaperlessAuthenticationError(CAUSE),
                    paperless_user_prefs,
                    db_session,
                )

        # 401 would make the frontend treat the MediKeep session as expired.
        assert raised.value.status_code == 400
        assert CAUSE not in str(raised.value.detail)
        assert any(CAUSE in cause for cause in _causes(caplog))


class _RequestFailingService:
    """A service whose request itself fails, after the service was created."""

    def __init__(self, error: Exception):
        self._error = error

    @asynccontextmanager
    async def _make_request(self, *args, **kwargs):
        raise self._error
        yield  # pragma: no cover - makes this an async generator


def _service_factory(error: Exception):
    @asynccontextmanager
    async def factory(*args, **kwargs):
        yield _RequestFailingService(error)

    return factory


@pytest.mark.asyncio
class TestFailureDuringTheRequestKeepsItsMeaning:
    """The task-status endpoint has an inner try around the request. Its broad handler
    must not turn a connection or credential failure into a 500 that skips the
    provider-specific handling (and the log entry) below it."""

    async def _call(self, error, prefs, db):
        with patch.object(
            paperless_endpoint.user_preferences, "get_by_user_id", return_value=prefs
        ), patch.object(
            paperless_endpoint, "create_paperless_service", _service_factory(error)
        ):
            return await get_paperless_task_status(
                task_uuid=TASK_UUID, current_user=MagicMock(id=2), db=db
            )

    async def test_connection_failure_is_a_400_and_is_logged(
        self, paperless_user_prefs, db_session, caplog
    ):
        with caplog.at_level("WARNING"):
            with pytest.raises(HTTPException) as raised:
                await self._call(
                    PaperlessConnectionError(CAUSE), paperless_user_prefs, db_session
                )

        assert raised.value.status_code == 400
        assert "Unable to connect" in raised.value.detail
        assert CAUSE not in str(raised.value.detail)
        assert any(CAUSE in cause for cause in _causes(caplog))

    async def test_rejected_credentials_are_a_400_and_are_logged(
        self, paperless_user_prefs, db_session, caplog
    ):
        with caplog.at_level("WARNING"):
            with pytest.raises(HTTPException) as raised:
                await self._call(
                    PaperlessAuthenticationError(CAUSE),
                    paperless_user_prefs,
                    db_session,
                )

        assert raised.value.status_code == 400
        assert "authentication failed" in raised.value.detail.lower()
        assert any(CAUSE in cause for cause in _causes(caplog))

    async def test_search_keeps_the_same_meaning_for_a_failed_request(
        self, paperless_user_prefs, db_session, caplog
    ):
        """The sibling search endpoint has no such inner handler; keep it that way."""
        with patch.object(
            paperless_endpoint.user_preferences,
            "get_by_user_id",
            return_value=paperless_user_prefs,
        ), patch.object(
            paperless_endpoint,
            "create_paperless_service",
            _service_factory(PaperlessConnectionError(CAUSE)),
        ):
            with caplog.at_level("WARNING"):
                with pytest.raises(HTTPException) as raised:
                    await search_paperless_documents(
                        db=db_session, current_user=MagicMock(id=2), query="x"
                    )

        assert raised.value.status_code == 400
        assert any(CAUSE in cause for cause in _causes(caplog))

    async def test_an_unexpected_error_is_still_a_generic_500(
        self, paperless_user_prefs, db_session
    ):
        with pytest.raises(HTTPException) as raised:
            await self._call(RuntimeError(CAUSE), paperless_user_prefs, db_session)

        assert raised.value.status_code == 500
        assert CAUSE not in str(raised.value.detail)
