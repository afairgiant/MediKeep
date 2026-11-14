"""Regression test for issue #1171: deleting a user with an active patient."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.models import Patient, User
from app.services.user_deletion_service import UserDeletionService


def test_delete_user_with_active_patient(
    db_session: Session, test_user, test_admin_user, test_patient
):
    db_session.commit()
    user_id = test_user.id
    patient_id = test_patient.id

    stats = UserDeletionService().delete_user_account(db_session, user_id)
    db_session.commit()

    assert stats["deleted_records"]["user"] == 1
    assert db_session.query(User).filter(User.id == user_id).first() is None
    assert db_session.query(Patient).filter(Patient.id == patient_id).first() is None

    dangling = db_session.execute(
        text(
            "SELECT COUNT(*) FROM users u "
            "LEFT JOIN patients p ON u.active_patient_id = p.id "
            "WHERE u.active_patient_id IS NOT NULL AND p.id IS NULL"
        )
    ).scalar()
    assert dangling == 0


def test_admin_model_delete_user_with_active_patient(
    admin_client, db_session: Session, test_user, test_patient
):
    db_session.commit()
    user_id = test_user.id
    patient_id = test_patient.id

    response = admin_client.delete(f"/api/v1/admin/models/user/{user_id}")
    print("STATUS", response.status_code, response.text[:500])

    assert response.status_code == 200
    assert db_session.query(User).filter(User.id == user_id).first() is None
    assert db_session.query(Patient).filter(Patient.id == patient_id).first() is None
