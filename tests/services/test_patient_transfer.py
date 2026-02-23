"""
Unit tests for patient ownership transfer functionality in PatientManagementService.
"""
import pytest
from datetime import date

from app.models.models import User, Patient, PatientShare
from app.services.patient_management import PatientManagementService


class TestTransferPatientOwnership:
    """Test transfer_patient_ownership method"""

    @pytest.fixture
    def service(self, db_session):
        return PatientManagementService(db_session)

    @pytest.fixture
    def admin_user(self, db_session):
        user = User(
            username="admin_transfer",
            email="admin_transfer@example.com",
            password_hash="hashed",
            full_name="Admin Transfer",
            role="admin",
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def original_owner(self, db_session):
        user = User(
            username="original_owner",
            email="original@example.com",
            password_hash="hashed",
            full_name="Original Owner",
            role="user",
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def new_owner(self, db_session):
        user = User(
            username="new_owner",
            email="newowner@example.com",
            password_hash="hashed",
            full_name="New Owner",
            role="user",
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def dependent_patient(self, db_session, original_owner):
        """A non-self-record patient (e.g., a child) owned by original_owner."""
        patient = Patient(
            first_name="Child",
            last_name="Patient",
            birth_date=date(2010, 5, 15),
            gender="M",
            address="123 Main St",
            owner_user_id=original_owner.id,
            user_id=original_owner.id,
            is_self_record=False,
        )
        db_session.add(patient)
        db_session.commit()
        db_session.refresh(patient)
        return patient

    @pytest.fixture
    def self_record_patient(self, db_session, original_owner):
        """The original owner's self-record patient."""
        patient = Patient(
            first_name="Original",
            last_name="Owner",
            birth_date=date(1985, 3, 20),
            gender="F",
            blood_type="A+",
            height=165.0,
            weight=60.0,
            address="456 Oak Ave",
            owner_user_id=original_owner.id,
            user_id=original_owner.id,
            is_self_record=True,
        )
        db_session.add(patient)
        db_session.commit()
        db_session.refresh(patient)
        # Set as active patient
        original_owner.active_patient_id = patient.id
        db_session.commit()
        return patient

    def test_transfer_non_self_record(
        self, service, db_session, admin_user, original_owner, new_owner, dependent_patient
    ):
        """Transfer a non-self-record patient to new owner."""
        original_owner.active_patient_id = dependent_patient.id
        db_session.commit()

        result = service.transfer_patient_ownership(
            patient_id=dependent_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        assert result["patient_id"] == dependent_patient.id
        assert result["new_owner_id"] == new_owner.id
        assert result["original_owner_id"] == original_owner.id
        assert result["replacement_patient_id"] is None
        assert result["original_owner_has_edit_access"] is True

        # Verify patient ownership transferred
        db_session.refresh(dependent_patient)
        assert dependent_patient.owner_user_id == new_owner.id
        assert dependent_patient.user_id == new_owner.id
        assert dependent_patient.is_self_record is True

    def test_transfer_self_record_creates_replacement(
        self, service, db_session, admin_user, original_owner, new_owner, self_record_patient
    ):
        """Transfer a self-record creates replacement for original owner."""
        result = service.transfer_patient_ownership(
            patient_id=self_record_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        assert result["replacement_patient_id"] is not None

        # Verify replacement was created
        replacement = db_session.query(Patient).filter(
            Patient.id == result["replacement_patient_id"]
        ).first()
        assert replacement is not None
        assert replacement.owner_user_id == original_owner.id
        assert replacement.is_self_record is True
        assert replacement.first_name == "Original"
        assert replacement.last_name == "Owner"
        assert replacement.birth_date == date(1985, 3, 20)
        assert replacement.gender == "F"
        assert replacement.blood_type == "A+"

    def test_transfer_updates_original_owner_active_patient(
        self, service, db_session, admin_user, original_owner, new_owner, self_record_patient
    ):
        """Original owner's active_patient_id redirects to replacement."""
        assert original_owner.active_patient_id == self_record_patient.id

        result = service.transfer_patient_ownership(
            patient_id=self_record_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        db_session.refresh(original_owner)
        assert original_owner.active_patient_id == result["replacement_patient_id"]
        assert original_owner.active_patient_id != self_record_patient.id

    def test_transfer_creates_edit_share(
        self, service, db_session, admin_user, original_owner, new_owner, dependent_patient
    ):
        """Original owner gets edit access via PatientShare after transfer."""
        service.transfer_patient_ownership(
            patient_id=dependent_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        share = db_session.query(PatientShare).filter(
            PatientShare.patient_id == dependent_patient.id,
            PatientShare.shared_with_user_id == original_owner.id,
        ).first()

        assert share is not None
        assert share.permission_level == "edit"
        assert share.is_active is True
        assert share.shared_by_user_id == new_owner.id

    def test_transfer_sets_new_owner_active_patient(
        self, service, db_session, admin_user, original_owner, new_owner, dependent_patient
    ):
        """New owner gets the transferred patient as their active patient."""
        assert new_owner.active_patient_id is None

        service.transfer_patient_ownership(
            patient_id=dependent_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        db_session.refresh(new_owner)
        assert new_owner.active_patient_id == dependent_patient.id

    def test_transfer_patient_not_found(
        self, service, admin_user, new_owner
    ):
        """Error when transferring non-existent patient."""
        with pytest.raises(ValueError, match="Patient not found"):
            service.transfer_patient_ownership(
                patient_id=99999,
                new_owner=new_owner,
                admin_user=admin_user,
            )

    def test_transfer_reactivates_existing_inactive_share(
        self, service, db_session, admin_user, original_owner, new_owner, dependent_patient
    ):
        """Reactivates an existing inactive share instead of creating a duplicate."""
        # Create an existing inactive share
        existing_share = PatientShare(
            patient_id=dependent_patient.id,
            shared_by_user_id=original_owner.id,
            shared_with_user_id=original_owner.id,
            permission_level="view",
            is_active=False,
        )
        db_session.add(existing_share)
        db_session.commit()

        service.transfer_patient_ownership(
            patient_id=dependent_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        db_session.refresh(existing_share)
        assert existing_share.is_active is True
        assert existing_share.permission_level == "edit"
        assert existing_share.shared_by_user_id == new_owner.id

    def test_transfer_self_record_copies_demographics(
        self, service, db_session, admin_user, original_owner, new_owner, self_record_patient
    ):
        """Replacement self-record copies all demographic fields."""
        result = service.transfer_patient_ownership(
            patient_id=self_record_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        replacement = db_session.query(Patient).filter(
            Patient.id == result["replacement_patient_id"]
        ).first()

        assert replacement.first_name == self_record_patient.first_name
        assert replacement.last_name == self_record_patient.last_name
        assert replacement.birth_date == self_record_patient.birth_date
        assert replacement.gender == self_record_patient.gender
        assert replacement.blood_type == self_record_patient.blood_type
        assert replacement.height == self_record_patient.height
        assert replacement.weight == self_record_patient.weight
        assert replacement.address == self_record_patient.address

    def test_transfer_non_self_record_no_replacement(
        self, service, db_session, admin_user, original_owner, new_owner, dependent_patient
    ):
        """Non-self-record transfer does not create a replacement patient."""
        initial_count = db_session.query(Patient).count()

        service.transfer_patient_ownership(
            patient_id=dependent_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        # No new patient should be created (only existing patient transferred)
        final_count = db_session.query(Patient).count()
        assert final_count == initial_count

    def test_transfer_updates_active_to_other_patient_when_no_replacement(
        self, service, db_session, admin_user, original_owner, new_owner, dependent_patient
    ):
        """When transferring non-self-record, active patient redirects to another owned patient."""
        # Create another patient owned by original owner
        other_patient = Patient(
            first_name="Other",
            last_name="Patient",
            birth_date=date(2005, 1, 1),
            gender="F",
            owner_user_id=original_owner.id,
            user_id=original_owner.id,
            is_self_record=True,
        )
        db_session.add(other_patient)
        db_session.commit()

        original_owner.active_patient_id = dependent_patient.id
        db_session.commit()

        service.transfer_patient_ownership(
            patient_id=dependent_patient.id,
            new_owner=new_owner,
            admin_user=admin_user,
        )

        db_session.refresh(original_owner)
        assert original_owner.active_patient_id == other_patient.id
