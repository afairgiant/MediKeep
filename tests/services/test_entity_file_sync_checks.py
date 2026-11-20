"""
Paperless-ngx and Papra sync checks on medical equipment files.

Each check finds the user's remote files through the record they are attached to,
so equipment files are only checked once equipment is one of those record types.
Another user's files must never be checked or changed.
"""

from contextlib import asynccontextmanager
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.crud.patient import patient as patient_crud
from app.models.models import (
    EntityFile,
    MedicalEquipment,
    UserPreferences,
    get_utc_now,
)
from app.schemas.patient import PatientCreate
from app.services.generic_entity_file_service import GenericEntityFileService
from tests.utils.user import create_random_user

pytestmark = pytest.mark.asyncio


class _RemoteWhereEveryDocumentIsGone:
    """Stands in for a Paperless service or a Papra client."""

    def __init__(self):
        self.checked = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    def get_auth_type(self):
        return "token"

    async def check_document_exists(self, document_id):
        self.checked.append(document_id)
        return False

    async def get_document_info(self, document_id):
        self.checked.append(document_id)
        return None


class _FakePaperlessApi:
    """Answers each Paperless API request with HTTP 200 and the body ``respond(endpoint)`` returns."""

    def __init__(self, respond):
        self.respond = respond

    @asynccontextmanager
    async def _make_request(self, method, endpoint):
        yield SimpleNamespace(
            status=200, json=AsyncMock(return_value=self.respond(endpoint))
        )


def _equipment(db_session, patient_id):
    record = MedicalEquipment(
        patient_id=patient_id,
        equipment_name="CPAP",
        equipment_type="cpap",
        status="active",
    )
    db_session.add(record)
    db_session.commit()
    return record


def _remote_file(
    db_session,
    equipment,
    backend,
    document_id,
    sync_status="synced",
    task_uuid=None,
):
    record = EntityFile(
        entity_type="medical-equipment",
        entity_id=equipment.id,
        file_name="manual.pdf",
        file_path=f"{backend}://",
        file_type="application/pdf",
        file_size=1024,
        uploaded_at=get_utc_now(),
        storage_backend=backend,
        sync_status=sync_status,
        paperless_document_id=document_id if backend == "paperless" else None,
        paperless_task_uuid=task_uuid,
        papra_document_id=document_id if backend == "papra" else None,
    )
    db_session.add(record)
    db_session.commit()
    return record


async def _run_paperless_sync_check(db_session, user_id, remote):
    """Run the Paperless sync check against ``remote``; task resolution leaves every task pending."""
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
            return_value=remote,
        ),
        patch.object(
            GenericEntityFileService,
            "_resolve_task_uuids_to_document_ids",
            new=AsyncMock(),
        ),
    ):
        return await GenericEntityFileService().check_paperless_sync_status(
            db_session, user_id
        )


@pytest.fixture
def other_users_equipment(db_session):
    other = create_random_user(db_session)
    patient = patient_crud.create_for_user(
        db_session,
        user_id=other["user"].id,
        patient_data=PatientCreate(
            first_name="Other",
            last_name="User",
            birth_date=date(1990, 1, 1),
            gender="F",
        ),
    )
    return _equipment(db_session, patient.id)


@pytest.fixture
def remote():
    return _RemoteWhereEveryDocumentIsGone()


class TestPaperlessChecks:
    @pytest.fixture(autouse=True)
    def paperless_enabled(self, db_session, test_user):
        db_session.add(
            UserPreferences(
                user_id=test_user.id,
                paperless_enabled=True,
                paperless_url="https://paperless.invalid",
            )
        )
        db_session.commit()

    async def test_orphaned_equipment_file_is_marked_missing(
        self, db_session, test_user, test_patient, other_users_equipment
    ):
        mine = _remote_file(
            db_session, _equipment(db_session, test_patient.id), "paperless", None
        )
        theirs = _remote_file(db_session, other_users_equipment, "paperless", None)

        await GenericEntityFileService()._handle_orphaned_paperless_records(
            db_session, test_user.id
        )

        db_session.refresh(mine)
        db_session.refresh(theirs)
        assert mine.sync_status == "missing"
        assert theirs.sync_status == "synced"

    async def test_file_whose_task_failed_is_marked_missing(
        self, db_session, test_user, test_patient
    ):
        # _resolve_task_uuids_to_document_ids marks a failed task "failed" but
        # keeps its task UUID, so a task UUID alone must not shield a record.
        failed = _remote_file(
            db_session,
            _equipment(db_session, test_patient.id),
            "paperless",
            None,
            sync_status="failed",
            task_uuid="task-failed",
        )

        await GenericEntityFileService()._handle_orphaned_paperless_records(
            db_session, test_user.id
        )

        db_session.refresh(failed)
        assert failed.sync_status == "missing"

    async def test_upload_still_processing_is_not_marked_missing(
        self, db_session, test_user, test_patient, remote
    ):
        # Regression for #1273: the orphan check ran before task resolution and
        # marked uploads Paperless was still processing as missing.
        processing = _remote_file(
            db_session,
            _equipment(db_session, test_patient.id),
            "paperless",
            None,
            sync_status="processing",
            task_uuid="task-in-progress",
        )

        result = await _run_paperless_sync_check(db_session, test_user.id, remote)

        assert result == {processing.id: True}
        assert remote.checked == []
        db_session.refresh(processing)
        assert processing.sync_status == "processing"
        assert processing.paperless_task_uuid == "task-in-progress"

    async def test_upload_whose_task_paperless_lost_is_found_by_file_name(
        self, db_session, test_patient
    ):
        # Paperless no longer knows the first upload's task, so its document is
        # looked up by file name and upload time. The second upload's task is
        # still running, so it is left alone.
        equipment = _equipment(db_session, test_patient.id)
        lost = _remote_file(
            db_session,
            equipment,
            "paperless",
            None,
            sync_status="processing",
            task_uuid="task-lost",
        )
        running = _remote_file(
            db_session,
            equipment,
            "paperless",
            None,
            sync_status="processing",
            task_uuid="task-running",
        )
        task_bodies = {
            "task-lost": {"results": []},
            "task-running": {
                "results": [
                    {
                        "task_id": "task-running",
                        "status": "STARTED",
                        "related_document": None,
                    }
                ]
            },
        }
        paperless = _FakePaperlessApi(
            lambda endpoint: task_bodies[endpoint.split("task_id=", 1)[1]]
        )
        service = GenericEntityFileService()

        with patch.object(
            service,
            "_search_document_by_filename_and_time",
            new=AsyncMock(return_value=555),
        ) as search:
            await service._resolve_task_uuids_to_document_ids(
                db_session, paperless, [lost, running]
            )

        search.assert_awaited_once()
        db_session.refresh(lost)
        db_session.refresh(running)
        assert lost.sync_status == "synced"
        assert lost.paperless_document_id == "555"
        assert lost.paperless_task_uuid is None
        assert running.sync_status == "processing"
        assert running.paperless_document_id is None
        assert running.paperless_task_uuid == "task-running"

    async def test_deleted_equipment_document_is_marked_missing(
        self, db_session, test_user, test_patient, other_users_equipment, remote
    ):
        mine = _remote_file(
            db_session, _equipment(db_session, test_patient.id), "paperless", "101"
        )
        theirs = _remote_file(db_session, other_users_equipment, "paperless", "202")

        result = await _run_paperless_sync_check(db_session, test_user.id, remote)

        assert result == {mine.id: False}
        assert remote.checked == ["101"]
        db_session.refresh(mine)
        db_session.refresh(theirs)
        assert mine.sync_status == "missing"
        assert theirs.sync_status == "synced"


@pytest.mark.parametrize(
    "title_matches, same_day, expected",
    [
        # Stored upload times are naive UTC; Paperless timestamps can carry "Z".
        (
            [{"id": 7, "title": "manual", "created": "2026-11-19T12:05:00Z"}],
            [],
            7,
        ),
        (
            [],
            [
                {
                    "id": 9,
                    "title": "",
                    "original_file_name": "scan-0042.pdf",
                    "created": "2026-11-19",
                }
            ],
            None,
        ),
        (
            [],
            [
                {
                    "id": 11,
                    "title": "",
                    "original_file_name": "manual.pdf",
                    "created": "2026-11-19",
                }
            ],
            11,
        ),
    ],
    ids=[
        "naive_upload_time_vs_utc_timestamp",
        "unrelated_document_with_empty_title",
        "empty_title_but_same_original_file_name",
    ],
)
async def test_file_name_fallback_search(title_matches, same_day, expected):
    # The first request searches by title; the second lists documents created
    # around the upload date.
    paperless = _FakePaperlessApi(
        lambda endpoint: {
            "results": title_matches if "query=" in endpoint else same_day
        }
    )

    found = await GenericEntityFileService()._search_document_by_filename_and_time(
        "manual.pdf", datetime(2026, 11, 19, 12, 0), paperless
    )

    assert found == expected


class TestPapraCheck:
    async def test_deleted_equipment_document_is_marked_missing(
        self, db_session, test_user, test_patient, other_users_equipment, remote
    ):
        db_session.add(
            UserPreferences(
                user_id=test_user.id,
                papra_enabled=True,
                papra_url="https://papra.invalid",
                papra_api_token_encrypted="encrypted-token",
            )
        )
        db_session.commit()
        mine = _remote_file(
            db_session, _equipment(db_session, test_patient.id), "papra", "doc-1"
        )
        theirs = _remote_file(db_session, other_users_equipment, "papra", "doc-2")

        with patch(
            "app.services.papra_client.create_papra_client", return_value=remote
        ):
            result = await GenericEntityFileService().check_papra_sync_status(
                db_session, test_user.id
            )

        assert result == {mine.id: False}
        assert remote.checked == ["doc-1"]
        db_session.refresh(mine)
        db_session.refresh(theirs)
        assert mine.sync_status == "missing"
        assert theirs.sync_status == "synced"
