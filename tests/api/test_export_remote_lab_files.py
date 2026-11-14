"""ZIP export of lab result files (PDF export with include_files).

Lab files are EntityFile rows (entity_type 'lab-result') whether they are stored
locally, in Paperless-ngx or in Papra; LabResultFile rows are the legacy table.
The export must fetch remote files with the exporting user's saved integration
settings and list every file it could not include.
"""

import csv
import io
import zipfile
from datetime import date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import export as export_module
from app.core.config import settings
from app.crud.lab_result import lab_result as lab_result_crud
from app.crud.user_preferences import user_preferences as user_preferences_crud
from app.models.models import EntityFile, LabResultFile
from app.schemas.lab_result import LabResultCreate
from app.services import report_translations

EXPORT_URL = "/api/v1/export/data"
MANIFEST = "FILES_NOT_INCLUDED.txt"
PAPERLESS_URL = "https://paperless.test"
PAPRA_URL = "https://papra.test"


class FakeRemoteClient:
    """Stands in for PaperlessClient / PapraClient."""

    def __init__(self, remote):
        self._remote = remote

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def download_document(self, document_id):
        if document_id in self._remote.failing:
            raise RuntimeError("remote is down")
        return self._remote.documents[document_id]


class FakeRemote:
    """Records the clients the export builds and serves canned documents."""

    def __init__(self):
        self.calls = []
        self.documents = {}
        self.failing = set()

    def factory(self, backend):
        def create(**kwargs):
            self.calls.append((backend, kwargs))
            return FakeRemoteClient(self)

        return create


@pytest.fixture(autouse=True)
def source_locales(monkeypatch):
    """Read the translations from frontend/public/locales, not a stale local build."""
    monkeypatch.setattr(
        report_translations, "_LOCALES_DIR", Path("frontend/public/locales").resolve()
    )
    monkeypatch.setattr(report_translations, "_cache", {})


@pytest.fixture
def remote(monkeypatch):
    fake = FakeRemote()
    monkeypatch.setattr(
        export_module, "create_paperless_client", fake.factory("paperless")
    )
    monkeypatch.setattr(export_module, "create_papra_client", fake.factory("papra"))
    return fake


@pytest.fixture
def storage(tmp_path, monkeypatch):
    uploads = tmp_path / "uploads"
    trash = uploads / "trash"
    trash.mkdir(parents=True)
    monkeypatch.setattr(settings, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(settings, "TRASH_DIR", trash)
    monkeypatch.chdir(tmp_path)
    return uploads


@pytest.fixture
def lab_result(db_session, user_with_patient):
    return lab_result_crud.create(
        db_session,
        obj_in=LabResultCreate(
            test_name="Panel",
            completed_date=date.today(),
            status="completed",
            patient_id=user_with_patient["patient"].id,
        ),
    )


def _entry(lab_result, file_name):
    """How the left-out list names a file of the Panel lab result fixture."""
    return f"{file_name} (Lab Results: Panel, {lab_result.completed_date:%m/%d/%Y})"


def _path(lab_result, file_name):
    """ZIP path of a file attached to the Panel lab result fixture."""
    return f"attachments/lab_results/{lab_result.completed_date.isoformat()}_Panel/{file_name}"


def _set_prefs(db_session, user, **fields):
    prefs = user_preferences_crud.get_or_create_by_user_id(db_session, user_id=user.id)
    for name, value in fields.items():
        setattr(prefs, name, value)
    db_session.commit()
    return prefs


def _paperless_prefs(db_session, user_with_patient, **overrides):
    fields = {
        "paperless_enabled": True,
        "paperless_url": PAPERLESS_URL,
        "paperless_api_token_encrypted": "enc-token",
    }
    fields.update(overrides)
    return _set_prefs(db_session, user_with_patient["user"], **fields)


def _papra_prefs(db_session, user_with_patient, **overrides):
    fields = {
        "papra_enabled": True,
        "papra_url": PAPRA_URL,
        "papra_api_token_encrypted": "enc-papra-token",
        "papra_organization_id": "org-default",
    }
    fields.update(overrides)
    return _set_prefs(db_session, user_with_patient["user"], **fields)


def _add_file(db_session, lab_result, file_name="scan.pdf", **fields):
    record = {
        "entity_type": "lab-result",
        "entity_id": lab_result.id,
        "file_name": file_name,
        "file_path": "paperless://",
        "file_type": "application/pdf",
        "file_size": 10,
        "uploaded_at": datetime.now(),
        "storage_backend": "local",
    }
    record.update(fields)
    entity_file = EntityFile(**record)
    db_session.add(entity_file)
    db_session.commit()
    return entity_file


def _add_paperless_file(db_session, lab_result, document_id="11", **fields):
    return _add_file(
        db_session,
        lab_result,
        storage_backend="paperless",
        file_path="paperless://",
        paperless_document_id=document_id,
        **fields,
    )


def _add_papra_file(
    db_session, lab_result, document_id="p-1", org_id="org-file", **fields
):
    return _add_file(
        db_session,
        lab_result,
        file_name=fields.pop("file_name", "papra.pdf"),
        storage_backend="papra",
        file_path="papra://",
        papra_document_id=document_id,
        papra_organization_id=org_id,
        **fields,
    )


def _export_zip(client: TestClient, headers):
    response = client.get(
        EXPORT_URL,
        params={"format": "pdf", "scope": "lab_results", "include_files": "true"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(response.content))


def _manifest(zip_file):
    return (
        zip_file.read(MANIFEST).decode("utf-8")
        if MANIFEST in zip_file.namelist()
        else None
    )


class TestPaperlessFiles:
    def test_file_is_fetched_with_saved_token(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient)
        _add_paperless_file(db_session, lab_result, document_id="11")
        remote.documents["11"] = b"paperless-bytes"

        zip_file = _export_zip(client, authenticated_headers)

        assert zip_file.read(_path(lab_result, "scan.pdf")) == b"paperless-bytes"
        assert _manifest(zip_file) is None
        assert remote.calls == [
            (
                "paperless",
                {
                    "url": PAPERLESS_URL,
                    "encrypted_token": "enc-token",
                    "encrypted_username": None,
                    "encrypted_password": None,
                    "user_id": user_with_patient["user"].id,
                },
            )
        ]

    def test_chosen_basic_auth_sends_username_and_password_only(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(
            db_session,
            user_with_patient,
            paperless_auth_method="basic_auth",
            paperless_username_encrypted="enc-user",
            paperless_password_encrypted="enc-pass",
        )
        _add_paperless_file(db_session, lab_result)
        remote.documents["11"] = b"x"

        zip_file = _export_zip(client, authenticated_headers)

        assert _path(lab_result, "scan.pdf") in zip_file.namelist()
        ((_, kwargs),) = remote.calls
        assert kwargs["encrypted_username"] == "enc-user"
        assert kwargs["encrypted_password"] == "enc-pass"
        assert "encrypted_token" not in kwargs

    def test_username_password_without_a_token_works(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(
            db_session,
            user_with_patient,
            paperless_api_token_encrypted=None,
            paperless_username_encrypted="enc-user",
            paperless_password_encrypted="enc-pass",
        )
        _add_paperless_file(db_session, lab_result)
        remote.documents["11"] = b"x"

        zip_file = _export_zip(client, authenticated_headers)

        assert _path(lab_result, "scan.pdf") in zip_file.namelist()
        assert _manifest(zip_file) is None

    def test_disabled_integration_is_listed_and_no_client_is_built(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient, paperless_enabled=False)
        _add_paperless_file(db_session, lab_result)

        zip_file = _export_zip(client, authenticated_headers)

        assert _path(lab_result, "scan.pdf") not in zip_file.namelist()
        manifest = _manifest(zip_file)
        assert _entry(lab_result, "scan.pdf") in manifest
        assert "Paperless-ngx integration is not enabled" in manifest
        assert remote.calls == []

    def test_no_preferences_row_is_listed(
        self, client, authenticated_headers, lab_result, db_session, remote
    ):
        _add_paperless_file(db_session, lab_result)

        zip_file = _export_zip(client, authenticated_headers)

        assert _entry(lab_result, "scan.pdf") in _manifest(zip_file)
        assert remote.calls == []

    def test_missing_credentials_is_listed(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(
            db_session, user_with_patient, paperless_api_token_encrypted=None
        )
        _add_paperless_file(db_session, lab_result)

        zip_file = _export_zip(client, authenticated_headers)

        assert "not fully set up" in _manifest(zip_file)
        assert remote.calls == []

    def test_download_failure_is_listed_and_export_still_succeeds(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient)
        _add_paperless_file(
            db_session, lab_result, document_id="bad", file_name="bad.pdf"
        )
        _add_paperless_file(
            db_session, lab_result, document_id="good", file_name="good.pdf"
        )
        remote.failing.add("bad")
        remote.documents["good"] = b"good-bytes"

        zip_file = _export_zip(client, authenticated_headers)

        assert zip_file.read(_path(lab_result, "good.pdf")) == b"good-bytes"
        assert _path(lab_result, "bad.pdf") not in zip_file.namelist()
        manifest = _manifest(zip_file)
        assert (
            f"{_entry(lab_result, 'bad.pdf')}: could not be downloaded from Paperless-ngx"
            in manifest
        )
        assert "good.pdf" not in manifest

    def test_record_without_document_id_is_listed(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient)
        _add_paperless_file(db_session, lab_result, document_id=None)

        zip_file = _export_zip(client, authenticated_headers)

        assert f"{_entry(lab_result, 'scan.pdf')}: file not found" in _manifest(
            zip_file
        )
        assert remote.calls == []


class TestPapraFiles:
    def test_file_is_fetched_with_its_own_organization(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _papra_prefs(db_session, user_with_patient)
        _add_papra_file(db_session, lab_result, document_id="p-1", org_id="org-file")
        remote.documents["p-1"] = b"papra-bytes"

        zip_file = _export_zip(client, authenticated_headers)

        assert zip_file.read(_path(lab_result, "papra.pdf")) == b"papra-bytes"
        assert remote.calls == [
            (
                "papra",
                {
                    "url": PAPRA_URL,
                    "encrypted_token": "enc-papra-token",
                    "organization_id": "org-file",
                    "user_id": user_with_patient["user"].id,
                },
            )
        ]

    def test_file_without_organization_uses_the_saved_default(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _papra_prefs(db_session, user_with_patient)
        _add_papra_file(db_session, lab_result, org_id=None)
        remote.documents["p-1"] = b"x"

        zip_file = _export_zip(client, authenticated_headers)

        assert _path(lab_result, "papra.pdf") in zip_file.namelist()
        ((_, kwargs),) = remote.calls
        assert kwargs["organization_id"] == "org-default"

    def test_no_organization_anywhere_is_listed(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _papra_prefs(db_session, user_with_patient, papra_organization_id=None)
        _add_papra_file(db_session, lab_result, org_id=None)

        zip_file = _export_zip(client, authenticated_headers)

        assert "Papra integration is not enabled or not fully set up" in _manifest(
            zip_file
        )
        assert remote.calls == []

    def test_disabled_integration_is_listed(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _papra_prefs(db_session, user_with_patient, papra_enabled=False)
        _add_papra_file(db_session, lab_result)

        zip_file = _export_zip(client, authenticated_headers)

        assert _entry(lab_result, "papra.pdf") in _manifest(zip_file)
        assert remote.calls == []

    def test_download_failure_is_listed(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _papra_prefs(db_session, user_with_patient)
        _add_papra_file(db_session, lab_result, document_id="p-1")
        remote.failing.add("p-1")

        zip_file = _export_zip(client, authenticated_headers)

        assert "could not be downloaded from Papra" in _manifest(zip_file)


class TestLocalFiles:
    def test_local_entity_file_is_included(
        self, client, db_session, authenticated_headers, lab_result, storage, remote
    ):
        stored = storage / "files" / "lab-results" / "local.pdf"
        stored.parent.mkdir(parents=True)
        stored.write_bytes(b"local-bytes")
        _add_file(db_session, lab_result, file_name="local.pdf", file_path=str(stored))

        zip_file = _export_zip(client, authenticated_headers)

        assert zip_file.read(_path(lab_result, "local.pdf")) == b"local-bytes"
        assert _manifest(zip_file) is None

    def test_missing_local_file_is_listed(
        self, client, db_session, authenticated_headers, lab_result, storage, remote
    ):
        gone = storage / "files" / "lab-results" / "gone.pdf"
        _add_file(db_session, lab_result, file_name="gone.pdf", file_path=str(gone))

        zip_file = _export_zip(client, authenticated_headers)

        assert f"{_entry(lab_result, 'gone.pdf')}: file not found" in _manifest(
            zip_file
        )
        assert str(gone) not in _manifest(zip_file)

    def test_legacy_lab_result_file_is_still_included(
        self, client, db_session, authenticated_headers, lab_result, storage, remote
    ):
        stored = storage / "files" / "lab-results" / "legacy.pdf"
        stored.parent.mkdir(parents=True)
        stored.write_bytes(b"legacy-bytes")
        db_session.add(
            LabResultFile(
                lab_result_id=lab_result.id,
                file_name="legacy.pdf",
                file_path=str(stored),
                file_type="application/pdf",
                file_size=12,
                uploaded_at=datetime.now(),
            )
        )
        db_session.commit()

        zip_file = _export_zip(client, authenticated_headers)

        assert zip_file.read(_path(lab_result, "legacy.pdf")) == b"legacy-bytes"

    def test_mixed_files_list_only_the_ones_left_out(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        storage,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient)
        stored = storage / "files" / "lab-results" / "ok.pdf"
        stored.parent.mkdir(parents=True)
        stored.write_bytes(b"ok")
        _add_file(db_session, lab_result, file_name="ok.pdf", file_path=str(stored))
        _add_paperless_file(
            db_session, lab_result, document_id="bad", file_name="bad.pdf"
        )
        remote.failing.add("bad")

        zip_file = _export_zip(client, authenticated_headers)

        assert _path(lab_result, "ok.pdf") in zip_file.namelist()
        manifest = _manifest(zip_file)
        assert "bad.pdf" in manifest
        assert "ok.pdf" not in manifest


class TestManifest:
    def test_manifest_uses_the_user_language(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _set_prefs(db_session, user_with_patient["user"], language="de")
        _add_paperless_file(db_session, lab_result)

        zip_file = _export_zip(client, authenticated_headers)

        assert _manifest(zip_file).startswith(
            "Diese Dateien konnten nicht in den Export aufgenommen werden:"
        )

    def test_names_with_line_breaks_stay_on_one_line(
        self, client, db_session, authenticated_headers, lab_result, remote
    ):
        _add_paperless_file(db_session, lab_result, file_name="a\nb.pdf")

        zip_file = _export_zip(client, authenticated_headers)

        entries = [l for l in _manifest(zip_file).splitlines() if l.startswith("- ")]
        assert len(entries) == 1
        assert entries[0].startswith("- a b.pdf (Lab Results: Panel, ")

    def test_no_files_means_no_zip(self, client, authenticated_headers, lab_result):
        response = client.get(
            EXPORT_URL,
            params={"format": "pdf", "scope": "lab_results", "include_files": "true"},
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"


class TestAttachedFilesSection:
    def test_pdf_data_lists_entity_files(
        self, db_session, user_with_patient, lab_result, remote
    ):
        from app.services.export_service import ExportService

        _add_paperless_file(db_session, lab_result, file_name="scan.pdf")

        attachments = ExportService(db_session).get_attachments(
            user_with_patient["user"].id, ["lab_results"], None, None
        )

        data = ExportService(db_session)._export_lab_results(
            user_with_patient["patient"], None, None
        )
        ExportService(db_session)._add_attachment_listings(
            {"lab_results": data}, attachments
        )

        assert data[0]["attached_files"] == [
            {
                "zip_path": _path(lab_result, "scan.pdf"),
                "file_name": "scan.pdf",
                "file_type": "application/pdf",
                "file_size": 10,
            }
        ]


def _make_lab_result(
    db_session, user_with_patient, completed_date, test_name="Panel", **fields
):
    return lab_result_crud.create(
        db_session,
        obj_in=LabResultCreate(
            test_name=test_name,
            completed_date=completed_date,
            status="completed",
            patient_id=user_with_patient["patient"].id,
            **fields,
        ),
    )


def _index_rows(zip_file):
    text = zip_file.read("attachments/INDEX.csv").decode("utf-8-sig")
    return list(csv.reader(io.StringIO(text)))


class TestZipLayout:
    def test_same_test_and_file_name_on_different_dates_do_not_overwrite(
        self, client, db_session, user_with_patient, authenticated_headers, remote
    ):
        _paperless_prefs(db_session, user_with_patient)
        january = _make_lab_result(
            db_session, user_with_patient, date(2026, 1, 5), "CBC"
        )
        march = _make_lab_result(db_session, user_with_patient, date(2026, 3, 1), "CBC")
        _add_paperless_file(
            db_session, january, document_id="1", file_name="report.pdf"
        )
        _add_paperless_file(db_session, march, document_id="2", file_name="report.pdf")
        remote.documents.update({"1": b"january", "2": b"march"})

        zip_file = _export_zip(client, authenticated_headers)

        assert (
            zip_file.read("attachments/lab_results/2026-01-05_CBC/report.pdf")
            == b"january"
        )
        assert (
            zip_file.read("attachments/lab_results/2026-03-01_CBC/report.pdf")
            == b"march"
        )
        assert len(zip_file.namelist()) == len(set(zip_file.namelist()))

    def test_same_day_same_test_gets_separate_folders(
        self, client, db_session, user_with_patient, authenticated_headers, remote
    ):
        _paperless_prefs(db_session, user_with_patient)
        first = _make_lab_result(db_session, user_with_patient, date(2026, 1, 5), "CBC")
        second = _make_lab_result(
            db_session, user_with_patient, date(2026, 1, 5), "CBC"
        )
        _add_paperless_file(db_session, first, document_id="1", file_name="r.pdf")
        _add_paperless_file(db_session, second, document_id="2", file_name="r.pdf")
        remote.documents.update({"1": b"first", "2": b"second"})

        zip_file = _export_zip(client, authenticated_headers)

        assert zip_file.read("attachments/lab_results/2026-01-05_CBC/r.pdf") == b"first"
        assert (
            zip_file.read("attachments/lab_results/2026-01-05_CBC_2/r.pdf") == b"second"
        )

    def test_same_file_name_twice_in_one_result_keeps_both(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient)
        _add_paperless_file(
            db_session, lab_result, document_id="1", file_name="scan.pdf"
        )
        _add_paperless_file(
            db_session, lab_result, document_id="2", file_name="scan.pdf"
        )
        remote.documents.update({"1": b"one", "2": b"two"})

        zip_file = _export_zip(client, authenticated_headers)

        assert zip_file.read(_path(lab_result, "scan.pdf")) == b"one"
        assert zip_file.read(_path(lab_result, "scan_2.pdf")) == b"two"

    def test_files_of_one_result_share_a_folder(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        storage,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient)
        stored = storage / "files" / "lab-results" / "local.pdf"
        stored.parent.mkdir(parents=True)
        stored.write_bytes(b"local")
        _add_file(db_session, lab_result, file_name="local.pdf", file_path=str(stored))
        _add_paperless_file(
            db_session, lab_result, document_id="1", file_name="remote.pdf"
        )
        remote.documents["1"] = b"remote"

        zip_file = _export_zip(client, authenticated_headers)

        assert zip_file.read(_path(lab_result, "local.pdf")) == b"local"
        assert zip_file.read(_path(lab_result, "remote.pdf")) == b"remote"

    def test_folder_falls_back_to_ordered_date_then_undated(
        self, client, db_session, user_with_patient, authenticated_headers, remote
    ):
        _paperless_prefs(db_session, user_with_patient)
        ordered = _make_lab_result(
            db_session,
            user_with_patient,
            None,
            "Ordered",
            ordered_date=date(2026, 2, 3),
        )
        undated = _make_lab_result(db_session, user_with_patient, None, "Undated")
        _add_paperless_file(db_session, ordered, document_id="1", file_name="a.pdf")
        _add_paperless_file(db_session, undated, document_id="2", file_name="b.pdf")
        remote.documents.update({"1": b"a", "2": b"b"})

        zip_file = _export_zip(client, authenticated_headers)

        assert "attachments/lab_results/2026-02-03_Ordered/a.pdf" in zip_file.namelist()
        assert "attachments/lab_results/undated_Undated/b.pdf" in zip_file.namelist()
        rows = {row[1]: row for row in _index_rows(zip_file)[1:]}
        assert rows["a.pdf"][2:] == ["Lab Results", "Ordered", "02/03/2026"]
        assert rows["b.pdf"][2:] == ["Lab Results", "Undated", ""]

    @pytest.mark.parametrize(
        "file_name", ["../../evil.pdf", "..", "..\\..\\evil.pdf", "/etc/passwd"]
    )
    def test_hostile_file_names_stay_inside_their_record_folder(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
        file_name,
    ):
        _paperless_prefs(db_session, user_with_patient)
        _add_paperless_file(
            db_session, lab_result, document_id="1", file_name=file_name
        )
        remote.documents["1"] = b"x"

        names = _export_zip(client, authenticated_headers).namelist()

        lab_entries = [
            n
            for n in names
            if n.startswith("attachments/lab_results/") and n != "attachments/INDEX.csv"
        ]
        assert len(lab_entries) == 1
        assert all(
            part not in ("", ".", "..") and not part.startswith(".")
            for part in lab_entries[0].split("/")
        )
        assert lab_entries[0].count("/") == 3
        assert not any(n.startswith(("/", "..")) or "/../" in n for n in names)


class TestLabFilesIndex:
    def test_index_maps_each_path_to_its_lab_result(
        self, client, db_session, user_with_patient, authenticated_headers, remote
    ):
        _paperless_prefs(db_session, user_with_patient)
        january = _make_lab_result(
            db_session, user_with_patient, date(2026, 1, 5), "CBC"
        )
        march = _make_lab_result(db_session, user_with_patient, date(2026, 3, 1), "CBC")
        _add_paperless_file(
            db_session, january, document_id="1", file_name="report.pdf"
        )
        _add_paperless_file(db_session, march, document_id="2", file_name="report.pdf")
        remote.documents.update({"1": b"a", "2": b"b"})

        rows = _index_rows(_export_zip(client, authenticated_headers))

        assert rows[0] == ["Path in ZIP", "File name", "Category", "Name", "Date"]
        assert sorted(rows[1:]) == [
            [
                "attachments/lab_results/2026-01-05_CBC/report.pdf",
                "report.pdf",
                "Lab Results",
                "CBC",
                "01/05/2026",
            ],
            [
                "attachments/lab_results/2026-03-01_CBC/report.pdf",
                "report.pdf",
                "Lab Results",
                "CBC",
                "03/01/2026",
            ],
        ]

    def test_index_keeps_the_original_file_name_when_the_path_differs(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient)
        _add_paperless_file(
            db_session, lab_result, document_id="1", file_name="my scan #1.pdf"
        )
        remote.documents["1"] = b"x"

        rows = _index_rows(_export_zip(client, authenticated_headers))

        assert rows[1][:2] == [_path(lab_result, "my_scan_1.pdf"), "my scan #1.pdf"]

    def test_index_lists_only_files_that_made_it_into_the_zip(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient)
        _add_paperless_file(
            db_session, lab_result, document_id="ok", file_name="ok.pdf"
        )
        _add_paperless_file(
            db_session, lab_result, document_id="bad", file_name="bad.pdf"
        )
        remote.documents["ok"] = b"x"
        remote.failing.add("bad")

        rows = _index_rows(_export_zip(client, authenticated_headers))

        assert [r[1] for r in rows[1:]] == ["ok.pdf"]

    def test_no_index_when_no_file_was_included(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        lab_result,
        remote,
    ):
        _paperless_prefs(db_session, user_with_patient, paperless_enabled=False)
        _add_paperless_file(db_session, lab_result)

        zip_file = _export_zip(client, authenticated_headers)

        assert "attachments/INDEX.csv" not in zip_file.namelist()
        assert MANIFEST in zip_file.namelist()

    def test_formula_like_names_are_neutralized(
        self, client, db_session, user_with_patient, authenticated_headers, remote
    ):
        _paperless_prefs(db_session, user_with_patient)
        result = _make_lab_result(
            db_session, user_with_patient, date(2026, 1, 5), "=SUM(A1)"
        )
        _add_paperless_file(db_session, result, document_id="1", file_name="=cmd.pdf")
        remote.documents["1"] = b"x"

        rows = _index_rows(_export_zip(client, authenticated_headers))

        assert rows[1][1] == "'=cmd.pdf"
        assert rows[1][3] == "'=SUM(A1)"
        assert not rows[1][0].startswith(("=", "+", "-", "@"))

    def test_index_uses_the_user_language_and_date_format(
        self, client, db_session, user_with_patient, authenticated_headers, remote
    ):
        _set_prefs(
            db_session, user_with_patient["user"], language="de", date_format="dmy"
        )
        _paperless_prefs(db_session, user_with_patient)
        result = _make_lab_result(
            db_session, user_with_patient, date(2026, 1, 5), "CBC"
        )
        _add_paperless_file(db_session, result, document_id="1", file_name="r.pdf")
        remote.documents["1"] = b"x"

        rows = _index_rows(_export_zip(client, authenticated_headers))

        assert rows[0][:2] == ["Pfad im ZIP", "Dateiname"]
        assert rows[1][4] == "05/01/2026"


class TestLeftOutListTellsSameNamedFilesApart:
    def test_entries_carry_the_lab_result_date(
        self, client, db_session, user_with_patient, authenticated_headers, remote
    ):
        _paperless_prefs(db_session, user_with_patient, paperless_enabled=False)
        january = _make_lab_result(
            db_session, user_with_patient, date(2026, 1, 5), "CBC"
        )
        march = _make_lab_result(db_session, user_with_patient, date(2026, 3, 1), "CBC")
        ordered = _make_lab_result(
            db_session, user_with_patient, None, "CBC", ordered_date=date(2026, 2, 3)
        )
        for result in (january, march, ordered):
            _add_paperless_file(db_session, result, file_name="report.pdf")

        manifest = _manifest(_export_zip(client, authenticated_headers))

        assert "- report.pdf (Lab Results: CBC, 01/05/2026): " in manifest
        assert "- report.pdf (Lab Results: CBC, 03/01/2026): " in manifest
        assert "- report.pdf (Lab Results: CBC, 02/03/2026): " in manifest
