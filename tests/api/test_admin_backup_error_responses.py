"""Backup admin endpoints: generic 500 to the client, full error in the log (issue #1200)."""

from app.services.backup_service import BackupService
from tests.utils.log_output import persisted_entries

BACKUPS_URL = "/api/v1/admin/backups/"

# Looks like the internals an attacker would want: a path, SQL and a library.
SECRET_TEXT = "/srv/medikeep/secret/path SELECT * FROM users psycopg2 3.1.9"


async def _boom(*args, **kwargs):
    raise Exception(SECRET_TEXT)


def test_list_backups_failure_is_generic_for_client_and_detailed_in_log(
    admin_client, monkeypatch, caplog
):
    monkeypatch.setattr(BackupService, "list_backups", _boom)

    with caplog.at_level("ERROR"):
        response = admin_client.get(BACKUPS_URL)

    assert response.status_code == 500
    assert response.json()["message"] == "Failed to list backups"
    assert SECRET_TEXT not in response.text

    logged = [
        entry
        for entry in persisted_entries(caplog)
        if entry.get("event") == "endpoint_error"
    ]
    assert logged
    assert SECRET_TEXT in logged[0]["error"]
