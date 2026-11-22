"""A Paperless or Papra file is opened, deleted and checked only through a connection that holds it.

A file uploaded by another member who uses a different instance (or, for Papra, a
different organisation) is "stored elsewhere": it cannot be viewed or downloaded,
deleting it removes it from MediKeep only, and the sync check leaves it alone.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.http.integration_errors import IntegrationErrorCode
from app.crud.user_preferences import user_preferences
from app.models.models import EntityFile, Medication, get_utc_now
from app.services.generic_entity_file_service import (
    GenericEntityFileService,
    RemoteStorageAccess,
)
from tests.utils.paperless_uploads import (
    patient_for,
    share,
    use_paperless,
    use_papra,
)
from tests.utils.user import create_random_user, create_user_token_headers

PAPRA_URL = "https://papra.home"
PDF = (b"%PDF-1.4 test", "scan.pdf", "application/pdf")


def _remote_file(db_session, patient_id, backend, uploaded_by_user_id, org="org-1"):
    medication = Medication(patient_id=patient_id, medication_name="Med")
    db_session.add(medication)
    db_session.commit()
    fields = (
        {"paperless_document_id": "42", "file_path": "paperless://"}
        if backend == "paperless"
        else {
            "papra_document_id": "doc-42",
            "papra_organization_id": org,
            "file_path": "papra://",
        }
    )
    record = EntityFile(
        entity_type="medication",
        entity_id=medication.id,
        file_name="scan.pdf",
        file_type="application/pdf",
        file_size=10,
        uploaded_at=get_utc_now(),
        storage_backend=backend,
        sync_status="synced",
        uploaded_by_user_id=uploaded_by_user_id,
        **fields,
    )
    db_session.add(record)
    db_session.commit()
    return record


def _async_client(**methods):
    """A client mock usable with ``async with``, answering ``methods``."""
    client = AsyncMock(**methods)
    client.__aenter__.return_value = client
    return client


def _member(db_session):
    """A user with their own Paperless and Papra."""
    user = create_random_user(db_session)["user"]
    use_paperless(db_session, user.id)
    use_papra(db_session, user.id)
    return user


@pytest.fixture
def owner(db_session):
    return _member(db_session)


@pytest.fixture
def editor(db_session):
    return _member(db_session)


@pytest.fixture
def shared_patient(db_session, owner, editor):
    patient = patient_for(db_session, owner.id)
    share(db_session, patient, owner.id, editor.id)
    return patient


def _headers(user):
    return create_user_token_headers(user.username)


class TestWhereAFileIsStored:
    def test_local_file_is_never_elsewhere(self, db_session, owner, editor):
        access = RemoteStorageAccess.for_user(db_session, owner.id)
        assert not access.stored_elsewhere("local", editor.id)

    @pytest.mark.parametrize("backend", ["paperless", "papra"])
    def test_own_upload_and_unknown_uploader_are_reachable(
        self, db_session, owner, backend
    ):
        access = RemoteStorageAccess.for_user(db_session, owner.id)
        assert not access.stored_elsewhere(backend, owner.id, "org-1")
        assert not access.stored_elsewhere(backend, None, "org-1")

    def test_paperless_upload_from_another_instance_is_elsewhere(
        self, db_session, owner, editor
    ):
        access = RemoteStorageAccess.for_user(db_session, owner.id)
        assert access.stored_elsewhere("paperless", editor.id)

    def test_upload_stays_reachable_after_the_uploader_turns_paperless_off(
        self, db_session, owner, editor
    ):
        use_paperless(db_session, owner.id, "https://paperless.home")
        use_paperless(db_session, editor.id, "https://paperless.home")
        prefs = user_preferences.get_by_user_id(db_session, user_id=editor.id)
        prefs.paperless_enabled = False
        db_session.commit()

        access = RemoteStorageAccess.for_user(db_session, owner.id)
        assert not access.stored_elsewhere("paperless", editor.id)

    def test_paperless_upload_from_the_same_instance_is_reachable(
        self, db_session, owner, editor
    ):
        use_paperless(db_session, owner.id, "https://paperless.home/")
        use_paperless(db_session, editor.id, "https://paperless.home")
        access = RemoteStorageAccess.for_user(db_session, owner.id)
        assert not access.stored_elsewhere("paperless", editor.id)

    def test_scheme_host_case_and_default_port_do_not_split_an_instance(
        self, db_session, owner, editor
    ):
        use_paperless(db_session, owner.id, "HTTPS://Paperless.Home:443/docs")
        use_paperless(db_session, editor.id, "https://paperless.home/docs/")
        access = RemoteStorageAccess.for_user(db_session, owner.id)
        assert not access.stored_elsewhere("paperless", editor.id)

    @pytest.mark.parametrize(
        "editor_url",
        ["https://paperless.home/Docs", "https://paperless.home:8443/docs"],
    )
    def test_path_case_and_other_ports_are_other_instances(
        self, db_session, owner, editor, editor_url
    ):
        use_paperless(db_session, owner.id, "https://paperless.home/docs")
        use_paperless(db_session, editor.id, editor_url)
        access = RemoteStorageAccess.for_user(db_session, owner.id)
        assert access.stored_elsewhere("paperless", editor.id)

    def test_papra_upload_needs_the_same_url_and_organisation(
        self, db_session, owner, editor
    ):
        use_papra(db_session, owner.id, PAPRA_URL, org="org-1")
        use_papra(db_session, editor.id, PAPRA_URL + "/", org="org-2")
        access = RemoteStorageAccess.for_user(db_session, owner.id)

        assert not access.stored_elsewhere("papra", editor.id, "org-1")
        assert access.stored_elsewhere("papra", editor.id, "org-2")

    def test_papra_upload_from_another_instance_is_elsewhere(
        self, db_session, owner, editor
    ):
        access = RemoteStorageAccess.for_user(db_session, owner.id)
        assert access.stored_elsewhere("papra", editor.id, "org-1")


class TestViewAndDownload:
    @pytest.mark.parametrize("backend", ["paperless", "papra"])
    @pytest.mark.parametrize("action", ["view", "download"])
    def test_file_stored_elsewhere_is_refused_without_contacting_anyone(
        self,
        client: TestClient,
        db_session,
        owner,
        editor,
        shared_patient,
        backend,
        action,
    ):
        record = _remote_file(db_session, shared_patient.id, backend, editor.id)

        with (
            patch(
                "app.services.paperless_service.create_paperless_service"
            ) as paperless,
            patch("app.services.papra_client.create_papra_client") as papra,
        ):
            response = client.get(
                f"/api/v1/entity-files/files/{record.id}/{action}",
                headers=_headers(owner),
            )

        assert response.status_code == 409
        assert response.headers["X-Error-Code"] == IntegrationErrorCode.STORED_ELSEWHERE
        paperless.assert_not_called()
        papra.assert_not_called()

    @pytest.mark.parametrize("backend", ["paperless", "papra"])
    def test_same_instance_download_works_as_before(
        self, client: TestClient, db_session, owner, editor, shared_patient, backend
    ):
        use_paperless(db_session, owner.id, "https://paperless.home")
        use_paperless(db_session, editor.id, "https://paperless.home")
        use_papra(db_session, owner.id, PAPRA_URL)
        use_papra(db_session, editor.id, PAPRA_URL)
        record = _remote_file(db_session, shared_patient.id, backend, editor.id)
        fetch = AsyncMock(return_value=PDF)

        with patch.object(
            GenericEntityFileService, f"_get_{backend}_download_info", fetch
        ):
            response = client.get(
                f"/api/v1/entity-files/files/{record.id}/download",
                headers=_headers(owner),
            )

        assert response.status_code == 200
        fetch.assert_awaited_once()


class TestDelete:
    def _delete(self, client, user, record):
        return client.delete(
            f"/api/v1/entity-files/files/{record.id}", headers=_headers(user)
        )

    @pytest.mark.parametrize("backend", ["paperless", "papra"])
    def test_file_stored_elsewhere_is_only_unlinked(
        self, client: TestClient, db_session, owner, editor, shared_patient, backend
    ):
        record = _remote_file(db_session, shared_patient.id, backend, editor.id)
        record_id = record.id
        remote_delete = AsyncMock(return_value=True)

        with patch.object(
            GenericEntityFileService, f"_delete_from_{backend}", remote_delete
        ):
            response = self._delete(client, owner, record)

        assert response.status_code == 200, response.text
        assert response.json()["message"] == "Document unlinked successfully"
        remote_delete.assert_not_awaited()
        db_session.expire_all()
        assert db_session.get(EntityFile, record_id) is None

    def _delete_with_remote(self, client, user, record, document):
        """Delete ``record`` while the user's Paperless holds ``document`` under its ID."""
        paperless = _async_client(get_document_info=AsyncMock(return_value=document))
        remote_delete = AsyncMock(return_value=True)
        with (
            patch.object(
                GenericEntityFileService,
                "_create_paperless_client",
                AsyncMock(return_value=paperless),
            ),
            patch.object(
                GenericEntityFileService, "_delete_from_paperless", remote_delete
            ),
        ):
            response = self._delete(client, user, record)
        assert response.status_code == 200, response.text
        return response, remote_delete

    @pytest.mark.parametrize("uploader", ["owner", "none"])
    def test_reachable_file_is_still_deleted_remotely(
        self, client: TestClient, db_session, owner, shared_patient, uploader
    ):
        uploaded_by = owner.id if uploader == "owner" else None
        record = _remote_file(db_session, shared_patient.id, "paperless", uploaded_by)

        _, remote_delete = self._delete_with_remote(
            client, owner, record, {"original_file_name": "scan.pdf"}
        )

        remote_delete.assert_awaited_once()

    @pytest.mark.parametrize("uploader", ["owner", "none"])
    def test_id_naming_another_document_is_only_unlinked(
        self, client: TestClient, db_session, owner, shared_patient, uploader
    ):
        # An unknown uploader, or a changed Paperless URL, can point the ID at another document
        uploaded_by = owner.id if uploader == "owner" else None
        record = _remote_file(db_session, shared_patient.id, "paperless", uploaded_by)

        response, remote_delete = self._delete_with_remote(
            client,
            owner,
            record,
            {"original_file_name": "tax-return.pdf", "title": "tax-return"},
        )

        assert response.json()["message"] == "Document unlinked successfully"
        remote_delete.assert_not_awaited()

    def test_document_that_cannot_be_read_is_deleted_as_before(
        self, client: TestClient, db_session, owner, shared_patient
    ):
        record = _remote_file(db_session, shared_patient.id, "paperless", owner.id)

        _, remote_delete = self._delete_with_remote(client, owner, record, None)

        remote_delete.assert_awaited_once()


class TestFileResponses:
    def test_list_flags_files_stored_elsewhere(
        self, client: TestClient, db_session, owner, editor, shared_patient
    ):
        theirs = _remote_file(db_session, shared_patient.id, "paperless", editor.id)

        response = client.get(
            f"/api/v1/entity-files/medication/{theirs.entity_id}/files",
            headers=_headers(owner),
        )
        as_editor = client.get(
            f"/api/v1/entity-files/medication/{theirs.entity_id}/files",
            headers=_headers(editor),
        )

        assert response.status_code == 200
        assert [f["stored_elsewhere"] for f in response.json()] == [True]
        assert [f["stored_elsewhere"] for f in as_editor.json()] == [False]
        assert "uploaded_by_user_id" not in response.json()[0]

    def test_single_file_and_metadata_update_flag_it_too(
        self, client: TestClient, db_session, owner, editor, shared_patient
    ):
        record = _remote_file(db_session, shared_patient.id, "papra", editor.id)

        single = client.get(
            f"/api/v1/entity-files/files/{record.id}", headers=_headers(owner)
        )
        updated = client.put(
            f"/api/v1/entity-files/files/{record.id}/metadata",
            data={"description": "Renamed"},
            headers=_headers(owner),
        )

        assert single.json()["stored_elsewhere"] is True
        assert updated.status_code == 200, updated.text
        assert updated.json()["stored_elsewhere"] is True


@pytest.mark.asyncio
class TestPapraSyncCheck:
    async def test_file_stored_elsewhere_is_skipped(
        self, db_session, owner, editor, shared_patient
    ):
        theirs = _remote_file(db_session, shared_patient.id, "papra", editor.id)
        mine = _remote_file(db_session, shared_patient.id, "papra", owner.id)
        client = _async_client(get_document_info=AsyncMock(return_value=None))

        with patch(
            "app.services.papra_client.create_papra_client", return_value=client
        ):
            result = await GenericEntityFileService().check_papra_sync_status(
                db_session, owner.id
            )

        assert result == {mine.id: False}
        client.get_document_info.assert_awaited_once_with("doc-42")
        db_session.refresh(theirs)
        assert theirs.sync_status == "synced"

    async def test_each_file_is_read_in_its_own_organisation(
        self, db_session, owner, shared_patient
    ):
        _remote_file(db_session, shared_patient.id, "papra", owner.id, org="org-old")
        _remote_file(db_session, shared_patient.id, "papra", owner.id, org="org-1")
        client = _async_client(
            get_document_info=AsyncMock(return_value={"id": "doc-42"})
        )

        with patch(
            "app.services.papra_client.create_papra_client", return_value=client
        ) as create:
            await GenericEntityFileService().check_papra_sync_status(
                db_session, owner.id
            )

        organizations = {
            call.kwargs["organization_id"] for call in create.call_args_list
        }
        assert organizations == {"org-old", "org-1"}


@pytest.mark.asyncio
class TestPaperlessOrphanCheck:
    async def test_file_stored_elsewhere_is_not_marked_missing(
        self, db_session, owner, editor, shared_patient
    ):
        theirs = _remote_file(db_session, shared_patient.id, "paperless", editor.id)
        mine = _remote_file(db_session, shared_patient.id, "paperless", owner.id)
        for record in (theirs, mine):
            record.paperless_document_id = None
            record.sync_status = "failed"
        db_session.commit()

        await GenericEntityFileService()._handle_orphaned_paperless_records(
            db_session, owner.id
        )

        db_session.refresh(theirs)
        db_session.refresh(mine)
        assert theirs.sync_status == "failed"
        assert mine.sync_status == "missing"
