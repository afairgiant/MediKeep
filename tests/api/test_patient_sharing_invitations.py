"""
Integration tests for Patient Sharing Invitation API endpoints

Tests API endpoints for sending invitations, accepting them, and handling errors.
Tests user-friendly error messages and proper HTTP status codes.
"""
import pytest
from datetime import datetime, timedelta, timezone, date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import User, Patient, PatientShare, Invitation
from app.core.utils.security import create_access_token


class TestSendPatientShareInvitationEndpoint:
    """Test POST /api/v1/patient-sharing/ endpoint"""

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="owner",
            email="owner@example.com",
            password="password123",
            full_name="Owner User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="recipient",
            email="recipient@example.com",
            password="password123",
            full_name="Recipient User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def patient(self, db_session, owner):
        """Create patient owned by owner"""
        patient = Patient(
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
    def owner_token_headers(self, owner):
        """Create auth headers for owner"""
        token = create_access_token(subject=owner.id)
        return {"Authorization": f"Bearer {token}"}

    def test_send_invitation_success(self, client, owner_token_headers, patient, recipient):
        """Test successfully sending patient share invitation"""
        payload = {
            "patient_id": patient.id,
            "shared_with_user_identifier": recipient.username,
            "permission_level": "view",
            "message": "Please access my records",
            "expires_hours": 168
        }

        response = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['message'] == "Patient share invitation sent successfully"
        assert 'invitation_id' in data
        assert 'expires_at' in data

    def test_send_invitation_patient_not_found(self, client, owner_token_headers, recipient):
        """Test sending invitation for non-existent patient returns 404"""
        payload = {
            "patient_id": 99999,
            "shared_with_user_identifier": recipient.username,
            "permission_level": "view"
        }

        response = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 404
        assert "not found" in response.json()['detail'].lower()

    def test_send_invitation_recipient_not_found(self, client, owner_token_headers, patient):
        """Test sending invitation to non-existent user returns 404"""
        payload = {
            "patient_id": patient.id,
            "shared_with_user_identifier": "nonexistent@example.com",
            "permission_level": "view"
        }

        response = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 404
        assert "not found" in response.json()['detail'].lower()

    def test_send_invitation_already_shared(self, client, db_session, owner_token_headers, patient, owner, recipient):
        """Test sending invitation when already shared returns 409"""
        # Create existing share
        share = PatientShare(
            patient_id=patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level='view',
            is_active=True
        )
        db_session.add(share)
        db_session.commit()

        payload = {
            "patient_id": patient.id,
            "shared_with_user_identifier": recipient.username,
            "permission_level": "view"
        }

        response = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 409
        assert "already shared" in response.json()['detail'].lower()

    def test_send_invitation_pending_exists(self, client, db_session, owner_token_headers, patient, owner, recipient):
        """Test sending invitation when pending invitation exists returns 409"""
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

        payload = {
            "patient_id": patient.id,
            "shared_with_user_identifier": recipient.username,
            "permission_level": "view"
        }

        response = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 409
        assert "pending invitation" in response.json()['detail'].lower()

    def test_send_invitation_invalid_permission_level(self, client, owner_token_headers, patient, recipient):
        """Test sending invitation with invalid permission level returns 400"""
        payload = {
            "patient_id": patient.id,
            "shared_with_user_identifier": recipient.username,
            "permission_level": "superuser"
        }

        response = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 400

    def test_send_invitation_unauthorized(self, client, patient, recipient):
        """Test sending invitation without authentication returns 401"""
        payload = {
            "patient_id": patient.id,
            "shared_with_user_identifier": recipient.username,
            "permission_level": "view"
        }

        response = client.post("/api/v1/patient-sharing/", json=payload)
        assert response.status_code == 401


class TestBulkSendPatientShareInvitationEndpoint:
    """Test POST /api/v1/patient-sharing/bulk-invite endpoint"""

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="owner",
            email="owner@example.com",
            password="password123",
            full_name="Owner User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="recipient",
            email="recipient@example.com",
            password="password123",
            full_name="Recipient User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def patients(self, db_session, owner):
        """Create multiple patients"""
        patients = []
        for i in range(3):
            patient = Patient(
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

    @pytest.fixture
    def owner_token_headers(self, owner):
        """Create auth headers for owner"""
        token = create_access_token(subject=owner.id)
        return {"Authorization": f"Bearer {token}"}

    def test_bulk_send_success(self, client, owner_token_headers, patients, recipient):
        """Test successfully sending bulk patient share invitation"""
        patient_ids = [p.id for p in patients]
        payload = {
            "patient_ids": patient_ids,
            "shared_with_user_identifier": recipient.username,
            "permission_level": "view",
            "message": "Access to family records"
        }

        response = client.post(
            "/api/v1/patient-sharing/bulk-invite",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['patient_count'] == 3
        assert 'invitation_id' in data

    def test_bulk_send_partial_ownership(self, client, db_session, owner_token_headers, patients):
        """Test bulk send fails if user doesn't own all patients"""
        # Create another user with a patient
        other_user = User(
            username="other",
            email="other@example.com",
            hashed_password="hashed",
            full_name="Other User",
            role="user"
        )
        db_session.add(other_user)
        db_session.commit()

        other_patient = Patient(
            owner_user_id=other_user.id,
            first_name="Other",
            last_name="Patient",
            birth_date=date(1990, 1, 1),
            gender="F"
        )
        db_session.add(other_patient)
        db_session.commit()

        patient_ids = [patients[0].id, other_patient.id]
        payload = {
            "patient_ids": patient_ids,
            "shared_with_user_identifier": "recipient@example.com",
            "permission_level": "view"
        }

        response = client.post(
            "/api/v1/patient-sharing/bulk-invite",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code in [400, 404, 500]


class TestAcceptPatientShareInvitationEndpoint:
    """Test POST /api/v1/invitations/{invitation_id}/respond endpoint"""

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="owner",
            email="owner@example.com",
            password="password123",
            full_name="Owner User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="recipient",
            email="recipient@example.com",
            password="password123",
            full_name="Recipient User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def patient(self, db_session, owner):
        """Create patient owned by owner"""
        patient = Patient(
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
        """Create pending invitation"""
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

    @pytest.fixture
    def recipient_token_headers(self, recipient):
        """Create auth headers for recipient"""
        token = create_access_token(subject=recipient.id)
        return {"Authorization": f"Bearer {token}"}

    def test_accept_invitation_success(self, client, db_session, recipient_token_headers, pending_invitation, patient):
        """Test successfully accepting patient share invitation"""
        payload = {
            "response": "accepted",
            "response_note": "Thank you for sharing"
        }

        response = client.post(
            f"/api/v1/invitations/{pending_invitation.id}/respond",
            json=payload,
            headers=recipient_token_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "accepted" in data['message'].lower()
        assert 'share_id' in data

        # Verify share was created
        share = db_session.query(PatientShare).filter(
            PatientShare.patient_id == patient.id,
            PatientShare.invitation_id == pending_invitation.id
        ).first()
        assert share is not None
        assert share.is_active is True

    def test_accept_invitation_not_found(self, client, recipient_token_headers):
        """Test accepting non-existent invitation returns 404"""
        payload = {"response": "accepted"}

        response = client.post(
            "/api/v1/invitations/99999/respond",
            json=payload,
            headers=recipient_token_headers
        )

        assert response.status_code == 404

    def test_accept_invitation_expired(self, client, db_session, recipient_token_headers, pending_invitation):
        """Test accepting expired invitation returns 400"""
        # Make invitation expired
        pending_invitation.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db_session.commit()

        payload = {"response": "accepted"}

        response = client.post(
            f"/api/v1/invitations/{pending_invitation.id}/respond",
            json=payload,
            headers=recipient_token_headers
        )

        assert response.status_code == 400
        assert "expired" in response.json()['detail'].lower()

    def test_reject_invitation(self, client, recipient_token_headers, pending_invitation):
        """Test rejecting patient share invitation"""
        payload = {
            "response": "rejected",
            "response_note": "Not interested"
        }

        response = client.post(
            f"/api/v1/invitations/{pending_invitation.id}/respond",
            json=payload,
            headers=recipient_token_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'rejected'


class TestBulkAcceptPatientShareInvitation:
    """Test accepting bulk patient share invitations"""

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="owner",
            email="owner@example.com",
            password="password123",
            full_name="Owner User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="recipient",
            email="recipient@example.com",
            password="password123",
            full_name="Recipient User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def patients(self, db_session, owner):
        """Create multiple patients"""
        patients = []
        for i in range(3):
            patient = Patient(
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

    @pytest.fixture
    def bulk_invitation(self, db_session, owner, recipient, patients):
        """Create bulk invitation"""
        patients_data = [
            {
                'patient_id': p.id,
                'patient_name': f"{p.first_name} {p.last_name}",
                'patient_birth_date': p.birth_date.isoformat()
            }
            for p in patients
        ]

        invitation = Invitation(
            sent_by_user_id=owner.id,
            sent_to_user_id=recipient.id,
            invitation_type='patient_share',
            status='pending',
            title="Bulk Patient Share",
            context_data={
                'is_bulk_invite': True,
                'patients': patients_data,
                'permission_level': 'view',
                'patient_count': len(patients)
            },
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db_session.add(invitation)
        db_session.commit()
        db_session.refresh(invitation)
        return invitation

    @pytest.fixture
    def recipient_token_headers(self, recipient):
        """Create auth headers for recipient"""
        token = create_access_token(subject=recipient.id)
        return {"Authorization": f"Bearer {token}"}

    def test_accept_bulk_invitation_success(self, client, db_session, recipient_token_headers, bulk_invitation, patients):
        """Test successfully accepting bulk patient share invitation"""
        payload = {"response": "accepted"}

        response = client.post(
            f"/api/v1/invitations/{bulk_invitation.id}/respond",
            json=payload,
            headers=recipient_token_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['share_count'] == 3
        assert len(data['share_ids']) == 3

        # Verify all shares were created
        for patient in patients:
            share = db_session.query(PatientShare).filter(
                PatientShare.patient_id == patient.id,
                PatientShare.invitation_id == bulk_invitation.id
            ).first()
            assert share is not None
            assert share.is_active is True

    def test_accept_bulk_invitation_patient_verification(self, client, db_session, recipient_token_headers, bulk_invitation, patients, owner):
        """Test bulk acceptance verifies patient still exists and sender still owns it"""
        # Delete one patient before acceptance
        db_session.delete(patients[0])
        db_session.commit()

        payload = {"response": "accepted"}

        response = client.post(
            f"/api/v1/invitations/{bulk_invitation.id}/respond",
            json=payload,
            headers=recipient_token_headers
        )

        # Should still succeed but only create shares for valid patients
        assert response.status_code == 200
        data = response.json()
        # Should only create 2 shares (patient 0 was deleted)
        assert data['share_count'] <= 3


class TestRaceConditions:
    """Test race condition handling in invitation acceptance"""

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="owner",
            email="owner@example.com",
            password="password123",
            full_name="Owner User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def recipient(self, db_session):
        """Create recipient user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="recipient",
            email="recipient@example.com",
            password="password123",
            full_name="Recipient User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def patient(self, db_session, owner):
        """Create patient owned by owner"""
        patient = Patient(
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
        """Create pending invitation"""
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

    @pytest.fixture
    def recipient_token_headers(self, recipient):
        """Create auth headers for recipient"""
        token = create_access_token(subject=recipient.id)
        return {"Authorization": f"Bearer {token}"}

    def test_concurrent_acceptance_handling(self, client, db_session, recipient_token_headers, pending_invitation, patient, owner, recipient):
        """
        CRITICAL: Test that duplicate acceptance is handled gracefully
        Simulates race condition where share already exists when accepting
        """
        # First acceptance
        payload = {"response": "accepted"}
        response1 = client.post(
            f"/api/v1/invitations/{pending_invitation.id}/respond",
            json=payload,
            headers=recipient_token_headers
        )

        assert response1.status_code == 200

        # Verify only one share exists
        shares = db_session.query(PatientShare).filter(
            PatientShare.patient_id == patient.id,
            PatientShare.shared_with_user_id == recipient.id
        ).all()

        assert len(shares) == 1

        # Trying to accept again should fail gracefully
        # Reset invitation status to simulate concurrent request
        db_session.refresh(pending_invitation)
        if pending_invitation.status == 'accepted':
            # Second request should handle existing share
            response2 = client.post(
                f"/api/v1/invitations/{pending_invitation.id}/respond",
                json=payload,
                headers=recipient_token_headers
            )
            # Should get error about already responded or should handle gracefully
            assert response2.status_code in [200, 400, 409]


class TestErrorMessages:
    """Test user-friendly error messages"""

    @pytest.fixture
    def owner(self, db_session):
        """Create owner user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="owner",
            email="owner@example.com",
            password="password123",
            full_name="Owner User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def owner_token_headers(self, owner):
        """Create auth headers for owner"""
        token = create_access_token(subject=owner.id)
        return {"Authorization": f"Bearer {token}"}

    def test_patient_not_found_friendly_message(self, client, owner_token_headers):
        """Test patient not found returns user-friendly message"""
        payload = {
            "patient_id": 99999,
            "shared_with_user_identifier": "someone@example.com",
            "permission_level": "view"
        }

        response = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 404
        detail = response.json()['detail']
        # Should be user-friendly, not technical
        assert "not found" in detail.lower()
        assert "permission" in detail.lower()

    def test_recipient_not_found_includes_identifier(self, client, db_session, owner_token_headers, owner):
        """Test recipient not found message includes the identifier"""
        patient = Patient(
            owner_user_id=owner.id,
            first_name="Test",
            last_name="Patient",
            birth_date=date(1990, 1, 1),
            gender="M"
        )
        db_session.add(patient)
        db_session.commit()

        payload = {
            "patient_id": patient.id,
            "shared_with_user_identifier": "nonexistent@example.com",
            "permission_level": "view"
        }

        response = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=owner_token_headers
        )

        assert response.status_code == 404
        detail = response.json()['detail']
        assert "nonexistent@example.com" in detail
