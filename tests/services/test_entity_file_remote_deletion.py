"""
Deleting remote-backed entity files that never received a remote document ID.

An upload that is still processing (or whose task failed) leaves an EntityFile
with sync_status="processing" and no remote document ID. Deleting it must only
remove the database record: there is nothing in the remote backend to delete.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.core.http.integration_errors import IntegrationErrorCode
from app.models.models import EntityFile, UserPreferences, get_utc_now
from app.services.generic_entity_file_service import GenericEntityFileService

TASK_UUID = "3f1c7a52-9e0b-4d0e-8c1a-0b6f5d2a7e11"


def _make_file(db_session, **overrides) -> EntityFile:
    fields = dict(
        entity_type="lab-result",
        entity_id=1,
        file_name="report.pdf",
        file_path="paperless://",
        file_type="application/pdf",
        file_size=1024,
        uploaded_at=get_utc_now(),
        storage_backend="paperless",
        sync_status="processing",
        paperless_document_id=None,
        paperless_task_uuid=TASK_UUID,
    )
    fields.update(overrides)
    record = EntityFile(**fields)
    db_session.add(record)
    db_session.commit()
    db_session.refresh(record)
    return record


@pytest.fixture
def paperless_enabled_user(db_session, test_user):
    prefs = UserPreferences(
        user_id=test_user.id,
        paperless_enabled=True,
        paperless_url="https://paperless.invalid",
    )
    db_session.add(prefs)
    db_session.commit()
    return test_user


@pytest.fixture
def remote_delete():
    """Stand in for the remote delete so no network call can happen."""
    with patch.object(
        GenericEntityFileService,
        "_delete_from_paperless",
        new=AsyncMock(return_value=True),
    ) as mock:
        yield mock


class TestDeleteFileWithoutRemoteDocumentId:
    @pytest.mark.asyncio
    async def test_processing_file_without_document_id_is_deleted(
        self, db_session, paperless_enabled_user, remote_delete
    ):
        record = _make_file(db_session)
        file_id = record.id

        result = await GenericEntityFileService().delete_file(
            db_session, file_id, paperless_enabled_user.id
        )

        assert result.success is True
        assert db_session.get(EntityFile, file_id) is None
        remote_delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_failed_file_without_document_id_is_deleted(
        self, db_session, paperless_enabled_user, remote_delete
    ):
        record = _make_file(db_session, sync_status="failed", paperless_task_uuid=None)
        file_id = record.id

        result = await GenericEntityFileService().delete_file(
            db_session, file_id, paperless_enabled_user.id
        )

        assert result.success is True
        assert db_session.get(EntityFile, file_id) is None
        remote_delete.assert_not_awaited()


class TestDeleteFileWithRemoteDocumentId:
    @pytest.mark.asyncio
    async def test_synced_file_is_deleted_from_remote(
        self, db_session, paperless_enabled_user, remote_delete
    ):
        record = _make_file(
            db_session,
            sync_status="synced",
            paperless_document_id="42",
            paperless_task_uuid=None,
        )
        file_id = record.id

        await GenericEntityFileService().delete_file(
            db_session, file_id, paperless_enabled_user.id
        )

        remote_delete.assert_awaited_once()
        assert db_session.get(EntityFile, file_id) is None

    @pytest.mark.asyncio
    async def test_remote_delete_failure_keeps_the_record(
        self, db_session, paperless_enabled_user
    ):
        record = _make_file(
            db_session,
            sync_status="synced",
            paperless_document_id="42",
            paperless_task_uuid=None,
        )
        file_id = record.id

        with patch.object(
            GenericEntityFileService,
            "_delete_from_paperless",
            new=AsyncMock(return_value=False),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await GenericEntityFileService().delete_file(
                    db_session, file_id, paperless_enabled_user.id
                )

        assert exc_info.value.status_code == 500
        # Coded, so the frontend shows the message instead of "service unavailable"
        assert exc_info.value.headers["X-Error-Code"] == IntegrationErrorCode.GENERIC
        assert db_session.get(EntityFile, file_id) is not None

    @pytest.mark.asyncio
    async def test_shared_document_is_not_deleted_remotely(
        self, db_session, paperless_enabled_user, remote_delete
    ):
        first = _make_file(
            db_session,
            sync_status="synced",
            paperless_document_id="42",
            paperless_task_uuid=None,
        )
        _make_file(
            db_session,
            entity_id=2,
            sync_status="synced",
            paperless_document_id="42",
            paperless_task_uuid=None,
        )
        first_id = first.id

        await GenericEntityFileService().delete_file(
            db_session, first_id, paperless_enabled_user.id
        )

        remote_delete.assert_not_awaited()
        assert db_session.get(EntityFile, first_id) is None
