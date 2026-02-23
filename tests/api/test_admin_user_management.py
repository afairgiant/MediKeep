"""
API tests for admin user management endpoints.

Tests the admin patient search and user creation with optional patient linking.
"""
import pytest
from datetime import date

from app.models.models import User, Patient, PatientShare


class TestAdminPatientSearch:
    """Test GET /api/v1/admin/user-management/patients/search"""

    BASE_URL = "/api/v1/admin/user-management/patients/search"

    @pytest.fixture
    def setup_patients(self, db_session):
        """Create test patients with owners."""
        owner = User(
            username="patientowner",
            email="patientowner@test.com",
            password_hash="hashed",
            full_name="Patient Owner",
            role="user",
        )
        db_session.add(owner)
        db_session.commit()
        db_session.refresh(owner)

        patient1 = Patient(
            first_name="Alice",
            last_name="Smith",
            birth_date=date(1995, 6, 15),
            gender="F",
            owner_user_id=owner.id,
            user_id=owner.id,
            is_self_record=True,
        )
        patient2 = Patient(
            first_name="Bob",
            last_name="Jones",
            birth_date=date(2012, 3, 10),
            gender="M",
            owner_user_id=owner.id,
            user_id=owner.id,
            is_self_record=False,
        )
        db_session.add_all([patient1, patient2])
        db_session.commit()
        db_session.refresh(patient1)
        db_session.refresh(patient2)

        return {"owner": owner, "patient1": patient1, "patient2": patient2}

    def test_search_by_name(self, admin_client, setup_patients):
        response = admin_client.get(self.BASE_URL, params={"q": "Alice"})
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] >= 1
        names = [p["first_name"] for p in data["patients"]]
        assert "Alice" in names

    def test_search_by_id(self, admin_client, setup_patients):
        patient_id = setup_patients["patient1"].id
        response = admin_client.get(self.BASE_URL, params={"q": str(patient_id)})
        assert response.status_code == 200
        data = response.json()
        ids = [p["id"] for p in data["patients"]]
        assert patient_id in ids

    def test_search_returns_owner_info(self, admin_client, setup_patients):
        response = admin_client.get(self.BASE_URL, params={"q": "Alice"})
        assert response.status_code == 200
        data = response.json()
        patient = next(p for p in data["patients"] if p["first_name"] == "Alice")
        assert patient["owner_username"] == "patientowner"
        assert patient["owner_full_name"] == "Patient Owner"
        assert patient["is_self_record"] is True

    def test_search_requires_admin(self, authenticated_client, setup_patients):
        response = authenticated_client.get(self.BASE_URL, params={"q": "Alice"})
        assert response.status_code == 403

    def test_search_without_query_returns_all(self, admin_client, setup_patients):
        response = admin_client.get(self.BASE_URL)
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] >= 1

    def test_search_no_results(self, admin_client, setup_patients):
        response = admin_client.get(self.BASE_URL, params={"q": "Nonexistent"})
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 0
        assert len(data["patients"]) == 0


class TestAdminCreateUser:
    """Test POST /api/v1/admin/user-management/users/create"""

    BASE_URL = "/api/v1/admin/user-management/users/create"

    def test_create_user_standard_flow(self, admin_client, db_session):
        """Admin creates user without patient link (standard auto-create)."""
        response = admin_client.post(
            self.BASE_URL,
            json={
                "username": "newuser1",
                "password": "password123",
                "email": "newuser1@test.com",
                "full_name": "New User One",
                "first_name": "New",
                "last_name": "User",
                "role": "user",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["data"]["username"] == "newuser1"
        assert data["data"]["linked_patient_id"] is None

        # Verify user was created
        user = db_session.query(User).filter(User.username == "newuser1").first()
        assert user is not None

        # Verify auto-created patient
        patient = db_session.query(Patient).filter(
            Patient.owner_user_id == user.id,
            Patient.is_self_record == True,
        ).first()
        assert patient is not None
        assert user.active_patient_id == patient.id

    def test_create_user_with_patient_link(self, admin_client, db_session):
        """Admin creates user and links to existing patient."""
        # Create an owner with a dependent patient
        owner = User(
            username="linkowner",
            email="linkowner@test.com",
            password_hash="hashed",
            full_name="Link Owner",
            role="user",
        )
        db_session.add(owner)
        db_session.commit()
        db_session.refresh(owner)

        patient = Patient(
            first_name="Child",
            last_name="Record",
            birth_date=date(2015, 8, 22),
            gender="M",
            owner_user_id=owner.id,
            user_id=owner.id,
            is_self_record=False,
        )
        db_session.add(patient)
        db_session.commit()
        db_session.refresh(patient)

        owner.active_patient_id = patient.id
        db_session.commit()

        response = admin_client.post(
            self.BASE_URL,
            json={
                "username": "childuser",
                "password": "password123",
                "email": "childuser@test.com",
                "full_name": "Child User",
                "first_name": "Child",
                "last_name": "User",
                "role": "user",
                "link_patient_id": patient.id,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["data"]["linked_patient_id"] == patient.id

        # Verify patient ownership transferred
        db_session.refresh(patient)
        new_user = db_session.query(User).filter(User.username == "childuser").first()
        assert patient.owner_user_id == new_user.id
        assert patient.is_self_record is True

        # Verify original owner has edit share
        share = db_session.query(PatientShare).filter(
            PatientShare.patient_id == patient.id,
            PatientShare.shared_with_user_id == owner.id,
        ).first()
        assert share is not None
        assert share.permission_level == "edit"
        assert share.is_active is True

    def test_create_user_duplicate_username(self, admin_client, test_user):
        """Duplicate username returns 409."""
        response = admin_client.post(
            self.BASE_URL,
            json={
                "username": test_user.username,
                "password": "password123",
                "email": "unique@test.com",
                "full_name": "Duplicate User",
                "role": "user",
            },
        )
        assert response.status_code == 409

    def test_create_user_duplicate_email(self, admin_client, test_user):
        """Duplicate email returns 409."""
        response = admin_client.post(
            self.BASE_URL,
            json={
                "username": "uniqueuser",
                "password": "password123",
                "email": test_user.email,
                "full_name": "Duplicate Email",
                "role": "user",
            },
        )
        assert response.status_code == 409

    def test_create_user_invalid_patient_id(self, admin_client):
        """Non-existent patient ID returns 404."""
        response = admin_client.post(
            self.BASE_URL,
            json={
                "username": "linkuser99",
                "password": "password123",
                "email": "linkuser99@test.com",
                "full_name": "Link User",
                "role": "user",
                "link_patient_id": 99999,
            },
        )
        assert response.status_code == 404

    def test_create_user_non_admin_forbidden(self, authenticated_client):
        """Non-admin user gets 403."""
        response = authenticated_client.post(
            self.BASE_URL,
            json={
                "username": "shouldfail",
                "password": "password123",
                "email": "shouldfail@test.com",
                "full_name": "Should Fail",
                "role": "user",
            },
        )
        assert response.status_code == 403

    def test_create_user_with_self_record_link(self, admin_client, db_session):
        """Linking to a self-record creates replacement for original owner."""
        owner = User(
            username="selfrecowner",
            email="selfrecowner@test.com",
            password_hash="hashed",
            full_name="Self Rec Owner",
            role="user",
        )
        db_session.add(owner)
        db_session.commit()
        db_session.refresh(owner)

        self_patient = Patient(
            first_name="Self",
            last_name="Record",
            birth_date=date(1990, 1, 1),
            gender="F",
            blood_type="O+",
            owner_user_id=owner.id,
            user_id=owner.id,
            is_self_record=True,
        )
        db_session.add(self_patient)
        db_session.commit()
        db_session.refresh(self_patient)

        owner.active_patient_id = self_patient.id
        db_session.commit()

        response = admin_client.post(
            self.BASE_URL,
            json={
                "username": "newselfuser",
                "password": "password123",
                "email": "newselfuser@test.com",
                "full_name": "New Self User",
                "first_name": "New",
                "last_name": "Self",
                "role": "user",
                "link_patient_id": self_patient.id,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        transfer = data["data"]["transfer_details"]
        assert transfer["replacement_patient_id"] is not None

        # Verify replacement exists for original owner
        db_session.refresh(owner)
        replacement = db_session.query(Patient).filter(
            Patient.id == transfer["replacement_patient_id"]
        ).first()
        assert replacement is not None
        assert replacement.owner_user_id == owner.id
        assert replacement.is_self_record is True
        assert replacement.first_name == "Self"
        assert replacement.blood_type == "O+"

        # Verify original owner's active patient was updated
        assert owner.active_patient_id == replacement.id
