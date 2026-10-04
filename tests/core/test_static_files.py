"""
Tests for SPA static file serving and its interaction with API and health routes.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.http.error_handling import setup_error_handling
from app.core.http.static_files import setup_static_files

REPO_ROOT = Path(__file__).resolve().parents[2]
INDEX_HTML = "<!doctype html><html><body>spa</body></html>"


@pytest.fixture
def static_build(tmp_path, monkeypatch) -> Path:
    """A minimal frontend build directory, selected through STATIC_DIR."""
    (tmp_path / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    (tmp_path / "robots.txt").write_text("User-agent: *", encoding="utf-8")
    monkeypatch.setenv("STATIC_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def spa_client(static_build) -> TestClient:
    app = FastAPI()
    setup_error_handling(app)

    @app.get("/api/v1/real")
    def real_endpoint():
        return {"ok": True}

    setup_static_files(app)
    return TestClient(app)


class TestSpaCatchAll:
    @pytest.mark.parametrize("path", ["/api/v1/nope", "/api/"])
    def test_unmatched_api_path_returns_404(self, spa_client, path):
        response = spa_client.get(path)

        assert response.status_code == 404
        body = response.json()
        assert body["error_code"] == "NOT-404"
        assert body["message"] == "API endpoint not found"

    def test_registered_api_route_is_not_shadowed(self, spa_client):
        response = spa_client.get("/api/v1/real")

        assert response.status_code == 200
        assert response.json() == {"ok": True}

    @pytest.mark.parametrize("path", ["/", "/login", "/patients/5/medications", "/api"])
    def test_client_side_routes_get_index_html(self, spa_client, path):
        response = spa_client.get(path)

        assert response.status_code == 200
        assert response.text == INDEX_HTML

    def test_root_level_build_file_is_served(self, spa_client):
        response = spa_client.get("/robots.txt")

        assert response.status_code == 200
        assert response.text == "User-agent: *"


class TestHealthWithStaticBuild:
    def test_health_is_not_shadowed_by_catch_all(self, static_build):
        # app.main resolves STATIC_DIR at import, so a fresh interpreter is needed
        script = (
            "from fastapi.testclient import TestClient;"
            "from app.main import app;"
            "r = TestClient(app).get('/health');"
            "print('RESULT', r.status_code, r.headers['content-type'], r.json()['status']);"
            "print('LAST_ROUTE', app.routes[-1].path)"
        )
        result = subprocess.run(
            [sys.executable, "-c", script],
            env={**os.environ, "STATIC_DIR": str(static_build)},
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )

        assert result.returncode == 0, result.stderr
        assert "RESULT 200 application/json ok" in result.stdout
        # Any route registered after the catch-all is unreachable for GET
        assert "LAST_ROUTE /{full_path:path}" in result.stdout
