"""The admin dashboard's last-backup time picks up custom-format database dumps."""

import glob
import os
from datetime import datetime

HEALTH_URL = "/api/v1/admin/dashboard/system-health"


def test_dump_backup_counts_as_the_last_backup(admin_client, tmp_path, monkeypatch):
    dump = tmp_path / "backups" / "database_backup_20261127_100000.dump"
    dump.parent.mkdir()
    dump.write_bytes(b"PGDMP")
    stamp = datetime(2026, 11, 27, 10, 0, 0).timestamp()
    os.utime(dump, (stamp, stamp))
    real_glob = glob.glob
    # The endpoint globs relative to the working directory, which the test database also uses.
    monkeypatch.setattr(
        glob, "glob", lambda pattern: real_glob(str(tmp_path / pattern))
    )

    response = admin_client.get(HEALTH_URL)

    assert response.status_code == 200
    assert response.json()["last_backup"].startswith("2026-11-27T10:00:00")
