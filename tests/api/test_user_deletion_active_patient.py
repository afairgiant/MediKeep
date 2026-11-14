"""Regression test for issue #1171: deleting a user with an active patient."""

from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.activity_log import ActionType, ActivityLog, EntityType
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


def _log_rows(db_session: Session, user_id: int):
    """Activity rows owned by `user_id` (the audit trail that must survive)."""
    return db_session.query(ActivityLog).filter(ActivityLog.user_id == user_id).all()


def _add_logs(db_session: Session, user_id: int, count: int = 2) -> None:
    for i in range(count):
        db_session.add(
            ActivityLog(
                user_id=user_id,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                entity_id=None,
                description=f"fixture row {i}",
            )
        )
    db_session.commit()


def test_admin_delete_user_with_active_patient_keeps_activity_logs(
    admin_client, db_session: Session, test_user, test_patient
):
    """#1171 follow-up (#1239 review): activity_logs.user_id has no ON DELETE
    action, so a user with audit history must still delete, with the trail
    detached rather than dropped."""
    db_session.commit()
    user_id = test_user.id
    _add_logs(db_session, user_id)
    assert len(_log_rows(db_session, user_id)) == 2

    response = admin_client.delete(f"/api/v1/admin/models/user/{user_id}")

    assert response.status_code == 200
    assert db_session.query(User).filter(User.id == user_id).first() is None
    detached = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.description.like("fixture row %"))
        .all()
    )
    assert len(detached) == 2, "audit trail must be preserved, not cascaded away"
    assert all(row.user_id is None for row in detached)


def test_admin_delete_user_without_patient_keeps_activity_logs(
    admin_client, db_session: Session, test_admin_user
):
    """A user who never created a patient hits the user delete with no patient
    branch at all, so the detach must not live inside that branch."""
    bare = User(
        username="bareuser",
        email="bareuser@test.com",
        password_hash="hashed",
        full_name="Bare User",
        role="user",
    )
    db_session.add(bare)
    db_session.commit()
    db_session.refresh(bare)
    _add_logs(db_session, bare.id)

    response = admin_client.delete(f"/api/v1/admin/models/user/{bare.id}")

    assert response.status_code == 200
    assert db_session.query(User).filter(User.id == bare.id).first() is None
    detached = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.description.like("fixture row %"))
        .all()
    )
    assert len(detached) == 2
    assert all(row.user_id is None for row in detached)


def test_failed_user_delete_does_not_leave_patient_deleted(
    admin_client, db_session: Session, test_user, test_patient, monkeypatch
):
    """#1239 review: patient and user must delete atomically.

    The endpoint deletes the patient before it deletes the user, and the
    patient CRUD used to commit on its own. Any failure in the user branch then
    left the patient (and every medical record cascading off it) permanently
    gone while the user row survived. Failing the audit write between the two
    deletes proves the pair is now one transaction.
    """
    from app.api.v1.admin import models as admin_models

    db_session.commit()
    user_id = test_user.id
    patient_id = test_patient.id

    def _boom(**_kwargs):
        raise RuntimeError("injected failure after the patient delete")

    monkeypatch.setattr(admin_models, "safe_log_activity", _boom)

    response = admin_client.delete(f"/api/v1/admin/models/user/{user_id}")

    assert response.status_code == 500, (
        "the injected failure must reach the client, not be swallowed: "
        f"got {response.status_code}"
    )

    db_session.rollback()
    db_session.expire_all()
    assert (
        db_session.query(Patient).filter(Patient.id == patient_id).first() is not None
    ), "patient was deleted even though the user delete failed"
    assert (
        db_session.query(User).filter(User.id == user_id).first() is not None
    ), "user was deleted even though the delete failed"
