"""Who uploaded a file decides whose Paperless resolves it.

Only the uploader's Paperless holds an upload, so only the uploader may resolve it;
files from before the uploader was recorded keep the edit-access rule.
"""

import io
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import app.api.v1.endpoints.entity_file as entity_file_module
from app.api.v1.endpoints.paperless import _update_entity_file_from_task_result
from app.models.models import EntityFile, Medication
from app.services.generic_entity_file_service import GenericEntityFileService
from tests.utils.paperless_uploads import (
    RecordingPaperless,
    patient_for,
    poll,
    processing_upload,
    share,
    task_response,
    use_paperless,
)
from tests.utils.user import create_random_user, create_user_token_headers


def _medication(db_session, patient_id):
    medication = Medication(patient_id=patient_id, medication_name="Med")
    db_session.add(medication)
    db_session.commit()
    return medication


def _tasks_succeed(task_uuid="t-ed"):
    return RecordingPaperless({"/api/tasks/": task_response(task_uuid, 7)})


def _paperless_user(db_session):
    user = create_random_user(db_session)["user"]
    use_paperless(db_session, user.id)
    return user


@pytest.fixture
def owner(db_session):
    return _paperless_user(db_session)


@pytest.fixture
def editor(db_session):
    return _paperless_user(db_session)


@pytest.fixture
def shared_patient(db_session, owner, editor):
    patient = patient_for(db_session, owner.id)
    share(db_session, patient, owner.id, editor.id)
    return patient


@pytest.mark.asyncio
class TestProcessingPoll:
    async def test_owner_does_not_resolve_an_editors_upload(
        self, db_session, owner, shared_patient, editor
    ):
        upload = processing_upload(db_session, shared_patient.id, "t-ed", editor.id)
        paperless = _tasks_succeed()

        assert await poll(db_session, owner.id, paperless) == {}
        assert paperless.requests == []
        db_session.refresh(upload)
        assert upload.sync_status == "processing"

    async def test_editor_does_not_resolve_the_owners_upload(
        self, db_session, owner, shared_patient, editor
    ):
        processing_upload(db_session, shared_patient.id, "t-own", owner.id)
        paperless = _tasks_succeed()

        assert await poll(db_session, editor.id, paperless) == {}
        assert paperless.requests == []

    async def test_editor_resolves_their_own_upload(
        self, db_session, shared_patient, editor
    ):
        upload = processing_upload(db_session, shared_patient.id, "t-ed", editor.id)

        result = await poll(db_session, editor.id, _tasks_succeed())

        assert result == {str(upload.id): "synced"}

    async def test_upload_with_no_recorded_uploader_keeps_the_edit_rule(
        self, db_session, owner, shared_patient, editor
    ):
        upload = processing_upload(db_session, shared_patient.id, "t-old", None)

        assert await poll(db_session, editor.id, _tasks_succeed("t-old")) == {
            str(upload.id): "synced"
        }

    async def test_users_of_one_paperless_instance_resolve_each_others_uploads(
        self, db_session, owner, shared_patient, editor
    ):
        use_paperless(db_session, owner.id, "https://paperless.home/")
        use_paperless(db_session, editor.id, "https://paperless.home")
        upload = processing_upload(db_session, shared_patient.id, "t-ed", editor.id)

        result = await poll(db_session, owner.id, _tasks_succeed())

        assert result == {str(upload.id): "synced"}

    async def test_uploader_who_lost_edit_access_no_longer_resolves(
        self, db_session, owner, editor
    ):
        patient = patient_for(db_session, owner.id)
        patient_share = share(db_session, patient, owner.id, editor.id)
        upload = processing_upload(db_session, patient.id, "t-ed", editor.id)
        patient_share.permission_level = "view"
        db_session.commit()
        paperless = _tasks_succeed()

        assert await poll(db_session, editor.id, paperless) == {}
        assert paperless.requests == []
        db_session.refresh(upload)
        assert upload.sync_status == "processing"


async def _sync_check(db_session, user_id, paperless):
    with (
        patch(
            "app.services.generic_entity_file_service.has_usable_credentials",
            return_value=True,
        ),
        patch(
            "app.services.generic_entity_file_service.credential_kwargs",
            return_value={},
        ),
        patch(
            "app.services.paperless_service.create_paperless_service",
            return_value=paperless,
        ),
    ):
        return await GenericEntityFileService().check_paperless_sync_status(
            db_session, user_id
        )


def _synced_upload(db_session, patient_id, uploaded_by_user_id):
    upload = processing_upload(db_session, patient_id, None, uploaded_by_user_id)
    upload.sync_status = "synced"
    upload.paperless_document_id = "7"
    db_session.commit()
    return upload


@pytest.mark.asyncio
class TestSyncCheck:
    async def test_another_instances_upload_is_not_resolved_by_the_owner(
        self, db_session, owner, shared_patient, editor
    ):
        upload = processing_upload(db_session, shared_patient.id, "t-ed", editor.id)
        paperless = _tasks_succeed()

        assert await _sync_check(db_session, owner.id, paperless) == {}

        assert paperless.requests == []
        db_session.refresh(upload)
        assert upload.sync_status == "processing"
        assert upload.paperless_task_uuid == "t-ed"

    async def test_another_instances_document_is_not_marked_missing(
        self, db_session, owner, shared_patient, editor
    ):
        upload = _synced_upload(db_session, shared_patient.id, editor.id)
        paperless = _tasks_succeed()
        paperless.check_document_exists = AsyncMock(return_value=False)

        assert await _sync_check(db_session, owner.id, paperless) == {}

        paperless.check_document_exists.assert_not_awaited()
        db_session.refresh(upload)
        assert upload.sync_status == "synced"

    async def test_document_with_no_recorded_uploader_is_still_checked(
        self, db_session, owner, shared_patient
    ):
        upload = _synced_upload(db_session, shared_patient.id, None)
        paperless = _tasks_succeed()
        paperless.check_document_exists = AsyncMock(return_value=False)

        assert await _sync_check(db_session, owner.id, paperless) == {upload.id: False}
        db_session.refresh(upload)
        assert upload.sync_status == "missing"


class TestUploadDialog:
    def test_task_result_for_another_users_upload_is_ignored(
        self, db_session, owner, shared_patient, editor
    ):
        upload = processing_upload(db_session, shared_patient.id, "t-ed", editor.id)

        _update_entity_file_from_task_result(
            db_session, owner, "t-ed", {"status": "SUCCESS", "document_id": 5}
        )

        db_session.refresh(upload)
        assert upload.sync_status == "processing"
        assert upload.paperless_document_id is None

    def test_uploader_applies_their_task_result(
        self, db_session, shared_patient, editor
    ):
        upload = processing_upload(db_session, shared_patient.id, "t-ed", editor.id)

        _update_entity_file_from_task_result(
            db_session, editor, "t-ed", {"status": "SUCCESS", "document_id": 5}
        )

        db_session.refresh(upload)
        assert upload.sync_status == "synced"
        assert upload.paperless_document_id == "5"

    def test_background_task_cannot_be_set_on_another_users_upload(
        self, client: TestClient, db_session, owner, shared_patient, editor
    ):
        upload = processing_upload(db_session, shared_patient.id, None, editor.id)

        response = client.post(
            "/api/v1/paperless/entity-files/set-background-task",
            json={
                "entity_type": "medication",
                "entity_id": upload.entity_id,
                "file_name": upload.file_name,
                "task_uuid": "planted",
            },
            headers=create_user_token_headers(owner.username),
        )

        assert response.status_code == 404
        db_session.refresh(upload)
        assert upload.paperless_task_uuid is None


class TestCreationRecordsTheUploader:
    def test_local_upload(
        self, authenticated_client: TestClient, db_session, test_user, test_patient
    ):
        medication = _medication(db_session, test_patient.id)

        response = authenticated_client.post(
            f"/api/v1/entity-files/medication/{medication.id}/files",
            files={"file": ("note.txt", io.BytesIO(b"note"), "text/plain")},
            data={"storage_backend": "local"},
        )

        assert response.status_code == 201, response.text
        assert "uploaded_by_user_id" not in response.json()
        record = db_session.get(EntityFile, response.json()["id"])
        assert record.uploaded_by_user_id == test_user.id

    @pytest.mark.parametrize(
        "provider, factory, payload, document_info",
        [
            (
                "paperless",
                "create_paperless_client",
                {"paperless_document_id": "123"},
                {"title": "scan", "original_file_name": "scan.pdf"},
            ),
            (
                "papra",
                "create_papra_client",
                {"papra_document_id": "doc_1"},
                {"name": "scan.pdf", "organizationId": "org_1"},
            ),
        ],
    )
    def test_linked_document(
        self,
        authenticated_client: TestClient,
        db_session,
        test_user,
        test_patient,
        monkeypatch,
        provider,
        factory,
        payload,
        document_info,
    ):
        medication = _medication(db_session, test_patient.id)
        prefs = SimpleNamespace(
            paperless_enabled=True,
            paperless_url="http://paperless.test",
            paperless_api_token_encrypted="token",
            paperless_username_encrypted=None,
            paperless_password_encrypted=None,
            papra_enabled=True,
            papra_url="http://papra.test",
            papra_api_token_encrypted="token",
            papra_organization_id="org_1",
        )
        monkeypatch.setattr(
            entity_file_module.user_preferences,
            "get_by_user_id",
            lambda db, user_id: prefs,
        )

        class _Client:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def get_document_info(self, *args, **kwargs):
                return document_info

        monkeypatch.setattr(entity_file_module, factory, lambda **kwargs: _Client())

        response = authenticated_client.post(
            f"/api/v1/entity-files/medication/{medication.id}/link-{provider}",
            json=payload,
        )

        assert response.status_code in (200, 201), response.text
        record = (
            db_session.query(EntityFile)
            .filter(EntityFile.entity_id == medication.id)
            .one()
        )
        assert record.uploaded_by_user_id == test_user.id
