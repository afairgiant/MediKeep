"""
Unit tests for physician validation in PatientManagementService.
"""

import pytest

from app.models.models import Patient, Practitioner, User
from app.services.patient_management import PatientManagementService


class TestValidatePhysician:
    """Regression tests for #995: an unknown physician must fail before the flush."""

    @pytest.fixture
    def service(self, db_session):
        return PatientManagementService(db_session)

    def test_update_rejects_unknown_physician(
        self,
        service: PatientManagementService,
        test_user: User,
        test_patient: Patient,
    ):
        with pytest.raises(ValueError, match="physician does not exist"):
            service.update_patient(test_user, test_patient.id, {"physician_id": 999999})

    def test_update_accepts_existing_physician(
        self,
        service: PatientManagementService,
        test_user: User,
        test_patient: Patient,
        test_practitioner: Practitioner,
    ):
        updated = service.update_patient(
            test_user, test_patient.id, {"physician_id": test_practitioner.id}
        )

        assert updated.physician_id == test_practitioner.id

    def test_update_accepts_null_physician(
        self,
        service: PatientManagementService,
        db_session,
        test_user: User,
        test_patient: Patient,
        test_practitioner: Practitioner,
    ):
        test_patient.physician_id = test_practitioner.id
        db_session.commit()

        updated = service.update_patient(
            test_user, test_patient.id, {"physician_id": None}
        )

        assert updated.physician_id is None

    def test_create_rejects_unknown_physician(
        self, service: PatientManagementService, test_user: User
    ):
        with pytest.raises(ValueError, match="physician does not exist"):
            service.create_patient(
                test_user,
                {
                    "first_name": "Unknown",
                    "last_name": "Physician",
                    "birth_date": "1990-01-01",
                    "physician_id": 999999,
                },
            )

    def test_create_accepts_existing_physician(
        self,
        service: PatientManagementService,
        test_user: User,
        test_practitioner: Practitioner,
    ):
        patient = service.create_patient(
            test_user,
            {
                "first_name": "Known",
                "last_name": "Physician",
                "birth_date": "1990-01-01",
                "physician_id": test_practitioner.id,
            },
        )

        assert patient.physician_id == test_practitioner.id
