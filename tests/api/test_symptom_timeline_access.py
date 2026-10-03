"""
Regression tests: GET /api/v1/symptoms/timeline used a caller-supplied
patient_id without checking access, so any authenticated user could read
another patient's symptom episodes.
"""

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.crud.symptom import symptom_occurrence, symptom_parent
from app.models.models import PatientShare
from app.schemas.patient import PatientCreate
from app.schemas.symptom import SymptomCreate, SymptomOccurrenceCreate
from tests.utils.user import create_random_user, create_user_token_headers

TIMELINE_URL = "/api/v1/symptoms/timeline"


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


def _log_episode(db_session: Session, patient_id: int, name: str):
    symptom = symptom_parent.create(
        db_session,
        obj_in=SymptomCreate(
            patient_id=patient_id,
            symptom_name=name,
            status="active",
            first_occurrence_date=date.today() - timedelta(days=1),
        ),
    )
    symptom_occurrence.create(
        db_session,
        obj_in=SymptomOccurrenceCreate(
            symptom_id=symptom.id,
            occurrence_date=date.today() - timedelta(days=1),
            severity="moderate",
        ),
    )


class TestSymptomTimelineAccess:
    def test_own_timeline_by_default(self, client: TestClient, db_session: Session):
        _, patient, headers = _make_user_with_patient(db_session, "Owner")
        _log_episode(db_session, patient.id, "Own Migraine")

        response = client.get(TIMELINE_URL, headers=headers)

        assert response.status_code == 200
        assert [row["symptom_name"] for row in response.json()] == ["Own Migraine"]

    def test_other_patient_is_forbidden(self, client: TestClient, db_session: Session):
        _, owner_patient, _ = _make_user_with_patient(db_session, "Owner")
        _log_episode(db_session, owner_patient.id, "Private Migraine")
        _, _, stranger_headers = _make_user_with_patient(db_session, "Stranger")

        response = client.get(
            TIMELINE_URL,
            params={"patient_id": owner_patient.id},
            headers=stranger_headers,
        )

        assert response.status_code == 403
        assert "Private Migraine" not in response.text

    def test_unknown_patient_is_not_found(
        self, client: TestClient, db_session: Session
    ):
        _, _, headers = _make_user_with_patient(db_session, "Owner")

        response = client.get(
            TIMELINE_URL, params={"patient_id": 999999}, headers=headers
        )

        assert response.status_code == 404

    def test_view_share_can_read(self, client: TestClient, db_session: Session):
        owner, owner_patient, _ = _make_user_with_patient(db_session, "Owner")
        _log_episode(db_session, owner_patient.id, "Shared Migraine")
        viewer, _, viewer_headers = _make_user_with_patient(db_session, "Viewer")
        db_session.add(
            PatientShare(
                patient_id=owner_patient.id,
                shared_by_user_id=owner.id,
                shared_with_user_id=viewer.id,
                permission_level="view",
                is_active=True,
            )
        )
        db_session.commit()

        response = client.get(
            TIMELINE_URL,
            params={"patient_id": owner_patient.id},
            headers=viewer_headers,
        )

        assert response.status_code == 200
        assert [row["symptom_name"] for row in response.json()] == ["Shared Migraine"]
