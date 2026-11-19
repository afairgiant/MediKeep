"""
Paperless-ngx and Papra sync checks on medical equipment files.

Each check finds the user's remote files through the record they are attached to,
so equipment files are only checked once equipment is one of those record types.
Another user's files must never be checked or changed.
"""

from datetime import date
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
