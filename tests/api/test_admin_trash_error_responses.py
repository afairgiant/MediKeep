"""Trash admin endpoints: generic 500s and deliberate HTTP errors preserved (issue #1200)."""

import os
from pathlib import Path

from app.core.config import settings
from app.services.file_management_service import file_management_service
from tests.utils.log_output import persisted_entries

TRASH_URL = "/api/v1/admin/trash/"
CLEANUP_URL = "/api/v1/admin/trash/cleanup"
PERMANENT_DELETE_URL = "/api/v1/admin/trash/permanently-delete"

# Looks like the internals an attacker would want: a path, SQL and a library.
SECRET_TEXT = "/srv/medikeep/secret/path SELECT * FROM users psycopg2 3.1.9"


def _boom(*args, **kwargs):
    raise Exception(SECRET_TEXT)


class TestTrashErrorResponses:
    def test_list_failure_returns_generic_500(self, admin_client, monkeypatch):
        monkeypatch.setattr(file_management_service, "list_trash_contents", _boom)

        response = admin_client.get(TRASH_URL)

        assert response.status_code == 500
        assert response.json()["message"] == "Failed to list trash contents"
        assert "secret" not in response.text
        assert "SELECT" not in response.text

    def test_cleanup_failure_returns_generic_500(self, admin_client, monkeypatch):
        monkeypatch.setattr(file_management_service, "cleanup_old_trash", _boom)

        response = admin_client.post(CLEANUP_URL)

        assert response.status_code == 500
        assert response.json()["message"] == "Failed to clean up trash"
        assert "secret" not in response.text

    def test_failure_is_logged_not_returned(self, admin_client, monkeypatch, caplog):
        monkeypatch.setattr(file_management_service, "list_trash_contents", _boom)

        with caplog.at_level("ERROR"):
            response = admin_client.get(TRASH_URL)

        assert SECRET_TEXT not in response.text
        logged = [
            entry
            for entry in persisted_entries(caplog)
            if entry.get("event") == "trash_list_failed"
        ]
        assert logged
        assert SECRET_TEXT in logged[0]["error"]

    def test_permanent_delete_missing_file_stays_404(self, admin_client):
        """A deliberate 404 must not be re-wrapped as a 500 by the broad handler."""
        missing = os.path.join(str(settings.TRASH_DIR), "does-not-exist.bin")

        response = admin_client.delete(
            PERMANENT_DELETE_URL, params={"trash_path": missing}
        )

        assert response.status_code == 404
        assert response.json()["message"] == "File not found in trash"

    def test_permanent_delete_unexpected_failure_returns_generic_500(
        self, admin_client, monkeypatch
    ):
        trash_dir = Path(settings.TRASH_DIR)
        trash_dir.mkdir(parents=True, exist_ok=True)
        target = trash_dir / "present-issue-1200.bin"
        target.write_bytes(b"x")
        try:
            with monkeypatch.context() as scoped:
                scoped.setattr(Path, "unlink", lambda _self, *a, **k: _boom())
                response = admin_client.delete(
                    PERMANENT_DELETE_URL,
                    params={
                        "trash_path": os.path.join(str(settings.TRASH_DIR), target.name)
                    },
                )
        finally:
            target.unlink(missing_ok=True)

        assert response.status_code == 500
        assert (
            response.json()["message"] == "Failed to permanently delete file from trash"
        )
        assert "secret" not in response.text
