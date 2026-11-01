"""Routes that act on another user's records by id: invitations, file task status, cleanups."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.utils.datetime_utils import get_utc_now
from app.api.v1.endpoints.paperless import _update_entity_file_from_task_result
from app.main import app
from app.models.models import (
    EntityFile,
    Invitation,
    Medication,
    PatientShare,
    Practitioner,
)
from tests.utils.data import create_sample_practitioner
from tests.utils.user import create_test_user_with_patient, create_user_token_headers


def _user_with_patient(db_session: Session):
    created = create_test_user_with_patient(db_session)
    return created["user"], created["patient"]


@pytest.fixture
def owner(db_session: Session):
    return _user_with_patient(db_session)


@pytest.fixture
def other_user(db_session: Session):
    return _user_with_patient(db_session)[0]


class TestBulkInvitationAccept:
    @pytest.fixture
    def recipient(self, db_session: Session):
        return _user_with_patient(db_session)[0]

    @pytest.fixture
    def invitation(self, db_session: Session, owner, recipient):
        owner_user, owner_patient = owner
        invitation = Invitation(
            sent_by_user_id=owner_user.id,
            sent_to_user_id=recipient.id,
            invitation_type="patient_share",
            status="pending",
            title="Patient Records Share",
            context_data={
                "patients": [{"patient_id": owner_patient.id}],
                "permission_level": "view",
                "is_bulk_invite": True,
                "patient_count": 1,
            },
        )
        db_session.add(invitation)
        db_session.commit()
        return invitation

    def _accept(self, client: TestClient, invitation_id: int, user):
        return client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json={"response": "accepted"},
            headers=create_user_token_headers(user.username),
        )

    def _shares_for(self, db_session: Session, user) -> int:
        return (
            db_session.query(PatientShare)
            .filter(PatientShare.shared_with_user_id == user.id)
            .count()
        )

    def test_another_user_cannot_accept(
        self, client: TestClient, db_session: Session, invitation, other_user
    ):
        response = self._accept(client, invitation.id, other_user)

        assert response.status_code == 404
        assert self._shares_for(db_session, other_user) == 0
        db_session.refresh(invitation)
        assert invitation.status == "pending"

    def test_recipient_can_accept(
        self, client: TestClient, db_session: Session, invitation, recipient
    ):
        response = self._accept(client, invitation.id, recipient)

        assert response.status_code == 200
        assert self._shares_for(db_session, recipient) == 1

    def test_accepted_invitation_cannot_be_reused(
        self, client: TestClient, db_session: Session, invitation, recipient
    ):
        invitation.status = "accepted"
        db_session.commit()

        assert self._accept(client, invitation.id, recipient).status_code == 404
        assert self._shares_for(db_session, recipient) == 0

    def test_expired_invitation_is_refused(
        self, client: TestClient, db_session: Session, invitation, recipient
    ):
        invitation.expires_at = get_utc_now() - timedelta(days=1)
        db_session.commit()

        assert self._accept(client, invitation.id, recipient).status_code == 400
        assert self._shares_for(db_session, recipient) == 0


class TestRemovedRoutes:
    @pytest.mark.parametrize(
        "path",
        [
            "/api/v1/procedures/scheduled",
            "/api/v1/treatments/ongoing",
            "/api/v1/entity-files/{entity_type}/{entity_id}/cleanup",
        ],
    )
    def test_route_is_not_registered(self, path):
        assert path not in app.openapi()["paths"]


def _medication_file(db_session: Session, patient, **fields) -> EntityFile:
    medication = Medication(
        patient_id=patient.id, medication_name="Med", status="active"
    )
    db_session.add(medication)
    db_session.flush()
    entity_file = EntityFile(
        entity_type="medication",
        entity_id=medication.id,
        file_name="scan.pdf",
        file_path="uploads/scan.pdf",
        file_type="application/pdf",
        uploaded_at=get_utc_now(),
        **fields,
    )
    db_session.add(entity_file)
    db_session.commit()
    return entity_file


class TestPaperlessBackgroundTask:
    URL = "/api/v1/paperless/entity-files/set-background-task"

    @pytest.fixture
    def entity_file(self, db_session: Session, owner):
        return _medication_file(db_session, owner[1])

    def _set_task(self, client: TestClient, entity_file, user):
        return client.post(
            self.URL,
            json={
                "entity_type": "medication",
                "entity_id": entity_file.entity_id,
                "file_name": entity_file.file_name,
                "task_uuid": "task-123",
            },
            headers=create_user_token_headers(user.username),
        )

    def test_another_user_cannot_change_the_file(
        self, client: TestClient, db_session: Session, entity_file, other_user
    ):
        response = self._set_task(client, entity_file, other_user)

        assert response.status_code == 404
        db_session.refresh(entity_file)
        assert entity_file.paperless_task_uuid is None

    def test_owner_can_set_the_task(
        self, client: TestClient, db_session: Session, entity_file, owner
    ):
        response = self._set_task(client, entity_file, owner[0])

        assert response.status_code == 200
        db_session.refresh(entity_file)
        assert entity_file.paperless_task_uuid == "task-123"


class TestPaperlessFilesOfOtherUsers:
    def test_cleanup_only_removes_the_callers_files(
        self, client: TestClient, db_session: Session, owner
    ):
        other, other_patient = _user_with_patient(db_session)
        owners_file = _medication_file(db_session, owner[1], sync_status="failed")
        others_file = _medication_file(db_session, other_patient, sync_status="failed")
        owners_file_id, others_file_id = owners_file.id, others_file.id

        response = client.post(
            "/api/v1/paperless/cleanup",
            headers=create_user_token_headers(other.username),
        )

        assert response.status_code == 200
        assert response.json()["files_deleted"] == 1
        db_session.expire_all()
        assert db_session.get(EntityFile, owners_file_id) is not None
        assert db_session.get(EntityFile, others_file_id) is None

    def test_task_result_from_another_user_is_ignored(
        self, db_session: Session, owner, other_user
    ):
        entity_file = _medication_file(
            db_session, owner[1], paperless_task_uuid="task-9", sync_status="processing"
        )

        _update_entity_file_from_task_result(
            db_session, other_user, "task-9", {"status": "SUCCESS", "document_id": 5}
        )

        db_session.refresh(entity_file)
        assert entity_file.sync_status == "processing"
        assert entity_file.paperless_document_id is None

    def test_task_result_from_the_owner_is_applied(self, db_session: Session, owner):
        entity_file = _medication_file(
            db_session, owner[1], paperless_task_uuid="task-9", sync_status="processing"
        )

        _update_entity_file_from_task_result(
            db_session, owner[0], "task-9", {"status": "SUCCESS", "document_id": 5}
        )

        db_session.refresh(entity_file)
        assert entity_file.sync_status == "synced"


class TestInvitationCleanupIsAdminOnly:
    def test_regular_user_is_forbidden(self, authenticated_client: TestClient):
        response = authenticated_client.post("/api/v1/invitations/cleanup")

        assert response.status_code == 403

    def test_admin_can_run_it(self, admin_client: TestClient):
        response = admin_client.post("/api/v1/invitations/cleanup")

        assert response.status_code == 200


class TestPractitionerDeleteWhileInUse:
    @pytest.fixture
    def practitioner(self, db_session: Session):
        return create_sample_practitioner(db_session)

    def test_linked_practitioner_is_refused(
        self,
        authenticated_client: TestClient,
        db_session: Session,
        practitioner,
        owner,
    ):
        db_session.add(
            Medication(
                patient_id=owner[1].id,
                medication_name="Med",
                status="active",
                practitioner_id=practitioner.id,
            )
        )
        db_session.commit()

        response = authenticated_client.delete(
            f"/api/v1/practitioners/{practitioner.id}"
        )

        assert response.status_code == 409
        assert db_session.get(Practitioner, practitioner.id) is not None

    def test_unlinked_practitioner_is_deleted(
        self, authenticated_client: TestClient, practitioner
    ):
        response = authenticated_client.delete(
            f"/api/v1/practitioners/{practitioner.id}"
        )

        assert response.status_code == 200
