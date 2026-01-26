"""
Tests for Injury Types API endpoints.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestInjuryTypesAPI:
    """Test Injury Types API endpoints."""

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
        user_data["user"].active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(user_data["user"])
        return {**user_data, "patient": patient}

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        """Create authentication headers."""
        return create_user_token_headers(user_with_patient["user"].username)

    def test_get_injury_types_list(self, client: TestClient, authenticated_headers):
        """Test getting list of injury types."""
        response = client.get(
            "/api/v1/injury-types/",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()

        # In test DB, may start empty (system types are seeded via migrations)
        assert isinstance(data, list)

    def test_get_injury_types_dropdown(self, client: TestClient, authenticated_headers):
        """Test getting injury types for dropdown."""
        response = client.get(
            "/api/v1/injury-types/dropdown",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_custom_injury_type(self, client: TestClient, authenticated_headers):
        """Test creating a custom injury type."""
        type_data = {
            "name": "Custom Test Injury Type",
            "description": "A custom injury type for testing"
        }

        response = client.post(
            "/api/v1/injury-types/",
            json=type_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Custom Test Injury Type"
        assert data["description"] == "A custom injury type for testing"
        assert data["is_system"] is False  # User-created types are not system types

    def test_create_injury_type_without_description(self, client: TestClient, authenticated_headers):
        """Test creating an injury type without description."""
        type_data = {
            "name": "Simple Injury Type"
        }

        response = client.post(
            "/api/v1/injury-types/",
            json=type_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Simple Injury Type"
        assert data["is_system"] is False

    def test_create_duplicate_injury_type(self, client: TestClient, authenticated_headers):
        """Test that creating duplicate injury type fails."""
        type_data = {
            "name": "Duplicate Test Type",
            "description": "First creation"
        }

        # Create first time
        response1 = client.post(
            "/api/v1/injury-types/",
            json=type_data,
            headers=authenticated_headers
        )
        assert response1.status_code == 200

        # Try to create duplicate
        response2 = client.post(
            "/api/v1/injury-types/",
            json=type_data,
            headers=authenticated_headers
        )

        # Should fail with conflict or bad request
        assert response2.status_code in [400, 409]

    def test_delete_custom_injury_type(self, client: TestClient, authenticated_headers):
        """Test deleting a custom (user-created) injury type."""
        # First create a custom type
        type_data = {
            "name": "Type to Delete",
            "description": "This type will be deleted"
        }

        create_response = client.post(
            "/api/v1/injury-types/",
            json=type_data,
            headers=authenticated_headers
        )
        assert create_response.status_code == 200
        type_id = create_response.json()["id"]

        # Delete the type
        delete_response = client.delete(
            f"/api/v1/injury-types/{type_id}",
            headers=authenticated_headers
        )

        assert delete_response.status_code == 200

    def test_cannot_delete_system_injury_type(self, client: TestClient, authenticated_headers, db_session: Session):
        """Test that system-defined injury types cannot be deleted."""
        # Get list of types to find a system type
        response = client.get(
            "/api/v1/injury-types/",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        types = response.json()

        # Find a system type
        system_types = [t for t in types if t.get("is_system", False)]

        if system_types:
            system_type_id = system_types[0]["id"]

            # Try to delete system type - should fail
            delete_response = client.delete(
                f"/api/v1/injury-types/{system_type_id}",
                headers=authenticated_headers
            )

            assert delete_response.status_code == 400

    def test_cannot_delete_injury_type_in_use(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test that injury types referenced by injuries cannot be deleted."""
        # Create a custom injury type
        type_data = {
            "name": "Type In Use",
            "description": "This type will be used by an injury"
        }

        type_response = client.post(
            "/api/v1/injury-types/",
            json=type_data,
            headers=authenticated_headers
        )
        assert type_response.status_code == 200
        type_id = type_response.json()["id"]

        # Create an injury using this type
        injury_data = {
            "injury_name": "Test Injury",
            "body_part": "Arm",
            "injury_type_id": type_id,
            "severity": "mild",
            "status": "active",
            "patient_id": user_with_patient["patient"].id
        }

        injury_response = client.post(
            "/api/v1/injuries/",
            json=injury_data,
            headers=authenticated_headers
        )
        assert injury_response.status_code == 200

        # Try to delete the type - should fail because it's in use
        delete_response = client.delete(
            f"/api/v1/injury-types/{type_id}",
            headers=authenticated_headers
        )

        assert delete_response.status_code == 400

    def test_get_injury_type_by_id(self, client: TestClient, authenticated_headers):
        """Test getting a specific injury type by ID."""
        # Create a type first
        type_data = {
            "name": "Specific Type",
            "description": "Type to retrieve by ID"
        }

        create_response = client.post(
            "/api/v1/injury-types/",
            json=type_data,
            headers=authenticated_headers
        )
        assert create_response.status_code == 200
        type_id = create_response.json()["id"]

        # Get by ID
        response = client.get(
            f"/api/v1/injury-types/{type_id}",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == type_id
        assert data["name"] == "Specific Type"

    def test_injury_type_validation(self, client: TestClient, authenticated_headers):
        """Test validation for injury type creation."""
        # Test empty name
        invalid_data = {
            "name": "",
            "description": "Invalid type"
        }

        response = client.post(
            "/api/v1/injury-types/",
            json=invalid_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

    def test_create_injury_with_type(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test creating an injury with an injury type."""
        # Create a custom injury type
        type_data = {
            "name": "Test Sprain Type",
            "description": "Type for sprain injuries"
        }

        type_response = client.post(
            "/api/v1/injury-types/",
            json=type_data,
            headers=authenticated_headers
        )
        assert type_response.status_code == 200
        type_id = type_response.json()["id"]

        # Create an injury using this type
        injury_data = {
            "injury_name": "Ankle Sprain",
            "body_part": "Ankle",
            "injury_type_id": type_id,
            "severity": "moderate",
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
        assert data["injury_type_id"] == type_id
        # The response should include the injury type details
        if "injury_type" in data and data["injury_type"]:
            assert data["injury_type"]["name"] == "Test Sprain Type"

    def test_injury_types_include_system_flag(self, client: TestClient, authenticated_headers):
        """Test that injury types response includes is_system flag."""
        response = client.get(
            "/api/v1/injury-types/",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()

        for injury_type in data:
            assert "is_system" in injury_type
            assert isinstance(injury_type["is_system"], bool)
