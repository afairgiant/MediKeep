"""Tests for the Paperless task status endpoint against both paperless-ngx API versions.

Regression coverage for #985: paperless-ngx 3.x reports task status in lowercase,
which the endpoint used to read as "still pending" forever.
"""

from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

import pytest

from app.api.v1.endpoints import paperless as paperless_endpoint
from app.api.v1.endpoints.paperless import (
    _categorize_task_error,
    get_paperless_task_status,
)

TASK_UUID = "4a8e8eee-bc89-4290-a7a5-5d01cb08d54d"


class FakeResponse:
    """Minimal stand-in for the aiohttp response the service yields."""

    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status = status_code

    async def json(self):
        return self._payload

    async def text(self):
        return str(self._payload)


class FakePaperlessService:
    """Paperless service that answers every request with one canned payload."""

    def __init__(self, payload, status_code=200):
        self._response = FakeResponse(payload, status_code)

    @asynccontextmanager
    async def _make_request(self, method, endpoint, **kwargs):
        yield self._response


@pytest.fixture
def paperless_user_prefs():
    prefs = MagicMock()
    prefs.paperless_enabled = True
    prefs.paperless_url = "https://paperless.example.com"
    prefs.paperless_api_token_encrypted = "encrypted-token"
    prefs.paperless_username_encrypted = None
    prefs.paperless_password_encrypted = None
    return prefs


async def call_endpoint(payload, user_prefs, db):
    """Invoke the endpoint with Paperless returning `payload` for the task query."""

    @asynccontextmanager
    async def fake_factory(*args, **kwargs):
        yield FakePaperlessService(payload)

    with patch.object(
        paperless_endpoint.user_preferences, "get_by_user_id", return_value=user_prefs
    ), patch.object(paperless_endpoint, "create_paperless_service", fake_factory):
        return await get_paperless_task_status(
            task_uuid=TASK_UUID, current_user=MagicMock(id=2), db=db
        )


@pytest.mark.asyncio
class TestTaskStatusEndpoint:
    """Endpoint behavior for v9 and v10 task payloads."""

    async def test_v10_success_links_document(self, paperless_user_prefs, db_session):
        payload = {
            "count": 1,
            "results": [
                {
                    "id": 4109,
                    "task_id": TASK_UUID,
                    "task_type": "consume_file",
                    "status": "success",
                    "status_display": "Success",
                    "result_data": {"document_id": 2744},
                    "related_document_ids": [2744],
                }
            ],
        }

        result = await call_endpoint(payload, paperless_user_prefs, db_session)

        assert result["status"] == "SUCCESS"
        assert result["result"]["document_id"] == "2744"

    async def test_v9_success_links_document(self, paperless_user_prefs, db_session):
        payload = {
            "count": 1,
            "results": [
                {
                    "id": 4109,
                    "task_id": TASK_UUID,
                    "task_name": "consume_file",
                    "status": "SUCCESS",
                    "result": "Success. New document id 2744 created",
                    "related_document": 2744,
                }
            ],
        }

        result = await call_endpoint(payload, paperless_user_prefs, db_session)

        assert result["status"] == "SUCCESS"
        assert result["result"]["document_id"] == "2744"

    async def test_v10_duplicate_reported_as_failure(
        self, paperless_user_prefs, db_session
    ):
        payload = {
            "count": 1,
            "results": [
                {
                    "task_id": TASK_UUID,
                    "status": "failure",
                    "result_data": {"duplicate_of": 42},
                    "related_document_ids": [42],
                }
            ],
        }

        result = await call_endpoint(payload, paperless_user_prefs, db_session)

        assert result["status"] == "FAILURE"
        assert result["error_type"] == "duplicate"

    async def test_pending_task(self, paperless_user_prefs, db_session):
        payload = {
            "count": 1,
            "results": [{"task_id": TASK_UUID, "status": "pending"}],
        }

        result = await call_endpoint(payload, paperless_user_prefs, db_session)

        assert result["status"] == "PENDING"
        assert result["result"] is None

    async def test_unknown_task_returns_404(self, paperless_user_prefs, db_session):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await call_endpoint(
                {"count": 0, "results": []}, paperless_user_prefs, db_session
            )

        assert exc_info.value.status_code == 404


class TestCategorizeTaskError:
    """Mapping of Paperless failure messages to frontend error types."""

    def test_duplicate_flag_wins(self):
        assert _categorize_task_error("anything at all", True) == "duplicate"

    @pytest.mark.parametrize(
        "message,expected",
        [
            ("File appears to be corrupted", "corrupted_file"),
            ("Permission denied writing document", "permission_error"),
            ("File too large for consumption", "file_too_large"),
            ("No space left on device: disk space", "storage_full"),
            ("OCR failed after 3 retries", "ocr_failed"),
            ("Connection reset by peer", "network_error"),
            ("Something unexpected happened", "processing_error"),
        ],
    )
    def test_message_categorization(self, message, expected):
        assert _categorize_task_error(message, False) == expected
