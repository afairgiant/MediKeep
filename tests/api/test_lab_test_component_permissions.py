"""
Regression tests: the /api/v1/lab-test-components/* mutation endpoints
(create, create-bulk, update, delete) historically called verify_patient_access
without required_permission="edit", so they defaulted to "view" — a patient
share with view-only permission could create, edit, or delete another user's
lab test component records.

These tests assert that a view-only share can read but not mutate, and that
an edit share can.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.crud.lab_result import lab_result as lab_result_crud
from app.crud.lab_test_component import lab_test_component as component_crud
from app.crud.patient import patient as patient_crud
from app.models.models import PatientShare
from app.schemas.lab_result import LabResultCreate
from app.schemas.lab_test_component import LabTestComponentCreate
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


def _make_user_with_patient(db_session: Session, first_name: str):
    user_data = create_random_user(db_session)
    patient = patient_crud.create_for_user(
        db_session,
        user_id=user_data["user"].id,
        patient_data=PatientCreate(
            first_name=first_name,
            last_name="Tester",
            birth_date=date(1988, 3, 3),
            gender="M",
        ),
    )
    user_data["user"].active_patient_id = patient.id
    db_session.commit()
    db_session.refresh(user_data["user"])
    headers = create_user_token_headers(user_data["user"].username)
    return user_data["user"], patient, headers


class TestLabTestComponentSharePermissions:
    """View shares are read-only; edit shares can create/update/delete components."""

    def _setup(self, db_session, permission_level):
        owner, owner_patient, owner_headers = _make_user_with_patient(
            db_session, "ComponentOwner"
        )
        owner_lab_result = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                test_name="Shared Panel",
                completed_date=date.today(),
                status="completed",
                patient_id=owner_patient.id,
            ),
        )
        component = component_crud.create(
            db_session,
            obj_in=LabTestComponentCreate(
                test_name="Glucose",
                value=95,
                unit="mg/dL",
                lab_result_id=owner_lab_result.id,
            ),
        )

        recipient, _, recipient_headers = _make_user_with_patient(
            db_session, "ComponentRecipient"
        )
        share = PatientShare(
            patient_id=owner_patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level=permission_level,
            is_active=True,
        )
        db_session.add(share)
        db_session.commit()

        return {
            "recipient_headers": recipient_headers,
            "lab_result_id": owner_lab_result.id,
            "component_id": component.id,
        }

    def test_view_share_can_read_but_not_update(self, client, db_session):
        ctx = self._setup(db_session, "view")

        read = client.get(
            f"/api/v1/lab-test-components/components/{ctx['component_id']}",
            headers=ctx["recipient_headers"],
        )
        assert read.status_code == 200

        update = client.put(
            f"/api/v1/lab-test-components/components/{ctx['component_id']}",
            headers=ctx["recipient_headers"],
            json={"value": 999},
        )
        assert update.status_code == 403

    def test_view_share_cannot_delete(self, client, db_session):
        ctx = self._setup(db_session, "view")

        delete = client.delete(
            f"/api/v1/lab-test-components/components/{ctx['component_id']}",
            headers=ctx["recipient_headers"],
        )
        assert delete.status_code == 403

    def test_view_share_cannot_create(self, client, db_session):
        ctx = self._setup(db_session, "view")

        create = client.post(
            f"/api/v1/lab-test-components/lab-result/{ctx['lab_result_id']}/components",
            headers=ctx["recipient_headers"],
            json={
                "test_name": "Injected Test",
                "value": 1,
                "lab_result_id": ctx["lab_result_id"],
            },
        )
        assert create.status_code == 403

    def test_edit_share_can_create_update_and_delete(self, client, db_session):
        ctx = self._setup(db_session, "edit")

        create = client.post(
            f"/api/v1/lab-test-components/lab-result/{ctx['lab_result_id']}/components",
            headers=ctx["recipient_headers"],
            json={
                "test_name": "Added Test",
                "value": 5,
                "lab_result_id": ctx["lab_result_id"],
            },
        )
        assert create.status_code == 201
        new_component_id = create.json()["id"]

        update = client.put(
            f"/api/v1/lab-test-components/components/{ctx['component_id']}",
            headers=ctx["recipient_headers"],
            json={"value": 100},
        )
        assert update.status_code == 200
        assert update.json()["value"] == 100

        delete = client.delete(
            f"/api/v1/lab-test-components/components/{new_component_id}",
            headers=ctx["recipient_headers"],
        )
        assert delete.status_code == 204
