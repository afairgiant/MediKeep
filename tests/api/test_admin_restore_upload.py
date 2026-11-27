"""Which backup file types the admin restore upload accepts."""

from types import SimpleNamespace

import pytest

from app.services.restore_service import RestoreService

UPLOAD_URL = "/api/v1/admin/restore/upload"


@pytest.fixture
def processed(monkeypatch):
    saved = []

    async def _process(self, uploaded_file, uploaded_by):
        saved.append(uploaded_file)
        return SimpleNamespace(
            id=1,
            backup_type="database",
            size_bytes=5,
            description="Uploaded",
        )

    monkeypatch.setattr(RestoreService, "process_uploaded_backup", _process)
    return saved


@pytest.mark.parametrize("name", ["backup.dump", "backup.sql", "backup.zip"])
def test_backup_file_types_are_accepted(admin_client, processed, name):
    response = admin_client.post(UPLOAD_URL, files={"file": (name, b"PGDMP")})

    assert response.status_code == 200
    assert [path.name for path in processed] == [name]


def test_other_file_types_are_refused(admin_client, processed):
    response = admin_client.post(UPLOAD_URL, files={"file": ("notes.txt", b"x")})

    assert response.status_code == 400
    assert processed == []


@pytest.mark.parametrize("name", ["../../escape.sql", "/tmp/escape.sql"])
def test_upload_name_cannot_leave_the_temp_dir(admin_client, processed, name):
    response = admin_client.post(UPLOAD_URL, files={"file": (name, b"PGDMP")})

    assert response.status_code == 200
    (path,) = processed
    assert path.name == "escape.sql"
    assert path.parent.name.startswith("backup_upload_")
