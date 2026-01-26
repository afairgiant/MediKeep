"""
Tests for Injuries API endpoints.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestInjuriesAPI:
    """Test Injuries API endpoints."""

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

    def test_create_injury_success(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test successful injury creation."""
        injury_data = {
            "injury_name": "Right Ankle Sprain",
            "body_part": "Ankle",
            "laterality": "right",
            "date_of_injury": "2025-12-30",
            "mechanism": "Fell while hiking",
            "severity": "moderate",
            "status": "active",
            "treatment_received": "RICE protocol, ankle brace",
            "notes": "Follow up in 2 weeks",
            "patient_id": user_with_patient["patient"].id
        }

        response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["injury_name"] == "Right Ankle Sprain"
        assert data["body_part"] == "Ankle"
        assert data["laterality"] == "right"
        assert data["severity"] == "moderate"
        assert data["status"] == "active"
        assert data["patient_id"] == user_with_patient["patient"].id

    def test_create_severe_injury(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test creating a severe injury."""
        injury_data = {
            "injury_name": "Fractured Tibia",
            "body_part": "Leg",
            "laterality": "left",
            "date_of_injury": "2025-11-15",
            "mechanism": "Car accident",
            "severity": "severe",
            "status": "active",
            "treatment_received": "Surgery, cast applied",
            "notes": "Required emergency surgery",
            "patient_id": user_with_patient["patient"].id
        }

        response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["injury_name"] == "Fractured Tibia"
        assert data["severity"] == "severe"
        assert data["status"] == "active"

    def test_get_injuries_list(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test getting list of injuries."""
        # Create multiple injuries
        injuries = [
            {
                "injury_name": "Sprained Wrist",
                "body_part": "Wrist",
                "laterality": "right",
                "date_of_injury": "2025-10-15",
                "severity": "mild",
                "status": "resolved",
                "patient_id": user_with_patient["patient"].id
            },
            {
                "injury_name": "Knee Contusion",
                "body_part": "Knee",
                "laterality": "left",
                "date_of_injury": "2025-11-20",
                "severity": "moderate",
                "status": "healing",
                "patient_id": user_with_patient["patient"].id
            },
            {
                "injury_name": "Back Strain",
                "body_part": "Back",
                "laterality": "not_applicable",
                "date_of_injury": "2025-12-01",
                "severity": "moderate",
                "status": "active",
                "patient_id": user_with_patient["patient"].id
            }
        ]

        for injury_data in injuries:
            client.post(
                "/api/v1/injuries/",
                json=injury_data,
                headers=authenticated_headers
            )

        # Get injuries list
        response = client.get("/api/v1/injuries/", headers=authenticated_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3

        # Should include all created injuries
        injury_names = [injury["injury_name"] for injury in data]
        assert "Sprained Wrist" in injury_names
        assert "Knee Contusion" in injury_names
        assert "Back Strain" in injury_names

    def test_get_active_injuries_filter(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test filtering for active injuries only."""
        # Create active and resolved injuries
        injuries = [
            {
                "injury_name": "Active Injury",
                "body_part": "Arm",
                "date_of_injury": "2025-12-15",
                "severity": "moderate",
                "status": "active",
                "patient_id": user_with_patient["patient"].id
            },
            {
                "injury_name": "Resolved Injury",
                "body_part": "Leg",
                "date_of_injury": "2025-06-15",
                "severity": "mild",
                "status": "resolved",
                "patient_id": user_with_patient["patient"].id
            }
        ]

        for injury_data in injuries:
            client.post(
                "/api/v1/injuries/",
                json=injury_data,
                headers=authenticated_headers
            )

        # Test status filtering - should return only active injuries
        response = client.get(
            "/api/v1/injuries/?status=active",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Should only return active injuries
        active_injuries = [injury for injury in data if injury["injury_name"] in ["Active Injury", "Resolved Injury"]]
        assert len(active_injuries) == 1
        assert active_injuries[0]["injury_name"] == "Active Injury"
        assert active_injuries[0]["status"] == "active"

    def test_get_injury_by_id(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test getting a specific injury by ID."""
        injury_data = {
            "injury_name": "Shoulder Dislocation",
            "body_part": "Shoulder",
            "laterality": "right",
            "date_of_injury": "2025-11-01",
            "mechanism": "Sports injury during basketball",
            "severity": "severe",
            "status": "healing",
            "treatment_received": "Manual reduction, sling",
            "notes": "Physical therapy recommended",
            "patient_id": user_with_patient["patient"].id
        }

        create_response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )

        injury_id = create_response.json()["id"]

        # Get injury by ID
        response = client.get(
            f"/api/v1/injuries/{injury_id}",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == injury_id
        assert data["injury_name"] == "Shoulder Dislocation"
        assert data["severity"] == "severe"

    def test_update_injury(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test updating an injury."""
        # Create injury
        injury_data = {
            "injury_name": "Minor Cut",
            "body_part": "Hand",
            "laterality": "left",
            "date_of_injury": "2025-12-20",
            "severity": "mild",
            "status": "active",
            "patient_id": user_with_patient["patient"].id
        }

        create_response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )

        injury_id = create_response.json()["id"]

        # Update injury status and notes
        update_data = {
            "status": "resolved",
            "recovery_notes": "Healed completely, no scarring",
            "notes": "Patient recovered well"
        }

        response = client.put(
            f"/api/v1/injuries/{injury_id}",
            json=update_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "resolved"
        assert data["recovery_notes"] == "Healed completely, no scarring"
        assert data["injury_name"] == "Minor Cut"  # Unchanged

    def test_update_injury_severity(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test updating injury severity."""
        # Create injury
        injury_data = {
            "injury_name": "Burn",
            "body_part": "Arm",
            "date_of_injury": "2025-12-15",
            "severity": "mild",
            "status": "active",
            "patient_id": user_with_patient["patient"].id
        }

        create_response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )

        injury_id = create_response.json()["id"]

        # Update to more severe
        update_data = {
            "severity": "moderate",
            "treatment_received": "Burn cream applied, dressing changed daily",
            "notes": "Severity reassessed after inflammation"
        }

        response = client.put(
            f"/api/v1/injuries/{injury_id}",
            json=update_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["severity"] == "moderate"

    def test_delete_injury(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test deleting an injury."""
        injury_data = {
            "injury_name": "Test Injury to Delete",
            "body_part": "Finger",
            "date_of_injury": "2025-12-01",
            "severity": "mild",
            "status": "resolved",
            "patient_id": user_with_patient["patient"].id
        }

        create_response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )

        injury_id = create_response.json()["id"]

        # Delete injury
        response = client.delete(
            f"/api/v1/injuries/{injury_id}",
            headers=authenticated_headers
        )

        assert response.status_code == 200

        # Verify deletion
        get_response = client.get(
            f"/api/v1/injuries/{injury_id}",
            headers=authenticated_headers
        )
        assert get_response.status_code == 404

    def test_injury_patient_isolation(self, client: TestClient, db_session: Session):
        """Test that users can only access their own injuries."""
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

        # User1 creates an injury
        injury_data = {
            "injury_name": "Private Injury",
            "body_part": "Knee",
            "date_of_injury": "2025-12-01",
            "severity": "moderate",
            "status": "active",
            "patient_id": patient1.id
        }

        create_response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=headers1
        )

        injury_id = create_response.json()["id"]

        # User2 tries to access User1's injury - should fail
        response = client.get(
            f"/api/v1/injuries/{injury_id}",
            headers=headers2
        )
        assert response.status_code == 404

        # User2 tries to update User1's injury - should fail
        update_response = client.put(
            f"/api/v1/injuries/{injury_id}",
            json={"severity": "mild"},
            headers=headers2
        )
        assert update_response.status_code == 404

    def test_injury_validation_errors(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test various validation error scenarios."""
        # Test missing required fields
        invalid_data = {
            "severity": "moderate",
            "status": "active"
            # Missing injury_name and body_part
        }

        response = client.post(
            "/api/v1/injuries/",
            json=invalid_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

        # Test invalid severity
        invalid_severity_data = {
            "injury_name": "Test Injury",
            "body_part": "Arm",
            "severity": "invalid_severity",
            "status": "active",
            "patient_id": user_with_patient["patient"].id
        }

        response = client.post(
            "/api/v1/injuries/",
            json=invalid_severity_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

        # Test invalid status
        invalid_status_data = {
            "injury_name": "Test Injury",
            "body_part": "Arm",
            "severity": "mild",
            "status": "invalid_status",
            "patient_id": user_with_patient["patient"].id
        }

        response = client.post(
            "/api/v1/injuries/",
            json=invalid_status_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

    def test_injury_with_laterality_options(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test creating injuries with different laterality options."""
        laterality_options = ["left", "right", "bilateral", "not_applicable"]

        for laterality in laterality_options:
            injury_data = {
                "injury_name": f"Test {laterality.title()} Injury",
                "body_part": "Arm",
                "laterality": laterality,
                "date_of_injury": "2025-12-01",
                "severity": "mild",
                "status": "active",
                "patient_id": user_with_patient["patient"].id
            }

            response = client.post(
                "/api/v1/injuries/",
                json=injury_data,
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert data["laterality"] == laterality

    def test_injury_status_transitions(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test injury status transitions through healing process."""
        # Create active injury
        injury_data = {
            "injury_name": "Healing Injury",
            "body_part": "Knee",
            "date_of_injury": "2025-11-01",
            "severity": "moderate",
            "status": "active",
            "patient_id": user_with_patient["patient"].id
        }

        create_response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )
        injury_id = create_response.json()["id"]

        # Transition to healing
        response = client.put(
            f"/api/v1/injuries/{injury_id}",
            json={"status": "healing", "recovery_notes": "Started physical therapy"},
            headers=authenticated_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "healing"

        # Transition to resolved
        response = client.put(
            f"/api/v1/injuries/{injury_id}",
            json={"status": "resolved", "recovery_notes": "Fully healed"},
            headers=authenticated_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "resolved"

    def test_injury_with_tags(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test creating and filtering injuries with tags."""
        injury_data = {
            "injury_name": "Tagged Injury",
            "body_part": "Ankle",
            "date_of_injury": "2025-12-01",
            "severity": "mild",
            "status": "active",
            "tags": ["sports", "running", "outdoor"],
            "patient_id": user_with_patient["patient"].id
        }

        response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "sports" in data["tags"]
        assert "running" in data["tags"]
        assert "outdoor" in data["tags"]
