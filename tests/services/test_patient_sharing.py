"""
Unit tests for PatientSharingService

Tests all service methods, custom exceptions, race condition handling,
and business logic for patient share invitations.
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.models import User, Patient, PatientShare, Invitation
from app.services.patient_sharing import PatientSharingService, MAX_BULK_PATIENTS
from app.exceptions.patient_sharing import (
    PatientNotFoundError,
    AlreadySharedError,
    PendingInvitationError,
    RecipientNotFoundError,
    InvalidPermissionLevelError,
    ShareNotFoundError,
    SelfShareError,
)
from app.core.utils.datetime_utils import get_utc_now


class TestCustomExceptions:
    """Test custom exception classes"""

    def test_patient_not_found_error(self):
        """Test PatientNotFoundError is raised correctly"""
        with pytest.raises(PatientNotFoundError) as exc_info:
            raise PatientNotFoundError("Patient not found")
        assert "Patient not found" in str(exc_info.value)

    def test_already_shared_error(self):
        """Test AlreadySharedError is raised correctly"""
        with pytest.raises(AlreadySharedError) as exc_info:
            raise AlreadySharedError("Already shared")
        assert "Already shared" in str(exc_info.value)

    def test_pending_invitation_error(self):
        """Test PendingInvitationError is raised correctly"""
        with pytest.raises(PendingInvitationError) as exc_info:
            raise PendingInvitationError("Pending invitation exists")
        assert "Pending invitation exists" in str(exc_info.value)

    def test_recipient_not_found_error(self):
        """Test RecipientNotFoundError is raised correctly"""
        with pytest.raises(RecipientNotFoundError) as exc_info:
            raise RecipientNotFoundError("Recipient not found")
        assert "Recipient not found" in str(exc_info.value)

    def test_invalid_permission_level_error(self):
        """Test InvalidPermissionLevelError is raised correctly"""
        with pytest.raises(InvalidPermissionLevelError) as exc_info:
            raise InvalidPermissionLevelError("Invalid permission")
        assert "Invalid permission" in str(exc_info.value)


class TestSendPatientShareInvitation:
    """Test send_patient_share_invitation method"""

    @pytest.fixture
    def service(self, db_session):
        """Create service instance"""
        return PatientSharingService(db_session)

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        user = User(
            username="owner",
            email="owner@example.com",
            password_hash="hashed",
            full_name="Owner User",
            role="user"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        user = User(
            username="recipient",
            email="recipient@example.com",
            password_hash="hashed",
            full_name="Recipient User",
            role="user"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def patient(self, db_session, owner):
        """Create patient owned by owner"""
        from datetime import date
        patient = Patient(
            user_id=owner.id,
            owner_user_id=owner.id,
            first_name="Test",
            last_name="Patient",
            birth_date=date(1990, 1, 1),
            gender="M"
        )
        db_session.add(patient)
        db_session.commit()
        db_session.refresh(patient)
        return patient

    @pytest.mark.asyncio
    async def test_send_invitation_success(self, service, owner, recipient, patient):
        """Test successfully sending patient share invitation"""
        invitation = await service.send_patient_share_invitation(
            owner=owner,
            patient_id=patient.id,
            shared_with_identifier=recipient.username,
            permission_level='view',
            message="Please access my medical records"
        )

        assert invitation is not None
        assert invitation.invitation_type == 'patient_share'
        assert invitation.sent_by_user_id == owner.id
        assert invitation.sent_to_user_id == recipient.id
        assert invitation.status == 'pending'
        assert invitation.context_data['patient_id'] == patient.id
        assert invitation.context_data['permission_level'] == 'view'
        assert invitation.context_data['patient_name'] == f"{patient.first_name} {patient.last_name}"

    @pytest.mark.asyncio
    async def test_send_invitation_with_email(self, service, owner, recipient, patient):
        """Test sending invitation using email instead of username"""
        invitation = await service.send_patient_share_invitation(
            owner=owner,
            patient_id=patient.id,
            shared_with_identifier=recipient.email,
            permission_level='edit'
        )

        assert invitation.sent_to_user_id == recipient.id

    @pytest.mark.asyncio
    async def test_send_invitation_patient_not_found(self, service, owner, recipient):
        """Test sending invitation for non-existent patient"""
        with pytest.raises(PatientNotFoundError):
            await service.send_patient_share_invitation(
                owner=owner,
                patient_id=99999,
                shared_with_identifier=recipient.username,
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_send_invitation_patient_not_owned(self, service, db_session, owner, recipient, patient):
        """Test sending invitation for patient not owned by user"""
        # Create another user who tries to share someone else's patient
        other_user = User(
            username="other",
            email="other@example.com",
            password_hash="hashed",
            full_name="Other User",
            role="user"
        )
        db_session.add(other_user)
        db_session.commit()

        with pytest.raises(PatientNotFoundError):
            await service.send_patient_share_invitation(
                owner=other_user,
                patient_id=patient.id,
                shared_with_identifier=recipient.username,
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_send_invitation_recipient_not_found(self, service, owner, patient):
        """Test sending invitation to non-existent user"""
        with pytest.raises(RecipientNotFoundError):
            await service.send_patient_share_invitation(
                owner=owner,
                patient_id=patient.id,
                shared_with_identifier="nonexistent@example.com",
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_send_invitation_cannot_share_with_self(self, service, owner, patient):
        """Test that user cannot share patient with themselves"""
        with pytest.raises(SelfShareError):
            await service.send_patient_share_invitation(
                owner=owner,
                patient_id=patient.id,
                shared_with_identifier=owner.username,
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_send_invitation_already_shared(self, service, db_session, owner, recipient, patient):
        """Test sending invitation when patient is already shared"""
        # Create existing active share
        share = PatientShare(
            patient_id=patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level='view',
            is_active=True
        )
        db_session.add(share)
        db_session.commit()

        with pytest.raises(AlreadySharedError):
            await service.send_patient_share_invitation(
                owner=owner,
                patient_id=patient.id,
                shared_with_identifier=recipient.username,
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_send_invitation_pending_invitation_exists(self, service, db_session, owner, recipient, patient):
        """Test sending invitation when pending invitation already exists"""
        # Create pending invitation
        invitation = Invitation(
            sent_by_user_id=owner.id,
            sent_to_user_id=recipient.id,
            invitation_type='patient_share',
            status='pending',
            title='Test',
            context_data={'patient_id': patient.id}
        )
        db_session.add(invitation)
        db_session.commit()

        with pytest.raises(PendingInvitationError):
            await service.send_patient_share_invitation(
                owner=owner,
                patient_id=patient.id,
                shared_with_identifier=recipient.username,
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_send_invitation_invalid_permission_level(self, service, owner, recipient, patient):
        """Test sending invitation with invalid permission level"""
        with pytest.raises(InvalidPermissionLevelError):
            await service.send_patient_share_invitation(
                owner=owner,
                patient_id=patient.id,
                shared_with_identifier=recipient.username,
                permission_level='invalid'
            )

    @pytest.mark.asyncio
    async def test_send_invitation_with_custom_permissions(self, service, owner, recipient, patient):
        """Test sending invitation with custom permissions"""
        custom_perms = {"can_view_labs": True, "can_edit_medications": False}
        invitation = await service.send_patient_share_invitation(
            owner=owner,
            patient_id=patient.id,
            shared_with_identifier=recipient.username,
            permission_level='view',
            custom_permissions=custom_perms
        )

        assert invitation.context_data['custom_permissions'] == custom_perms

    @pytest.mark.asyncio
    async def test_send_invitation_with_expiration(self, service, owner, recipient, patient):
        """Test sending invitation with share expiration date"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        invitation = await service.send_patient_share_invitation(
            owner=owner,
            patient_id=patient.id,
            shared_with_identifier=recipient.username,
            permission_level='view',
            expires_at=expires_at
        )

        assert invitation.context_data['expires_at'] is not None


class TestAcceptPatientShareInvitation:
    """Test accept_patient_share_invitation method"""

    @pytest.fixture
    def service(self, db_session):
        """Create service instance"""
        return PatientSharingService(db_session)

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        user = User(
            username="owner",
            email="owner@example.com",
            password_hash="hashed",
            full_name="Owner User",
            role="user"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        user = User(
            username="recipient",
            email="recipient@example.com",
            password_hash="hashed",
            full_name="Recipient User",
            role="user"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def patient(self, db_session, owner):
        """Create patient owned by owner"""
        from datetime import date
        patient = Patient(
            user_id=owner.id,
            owner_user_id=owner.id,
            first_name="Test",
            last_name="Patient",
            birth_date=date(1990, 1, 1),
            gender="M"
        )
        db_session.add(patient)
        db_session.commit()
        db_session.refresh(patient)
        return patient

    @pytest.fixture
    def pending_invitation(self, db_session, owner, recipient, patient):
        """Create pending patient share invitation"""
        invitation = Invitation(
            sent_by_user_id=owner.id,
            sent_to_user_id=recipient.id,
            invitation_type='patient_share',
            status='pending',
            title=f"Patient Share: {patient.first_name} {patient.last_name}",
            context_data={
                'patient_id': patient.id,
                'patient_name': f"{patient.first_name} {patient.last_name}",
                'permission_level': 'view'
            },
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db_session.add(invitation)
        db_session.commit()
        db_session.refresh(invitation)
        return invitation

    def test_accept_invitation_success(self, service, recipient, pending_invitation, patient, owner):
        """Test successfully accepting patient share invitation"""
        share = service.accept_patient_share_invitation(
            user=recipient,
            invitation_id=pending_invitation.id
        )

        assert share is not None
        assert share.patient_id == patient.id
        assert share.shared_by_user_id == owner.id
        assert share.shared_with_user_id == recipient.id
        assert share.permission_level == 'view'
        assert share.is_active is True
        assert share.invitation_id == pending_invitation.id

        # Verify invitation status updated
        assert pending_invitation.status == 'accepted'
        assert pending_invitation.responded_at is not None

    def test_accept_invitation_with_response_note(self, service, recipient, pending_invitation):
        """Test accepting invitation with response note"""
        share = service.accept_patient_share_invitation(
            user=recipient,
            invitation_id=pending_invitation.id,
            response_note="Thank you for sharing"
        )

        assert share is not None
        assert pending_invitation.response_note == "Thank you for sharing"

    def test_accept_invitation_not_found(self, service, recipient):
        """Test accepting non-existent invitation"""
        with pytest.raises(ValueError, match="Invitation not found"):
            service.accept_patient_share_invitation(
                user=recipient,
                invitation_id=99999
            )

    def test_accept_invitation_already_accepted(self, service, db_session, recipient, pending_invitation):
        """Test accepting already accepted invitation"""
        pending_invitation.status = 'accepted'
        db_session.commit()

        with pytest.raises(ValueError, match="not found or not pending"):
            service.accept_patient_share_invitation(
                user=recipient,
                invitation_id=pending_invitation.id
            )

    def test_accept_invitation_expired(self, service, db_session, recipient, pending_invitation):
        """Test accepting expired invitation"""
        # Set invitation to be expired
        pending_invitation.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db_session.commit()

        with pytest.raises(ValueError, match="expired"):
            service.accept_patient_share_invitation(
                user=recipient,
                invitation_id=pending_invitation.id
            )

        # Verify status was updated to expired
        assert pending_invitation.status == 'expired'

    def test_accept_invitation_wrong_recipient(self, service, db_session, pending_invitation):
        """Test accepting invitation by wrong user"""
        other_user = User(
            username="other",
            email="other@example.com",
            password_hash="hashed",
            full_name="Other User",
            role="user"
        )
        db_session.add(other_user)
        db_session.commit()

        with pytest.raises(ValueError, match="not found or not pending"):
            service.accept_patient_share_invitation(
                user=other_user,
                invitation_id=pending_invitation.id
            )

    def test_accept_invitation_missing_patient_id(self, service, db_session, recipient, owner):
        """Test accepting invitation with invalid context data"""
        invitation = Invitation(
            sent_by_user_id=owner.id,
            sent_to_user_id=recipient.id,
            invitation_type='patient_share',
            status='pending',
            title='Invalid Invitation',
            context_data={}  # Missing patient_id
        )
        db_session.add(invitation)
        db_session.commit()

        with pytest.raises(ValueError, match="missing patient_id"):
            service.accept_patient_share_invitation(
                user=recipient,
                invitation_id=invitation.id
            )

    def test_accept_invitation_race_condition(self, service, db_session, recipient, pending_invitation, patient, owner):
        """
        CRITICAL: Test race condition handling
        A concurrent request already created the share; the second acceptance
        should catch the IntegrityError and return the existing share gracefully.
        """
        # Simulate a concurrent request having already created the share
        # before this acceptance attempt arrives
        existing_share = PatientShare(
            patient_id=patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level='view',
            is_active=True
        )
        db_session.add(existing_share)
        db_session.commit()

        # Acceptance should handle the IntegrityError from the unique constraint
        # and return the already-existing share rather than raising
        share = service.accept_patient_share_invitation(
            user=recipient,
            invitation_id=pending_invitation.id
        )

        # Should return existing share, not fail
        assert share is not None
        assert share.patient_id == patient.id
        assert share.shared_with_user_id == recipient.id


class TestBulkSendPatientShareInvitations:
    """Test bulk_send_patient_share_invitations method"""

    @pytest.fixture
    def service(self, db_session):
        """Create service instance"""
        return PatientSharingService(db_session)

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        user = User(
            username="owner",
            email="owner@example.com",
            password_hash="hashed",
            full_name="Owner User",
            role="user"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        user = User(
            username="recipient",
            email="recipient@example.com",
            password_hash="hashed",
            full_name="Recipient User",
            role="user"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def patients(self, db_session, owner):
        """Create multiple patients owned by owner"""
        from datetime import date
        patients = []
        for i in range(5):
            patient = Patient(
                user_id=owner.id,
                owner_user_id=owner.id,
                first_name=f"Patient{i}",
                last_name=f"Test{i}",
                birth_date=date(1990, 1, 1),
                gender="M"
            )
            db_session.add(patient)
            patients.append(patient)
        db_session.commit()
        for p in patients:
            db_session.refresh(p)
        return patients

    @pytest.mark.asyncio
    async def test_bulk_send_success(self, service, owner, recipient, patients):
        """Test successfully sending bulk patient share invitation"""
        patient_ids = [p.id for p in patients]
        result = await service.bulk_send_patient_share_invitations(
            owner=owner,
            patient_ids=patient_ids,
            shared_with_identifier=recipient.username,
            permission_level='view'
        )

        assert result['patient_count'] == 5
        assert result['invitation_id'] is not None

    @pytest.mark.asyncio
    async def test_bulk_send_creates_one_invitation(self, service, db_session, owner, recipient, patients):
        """Test bulk send creates single invitation for multiple patients"""
        patient_ids = [p.id for p in patients]
        result = await service.bulk_send_patient_share_invitations(
            owner=owner,
            patient_ids=patient_ids,
            shared_with_identifier=recipient.username,
            permission_level='view'
        )

        # Verify only one invitation was created
        invitation = db_session.query(Invitation).filter(
            Invitation.id == result['invitation_id']
        ).first()

        assert invitation is not None
        assert invitation.context_data['is_bulk_invite'] is True
        assert invitation.context_data['patient_count'] == 5
        assert len(invitation.context_data['patients']) == 5

    @pytest.mark.asyncio
    async def test_bulk_send_patient_not_owned(self, service, db_session, owner, recipient, patients):
        """Test bulk send with patient not owned by user"""
        other_user = User(
            username="other",
            email="other@example.com",
            password_hash="hashed",
            full_name="Other User",
            role="user"
        )
        db_session.add(other_user)
        db_session.commit()

        from datetime import date
        other_patient = Patient(
            user_id=other_user.id,
            owner_user_id=other_user.id,
            first_name="Other",
            last_name="Patient",
            birth_date=date(1990, 1, 1),
            gender="F"
        )
        db_session.add(other_patient)
        db_session.commit()

        patient_ids = [patients[0].id, other_patient.id]

        with pytest.raises(PatientNotFoundError):
            await service.bulk_send_patient_share_invitations(
                owner=owner,
                patient_ids=patient_ids,
                shared_with_identifier=recipient.username,
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_bulk_send_already_shared(self, service, db_session, owner, recipient, patients):
        """Test bulk send when one patient is already shared"""
        # Create existing share for first patient
        share = PatientShare(
            patient_id=patients[0].id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level='view',
            is_active=True
        )
        db_session.add(share)
        db_session.commit()

        patient_ids = [p.id for p in patients]

        with pytest.raises(AlreadySharedError):
            await service.bulk_send_patient_share_invitations(
                owner=owner,
                patient_ids=patient_ids,
                shared_with_identifier=recipient.username,
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_bulk_send_invalid_permission_level(self, service, owner, recipient, patients):
        """Test bulk send with invalid permission level"""
        patient_ids = [p.id for p in patients]

        with pytest.raises(InvalidPermissionLevelError):
            await service.bulk_send_patient_share_invitations(
                owner=owner,
                patient_ids=patient_ids,
                shared_with_identifier=recipient.username,
                permission_level='superuser'
            )

    @pytest.mark.asyncio
    async def test_bulk_send_recipient_not_found(self, service, owner, patients):
        """Test bulk send with non-existent recipient"""
        patient_ids = [p.id for p in patients]

        with pytest.raises(RecipientNotFoundError):
            await service.bulk_send_patient_share_invitations(
                owner=owner,
                patient_ids=patient_ids,
                shared_with_identifier="nonexistent@example.com",
                permission_level='view'
            )

    @pytest.mark.asyncio
    async def test_bulk_send_cannot_share_with_self(self, service, owner, patients):
        """Test bulk send to self is not allowed"""
        patient_ids = [p.id for p in patients]

        with pytest.raises(SelfShareError):
            await service.bulk_send_patient_share_invitations(
                owner=owner,
                patient_ids=patient_ids,
                shared_with_identifier=owner.username,
                permission_level='view'
            )


class TestOtherServiceMethods:
    """Test other service methods like revoke, update, etc."""

    @pytest.fixture
    def service(self, db_session):
        """Create service instance"""
        return PatientSharingService(db_session)

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        user = User(
            username="owner",
            email="owner@example.com",
            password_hash="hashed",
            full_name="Owner User",
            role="user"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        user = User(
            username="recipient",
            email="recipient@example.com",
            password_hash="hashed",
            full_name="Recipient User",
            role="user"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def patient(self, db_session, owner):
        """Create patient owned by owner"""
        from datetime import date
        patient = Patient(
            user_id=owner.id,
            owner_user_id=owner.id,
            first_name="Test",
            last_name="Patient",
            birth_date=date(1990, 1, 1),
            gender="M"
        )
        db_session.add(patient)
        db_session.commit()
        db_session.refresh(patient)
        return patient

    @pytest.fixture
    def active_share(self, db_session, owner, recipient, patient):
        """Create active patient share"""
        share = PatientShare(
            patient_id=patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level='view',
            is_active=True
        )
        db_session.add(share)
        db_session.commit()
        db_session.refresh(share)
        return share

    @pytest.mark.asyncio
    async def test_revoke_share_success(self, service, owner, patient, recipient, active_share):
        """Test successfully revoking patient share"""
        result = await service.revoke_patient_share(
            owner=owner,
            patient_id=patient.id,
            shared_with_user_id=recipient.id
        )

        assert result is True
        assert active_share.is_active is False

    @pytest.mark.asyncio
    async def test_revoke_share_updates_invitation_status(self, service, db_session, owner, patient, recipient):
        """Test revoking share also updates invitation status"""
        # Create invitation
        invitation = Invitation(
            sent_by_user_id=owner.id,
            sent_to_user_id=recipient.id,
            invitation_type='patient_share',
            status='accepted',
            title='Test',
            context_data={'patient_id': patient.id}
        )
        db_session.add(invitation)
        db_session.commit()

        # Create share with invitation link
        share = PatientShare(
            patient_id=patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level='view',
            is_active=True,
            invitation_id=invitation.id
        )
        db_session.add(share)
        db_session.commit()

        # Revoke
        await service.revoke_patient_share(owner, patient.id, recipient.id)

        assert share.is_active is False
        assert invitation.status == 'revoked'

    @pytest.mark.asyncio
    async def test_revoke_share_no_active_share(self, service, owner, patient, recipient):
        """Test revoking when no active share exists"""
        result = await service.revoke_patient_share(
            owner=owner,
            patient_id=patient.id,
            shared_with_user_id=recipient.id
        )

        assert result is False

    def test_cleanup_expired_shares(self, service, db_session, owner, recipient, patient):
        """Test cleanup of expired shares"""
        # Create expired share
        expired_share = PatientShare(
            patient_id=patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level='view',
            is_active=True,
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        db_session.add(expired_share)
        db_session.commit()

        count = service.cleanup_expired_shares()

        assert count == 1
        assert expired_share.is_active is False
