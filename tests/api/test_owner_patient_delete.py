"""Owner delete of a patient: DELETE /patient-management/{id}."""

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.utils.activity_tracker import activity_tracking_disabled_var
from app.core.utils.security import create_access_token
from app.models.activity_log import ActionType, ActivityLog, EntityType
from app.models.models import Patient, PatientShare, User
from app.services.patient_management import PatientManagementService


def _other_user(db_session: Session, username: str) -> User:
    user = User(
        username=username,
        email=f"{username}@test.com",
        password_hash="hashed",
        full_name=username,
        role="user",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _add_patient_logs(db_session: Session, user_id: int, patient_id: int) -> None:
    for i in range(2):
        db_session.add(
            ActivityLog(
                user_id=user_id,
                patient_id=patient_id,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                entity_id=patient_id,
                description=f"owner delete row {i}",
            )
        )
    db_session.commit()


def _fixture_logs(db_session: Session):
    return (
        db_session.query(ActivityLog)
        .filter(ActivityLog.description.like("owner delete row %"))
        .all()
    )


def test_owner_delete_keeps_activity_and_clears_references(
    authenticated_client, db_session: Session, test_user, test_patient
):
    patient_id = test_patient.id
    viewer = _other_user(db_session, "shareviewer")
    db_session.add(
        PatientShare(
            patient_id=patient_id,
            shared_by_user_id=test_user.id,
            shared_with_user_id=viewer.id,
            permission_level="view",
            is_active=True,
        )
    )
    viewer.active_patient_id = patient_id
    db_session.commit()
    _add_patient_logs(db_session, test_user.id, patient_id)

    response = authenticated_client.delete(f"/api/v1/patient-management/{patient_id}")

    assert response.status_code == 200
    db_session.expire_all()
    assert db_session.query(Patient).filter(Patient.id == patient_id).first() is None
    assert (
        db_session.query(PatientShare)
        .filter(PatientShare.patient_id == patient_id)
        .count()
        == 0
    )
    assert db_session.get(User, viewer.id).active_patient_id is None
    kept = _fixture_logs(db_session)
    assert len(kept) == 2, "activity history must be kept, not deleted"
    assert all(row.patient_id is None for row in kept)


def test_non_owner_delete_is_forbidden(client, db_session: Session, test_patient):
    intruder = _other_user(db_session, "intruder")
    headers = {
        "Authorization": f"Bearer {create_access_token(data={'sub': intruder.username})}"
    }

    response = client.delete(
        f"/api/v1/patient-management/{test_patient.id}", headers=headers
    )

    assert response.status_code == 403
    assert db_session.query(Patient).filter(Patient.id == test_patient.id).first()


def test_failed_commit_rolls_back_and_reraises(
    db_session: Session, test_user, test_patient, monkeypatch
):
    patient_id = test_patient.id
    _add_patient_logs(db_session, test_user.id, patient_id)

    def failing_commit():
        raise OperationalError("COMMIT", {}, Exception("disk I/O error"))

    monkeypatch.setattr(db_session, "commit", failing_commit)

    with pytest.raises(OperationalError):
        PatientManagementService(db_session).delete_patient(test_user, patient_id)

    monkeypatch.undo()
    db_session.expire_all()
    assert db_session.query(Patient).filter(Patient.id == patient_id).first()
    assert all(row.patient_id == patient_id for row in _fixture_logs(db_session))
    assert activity_tracking_disabled_var.get() is False
