"""Regression test for issue #1171: deleting a user with an active patient."""

from datetime import date

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.crud.activity_log import activity_log
from app.models.activity_log import ActionType, ActivityLog, EntityType
from app.models.models import Patient, PatientPhoto, User
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
    untouched = (
        db_session.query(Patient).filter(Patient.id == untouched_patient.id).first()
    )
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


def test_failed_audit_flush_keeps_callers_transaction(
    db_session, test_user, monkeypatch
):
    from app.api.activity_logging import safe_log_activity

    test_user.full_name = "Changed before failed audit"
    db_session.flush()

    def invalid_log(**kwargs):
        kwargs["db"].add(
            ActivityLog(action=None, entity_type="user", description="invalid")
        )
        kwargs["db"].flush()

    monkeypatch.setattr(activity_log, "log_activity", invalid_log)
    safe_log_activity(
        db_session, ActionType.UPDATED, "user", test_user, test_user.id, commit=False
    )
    db_session.commit()
    db_session.refresh(test_user)
    assert test_user.full_name == "Changed before failed audit"
    assert (
        db_session.query(ActivityLog)
        .filter(ActivityLog.description == "invalid")
        .count()
        == 0
    )


def test_failed_user_delete_after_audit_log_does_not_leave_patient_deleted(
    admin_client, db_session: Session, test_user, test_patient, monkeypatch
):
    """#1239 review: the audit write must not commit the patient delete.

    Here the real audit logging runs and succeeds, and the failure comes from
    the user delete itself. If the audit write committed, the patient would
    already be gone when the user delete fails.
    """
    db_session.commit()
    user_id = test_user.id
    patient_id = test_patient.id

    original = UserDeletionService.delete_user_account

    def _boom(self, db, user_id):
        original(self, db, user_id)
        db.flush()
        raise RuntimeError("injected failure after deleting the aggregate")

    monkeypatch.setattr(UserDeletionService, "delete_user_account", _boom)

    response = admin_client.delete(f"/api/v1/admin/models/user/{user_id}")

    assert response.status_code == 500

    db_session.rollback()
    db_session.expire_all()
    assert (
        db_session.query(Patient).filter(Patient.id == patient_id).first() is not None
    ), "patient was deleted even though the user delete failed"
    assert db_session.query(User).filter(User.id == user_id).first() is not None
    assert (
        db_session.query(ActivityLog)
        .filter(
            ActivityLog.action == ActionType.DELETED,
            ActivityLog.entity_type == "user",
            ActivityLog.entity_id == user_id,
        )
        .first()
        is None
    ), "the audit entry for a delete that rolled back must not be kept"


@pytest.mark.parametrize("through_admin", [False, True])
def test_delete_user_cleans_all_patients_shares_invitations_and_tags(
    admin_client, db_session, test_user, test_admin_user, test_patient, through_admin
):
    from app.models.models import (
        FamilyHistoryShare,
        FamilyMember,
        Invitation,
        PatientShare,
        UserTag,
    )

    user_id = test_user.id
    extra = _other_patient(db_session, test_user, "Family")
    kept = _other_patient(db_session, test_admin_user, "Kept")
    db_session.add_all(
        [
            PatientShare(
                patient_id=test_patient.id,
                shared_by_user_id=user_id,
                shared_with_user_id=test_admin_user.id,
                permission_level="view",
            ),
            PatientShare(
                patient_id=kept.id,
                shared_by_user_id=test_admin_user.id,
                shared_with_user_id=user_id,
                permission_level="view",
            ),
            UserTag(user_id=user_id, tag="cleanup"),
        ]
    )
    family_member = FamilyMember(
        patient_id=kept.id, name="Relative", relationship="parent"
    )
    db_session.add(family_member)
    db_session.flush()
    for sender, recipient in [
        (user_id, test_admin_user.id),
        (test_admin_user.id, user_id),
    ]:
        invitation = Invitation(
            sent_by_user_id=sender,
            sent_to_user_id=recipient,
            invitation_type="family_history_share",
            title="Share",
            context_data={},
        )
        db_session.add(invitation)
        db_session.flush()
        db_session.add(
            FamilyHistoryShare(
                invitation_id=invitation.id,
                family_member_id=family_member.id,
                shared_by_user_id=sender,
                shared_with_user_id=recipient,
            )
        )
    test_admin_user.active_patient_id = extra.id
    deleted_ids = [test_patient.id, extra.id]
    kept_id = kept.id
    db_session.commit()
    assert len(test_user.shared_patients_by_me) == 1
    assert len(test_user.shared_patients_with_me) == 1

    if through_admin:
        response = admin_client.delete(f"/api/v1/admin/models/user/{user_id}")
        assert response.status_code == 200, response.text
    else:
        stats = UserDeletionService().delete_user_account(db_session, user_id)
        assert stats["deleted_records"]["patient"] == 2
        db_session.commit()
    db_session.expire_all()
    assert db_session.query(User).filter(User.id == user_id).count() == 0
    assert db_session.query(Patient).filter(Patient.id.in_(deleted_ids)).count() == 0
    assert db_session.query(Patient).filter(Patient.id == kept_id).count() == 1
    assert db_session.query(PatientShare).count() == 0
    assert db_session.query(FamilyHistoryShare).count() == 0
    assert db_session.query(Invitation).count() == 0
    assert db_session.query(UserTag).count() == 0
    assert db_session.get(User, test_admin_user.id).active_patient_id is None


def test_admin_patient_delete_clears_active_patient_references(
    admin_client, db_session, test_user, test_patient
):
    patient_id = test_patient.id
    db_session.commit()
    response = admin_client.delete(f"/api/v1/admin/models/patient/{patient_id}")
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert db_session.get(User, test_user.id).active_patient_id is None
    assert db_session.get(Patient, patient_id) is None


def _patient_log(db_session: Session, user_id: int, patient_id: int) -> int:
    log = ActivityLog(
        user_id=user_id,
        patient_id=patient_id,
        action=ActionType.CREATED,
        entity_type=EntityType.MEDICATION,
        entity_id=None,
        description="medication added",
    )
    db_session.add(log)
    db_session.commit()
    return log.id


def test_admin_patient_delete_keeps_activity_history(
    admin_client, db_session, test_user, test_patient
):
    patient_id = test_patient.id
    log_id = _patient_log(db_session, test_user.id, patient_id)

    response = admin_client.delete(f"/api/v1/admin/models/patient/{patient_id}")
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert db_session.get(Patient, patient_id) is None
    kept = db_session.get(ActivityLog, log_id)
    assert kept is not None
    assert kept.patient_id is None


def test_admin_bulk_patient_delete_keeps_activity_history(
    admin_client, db_session, test_user, test_admin_user, test_patient
):
    second = _other_patient(db_session, test_user, "Second")
    bystander = _other_patient(db_session, test_admin_user, "Bystander")
    deleted_ids = [test_patient.id, second.id]
    deleted_logs = [_patient_log(db_session, test_user.id, pid) for pid in deleted_ids]
    bystander_log = _patient_log(db_session, test_admin_user.id, bystander.id)
    bystander_id = bystander.id

    response = admin_client.post(
        "/api/v1/admin/bulk/delete",
        json={"model_name": "patient", "record_ids": deleted_ids},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["failed_records"] == []
    assert body["affected_records"] == 2

    db_session.expire_all()
    for patient_id, log_id in zip(deleted_ids, deleted_logs):
        assert db_session.get(Patient, patient_id) is None
        assert db_session.get(ActivityLog, log_id).patient_id is None
    assert db_session.get(ActivityLog, bystander_log).patient_id == bystander_id

    audited = {
        row.entity_id
        for row in db_session.query(ActivityLog).filter(
            ActivityLog.action == ActionType.DELETED,
            ActivityLog.entity_type == "patient",
            ActivityLog.user_id == test_admin_user.id,
        )
    }
    assert audited == set(deleted_ids)


def test_admin_bulk_delete_failure_does_not_block_later_records(
    admin_client, db_session, test_user, test_patient, monkeypatch
):
    second = _other_patient(db_session, test_user, "Second")
    first_id, second_id = test_patient.id, second.id
    real_detach = activity_log.detach_patient_activity

    def detach_failing_first(db, *, patient_ids):
        if patient_ids == [first_id]:
            # A failed flush leaves the session unusable until it is rolled back
            db.add(ActivityLog(action=None, entity_type="patient", description="x"))
            db.flush()
        return real_detach(db, patient_ids=patient_ids)

    monkeypatch.setattr(activity_log, "detach_patient_activity", detach_failing_first)

    response = admin_client.post(
        "/api/v1/admin/bulk/delete",
        json={"model_name": "patient", "record_ids": [first_id, second_id]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["failed_records"] == [first_id]

    db_session.expire_all()
    assert db_session.get(Patient, first_id) is not None
    assert db_session.get(Patient, second_id) is None


def test_delete_my_patient_record_keeps_activity_history(
    authenticated_client, db_session, test_user, test_patient
):
    patient_id = test_patient.id
    log_id = _patient_log(db_session, test_user.id, patient_id)

    response = authenticated_client.delete("/api/v1/patients/me")
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert db_session.get(Patient, patient_id) is None
    assert db_session.get(ActivityLog, log_id).patient_id is None


def test_detach_patient_activity_with_no_ids_changes_nothing(
    db_session, test_user, test_patient
):
    log_id = _patient_log(db_session, test_user.id, test_patient.id)
    assert activity_log.detach_patient_activity(db_session, patient_ids=[]) == 0
    db_session.expire_all()
    assert db_session.get(ActivityLog, log_id).patient_id == test_patient.id


def test_noncommitting_crud_delete_does_not_rollback_caller(db_session, test_user):
    from app.crud.patient import patient

    test_user.full_name = "Caller change"
    db_session.flush()
    with pytest.raises(ValueError):
        patient.delete(db_session, id=9999999, commit=False)
    db_session.commit()
    db_session.refresh(test_user)
    assert test_user.full_name == "Caller change"


@pytest.mark.parametrize("through_admin", [False, True])
def test_delete_user_who_uploaded_photo_to_another_owners_patient(
    admin_client, db_session: Session, test_user, test_admin_user, through_admin
):
    """Issue #1285: a photo uploaded with shared edit access must not block the delete."""
    db_session.commit()
    user_id = test_user.id
    other_patient = _other_patient(db_session, test_admin_user, "PhotoOwner")
    photo = PatientPhoto(
        patient_id=other_patient.id,
        file_name="photo.jpg",
        file_path="uploads/photos/photo.jpg",
        uploaded_by=user_id,
    )
    db_session.add(photo)
    db_session.commit()
    photo_id = photo.id

    if through_admin:
        response = admin_client.delete(f"/api/v1/admin/models/user/{user_id}")
        assert response.status_code == 200
    else:
        stats = UserDeletionService().delete_user_account(db_session, user_id)
        db_session.commit()
        assert stats["deleted_records"]["patient_photos_updated"] == 1

    db_session.expire_all()
    assert db_session.query(User).filter(User.id == user_id).first() is None
    kept = db_session.query(PatientPhoto).filter(PatientPhoto.id == photo_id).first()
    assert kept is not None
    assert kept.patient_id == other_patient.id
    assert kept.uploaded_by is None
