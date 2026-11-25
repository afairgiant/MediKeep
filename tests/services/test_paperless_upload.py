"""What a Paperless upload stores so its document can be found when its task can't be read."""

import hashlib
import io
from unittest.mock import patch

import pytest
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.models.models import EntityFile, Medication
from app.services.generic_entity_file_service import GenericEntityFileService
from tests.utils.paperless_uploads import use_paperless

pytestmark = pytest.mark.asyncio


class _PaperlessQueuingUploads:
    """Accepts each upload as a queued task, keeping the bytes it was sent."""

    def __init__(self):
        self.sent = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def upload_document(self, file_data, **kwargs):
        self.sent.append(file_data)
        return {"task_id": "task-1"}


async def test_upload_stores_digests_of_the_bytes_sent_to_paperless(
    db_session, test_user, test_patient
):
    use_paperless(db_session, test_user.id)
    medication = Medication(patient_id=test_patient.id, medication_name="Test med")
    db_session.add(medication)
    db_session.commit()
    content = b"%PDF-1.4 blood panel"
    upload = UploadFile(
        file=io.BytesIO(content),
        filename="blood-panel.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )
    paperless = _PaperlessQueuingUploads()

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
        response = await GenericEntityFileService()._upload_to_paperless(
            db_session,
            "medication",
            medication.id,
            upload,
            content,
            len(content),
            current_user_id=test_user.id,
        )

    assert paperless.sent == [content]
    record = db_session.get(EntityFile, response.id)
    assert record.paperless_sha256 == hashlib.sha256(content).hexdigest()
    assert record.paperless_md5 == hashlib.md5(content).hexdigest()
    assert "paperless_sha256" not in response.model_dump()
