"""Builders and a fake Paperless for tests of processing Paperless uploads."""

from contextlib import asynccontextmanager
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.crud.patient import patient as patient_crud
from app.crud.user_preferences import user_preferences
from app.models.models import EntityFile, Medication, PatientShare, get_utc_now
from app.schemas.patient import PatientCreate
from app.services.generic_entity_file_service import GenericEntityFileService
from tests.utils.user import create_random_user

FILE_NAME = "blood-panel-results.pdf"


class RecordingPaperless:
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

    def get_auth_type(self):
        return "token"

    async def check_document_exists(self, document_id):
        return True

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


def task_response(task_uuid, document_id, status="SUCCESS"):
    """A ``/api/tasks/`` answer holding one task."""
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


def use_paperless(db_session, user_id, url=None):
    """Enable Paperless for the user; each user gets their own instance unless ``url`` is given."""
    prefs = user_preferences.get_or_create_by_user_id(db_session, user_id=user_id)
    prefs.paperless_enabled = True
    prefs.paperless_url = url or f"https://paperless-{user_id}.invalid"
    db_session.commit()


def use_papra(db_session, user_id, url=None, org="org-1"):
    """Enable Papra for the user; each user gets their own instance unless ``url`` is given."""
    prefs = user_preferences.get_or_create_by_user_id(db_session, user_id=user_id)
    prefs.papra_enabled = True
    prefs.papra_url = url or f"https://papra-{user_id}.invalid"
    prefs.papra_api_token_encrypted = "enc-token"
    prefs.papra_organization_id = org
    db_session.commit()


def member(db_session, paperless_url=None, papra_url=None):
    """A new user with Paperless and Papra enabled, on their own instances unless URLs are given."""
    user = create_random_user(db_session)["user"]
    use_paperless(db_session, user.id, paperless_url)
    use_papra(db_session, user.id, papra_url)
    return user


def patient_for(db_session, user_id):
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


def processing_upload(db_session, patient_id, task_uuid, uploaded_by_user_id=None):
    """A medication file still processing in Paperless under ``task_uuid``."""
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
        uploaded_by_user_id=uploaded_by_user_id,
    )
    db_session.add(record)
    db_session.commit()
    return record


def share(db_session, patient, owner_id, recipient_id, permission_level="edit"):
    patient_share = PatientShare(
        patient_id=patient.id,
        shared_by_user_id=owner_id,
        shared_with_user_id=recipient_id,
        permission_level=permission_level,
        is_active=True,
    )
    db_session.add(patient_share)
    db_session.commit()
    return patient_share


async def poll(db_session, user_id, paperless):
    """Run the processing poll for ``user_id`` against ``paperless``."""
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
