"""
Test patient endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import User, Patient
from tests.utils.user import create_random_user


class TestPatientEndpoints:
    """Test patient-related endpoints."""

    def test_get_current_patient_success(self, authenticated_client: TestClient, test_patient: Patient):
        """Test successfully getting current patient info."""
        response = authenticated_client.get("/api/v1/patients/me")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_patient.id
        assert "first_name" in data
        assert "last_name" in data
        assert "birth_date" in data

    def test_get_current_patient_without_auth(self, client: TestClient):
        """Test getting patient info without authentication."""
        response = client.get("/api/v1/patients/me")

        assert response.status_code == 401

    def test_update_current_patient_success(self, authenticated_client: TestClient, test_patient: Patient):
        """Test successfully updating current patient info."""
        update_data = {
            "first_name": "Updated",
            "last_name": "Name",
            "address": "123 Updated Street",
            "blood_type": "B+",
            "height": 72,
            "weight": 200
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == update_data["first_name"]
        assert data["last_name"] == update_data["last_name"]
        assert data["address"] == update_data["address"]
        assert data["blood_type"] == update_data["blood_type"]
        assert data["height"] == update_data["height"]
        assert data["weight"] == update_data["weight"]

    def test_update_current_patient_partial(self, authenticated_client: TestClient, test_patient: Patient):
        """Test partial update of patient info."""
        update_data = {
            "first_name": "PartialUpdate"
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        # API normalizes names to title case
        assert data["first_name"] == "Partialupdate"
        # Other fields should remain unchanged

    def test_update_current_patient_invalid_data(self, authenticated_client: TestClient, test_patient: Patient):
        """Test updating patient with invalid data."""
        invalid_data = {
            "birth_date": "invalid-date-format",
            "height": -10,  # Invalid height
            "weight": 1000,  # Invalid weight
            "blood_type": "INVALID"  # Invalid blood type
        }

        response = authenticated_client.put("/api/v1/patients/me", json=invalid_data)

        assert response.status_code == 422
        response_data = response.json()
        # API returns error structure with 'errors' or 'message' key, not 'detail'
        assert "errors" in response_data or "message" in response_data

    def test_update_current_patient_without_auth(self, client: TestClient):
        """Test updating patient info without authentication."""
        update_data = {"first_name": "Unauthorized"}

        response = client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 401

    def test_create_current_patient_success(self, client: TestClient, db_session: Session):
        """Test creating a patient record when none exists."""
        from app.core.utils.security import create_access_token
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate

        # Create a user without a patient record
        user_data = UserCreate(
            username="nopatient",
            email="nopatient@example.com",
            password="password123",
            full_name="No Patient User",
            role="user"
        )
        user = user_crud.create(db_session, obj_in=user_data)
        
        # Create auth headers
        token = create_access_token(subject=user.id)
        headers = {"Authorization": f"Bearer {token}"}

        patient_data = {
            "first_name": "New",
            "last_name": "Patient",
            "birth_date": "1995-01-01",
            "gender": "F",
            "address": "456 New Street",
            "blood_type": "AB+",
            "height": 65,
            "weight": 130
        }

        response = client.post("/api/v1/patients/me", json=patient_data, headers=headers)

        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] == user.id
        assert data["first_name"] == patient_data["first_name"]
        assert data["last_name"] == patient_data["last_name"]

    def test_create_patient_when_already_exists(self, authenticated_client: TestClient, test_patient: Patient):
        """Test creating patient when one already exists."""
        patient_data = {
            "first_name": "Duplicate",
            "last_name": "Patient",
            "birth_date": "1995-01-01",
            "gender": "M"
        }

        response = authenticated_client.post("/api/v1/patients/me", json=patient_data)

        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

    def test_patient_data_validation(self, authenticated_client: TestClient, test_patient: Patient):
        """Test various validation scenarios for patient data."""
        test_cases = [
            # Missing required fields
            {
                "data": {"first_name": "Test"},
                "expected_status": 422
            },
            # Invalid birth date
            {
                "data": {
                    "first_name": "Test",
                    "last_name": "User",
                    "birth_date": "2030-01-01",  # Future date
                    "gender": "M"
                },
                "expected_status": 422
            },
            # Invalid blood type
            {
                "data": {
                    "first_name": "Test",
                    "last_name": "User", 
                    "birth_date": "1990-01-01",
                    "gender": "M",
                    "blood_type": "XX+"
                },
                "expected_status": 422
            },
            # Invalid height/weight
            {
                "data": {
                    "first_name": "Test",
                    "last_name": "User",
                    "birth_date": "1990-01-01", 
                    "gender": "M",
                    "height": 200,  # Too tall
                    "weight": -10   # Negative weight
                },
                "expected_status": 422
            }
        ]

        for test_case in test_cases:
            response = authenticated_client.put("/api/v1/patients/me", json=test_case["data"])
            assert response.status_code == test_case["expected_status"]

    def test_patient_recent_activity(self, authenticated_client: TestClient, db_session: Session, test_patient: Patient):
        """Test getting patient's recent activity."""
        # First create some activity by updating patient
        authenticated_client.put("/api/v1/patients/me", json={"first_name": "ActivityTest"})

        response = authenticated_client.get("/api/v1/patients/recent-activity")

        assert response.status_code == 200
        activities = response.json()
        assert isinstance(activities, list)
        
        if len(activities) > 0:
            activity = activities[0]
            assert "type" in activity
            assert "action" in activity
            assert "description" in activity
            assert "timestamp" in activity

    def test_patient_data_privacy(self, client: TestClient, db_session: Session):
        """Test that users can only access their own patient data."""
        # Create two users with patient records
        user1_data = create_random_user(db_session)
        user2_data = create_random_user(db_session)

        from app.crud.patient import patient as patient_crud
        
        # Create patient records
        patient1 = patient_crud.create_for_user(
            db_session, 
            user_id=user1_data["user"].id,
            patient_data={"first_name": "User1", "last_name": "Patient", "birth_date": "1990-01-01", "gender": "M"}
        )
        patient2 = patient_crud.create_for_user(
            db_session,
            user_id=user2_data["user"].id, 
            patient_data={"first_name": "User2", "last_name": "Patient", "birth_date": "1991-01-01", "gender": "F"}
        )

        from app.core.utils.security import create_access_token

        # User 1 should only see their own data
        user1_token = create_access_token(subject=user1_data["user"].id)
        user1_headers = {"Authorization": f"Bearer {user1_token}"}

        response = client.get("/api/v1/patients/me", headers=user1_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == patient1.id
        assert data["first_name"] == "User1"

        # User 2 should only see their own data
        user2_token = create_access_token(subject=user2_data["user"].id)
        user2_headers = {"Authorization": f"Bearer {user2_token}"}

        response = client.get("/api/v1/patients/me", headers=user2_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == patient2.id
        assert data["first_name"] == "User2"

    def test_patient_physician_assignment(self, authenticated_client: TestClient, db_session: Session):
        """Test assigning a physician to a patient."""
        from tests.utils.data import create_sample_practitioner

        # Create a practitioner
        practitioner = create_sample_practitioner(db_session)

        # Update patient with physician assignment
        update_data = {
            "physician_id": practitioner.id,
            "first_name": "Updated"
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["physician_id"] == practitioner.id

    def test_patient_physician_invalid_assignment(self, authenticated_client: TestClient, test_patient: Patient):
        """Test assigning a non-existent physician to a patient."""
        update_data = {
            "physician_id": 99999,  # Non-existent practitioner
            "first_name": "Updated"
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 422

    @pytest.mark.parametrize("field,value", [
        ("first_name", ""),
        ("last_name", ""),
        ("first_name", "A" * 101),  # Too long
        ("last_name", "A" * 101),   # Too long
        ("address", ""),
        ("address", "A" * 501),     # Too long
    ])
    def test_patient_field_validation(self, authenticated_client: TestClient, test_patient: Patient, field: str, value):
        """Test validation of individual patient fields."""
        update_data = {field: value}

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 422

    def test_patient_date_handling(self, authenticated_client: TestClient):
        """Test proper handling of date fields."""
        valid_dates = ["1990-01-01", "2000-12-31", "1950-06-15"]
        invalid_dates = ["invalid-date", "2030-01-01", "1800-01-01", "90-01-01"]

        # Test valid dates
        for date_str in valid_dates:
            response = authenticated_client.put(
                "/api/v1/patients/me",
                json={"birth_date": date_str}
            )
            # Should succeed or have other validation errors, but not date format errors
            if response.status_code == 422:
                errors = response.json()["detail"]
                assert not any("birth_date" in str(error) for error in errors)

        # Test invalid dates
        for date_str in invalid_dates:
            response = authenticated_client.put(
                "/api/v1/patients/me", 
                json={"birth_date": date_str}
            )
            assert response.status_code == 422