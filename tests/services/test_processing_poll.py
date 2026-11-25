"""
Paperless processing poll: which uploads it resolves, and when it links a document.

The poll must only resolve uploads on patients the caller can edit, through the
caller's own Paperless. Another user's task IDs and file names must never be sent
anywhere, and only the task that was asked for may decide a record.
"""

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.entity_file import get_entity_by_type_and_id
from app.models.models import UserPreferences
from app.schemas.entity_file import EntityType
from app.services.generic_entity_file_service import FILE_ENTITY_SOURCES
from tests.utils.paperless_uploads import (
    FILE_MD5,
    FILE_NAME,
    FILE_SHA256,
    RecordingPaperless,
    patient_for,
    poll,
    processing_upload,
    share,
    task_response,
    use_paperless,
)
from tests.utils.user import create_random_user

pytestmark = pytest.mark.asyncio


@pytest.fixture
def other_user(db_session):
    return create_random_user(db_session)["user"]


@pytest.fixture(autouse=True)
def caller_paperless(db_session, test_user):
    use_paperless(db_session, test_user.id)


class TestScope:
    async def test_other_users_upload_is_never_sent_or_changed(
        self, db_session, test_user, test_patient, other_user
    ):
        victim = processing_upload(
            db_session, patient_for(db_session, other_user.id).id, "victim-task"
        )
        paperless = RecordingPaperless({"/api/tasks/": task_response("victim-task", 1)})

        result = await poll(db_session, test_user.id, paperless)

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
        own = processing_upload(db_session, test_patient.id, "own-task")
        paperless = RecordingPaperless(
            {
                "/api/tasks/": task_response("own-task", 12),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(own.id): "synced"}
        db_session.refresh(own)
        assert own.paperless_document_id == "12"
        assert own.paperless_task_uuid is None

    async def test_editor_resolves_their_upload_on_a_shared_patient(
        self, db_session, test_user, other_user
    ):
        shared = patient_for(db_session, other_user.id)
        share(db_session, shared, other_user.id, test_user.id, "edit")
        upload = processing_upload(db_session, shared.id, "editor-task", test_user.id)
        paperless = RecordingPaperless(
            {
                "/api/tasks/": task_response("editor-task", 7),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "synced"}

    async def test_view_only_share_is_not_polled(
        self, db_session, test_user, other_user
    ):
        shared = patient_for(db_session, other_user.id)
        share(db_session, shared, other_user.id, test_user.id, "view")
        upload = processing_upload(db_session, shared.id, "viewer-task", test_user.id)
        paperless = RecordingPaperless({"/api/tasks/": task_response("viewer-task", 3)})

        result = await poll(db_session, test_user.id, paperless)

        assert result == {}
        assert paperless.requests == []
        db_session.refresh(upload)
        assert upload.sync_status == "processing"

    async def test_edit_share_of_a_private_patient_is_not_polled(
        self, db_session, test_user, other_user
    ):
        shared = patient_for(db_session, other_user.id)
        shared.privacy_level = "private"
        db_session.commit()
        share(db_session, shared, other_user.id, test_user.id, "edit")
        processing_upload(db_session, shared.id, "private-task", test_user.id)
        paperless = RecordingPaperless(
            {"/api/tasks/": task_response("private-task", 3)}
        )

        assert await poll(db_session, test_user.id, paperless) == {}
        assert paperless.requests == []


class TestLinking:
    async def test_task_document_is_linked_without_looking_it_up(
        self, db_session, test_user, test_patient
    ):
        # Paperless answers 404 for documents the account may not view, so a
        # lookup would wrongly reject a real upload.
        upload = processing_upload(db_session, test_patient.id, "task")
        paperless = RecordingPaperless(
            {
                "/api/tasks/": task_response("task", 42),
                "/api/documents/42/": (404, {}),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "synced"}
        assert not any(r.startswith("/api/documents/42/") for r in paperless.requests)
        db_session.refresh(upload)
        assert upload.paperless_document_id == "42"

    async def test_invalid_document_id_with_no_match_is_marked_duplicate(
        self, db_session, test_user, test_patient
    ):
        upload = processing_upload(db_session, test_patient.id, "task")
        paperless = RecordingPaperless(
            {
                "/api/tasks/": task_response("task", "unknown"),
                "/api/documents/?": (200, {"results": []}),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

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
        upload = processing_upload(db_session, test_patient.id, "task")
        paperless = RecordingPaperless({"/api/tasks/": task_response("task", 1)})

        assert await poll(db_session, test_user.id, paperless) == {}
        assert paperless.requests == []
        db_session.refresh(upload)
        assert upload.sync_status == "processing"


class TestTaskMatching:
    async def test_task_for_a_different_upload_is_ignored(
        self, db_session, test_user, test_patient
    ):
        upload = processing_upload(db_session, test_patient.id, "mine")
        paperless = RecordingPaperless(
            {
                "/api/tasks/": task_response("someone-else", 4),
            }
        )

        assert await poll(db_session, test_user.id, paperless) == {}
        db_session.refresh(upload)
        assert upload.sync_status == "processing"
        assert upload.paperless_document_id is None

    async def test_lone_task_without_a_task_id_is_accepted(
        self, db_session, test_user, test_patient
    ):
        upload = processing_upload(db_session, test_patient.id, "mine")
        paperless = RecordingPaperless(
            {
                "/api/tasks/": (200, [{"status": "SUCCESS", "related_document": 8}]),
            }
        )

        assert await poll(db_session, test_user.id, paperless) == {
            str(upload.id): "synced"
        }


class TestTaskPermissionDenied:
    """Regression for #1280: the account can upload but Paperless refuses its task reads."""

    async def test_document_found_by_checksum_is_linked(
        self, db_session, test_user, test_patient
    ):
        upload = processing_upload(db_session, test_patient.id, "task")
        added = datetime.now(timezone.utc).isoformat()
        paperless = RecordingPaperless(
            {
                "/api/tasks/": (403, {}),
                f"/api/documents/?checksum__iexact={FILE_SHA256}": (
                    200,
                    {"results": [{"id": 55, "added": added}]},
                ),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "synced"}
        db_session.refresh(upload)
        assert upload.paperless_document_id == "55"
        assert upload.paperless_task_uuid is None

    async def test_upload_not_found_stays_processing(
        self, db_session, test_user, test_patient
    ):
        upload = processing_upload(db_session, test_patient.id, "task")
        paperless = RecordingPaperless(
            {
                "/api/tasks/": (403, {}),
                "/api/documents/?": (200, {"results": []}),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "processing"}
        db_session.refresh(upload)
        assert upload.sync_status == "processing"
        assert upload.paperless_task_uuid == "task"

    async def test_upload_without_stored_checksums_is_not_looked_up(
        self, db_session, test_user, test_patient
    ):
        upload = processing_upload(db_session, test_patient.id, "task")
        upload.paperless_sha256 = upload.paperless_md5 = None
        db_session.commit()
        paperless = RecordingPaperless({"/api/tasks/": (403, {})})

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "processing"}
        assert not any(r.startswith("/api/documents/") for r in paperless.requests)

    async def test_identical_uploads_each_get_their_own_copy(
        self, db_session, test_user, test_patient
    ):
        # Paperless 3.x consumes a re-upload of the same file as a second document
        first = processing_upload(db_session, test_patient.id, "first")
        second = processing_upload(db_session, test_patient.id, "second")
        added = datetime.now(timezone.utc).isoformat()
        paperless = RecordingPaperless(
            {
                "/api/tasks/": (403, {}),
                "/api/documents/?": (
                    200,
                    {
                        "results": [
                            {"id": 55, "added": added},
                            {"id": 56, "added": added},
                        ]
                    },
                ),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(first.id): "synced", str(second.id): "synced"}
        db_session.refresh(first)
        db_session.refresh(second)
        assert {first.paperless_document_id, second.paperless_document_id} == {
            "55",
            "56",
        }

    async def test_copy_held_elsewhere_on_paperless_3_waits_for_its_own(
        self, db_session, test_user, test_patient
    ):
        # Paperless 3.x consumes re-uploads, so this upload's own copy may still be queued
        first = processing_upload(db_session, test_patient.id, "first")
        first.paperless_task_uuid = None
        first.sync_status = "synced"
        first.paperless_document_id = "55"
        db_session.commit()
        again = processing_upload(db_session, test_patient.id, "again")
        added = datetime.now(timezone.utc).isoformat()
        paperless = RecordingPaperless(
            {
                "/api/tasks/": (403, {}),
                f"/api/documents/?checksum__iexact={FILE_SHA256}": (
                    200,
                    {"results": [{"id": 55, "added": added}]},
                ),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(again.id): "processing"}
        db_session.refresh(again)
        assert again.paperless_document_id is None
        assert again.paperless_task_uuid == "again"

    async def test_re_upload_rejected_by_paperless_2_is_a_duplicate(
        self, db_session, test_user, test_patient
    ):
        # Paperless 2.x (MD5 checksums) rejects a re-upload, so the match is the first upload's document
        first = processing_upload(db_session, test_patient.id, "first")
        first.paperless_task_uuid = None
        first.sync_status = "synced"
        first.paperless_document_id = "55"
        db_session.commit()
        again = processing_upload(db_session, test_patient.id, "again")
        added = datetime.now(timezone.utc).isoformat()
        paperless = RecordingPaperless(
            {
                "/api/tasks/": (403, {}),
                f"/api/documents/?checksum__iexact={FILE_SHA256}": (
                    200,
                    {"results": []},
                ),
                f"/api/documents/?checksum__iexact={FILE_MD5}": (
                    200,
                    {"results": [{"id": 55, "added": added}]},
                ),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(again.id): "duplicate"}
        db_session.refresh(again)
        assert again.paperless_document_id is None
        assert again.paperless_task_uuid is None

    async def test_tasks_are_read_once_per_run_after_a_refusal(
        self, db_session, test_user, test_patient
    ):
        uploads = [
            processing_upload(db_session, test_patient.id, f"task-{n}")
            for n in range(3)
        ]
        paperless = RecordingPaperless(
            {
                "/api/tasks/": (403, {}),
                "/api/documents/?": (200, {"results": []}),
            }
        )

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(u.id): "processing" for u in uploads}
        assert sum(r.startswith("/api/tasks/") for r in paperless.requests) == 1

    async def test_other_task_errors_do_not_look_the_document_up(
        self, db_session, test_user, test_patient
    ):
        upload = processing_upload(db_session, test_patient.id, "task")
        paperless = RecordingPaperless({"/api/tasks/": (500, {})})

        result = await poll(db_session, test_user.id, paperless)

        assert result == {str(upload.id): "processing"}
        assert not any(r.startswith("/api/documents/") for r in paperless.requests)


async def test_sources_match_the_entity_types_that_accept_files(db_session):
    covered = {entity_type for entity_type, _ in FILE_ENTITY_SOURCES}
    for entity_type in EntityType:
        try:
            get_entity_by_type_and_id(db_session, entity_type.value, 0)
            accepts_files = True
        except HTTPException:
            accepts_files = False
        assert (entity_type.value in covered) == accepts_files, entity_type.value
