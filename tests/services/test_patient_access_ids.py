"""PatientAccessService.accessible_patient_ids must allow exactly what can_access_patient allows."""

from datetime import date, timedelta, timezone

import pytest

from app.models.models import Patient, PatientShare, get_utc_now
from app.services.patient_access import PatientAccessService
from tests.utils.user import create_random_user

SHARE_CASES = {
    "view": {"permission_level": "view"},
    "edit": {"permission_level": "edit"},
    "full": {"permission_level": "full"},
    "inactive_edit": {"permission_level": "edit", "is_active": False},
    "private_edit": {"permission_level": "edit", "private": True},
}


def _patient(db_session, user_id, name):
    patient = Patient(
        user_id=user_id,
        owner_user_id=user_id,
        first_name=name,
        last_name="Patient",
        birth_date=date(1990, 1, 1),
        gender="F",
    )
    db_session.add(patient)
    db_session.flush()
    return patient


@pytest.mark.parametrize("permission", ["view", "edit", "full"])
def test_subquery_matches_can_access_patient(db_session, test_user, permission):
    owner = create_random_user(db_session)["user"]
    patients = [_patient(db_session, test_user.id, "Own")]
    for name, case in SHARE_CASES.items():
        patient = _patient(db_session, owner.id, name)
        if case.get("private"):
            patient.privacy_level = "private"
        db_session.add(
            PatientShare(
                patient_id=patient.id,
                shared_by_user_id=owner.id,
                shared_with_user_id=test_user.id,
                permission_level=case["permission_level"],
                is_active=case.get("is_active", True),
                expires_at=case.get("expires_at"),
            )
        )
        patients.append(patient)
    patients.append(_patient(db_session, owner.id, "Unshared"))
    db_session.commit()

    service = PatientAccessService(db_session)
    allowed = {
        row[0]
        for row in db_session.execute(
            PatientAccessService.accessible_patient_ids(test_user.id, permission)
        )
    }

    for patient in patients:
        expected = service.can_access_patient(test_user, patient, permission)
        assert (patient.id in allowed) == expected, patient.first_name


def _now_naive():
    return get_utc_now().astimezone(timezone.utc).replace(tzinfo=None)


@pytest.mark.parametrize(
    ("expires_at", "allowed"),
    [
        (lambda: _now_naive() - timedelta(days=1), False),
        (lambda: _now_naive() + timedelta(days=1), True),
    ],
    ids=["expired", "not_yet_expired"],
)
def test_subquery_applies_share_expiry(db_session, test_user, expires_at, allowed):
    owner = create_random_user(db_session)["user"]
    patient = _patient(db_session, owner.id, "Expiring")
    db_session.add(
        PatientShare(
            patient_id=patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=test_user.id,
            permission_level="edit",
            is_active=True,
            expires_at=expires_at(),
        )
    )
    db_session.commit()

    ids = {
        row[0]
        for row in db_session.execute(
            PatientAccessService.accessible_patient_ids(test_user.id, "edit")
        )
    }
    assert (patient.id in ids) == allowed
