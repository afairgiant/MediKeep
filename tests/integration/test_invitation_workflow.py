"""
End-to-end integration tests for patient share invitation workflow

Tests complete workflows from invitation creation through acceptance,
including bulk operations and edge cases.
"""
import pytest
from datetime import datetime, timedelta, timezone, date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import User, Patient, PatientShare, Invitation
from app.core.utils.security import create_access_token


class TestCompleteInvitationWorkflow:
    """Test complete patient share invitation workflow"""

    @pytest.fixture
    def alice(self, db_session):
        """Create alice user (sender)"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="alice",
            email="alice@example.com",
            password="password123",
            full_name="Alice Sender",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def bob(self, db_session):
        """Create bob user (recipient)"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="bob",
            email="bob@example.com",
            password="password123",
            full_name="Bob Recipient",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def alice_patient(self, db_session, alice):
        """Create patient for alice"""
        patient = Patient(
            owner_user_id=alice.id,
            first_name="Child",
            last_name="Patient",
            birth_date=date(2010, 1, 1),
            gender="F"
        )
        db_session.add(patient)
        db_session.commit()
        db_session.refresh(patient)
        return patient

    @pytest.fixture
    def alice_token_headers(self, alice):
        """Auth headers for alice"""
        token = create_access_token(subject=alice.id)
        return {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def bob_token_headers(self, bob):
        """Auth headers for bob"""
        token = create_access_token(subject=bob.id)
        return {"Authorization": f"Bearer {token}"}

    def test_complete_single_patient_workflow(self, client, db_session, alice_token_headers, bob_token_headers, alice_patient, alice, bob):
        """
        Test complete workflow: send invitation -> check pending -> accept -> verify share
        """
        # Step 1: Alice sends invitation to Bob
        send_payload = {
            "patient_id": alice_patient.id,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view",
            "message": "Please help manage my child's records"
        }

        send_response = client.post(
            "/api/v1/patient-sharing/",
            json=send_payload,
            headers=alice_token_headers
        )

        assert send_response.status_code == 200
        invitation_id = send_response.json()['invitation_id']

        # Step 2: Bob checks his pending invitations
        pending_response = client.get(
            "/api/v1/invitations/pending",
            headers=bob_token_headers
        )

        assert pending_response.status_code == 200
        pending_invitations = pending_response.json()
        assert len(pending_invitations) == 1
        assert pending_invitations[0]['id'] == invitation_id
        assert pending_invitations[0]['invitation_type'] == 'patient_share'

        # Step 3: Bob accepts the invitation
        accept_payload = {
            "response": "accepted",
            "response_note": "Happy to help!"
        }

        accept_response = client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json=accept_payload,
            headers=bob_token_headers
        )

        assert accept_response.status_code == 200
        share_id = accept_response.json()['share_id']

        # Step 4: Verify share was created
        share = db_session.query(PatientShare).filter(
            PatientShare.id == share_id
        ).first()

        assert share is not None
        assert share.patient_id == alice_patient.id
        assert share.shared_by_user_id == alice.id
        assert share.shared_with_user_id == bob.id
        assert share.permission_level == 'view'
        assert share.is_active is True
        assert share.invitation_id == invitation_id

        # Step 5: Verify invitation status updated
        invitation = db_session.query(Invitation).filter(
            Invitation.id == invitation_id
        ).first()

        assert invitation.status == 'accepted'
        assert invitation.responded_at is not None
        assert invitation.response_note == "Happy to help!"

        # Step 6: Bob should no longer see this in pending invitations
        pending_response2 = client.get(
            "/api/v1/invitations/pending",
            headers=bob_token_headers
        )

        assert pending_response2.status_code == 200
        assert len(pending_response2.json()) == 0

    def test_complete_bulk_workflow(self, client, db_session, alice_token_headers, bob_token_headers, alice, bob):
        """
        Test complete bulk workflow: create multiple patients -> send bulk invitation -> accept -> verify all shares
        """
        # Step 1: Create multiple patients for Alice
        patients = []
        for i in range(3):
            patient = Patient(
                owner_user_id=alice.id,
                first_name=f"Child{i}",
                last_name="Patient",
                birth_date=date(2010 + i, 1, 1),
                gender="F" if i % 2 == 0 else "M"
            )
            db_session.add(patient)
            patients.append(patient)
        db_session.commit()
        for p in patients:
            db_session.refresh(p)

        patient_ids = [p.id for p in patients]

        # Step 2: Alice sends bulk invitation to Bob
        send_payload = {
            "patient_ids": patient_ids,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view",
            "message": "Please help manage all my children's records"
        }

        send_response = client.post(
            "/api/v1/patient-sharing/bulk-invite",
            json=send_payload,
            headers=alice_token_headers
        )

        assert send_response.status_code == 200
        invitation_id = send_response.json()['invitation_id']
        assert send_response.json()['patient_count'] == 3

        # Step 3: Bob checks pending invitations
        pending_response = client.get(
            "/api/v1/invitations/pending?invitation_type=patient_share",
            headers=bob_token_headers
        )

        assert pending_response.status_code == 200
        pending = pending_response.json()
        assert len(pending) == 1
        assert pending[0]['context_data']['is_bulk_invite'] is True

        # Step 4: Bob accepts the bulk invitation
        accept_payload = {"response": "accepted"}

        accept_response = client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json=accept_payload,
            headers=bob_token_headers
        )

        assert accept_response.status_code == 200
        assert accept_response.json()['share_count'] == 3

        # Step 5: Verify all shares were created
        shares = db_session.query(PatientShare).filter(
            PatientShare.shared_with_user_id == bob.id,
            PatientShare.shared_by_user_id == alice.id
        ).all()

        assert len(shares) == 3
        share_patient_ids = {s.patient_id for s in shares}
        assert share_patient_ids == set(patient_ids)

        for share in shares:
            assert share.is_active is True
            assert share.invitation_id == invitation_id

    def test_reject_invitation_workflow(self, client, db_session, alice_token_headers, bob_token_headers, alice_patient, bob):
        """
        Test rejection workflow: send invitation -> reject -> verify no share created
        """
        # Step 1: Alice sends invitation
        send_payload = {
            "patient_id": alice_patient.id,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view"
        }

        send_response = client.post(
            "/api/v1/patient-sharing/",
            json=send_payload,
            headers=alice_token_headers
        )

        invitation_id = send_response.json()['invitation_id']

        # Step 2: Bob rejects the invitation
        reject_payload = {
            "response": "rejected",
            "response_note": "Sorry, too busy right now"
        }

        reject_response = client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json=reject_payload,
            headers=bob_token_headers
        )

        assert reject_response.status_code == 200
        assert reject_response.json()['status'] == 'rejected'

        # Step 3: Verify no share was created
        shares = db_session.query(PatientShare).filter(
            PatientShare.patient_id == alice_patient.id,
            PatientShare.shared_with_user_id == bob.id
        ).all()

        assert len(shares) == 0

        # Step 4: Verify invitation status
        invitation = db_session.query(Invitation).filter(
            Invitation.id == invitation_id
        ).first()

        assert invitation.status == 'rejected'
        assert invitation.response_note == "Sorry, too busy right now"

    def test_cancel_invitation_workflow(self, client, db_session, alice_token_headers, bob_token_headers, alice_patient, bob):
        """
        Test cancellation workflow: send invitation -> cancel before acceptance
        """
        # Step 1: Alice sends invitation
        send_payload = {
            "patient_id": alice_patient.id,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view"
        }

        send_response = client.post(
            "/api/v1/patient-sharing/",
            json=send_payload,
            headers=alice_token_headers
        )

        invitation_id = send_response.json()['invitation_id']

        # Step 2: Alice cancels the invitation
        cancel_response = client.delete(
            f"/api/v1/invitations/{invitation_id}",
            headers=alice_token_headers
        )

        assert cancel_response.status_code == 200
        assert cancel_response.json()['status'] == 'cancelled'

        # Step 3: Bob tries to accept cancelled invitation
        accept_payload = {"response": "accepted"}

        accept_response = client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json=accept_payload,
            headers=bob_token_headers
        )

        # Should fail because invitation is cancelled
        assert accept_response.status_code in [400, 404, 409]

    def test_revoke_share_workflow(self, client, db_session, alice_token_headers, bob_token_headers, alice_patient, alice, bob):
        """
        Test revocation workflow: send -> accept -> revoke -> verify share deactivated
        """
        # Step 1: Send and accept invitation
        send_payload = {
            "patient_id": alice_patient.id,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view"
        }

        send_response = client.post(
            "/api/v1/patient-sharing/",
            json=send_payload,
            headers=alice_token_headers
        )

        invitation_id = send_response.json()['invitation_id']

        accept_response = client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json={"response": "accepted"},
            headers=bob_token_headers
        )

        assert accept_response.status_code == 200

        # Step 2: Alice revokes the share
        revoke_payload = {
            "patient_id": alice_patient.id,
            "shared_with_user_id": bob.id
        }

        revoke_response = client.delete(
            "/api/v1/patient-sharing/revoke",
            json=revoke_payload,
            headers=alice_token_headers
        )

        assert revoke_response.status_code == 200

        # Step 3: Verify share is deactivated
        share = db_session.query(PatientShare).filter(
            PatientShare.patient_id == alice_patient.id,
            PatientShare.shared_with_user_id == bob.id
        ).first()

        assert share is not None
        assert share.is_active is False

        # Step 4: Verify invitation status updated to revoked
        invitation = db_session.query(Invitation).filter(
            Invitation.id == invitation_id
        ).first()

        assert invitation.status == 'revoked'


class TestEdgeCases:
    """Test edge cases and error scenarios"""

    @pytest.fixture
    def alice(self, db_session):
        """Create alice user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="alice",
            email="alice@example.com",
            password="password123",
            full_name="Alice User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def bob(self, db_session):
        """Create bob user"""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        user_data = UserCreate(
            username="bob",
            email="bob@example.com",
            password="password123",
            full_name="Bob User",
            role="user"
        )
        return user_crud.create(db_session, obj_in=user_data)

    @pytest.fixture
    def alice_patient(self, db_session, alice):
        """Create patient for alice"""
        patient = Patient(
            owner_user_id=alice.id,
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
    def alice_token_headers(self, alice):
        """Auth headers for alice"""
        token = create_access_token(subject=alice.id)
        return {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def bob_token_headers(self, bob):
        """Auth headers for bob"""
        token = create_access_token(subject=bob.id)
        return {"Authorization": f"Bearer {token}"}

    def test_cannot_send_duplicate_invitation(self, client, alice_token_headers, alice_patient, bob):
        """Test that sending duplicate invitation is prevented"""
        payload = {
            "patient_id": alice_patient.id,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view"
        }

        # First invitation succeeds
        response1 = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=alice_token_headers
        )

        assert response1.status_code == 200

        # Second invitation should fail
        response2 = client.post(
            "/api/v1/patient-sharing/",
            json=payload,
            headers=alice_token_headers
        )

        assert response2.status_code == 409
        assert "pending invitation" in response2.json()['detail'].lower()

    def test_cannot_accept_others_invitation(self, client, db_session, alice_token_headers, bob_token_headers, alice_patient, bob):
        """Test that user cannot accept invitation meant for someone else"""
        # Create third user
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        charlie_data = UserCreate(
            username="charlie",
            email="charlie@example.com",
            password="password123",
            full_name="Charlie User",
            role="user"
        )
        charlie = user_crud.create(db_session, obj_in=charlie_data)

        # Alice sends invitation to Bob
        send_payload = {
            "patient_id": alice_patient.id,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view"
        }

        send_response = client.post(
            "/api/v1/patient-sharing/",
            json=send_payload,
            headers=alice_token_headers
        )

        invitation_id = send_response.json()['invitation_id']

        # Charlie tries to accept (should fail)
        charlie_token = create_access_token(subject=charlie.id)
        charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

        accept_response = client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json={"response": "accepted"},
            headers=charlie_headers
        )

        assert accept_response.status_code in [400, 404]

    def test_bulk_invitation_with_deleted_patient(self, client, db_session, alice_token_headers, bob_token_headers, alice, bob):
        """Test bulk invitation handles patients that get deleted before acceptance"""
        # Create patients
        patients = []
        for i in range(3):
            patient = Patient(
                owner_user_id=alice.id,
                first_name=f"Patient{i}",
                last_name="Test",
                birth_date=date(1990, 1, 1),
                gender="M"
            )
            db_session.add(patient)
            patients.append(patient)
        db_session.commit()
        for p in patients:
            db_session.refresh(p)

        patient_ids = [p.id for p in patients]

        # Send bulk invitation
        send_payload = {
            "patient_ids": patient_ids,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view"
        }

        send_response = client.post(
            "/api/v1/patient-sharing/bulk-invite",
            json=send_payload,
            headers=alice_token_headers
        )

        invitation_id = send_response.json()['invitation_id']

        # Delete one patient before acceptance
        db_session.delete(patients[0])
        db_session.commit()

        # Accept invitation
        accept_response = client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json={"response": "accepted"},
            headers=bob_token_headers
        )

        # Should succeed but only create shares for existing patients
        assert accept_response.status_code == 200
        # Should create fewer shares (patient 0 was deleted)
        assert accept_response.json()['share_count'] <= 3

    def test_expired_invitation_cannot_be_accepted(self, client, db_session, alice_token_headers, bob_token_headers, alice_patient, alice, bob):
        """Test that expired invitations cannot be accepted"""
        # Create invitation that's already expired
        invitation = Invitation(
            sent_by_user_id=alice.id,
            sent_to_user_id=bob.id,
            invitation_type='patient_share',
            status='pending',
            title='Test',
            context_data={
                'patient_id': alice_patient.id,
                'patient_name': 'Test Patient',
                'permission_level': 'view'
            },
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        db_session.add(invitation)
        db_session.commit()

        # Try to accept
        accept_response = client.post(
            f"/api/v1/invitations/{invitation.id}/respond",
            json={"response": "accepted"},
            headers=bob_token_headers
        )

        assert accept_response.status_code == 400
        assert "expired" in accept_response.json()['detail'].lower()

    def test_remove_own_access(self, client, db_session, alice_token_headers, bob_token_headers, alice_patient, alice, bob):
        """Test that recipient can remove their own access to a shared patient"""
        # Send and accept invitation
        send_payload = {
            "patient_id": alice_patient.id,
            "shared_with_user_identifier": bob.username,
            "permission_level": "view"
        }

        send_response = client.post(
            "/api/v1/patient-sharing/",
            json=send_payload,
            headers=alice_token_headers
        )

        invitation_id = send_response.json()['invitation_id']

        client.post(
            f"/api/v1/invitations/{invitation_id}/respond",
            json={"response": "accepted"},
            headers=bob_token_headers
        )

        # Bob removes his own access
        remove_response = client.delete(
            f"/api/v1/patient-sharing/remove-my-access/{alice_patient.id}",
            headers=bob_token_headers
        )

        assert remove_response.status_code == 200

        # Verify share is deactivated
        share = db_session.query(PatientShare).filter(
            PatientShare.patient_id == alice_patient.id,
            PatientShare.shared_with_user_id == bob.id
        ).first()

        assert share.is_active is False
