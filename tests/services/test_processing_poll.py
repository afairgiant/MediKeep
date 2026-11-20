"""
Paperless processing poll: which uploads it resolves, and when it links a document.

The poll must only resolve uploads on patients the caller can edit, through the
caller's own Paperless. Another user's task IDs and file names must never be sent
anywhere, and only the task that was asked for may decide a record.
"""

from contextlib import asynccontextmanager
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.entity_file import get_entity_by_type_and_id
from app.crud.patient import patient as patient_crud
from app.models.models import (
    EntityFile,
    Medication,
    PatientShare,
    UserPreferences,
    get_utc_now,
)
from app.schemas.entity_file import EntityType
from app.schemas.patient import PatientCreate
from app.services.generic_entity_file_service import (
    FILE_ENTITY_SOURCES,
    GenericEntityFileService,
)
from tests.utils.user import create_random_user

pytestmark = pytest.mark.asyncio

FILE_NAME = "blood-panel-results.pdf"


class _RecordingPaperless:
    """Fake Paperless service that records every request and answers from ``routes``.

    ``routes`` maps an endpoint prefix to ``(status, body)``; unknown endpoints get 404.
    """

    def __init__(self, routes):
        self.routes = routes
        self.requests = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    @asynccontextmanager
    async def _make_request(self, method, endpoint):
        self.requests.append(endpoint)
        status, body = next(
            (
                answer
                for prefix, answer in self.routes.items()
                if endpoint.startswith(prefix)
            ),
            (404, {}),
        )
        yield SimpleNamespace(status=status, json=AsyncMock(return_value=body))


def _task(task_uuid, document_id, status="SUCCESS"):
    return (
        200,
        {
            "results": [
                {
                    "task_id": task_uuid,
                    "status": status,
                    "related_document": document_id,
                }
            ]
        },
    )


def _enable_paperless(db_session, user_id):
    db_session.add(
        UserPreferences(
            user_id=user_id,
            paperless_enabled=True,
            paperless_url="https://paperless.invalid",
        )
    )
    db_session.commit()


def _patient_for(db_session, user_id):
    return patient_crud.create_for_user(
        db_session,
        user_id=user_id,
        patient_data=PatientCreate(
            first_name="Other",
            last_name="User",
            birth_date=date(1990, 1, 1),
            gender="F",
        ),
    )


def _processing_upload(db_session, patient_id, task_uuid):
    medication = Medication(patient_id=patient_id, medication_name="Test med")
    db_session.add(medication)
    db_session.commit()
    record = EntityFile(
        entity_type="medication",
        entity_id=medication.id,
        file_name=FILE_NAME,
        file_path="paperless://",
        file_type="application/pdf",
        file_size=1024,
        uploaded_at=get_utc_now(),
        storage_backend="paperless",
        sync_status="processing",
        paperless_task_uuid=task_uuid,
    )
    db_session.add(record)
    db_session.commit()
    return record


def _share(db_session, patient, owner_id, recipient_id, permission_level):
    db_session.add(
        PatientShare(
            patient_id=patient.id,
            shared_by_user_id=owner_id,
            shared_with_user_id=recipient_id,
            permission_level=permission_level,
            is_active=True,
        )
    )
    db_session.commit()


async def _poll(db_session, user_id, paperless):
    with (
        patch(
            "app.services.generic_entity_file_service.credential_kwargs",
            return_value={},
        ),
        patch(
            "app.services.generic_entity_file_service.create_paperless_service",
            return_value=paperless,
        ),
    ):
        return await GenericEntityFileService().update_processing_files(
            db_session, user_id
        )


@pytest.fixture
def other_user(db_session):
    return create_random_user(db_session)["user"]


@pytest.fixture(autouse=True)
def caller_paperless(db_session, test_user):
    _enable_paperless(db_session, test_user.id)


class TestScope:
    async def test_other_users_upload_is_never_sent_or_changed(
        self, db_session, test_user, test_patient, other_user
    ):
        victim = _processing_upload(
            db_session, _patient_for(db_session, other_user.id).id, "victim-task"
        )
        paperless = _RecordingPaperless({"/api/tasks/": _task("victim-task", 1)})

        result = await _poll(db_session, test_user.id, paperless)

        assert result == {}
        assert not any("victim-task" in r for r in paperless.requests)
        assert not any(FILE_NAME in r for r in paperless.requests)
        db_session.refresh(victim)
        assert victim.sync_status == "processing"
        assert victim.paperless_task_uuid == "victim-task"
        assert victim.paperless_document_id is None

    async def test_own_medication_upload_is_resolved(
        self, db_session, test_user, test_patient
    ):
        own = _processing_upload(db_session, test_patient.id, "own-task")
        paperless = _RecordingPaperless(
            {
                "/api/tasks/": _task("own-task", 12),
            }
        )

        result = await _poll(db_session, test_user.id, paperless)

        assert result == {str(own.id): "synced"}
        db_session.refresh(own)
        assert own.paperless_document_id == "12"
        assert own.paperless_task_uuid is None

    async def test_editor_resolves_their_upload_on_a_shared_patient(
        self, db_session, test_user, other_user
    ):
        shared = _patient_for(db_session, other_user.id)
        _share(db_session, shared, other_user.id, test_user.id, "edit")
        upload = _processing_upload(db_session, shared.id, "editor-task")
        paperless = _RecordingPaperless(
            {
                "/api/tasks/": _task("editor-task", 7),
            }
        )

        result = await _poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "synced"}

    async def test_view_only_share_is_not_polled(
        self, db_session, test_user, other_user
    ):
        shared = _patient_for(db_session, other_user.id)
        _share(db_session, shared, other_user.id, test_user.id, "view")
        upload = _processing_upload(db_session, shared.id, "owner-task")
        paperless = _RecordingPaperless({"/api/tasks/": _task("owner-task", 3)})

        result = await _poll(db_session, test_user.id, paperless)

        assert result == {}
        assert paperless.requests == []
        db_session.refresh(upload)
        assert upload.sync_status == "processing"

    async def test_edit_share_of_a_private_patient_is_not_polled(
        self, db_session, test_user, other_user
    ):
        shared = _patient_for(db_session, other_user.id)
        shared.privacy_level = "private"
        db_session.commit()
        _share(db_session, shared, other_user.id, test_user.id, "edit")
        _processing_upload(db_session, shared.id, "private-task")
        paperless = _RecordingPaperless({"/api/tasks/": _task("private-task", 3)})

        assert await _poll(db_session, test_user.id, paperless) == {}
        assert paperless.requests == []


class TestLinking:
    async def test_task_document_is_linked_without_looking_it_up(
        self, db_session, test_user, test_patient
    ):
        # Paperless answers 404 for documents the account may not view, so a
        # lookup would wrongly reject a real upload.
        upload = _processing_upload(db_session, test_patient.id, "task")
        paperless = _RecordingPaperless(
            {
                "/api/tasks/": _task("task", 42),
                "/api/documents/42/": (404, {}),
            }
        )

        result = await _poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "synced"}
        assert not any(r.startswith("/api/documents/42/") for r in paperless.requests)
        db_session.refresh(upload)
        assert upload.paperless_document_id == "42"

    async def test_invalid_document_id_with_no_match_is_marked_duplicate(
        self, db_session, test_user, test_patient
    ):
        upload = _processing_upload(db_session, test_patient.id, "task")
        paperless = _RecordingPaperless(
            {
                "/api/tasks/": _task("task", "unknown"),
                "/api/documents/?": (200, {"results": []}),
            }
        )

        result = await _poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "duplicate"}
        db_session.refresh(upload)
        assert upload.paperless_document_id is None

    async def test_nothing_is_checked_when_paperless_is_disabled(
        self, db_session, test_user, test_patient
    ):
        prefs = (
            db_session.query(UserPreferences)
            .filter(UserPreferences.user_id == test_user.id)
            .one()
        )
        prefs.paperless_enabled = False
        db_session.commit()
        upload = _processing_upload(db_session, test_patient.id, "task")
        paperless = _RecordingPaperless({"/api/tasks/": _task("task", 1)})

        assert await _poll(db_session, test_user.id, paperless) == {}
        assert paperless.requests == []
        db_session.refresh(upload)
        assert upload.sync_status == "processing"


class TestTaskMatching:
    async def test_task_for_a_different_upload_is_ignored(
        self, db_session, test_user, test_patient
    ):
        upload = _processing_upload(db_session, test_patient.id, "mine")
        paperless = _RecordingPaperless(
            {
                "/api/tasks/": _task("someone-else", 4),
            }
        )

        assert await _poll(db_session, test_user.id, paperless) == {}
        db_session.refresh(upload)
        assert upload.sync_status == "processing"
        assert upload.paperless_document_id is None

    async def test_lone_task_without_a_task_id_is_accepted(
        self, db_session, test_user, test_patient
    ):
        upload = _processing_upload(db_session, test_patient.id, "mine")
        paperless = _RecordingPaperless(
            {
                "/api/tasks/": (200, [{"status": "SUCCESS", "related_document": 8}]),
            }
        )

        assert await _poll(db_session, test_user.id, paperless) == {
            str(upload.id): "synced"
        }


async def test_sources_match_the_entity_types_that_accept_files(db_session):
    covered = {entity_type for entity_type, _ in FILE_ENTITY_SOURCES}
    for entity_type in EntityType:
        try:
            get_entity_by_type_and_id(db_session, entity_type.value, 0)
            accepts_files = True
        except HTTPException:
            accepts_files = False
        assert (entity_type.value in covered) == accepts_files, entity_type.value
