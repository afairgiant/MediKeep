"""A Paperless account that can upload but may not read upload tasks (issue #1280).

The task status endpoint must say which permission is missing without looking like a
MediKeep authentication failure, and the connection test must warn about it.
"""

from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.v1.endpoints import paperless as paperless_endpoint
from app.core.http.integration_errors import IntegrationErrorCode
from app.services.paperless_service import PaperlessServiceToken

PAPERLESS_URL = "http://127.0.0.1:8000"


@pytest.fixture(autouse=True)
def allow_private_urls(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True)


@pytest.fixture
def prefs():
    saved = MagicMock()
    saved.paperless_enabled = True
    saved.paperless_url = PAPERLESS_URL
    saved.paperless_api_token_encrypted = "saved-encrypted-token"
    saved.paperless_username_encrypted = None
    saved.paperless_password_encrypted = None
    return saved


def _factory(service):
    @asynccontextmanager
    async def factory(url, **kwargs):
        yield service

    return factory


class TestTaskStatusEndpoint:
    def test_paperless_403_is_a_described_400_not_an_auth_error(
        self, authenticated_client, prefs, caplog
    ):
        service = MagicMock()

        @asynccontextmanager
        async def forbidden(method, endpoint):
            yield SimpleNamespace(status=403)

        service._make_request = forbidden

        with (
            patch.object(
                paperless_endpoint.user_preferences,
                "get_by_user_id",
                return_value=prefs,
            ),
            patch.object(
                paperless_endpoint, "has_usable_credentials", return_value=True
            ),
            patch.object(paperless_endpoint, "credential_kwargs", return_value={}),
            patch.object(
                paperless_endpoint, "create_paperless_service", _factory(service)
            ),
            caplog.at_level("WARNING"),
        ):
            response = authenticated_client.get("/api/v1/paperless/tasks/abc/status")

        assert response.status_code == 400, response.text
        body = response.json()
        assert body["error_code"] == IntegrationErrorCode.TASK_PERMISSION_DENIED
        assert "PaperlessTask" in body["message"]
        assert not any(
            getattr(record, "event", None) == "authentication_error"
            for record in caplog.records
        )


class TestConnectionTestWarning:
    @pytest.mark.parametrize(
        "can_view_tasks, warnings",
        [
            (False, ["task_permission_missing"]),
            (True, None),
            (None, None),
        ],
        ids=["forbidden", "allowed", "could_not_tell"],
    )
    def test_warns_only_when_tasks_are_refused(
        self, authenticated_client, prefs, can_view_tasks, warnings
    ):
        service = MagicMock()
        service.test_connection = AsyncMock(return_value={"status": "connected"})
        service.can_view_tasks = AsyncMock(return_value=can_view_tasks)
        service.get_auth_type.return_value = "token"

        with (
            patch.object(
                paperless_endpoint.user_preferences,
                "get_by_user_id",
                return_value=prefs,
            ),
            patch.object(paperless_endpoint.user_preferences, "update"),
            patch.object(
                paperless_endpoint, "create_paperless_service", _factory(service)
            ),
        ):
            response = authenticated_client.post(
                "/api/v1/paperless/test-connection",
                json={"paperless_url": PAPERLESS_URL},
            )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] == "connected"
        assert body.get("warnings") == warnings


@pytest.mark.asyncio
class TestCanViewTasks:
    @pytest.mark.parametrize(
        "status, expected",
        [(200, True), (403, False), (500, None)],
        ids=["allowed", "forbidden", "server_error"],
    )
    async def test_answer_follows_the_task_read(self, status, expected):
        service = PaperlessServiceToken(PAPERLESS_URL, "token", user_id=1)
        requested = []

        @asynccontextmanager
        async def answer(method, endpoint):
            requested.append(endpoint)
            yield SimpleNamespace(status=status)

        with patch.object(service, "_make_request", answer):
            assert await service.can_view_tasks() is expected
        assert requested[0].startswith("/api/tasks/?task_id=")

    async def test_a_failed_request_is_not_a_refusal(self):
        service = PaperlessServiceToken(PAPERLESS_URL, "token", user_id=1)

        def broken(method, endpoint):
            raise ConnectionError("unreachable")

        with patch.object(service, "_make_request", broken):
            assert await service.can_view_tasks() is None
