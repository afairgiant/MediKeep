"""Patient access checks: the active patient for reports and export, photo upload, share cleanup."""

import io
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.core.utils.datetime_utils import get_utc_now
from app.crud.patient import patient as patient_crud
from app.models.models import Medication, PatientShare
from app.schemas.patient import PatientCreate
from app.services.patient_photo_service import patient_photo_service
from app.services.patient_sharing import PatientSharingService
from tests.utils.user import create_random_user, create_user_token_headers

MEDICATION_NAME = "Shared Only Medication"


def _make_user_with_patient(db_session: Session, first_name: str):
    user = create_random_user(db_session)["user"]
    patient = patient_crud.create_for_user(
        db_session,
        user_id=user.id,
        patient_data=PatientCreate(
            first_name=first_name,
            last_name="Tester",
            birth_date=date(1985, 5, 5),
            gender="F",
        ),
    )
    user.active_patient_id = patient.id
    db_session.commit()
    return user, patient


@pytest.fixture
def shared_setup(db_session: Session):
    """Owner shares a patient with a recipient, whose active patient is the shared one."""
    owner, owner_patient = _make_user_with_patient(db_session, "Owner")
    recipient, recipient_patient = _make_user_with_patient(db_session, "Recipient")
    medication = Medication(
        patient_id=owner_patient.id, medication_name=MEDICATION_NAME, status="active"
    )
    share = PatientShare(
        patient_id=owner_patient.id,
        shared_by_user_id=owner.id,
        shared_with_user_id=recipient.id,
        permission_level="view",
        is_active=True,
    )
    db_session.add_all([medication, share])
    recipient.active_patient_id = owner_patient.id
    db_session.commit()
    return {
        "owner": owner,
        "owner_patient": owner_patient,
        "recipient": recipient,
        "recipient_patient": recipient_patient,
        "medication": medication,
        "share": share,
        "headers": create_user_token_headers(recipient.username),
    }


def _end_share_leaving_active_patient(db_session: Session, share: PatientShare):
    """The state an old share can leave behind: share gone, active_patient_id kept."""
    share.is_active = False
    db_session.commit()


def _medication_count(client: TestClient, headers) -> int:
    response = client.get("/api/v1/custom-reports/data-summary", headers=headers)
    assert response.status_code == 200
    medications = response.json()["categories"].get("medications")
    return medications["count"] if medications else 0


class TestWhileShareIsActive:
    def test_recipient_sees_shared_records(self, client: TestClient, shared_setup):
        assert _medication_count(client, shared_setup["headers"]) == 1

    def test_recipient_can_export(self, client: TestClient, shared_setup):
        response = client.get(
            "/api/v1/export/data",
            params={"format": "json", "scope": "medications"},
            headers=shared_setup["headers"],
        )

        assert response.status_code == 200
        assert MEDICATION_NAME in response.text


class TestAfterShareEnds:
    @pytest.fixture(autouse=True)
    def end_share(self, db_session: Session, shared_setup):
        _end_share_leaving_active_patient(db_session, shared_setup["share"])

    def test_data_summary_omits_the_patient(self, client: TestClient, shared_setup):
        assert _medication_count(client, shared_setup["headers"]) == 0

    def test_report_generation_is_refused(self, client: TestClient, shared_setup):
        response = client.post(
            "/api/v1/custom-reports/generate",
            json={
                "selected_records": [
                    {
                        "category": "medications",
                        "record_ids": [shared_setup["medication"].id],
                    }
                ]
            },
            headers=shared_setup["headers"],
        )

        assert response.status_code in (400, 403, 404)

    def test_record_count_preview_is_refused(self, client: TestClient, shared_setup):
        response = client.post(
            "/api/v1/custom-reports/preview-count",
            json={
                "selected_records": [
                    {
                        "category": "medications",
                        "record_ids": [shared_setup["medication"].id],
                    }
                ]
            },
            headers=shared_setup["headers"],
        )

        assert response.status_code in (400, 403, 404)

    def test_export_is_refused(self, client: TestClient, shared_setup):
        response = client.get(
            "/api/v1/export/data",
            params={"format": "json", "scope": "medications"},
            headers=shared_setup["headers"],
        )

        assert response.status_code != 200
        assert MEDICATION_NAME not in response.text

    def test_export_summary_is_refused(self, client: TestClient, shared_setup):
        response = client.get("/api/v1/export/summary", headers=shared_setup["headers"])

        assert response.status_code != 200

    def test_bulk_export_refuses_every_scope(self, client: TestClient, shared_setup):
        response = client.post(
            "/api/v1/export/bulk",
            json={
                "scopes": ["medications", "allergies", "conditions"],
                "format": "json",
            },
            headers=shared_setup["headers"],
        )

        assert response.status_code != 200

    def test_repeated_requests_keep_refusing(
        self, client: TestClient, db_session: Session, shared_setup
    ):
        for _ in range(2):
            response = client.get(
                "/api/v1/export/summary", headers=shared_setup["headers"]
            )
            assert response.status_code != 200

        db_session.refresh(shared_setup["recipient"])
        assert (
            shared_setup["recipient"].active_patient_id
            == shared_setup["owner_patient"].id
        )

    def test_loading_the_active_patient_switches_to_an_owned_one(
        self, client: TestClient, shared_setup
    ):
        headers = shared_setup["headers"]
        assert (
            client.get(
                "/api/v1/patient-management/active/current", headers=headers
            ).json()
            is None
        )

        response = client.get("/api/v1/export/summary", headers=headers)

        assert response.status_code == 200
        assert response.json()["data"]["patient_id"] == (
            shared_setup["recipient_patient"].id
        )


class TestOwnerUnaffected:
    def test_owner_still_sees_their_records(
        self, client: TestClient, db_session: Session, shared_setup
    ):
        _end_share_leaving_active_patient(db_session, shared_setup["share"])
        owner_headers = create_user_token_headers(shared_setup["owner"].username)

        assert _medication_count(client, owner_headers) == 1


class TestEndingAShareClearsTheRecipientsActivePatient:
    @pytest.mark.asyncio
    async def test_revoke(self, db_session: Session, shared_setup):
        await PatientSharingService(db_session).revoke_patient_share(
            shared_setup["owner"],
            shared_setup["owner_patient"].id,
            shared_setup["recipient"].id,
        )

        db_session.refresh(shared_setup["recipient"])
        assert shared_setup["recipient"].active_patient_id is None

    def test_recipient_removes_own_access(self, db_session: Session, shared_setup):
        PatientSharingService(db_session).remove_user_access(
            shared_setup["recipient"], shared_setup["owner_patient"].id
        )

        db_session.refresh(shared_setup["recipient"])
        assert shared_setup["recipient"].active_patient_id is None

    def test_expiry_cleanup(self, db_session: Session, shared_setup):
        shared_setup["share"].expires_at = get_utc_now() - timedelta(days=1)
        db_session.commit()

        PatientSharingService(db_session).cleanup_expired_shares()

        db_session.refresh(shared_setup["recipient"])
        assert shared_setup["recipient"].active_patient_id is None

    @pytest.mark.asyncio
    async def test_a_different_active_patient_is_left_alone(
        self, db_session: Session, shared_setup
    ):
        recipient = shared_setup["recipient"]
        recipient.active_patient_id = shared_setup["recipient_patient"].id
        db_session.commit()

        await PatientSharingService(db_session).revoke_patient_share(
            shared_setup["owner"], shared_setup["owner_patient"].id, recipient.id
        )

        db_session.refresh(recipient)
        assert recipient.active_patient_id == shared_setup["recipient_patient"].id


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(buffer, format="PNG")
    return buffer.getvalue()


class TestPhotoUploadNeedsEditAccess:
    def _upload(self, client: TestClient, patient_id: int, headers):
        return client.post(
            f"/api/v1/patients/{patient_id}/photo",
            files={"file": ("photo.png", _png_bytes(), "image/png")},
            headers=headers,
        )

    def test_view_only_recipient_is_forbidden(self, client: TestClient, shared_setup):
        response = self._upload(
            client, shared_setup["owner_patient"].id, shared_setup["headers"]
        )

        assert response.status_code == 403

    def test_edit_recipient_is_allowed(
        self,
        client: TestClient,
        db_session: Session,
        shared_setup,
        tmp_path,
        monkeypatch,
    ):
        # The service fixes its storage path at import, before uploads are redirected
        monkeypatch.setattr(patient_photo_service, "storage_base", tmp_path)
        shared_setup["share"].permission_level = "edit"
        db_session.commit()

        response = self._upload(
            client, shared_setup["owner_patient"].id, shared_setup["headers"]
        )

        assert response.status_code == 200


class TestCleanupExpiredSharesIsAdminOnly:
    def test_regular_user_is_forbidden(self, client: TestClient, shared_setup):
        response = client.post(
            "/api/v1/patient-sharing/cleanup-expired", headers=shared_setup["headers"]
        )

        assert response.status_code == 403

    def test_admin_can_run_it(self, admin_client: TestClient):
        response = admin_client.post("/api/v1/patient-sharing/cleanup-expired")

        assert response.status_code == 200
