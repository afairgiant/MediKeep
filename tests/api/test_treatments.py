"""
Tests for Treatments API endpoints.
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestTreatmentsAPI:
    """Test Treatments API endpoints."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        """Create a user with patient record for testing."""
        user_data = create_random_user(db_session)
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St"
        )
        patient = patient_crud.create_for_user(
            db_session, user_id=user_data["user"].id, patient_data=patient_data
        )
        # Set as active patient for multi-patient system
        user_data["user"].active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(user_data["user"])
        return {**user_data, "patient": patient}

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        """Create authentication headers."""
        return create_user_token_headers(user_with_patient["user"].username)

    def test_create_treatment_success(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test successful treatment creation."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Physical Therapy",
            "treatment_type": "Rehabilitation",
            "start_date": "2024-01-15",
            "status": "active",
            "frequency": "3 times per week",
            "notes": "Post-surgery rehabilitation program"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["treatment_name"] == "Physical Therapy"
        assert data["treatment_type"] == "Rehabilitation"
        assert data["status"] == "active"
        assert data["patient_id"] == user_with_patient["patient"].id

    def test_create_treatment_minimal_data(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test treatment creation with minimal required data."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Wound Care",
            "treatment_type": "Medical",
            "start_date": "2024-01-15"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["treatment_name"] == "Wound Care"
        assert data["start_date"] == "2024-01-15"
        assert data["status"] == "active"  # Default status

    def test_get_treatments_list(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test getting list of treatments."""
        # Create multiple treatments
        treatments = [
            {
                "patient_id": user_with_patient["patient"].id,
                "treatment_name": "Chemotherapy",
                "treatment_type": "Oncology",
                "start_date": "2024-01-10",
                "status": "active"
            },
            {
                "patient_id": user_with_patient["patient"].id,
                "treatment_name": "Radiation Therapy",
                "treatment_type": "Oncology",
                "start_date": "2024-01-20",
                "status": "planned"
            },
            {
                "patient_id": user_with_patient["patient"].id,
                "treatment_name": "Physical Therapy",
                "treatment_type": "Rehabilitation",
                "start_date": "2024-02-15",
                "status": "completed"
            }
        ]

        for treatment_data in treatments:
            client.post(
                "/api/v1/treatments/",
                json=treatment_data,
                headers=authenticated_headers
            )

        # Get treatments list
        response = client.get("/api/v1/treatments/", headers=authenticated_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3

        treatment_names = [treatment["treatment_name"] for treatment in data]
        assert "Chemotherapy" in treatment_names
        assert "Radiation Therapy" in treatment_names
        assert "Physical Therapy" in treatment_names

    def test_get_treatment_by_id(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test getting a specific treatment by ID."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Insulin Therapy",
            "treatment_type": "Diabetes Management",
            "start_date": "2024-01-15",
            "status": "active",
            "frequency": "Daily"
        }

        create_response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        treatment_id = create_response.json()["id"]

        # Get treatment by ID
        response = client.get(
            f"/api/v1/treatments/{treatment_id}",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == treatment_id
        assert data["treatment_name"] == "Insulin Therapy"
        assert data["frequency"] == "Daily"

    def test_update_treatment(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test updating a treatment."""
        # Create treatment
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Occupational Therapy",
            "treatment_type": "Rehabilitation",
            "start_date": "2024-01-15",
            "status": "planned",
        }

        create_response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        treatment_id = create_response.json()["id"]

        # Update treatment
        update_data = {
            "status": "active",
            "frequency": "2 times per week",
            "notes": "Started therapy program as planned",
        }

        response = client.put(
            f"/api/v1/treatments/{treatment_id}",
            json=update_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        assert data["frequency"] == "2 times per week"
        assert data["notes"] == "Started therapy program as planned"
        assert data["treatment_name"] == "Occupational Therapy"  # Unchanged

    def test_delete_treatment(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test deleting a treatment."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Test Treatment to Delete",
            "treatment_type": "Test",
            "start_date": "2024-01-15",
            "status": "planned"
        }

        create_response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        treatment_id = create_response.json()["id"]

        # Delete treatment
        response = client.delete(
            f"/api/v1/treatments/{treatment_id}",
            headers=authenticated_headers
        )

        assert response.status_code == 200

        # Verify deletion
        get_response = client.get(
            f"/api/v1/treatments/{treatment_id}",
            headers=authenticated_headers
        )
        assert get_response.status_code == 404

    def test_treatment_validation_errors(self, client: TestClient, authenticated_headers):
        """Test various validation error scenarios."""
        # Test missing required fields
        invalid_data = {
            "status": "active"
            # Missing treatment_name, treatment_type, and start_date
        }

        response = client.post(
            "/api/v1/treatments/",
            json=invalid_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

        # Test invalid status
        invalid_status_data = {
            "treatment_name": "Test",
            "treatment_type": "Test",
            "start_date": "2024-01-15",
            "status": "invalid_status"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=invalid_status_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

    def test_treatment_end_date_validation(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that end date cannot be before start date."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Invalid Date Range",
            "treatment_type": "Test",
            "start_date": "2024-02-15",
            "end_date": "2024-01-15",  # Before start date
            "status": "active"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422
        # Just check for 422 status - validation errors can have different formats
        # The important part is that the validation rejects the request

    # Date validation tests for planned/on_hold statuses

    def test_planned_treatment_future_date_allowed(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that planned treatments can have future start dates."""
        future_date = (date.today() + timedelta(days=30)).isoformat()

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Future Planned Treatment",
            "treatment_type": "Medical",
            "start_date": future_date,
            "status": "planned"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == future_date
        assert data["status"] == "planned"

    def test_planned_treatment_within_10_year_limit(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that planned treatments can be up to 10 years in the future."""
        # Set date to 9 years in future (within limit)
        future_date = (date.today() + timedelta(days=3285)).isoformat()  # ~9 years

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Long-term Planned Treatment",
            "treatment_type": "Medical",
            "start_date": future_date,
            "status": "planned"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == future_date

    def test_planned_treatment_beyond_10_year_limit_rejected(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that planned treatments beyond 10 years are rejected."""
        # Set date to 11 years in future (beyond limit)
        future_date = (date.today() + timedelta(days=4015)).isoformat()  # ~11 years

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Too Far Future Treatment",
            "treatment_type": "Medical",
            "start_date": future_date,
            "status": "planned"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422
        # Just check for 422 status - validation errors can have different formats
        # The important part is that the validation rejects the request

    def test_on_hold_treatment_future_date_allowed(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that on_hold treatments can have future start dates."""
        future_date = (date.today() + timedelta(days=60)).isoformat()

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "On Hold Treatment",
            "treatment_type": "Medical",
            "start_date": future_date,
            "status": "on_hold"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == future_date
        assert data["status"] == "on_hold"

    def test_active_treatment_future_date_rejected(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that active treatments cannot have future start dates."""
        future_date = (date.today() + timedelta(days=1)).isoformat()

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Active Treatment",
            "treatment_type": "Medical",
            "start_date": future_date,
            "status": "active"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422
        # Just check for 422 status - validation errors can have different formats
        # The important part is that the validation rejects the request

    def test_in_progress_treatment_future_date_rejected(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that in_progress treatments cannot have future start dates."""
        future_date = (date.today() + timedelta(days=1)).isoformat()

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "In Progress Treatment",
            "treatment_type": "Medical",
            "start_date": future_date,
            "status": "in_progress"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422
        # Just check for 422 status - validation errors can have different formats
        # The important part is that the validation rejects the request

    def test_completed_treatment_future_date_rejected(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that completed treatments cannot have future start dates."""
        future_date = (date.today() + timedelta(days=1)).isoformat()

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Completed Treatment",
            "treatment_type": "Medical",
            "start_date": future_date,
            "status": "completed"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422
        # Just check for 422 status - validation errors can have different formats
        # The important part is that the validation rejects the request

    def test_cancelled_treatment_future_date_rejected(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that cancelled treatments cannot have future start dates."""
        future_date = (date.today() + timedelta(days=1)).isoformat()

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Cancelled Treatment",
            "treatment_type": "Medical",
            "start_date": future_date,
            "status": "cancelled"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422
        # Just check for 422 status - validation errors can have different formats
        # The important part is that the validation rejects the request

    def test_partial_update_start_date_without_status(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that start_date can be updated without re-specifying status (partial update)."""
        # Create a planned treatment with future date
        initial_date = (date.today() + timedelta(days=30)).isoformat()
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Planned Treatment",
            "treatment_type": "Medical",
            "start_date": initial_date,
            "status": "planned"
        }

        create_response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        treatment_id = create_response.json()["id"]

        # Update only the start_date, without providing status
        new_date = (date.today() + timedelta(days=60)).isoformat()
        update_data = {
            "start_date": new_date
            # Status intentionally not provided
        }

        response = client.put(
            f"/api/v1/treatments/{treatment_id}",
            json=update_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == new_date
        assert data["status"] == "planned"  # Status unchanged

    def test_planned_treatment_past_date_allowed(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that planned treatments can have past dates (e.g., rescheduled from past)."""
        past_date = (date.today() - timedelta(days=10)).isoformat()

        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Rescheduled from Past",
            "treatment_type": "Medical",
            "start_date": past_date,
            "status": "planned"
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == past_date
        assert data["status"] == "planned"

    def test_treatment_patient_isolation(self, client: TestClient, db_session: Session):
        """Test that users can only access their own treatments."""
        # Create two users with patients
        user1_data = create_random_user(db_session)
        patient1_data = PatientCreate(
            first_name="User",
            last_name="One",
            birth_date=date(1990, 1, 1),
            gender="M"
        )
        patient1 = patient_crud.create_for_user(
            db_session, user_id=user1_data["user"].id, patient_data=patient1_data
        )
        user1_data["user"].active_patient_id = patient1.id
        db_session.commit()
        db_session.refresh(user1_data["user"])
        headers1 = create_user_token_headers(user1_data["user"].username)

        user2_data = create_random_user(db_session)
        patient2_data = PatientCreate(
            first_name="User",
            last_name="Two",
            birth_date=date(1990, 1, 1),
            gender="F"
        )
        patient2 = patient_crud.create_for_user(
            db_session, user_id=user2_data["user"].id, patient_data=patient2_data
        )
        user2_data["user"].active_patient_id = patient2.id
        db_session.commit()
        db_session.refresh(user2_data["user"])
        headers2 = create_user_token_headers(user2_data["user"].username)

        # User1 creates a treatment
        treatment_data = {
            "patient_id": patient1.id,
            "treatment_name": "Private Treatment",
            "treatment_type": "Medical",
            "start_date": "2024-01-15",
            "status": "active"
        }

        create_response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=headers1
        )

        treatment_id = create_response.json()["id"]

        # User2 tries to access User1's treatment - should fail
        response = client.get(
            f"/api/v1/treatments/{treatment_id}",
            headers=headers2
        )
        assert response.status_code == 404

    def test_treatment_planned_to_active_workflow(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test workflow from planned to active treatment."""
        # Create planned treatment
        planned_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Physical Therapy Program",
            "treatment_type": "Rehabilitation",
            "start_date": (date.today() + timedelta(days=7)).isoformat(),
            "status": "planned",
        }

        create_response = client.post(
            "/api/v1/treatments/",
            json=planned_data,
            headers=authenticated_headers
        )

        treatment_id = create_response.json()["id"]

        # Update to active with additional details
        activation_data = {
            "status": "active",
            "start_date": date.today().isoformat(),
            "frequency": "3 times per week",
            "notes": "Treatment started as planned"
        }

        response = client.put(
            f"/api/v1/treatments/{treatment_id}",
            json=activation_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        assert data["frequency"] == "3 times per week"
        assert data["notes"] == "Treatment started as planned"
