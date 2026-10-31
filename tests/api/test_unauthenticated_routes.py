"""Routes reachable without signing in: what each one exposes and accepts."""

import re
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import frontend_logs
from app.api.v1.endpoints import system as system_endpoint
from app.main import app

LOG_URL = "/api/v1/frontend-logs/log"
ERROR_URL = "/api/v1/frontend-logs/error"
ROTATION_URL = "/api/v1/system/log-rotation-config"


def _log_payload(**overrides):
    payload = {
        "level": "error",
        "message": "boom",
        "category": "error",
        "timestamp": "2026-10-31T12:00:00Z",
    }
    payload.update(overrides)
    return payload


def _error_payload(**overrides):
    payload = {
        "error_message": "boom",
        "error_type": "TypeError",
        "url": "/dashboard",
        "timestamp": "2026-10-31T12:00:00Z",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def captured_logger(monkeypatch):
    logger = MagicMock()
    monkeypatch.setattr(frontend_logs, "frontend_logger", logger)
    return logger


@pytest.fixture
def frontend_log_limit(limiter_ceiling):
    return lambda n: limiter_ceiling(frontend_logs._anonymous_limiter, n)


class TestRemovedAdminRoutes:
    @pytest.mark.parametrize(
        "path",
        ["/api/v1/admin/dashboard/stats-test", "/api/v1/admin/dashboard/health-check"],
    )
    def test_route_no_longer_exists(self, client: TestClient, path):
        assert client.get(path).status_code == 404


class TestAdminRouterGuard:
    def test_every_admin_route_rejects_a_signed_out_caller(self, client: TestClient):
        admin_paths = {
            path: operations
            for path, operations in app.openapi()["paths"].items()
            if path.startswith("/api/v1/admin/")
        }
        open_routes = []
        for path, operations in admin_paths.items():
            url = re.sub(r"\{[^}]+\}", "1", path)
            for method in operations:
                if client.request(method, url).status_code != 401:
                    open_routes.append(f"{method.upper()} {path}")

        assert admin_paths
        assert open_routes == []


class TestLogRotationConfigRequiresAdmin:
    def test_signed_out_is_rejected(self, client: TestClient):
        assert client.get(ROTATION_URL).status_code == 401

    def test_regular_user_is_forbidden(self, authenticated_client: TestClient):
        assert authenticated_client.get(ROTATION_URL).status_code == 403

    def test_admin_gets_the_config(self, admin_client: TestClient):
        response = admin_client.get(ROTATION_URL)

        assert response.status_code == 200
        assert "rotation_method" in response.json()

    def test_public_log_level_traffic_does_not_use_up_the_admin_quota(
        self, admin_client: TestClient, limiter_ceiling
    ):
        limiter_ceiling(system_endpoint.rate_limiter, 1)
        admin_client.get("/api/v1/system/log-level")

        assert admin_client.get(ROTATION_URL).status_code == 200


class TestLogLevelStaysPublic:
    def test_signed_out_gets_the_level_but_not_file_details(self, client: TestClient):
        response = client.get("/api/v1/system/log-level")

        assert response.status_code == 200
        body = response.json()
        assert "current_level" in body
        assert "file_mapping" not in body
        assert "configuration" not in body


class TestFrontendLogTrust:
    def test_signed_out_client_can_log(self, client: TestClient, captured_logger):
        response = client.post(LOG_URL, json=_log_payload())

        assert response.status_code == 200
        captured_logger.error.assert_called_once()

    def test_details_cannot_overwrite_server_fields(
        self, client: TestClient, captured_logger
    ):
        client.post(
            LOG_URL,
            json=_log_payload(
                details={"ip": "10.0.0.1", "user_id": 1, "event": "user_login"}
            ),
        )

        extra = captured_logger.error.call_args.kwargs["extra"]
        assert extra["ip"] != "10.0.0.1"
        assert "user_id" not in extra
        assert "event" not in extra
        assert extra["details"]["ip"] == "10.0.0.1"

    @pytest.mark.parametrize(
        "url, payload", [(LOG_URL, _log_payload), (ERROR_URL, _error_payload)]
    )
    def test_client_user_id_is_not_logged_as_the_user(
        self, client: TestClient, captured_logger, url, payload
    ):
        client.post(url, json=payload(user_id=42))

        extra = captured_logger.error.call_args.kwargs["extra"]
        assert "user_id" not in extra
        assert extra["client_user_id"] == 42

    def test_newlines_in_message_cannot_forge_a_second_line(
        self, client: TestClient, captured_logger
    ):
        client.post(LOG_URL, json=_log_payload(message="ok\nFAKE ENTRY"))

        message = captured_logger.error.call_args.args[0]
        assert "\n" not in message


class TestFrontendLogLevels:
    @pytest.mark.parametrize(
        "level, method",
        [
            ("WARNING", "warning"),
            ("warn", "warning"),
            ("CRITICAL", "critical"),
            ("ERROR", "error"),
            ("DEBUG", "debug"),
            ("INFO", "info"),
            ("trace", "info"),
        ],
    )
    def test_level_reaches_the_matching_logger_method(
        self, client: TestClient, captured_logger, level, method
    ):
        client.post(LOG_URL, json=_log_payload(level=level))

        getattr(captured_logger, method).assert_called_once()


class TestFrontendLogMessageCap:
    def test_long_message_is_truncated_not_rejected(
        self, client: TestClient, captured_logger
    ):
        response = client.post(LOG_URL, json=_log_payload(message="x" * 50000))

        assert response.status_code == 200
        message = captured_logger.error.call_args.args[0]
        assert message.count("x") == frontend_logs.MAX_MESSAGE_LENGTH


class TestFrontendLogRateLimit:
    def test_over_the_limit_returns_429(
        self, client: TestClient, captured_logger, frontend_log_limit
    ):
        frontend_log_limit(1)
        client.post(LOG_URL, json=_log_payload())

        response = client.post(LOG_URL, json=_log_payload())

        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) >= 1

    def test_log_and_error_share_one_limit(
        self, client: TestClient, captured_logger, frontend_log_limit
    ):
        frontend_log_limit(1)
        client.post(LOG_URL, json=_log_payload())

        assert client.post(ERROR_URL, json=_error_payload()).status_code == 429

    def test_over_the_limit_is_refused_before_the_body_is_validated(
        self, client: TestClient, captured_logger, frontend_log_limit
    ):
        frontend_log_limit(1)
        client.post(LOG_URL, json=_log_payload())

        assert client.post(LOG_URL, json={}).status_code == 429

    def test_limits_are_per_ip(
        self, behind_trusted_proxy: TestClient, captured_logger, frontend_log_limit
    ):
        def post(ip):
            return behind_trusted_proxy.post(
                LOG_URL, json=_log_payload(), headers={"X-Forwarded-For": ip}
            )

        frontend_log_limit(1)
        post("198.51.100.40")

        assert post("198.51.100.40").status_code == 429
        assert post("198.51.100.41").status_code == 200
