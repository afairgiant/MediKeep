"""Regression test for issue #1171: deleting a user with an active patient."""

from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.models import Patient, User
from app.services.user_deletion_service import UserDeletionService


def _survivor(db_session: Session, username: str, patient: Patient) -> User:
    """A second user pointing at `patient`, to prove the cleanup is filtered."""
    survivor = User(
        username=username,
        email=f"{username}@test.com",
        password_hash="hashed",
        full_name=username,
        role="user",
        active_patient_id=patient.id,
    )
    db_session.add(survivor)
    db_session.commit()
    db_session.refresh(survivor)
    return survivor


def _other_patient(db_session: Session, owner: User, first_name: str) -> Patient:
    patient = Patient(
        first_name=first_name,
        last_name="Bystander",
        birth_date=date(1980, 1, 1),
        gender="F",
        owner_user_id=owner.id,
        user_id=owner.id,
        is_self_record=False,
    )
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)
    return patient


def test_delete_user_with_active_patient(
    db_session: Session, test_user, test_admin_user, test_patient
):
    db_session.commit()
    user_id = test_user.id
    patient_id = test_patient.id

    # A user pointing at the patient being deleted, and a user pointing at a
    # different patient. Only the first reference may be cleared.
    pointing_at_deleted = _survivor(db_session, "sharedref", test_patient)
    untouched_patient = _other_patient(db_session, test_admin_user, "Bystander")
    test_admin_user.active_patient_id = untouched_patient.id
    db_session.commit()

    stats = UserDeletionService().delete_user_account(db_session, user_id)
    db_session.commit()

    assert stats["deleted_records"]["user"] == 1
    assert db_session.query(User).filter(User.id == user_id).first() is None
    assert db_session.query(Patient).filter(Patient.id == patient_id).first() is None

    db_session.refresh(pointing_at_deleted)
    db_session.refresh(test_admin_user)
    assert pointing_at_deleted.active_patient_id is None
    assert test_admin_user.active_patient_id == untouched_patient.id
    untouched = db_session.query(Patient).filter(Patient.id == untouched_patient.id).first()
    assert untouched is not None

    dangling = db_session.execute(
        text(
            "SELECT COUNT(*) FROM users u "
            "LEFT JOIN patients p ON u.active_patient_id = p.id "
            "WHERE u.active_patient_id IS NOT NULL AND p.id IS NULL"
        )
    ).scalar()
    assert dangling == 0


def test_admin_model_delete_user_with_active_patient(
    admin_client, db_session: Session, test_user, test_admin_user, test_patient
):
    db_session.commit()
    user_id = test_user.id
    patient_id = test_patient.id

    # Same two-survivor guard as above, but through the admin endpoint, which is
    # the path that deletes the patient row directly.
    pointing_at_deleted = _survivor(db_session, "adminref", test_patient)
    untouched_patient = _other_patient(db_session, test_admin_user, "AdminBystander")
    test_admin_user.active_patient_id = untouched_patient.id
    db_session.commit()

    response = admin_client.delete(f"/api/v1/admin/models/user/{user_id}")

    assert response.status_code == 200
    assert db_session.query(User).filter(User.id == user_id).first() is None
    assert db_session.query(Patient).filter(Patient.id == patient_id).first() is None

    db_session.refresh(pointing_at_deleted)
    db_session.refresh(test_admin_user)
    assert pointing_at_deleted.active_patient_id is None
    assert test_admin_user.active_patient_id == untouched_patient.id
    kept = db_session.query(Patient).filter(Patient.id == untouched_patient.id).first()
    assert kept is not None
