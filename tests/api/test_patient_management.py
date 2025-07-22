"""
Test patient management endpoints (V1 Netflix-style patient switching).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import User, Patient


class TestPatientManagementAPI:
    """Test patient management API endpoints."""

    def test_get_accessible_patients_with_floats(self, authenticated_client: TestClient, test_patient: Patient):
        """Test getting accessible patients handles float height/weight correctly."""
        # First update the patient with float values
        authenticated_client.put("/api/v1/patients/me", json={
            "height": 68.9,
            "weight": 182.98
        })

        # Now test the patient management API
        response = authenticated_client.get("/api/v1/patient-management/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "patients" in data
        assert "total_count" in data
        assert "owned_count" in data
        assert "shared_count" in data
        
        assert len(data["patients"]) > 0
        
        # Find our patient in the list
        our_patient = None
        for patient in data["patients"]:
            if patient["id"] == test_patient.id:
                our_patient = patient
                break
        
        assert our_patient is not None
        assert our_patient["height"] == 68.9
        assert our_patient["weight"] == 182.98

    def test_get_specific_patient_with_floats(self, authenticated_client: TestClient, test_patient: Patient):
        """Test getting specific patient by ID handles floats correctly."""
        # Update patient with float values
        authenticated_client.put("/api/v1/patients/me", json={
            "height": 70.866,
            "weight": 187.39
        })

        response = authenticated_client.get(f"/api/v1/patient-management/{test_patient.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == test_patient.id
        assert data["height"] == 70.866
        assert data["weight"] == 187.39

    def test_create_patient_with_floats(self, authenticated_client: TestClient, db_session: Session):
        """Test creating patient with float height/weight values."""
        patient_data = {
            "first_name": "Float",
            "last_name": "Test", 
            "birth_date": "1990-01-01",
            "gender": "M",
            "height": 71.25,
            "weight": 175.5,
            "is_self_record": False
        }

        response = authenticated_client.post("/api/v1/patient-management/", json=patient_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["first_name"] == "Float"
        assert data["last_name"] == "Test"
        assert data["height"] == 71.25
        assert data["weight"] == 175.5

    def test_update_patient_with_floats(self, authenticated_client: TestClient, test_patient: Patient):
        """Test updating patient through management API with floats."""
        update_data = {
            "first_name": "Updated",
            "height": 69.5,
            "weight": 180.25
        }

        response = authenticated_client.put(f"/api/v1/patient-management/{test_patient.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["first_name"] == "Updated"
        assert data["height"] == 69.5
        assert data["weight"] == 180.25

    def test_patient_stats_with_multiple_patients(self, authenticated_client: TestClient, db_session: Session):
        """Test patient statistics endpoint."""
        response = authenticated_client.get("/api/v1/patient-management/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "owned_count" in data
        assert "accessible_count" in data
        assert "has_self_record" in data
        assert "sharing_stats" in data
        
        assert isinstance(data["owned_count"], int)
        assert isinstance(data["accessible_count"], int)
        assert isinstance(data["has_self_record"], bool)

    def test_get_self_record(self, authenticated_client: TestClient, test_patient: Patient):
        """Test getting user's self record."""
        response = authenticated_client.get("/api/v1/patient-management/self-record")
        
        # Response can be null if no self-record exists
        assert response.status_code == 200
        data = response.json()
        
        if data is not None:
            assert "id" in data
            assert "first_name" in data
            assert "last_name" in data
            # Height and weight can be null or float
            if data.get("height") is not None:
                assert isinstance(data["height"], (int, float))
            if data.get("weight") is not None:
                assert isinstance(data["weight"], (int, float))

    def test_switch_active_patient(self, authenticated_client: TestClient, test_patient: Patient):
        """Test switching active patient context."""
        switch_data = {
            "patient_id": test_patient.id
        }

        response = authenticated_client.post("/api/v1/patient-management/switch", json=switch_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == test_patient.id
        
        # Verify we can get the active patient
        active_response = authenticated_client.get("/api/v1/patient-management/active/current")
        assert active_response.status_code == 200
        active_data = active_response.json()
        
        if active_data is not None:
            assert active_data["id"] == test_patient.id

    def test_get_owned_patients(self, authenticated_client: TestClient, test_patient: Patient):
        """Test getting owned patients list."""
        response = authenticated_client.get("/api/v1/patient-management/owned/list")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Find our test patient
        our_patient = None
        for patient in data:
            if patient["id"] == test_patient.id:
                our_patient = patient
                break
        
        assert our_patient is not None

    def test_patient_management_validation_errors(self, authenticated_client: TestClient):
        """Test validation errors in patient management API."""
        invalid_data = {
            "first_name": "",  # Empty name
            "last_name": "",   # Empty name
            "birth_date": "2030-01-01",  # Future date
            "height": -10.5,   # Negative height
            "weight": 2000.0,  # Too heavy
        }

        response = authenticated_client.post("/api/v1/patient-management/", json=invalid_data)
        assert response.status_code == 422

    @pytest.mark.parametrize("height,weight", [
        (68.9, 182.98),     # Admin Fair values
        (70.866, 187.39),   # User test values
        (60.5, 120.25),     # Smaller person
        (75.0, 250.0),      # Larger person
        (72.0, None),       # Height only
        (None, 150.0),      # Weight only
        (None, None),       # Neither
    ])
    def test_patient_management_float_combinations(self, authenticated_client: TestClient, test_patient: Patient, height, weight):
        """Test various height/weight combinations through management API."""
        update_data = {}
        if height is not None:
            update_data["height"] = height
        if weight is not None:
            update_data["weight"] = weight
            
        # Add required field to make it a valid update
        update_data["first_name"] = "Test"

        response = authenticated_client.put(f"/api/v1/patient-management/{test_patient.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        
        if height is not None:
            assert data["height"] == height
        if weight is not None:
            assert data["weight"] == weight

    def test_patient_management_precision_preservation(self, authenticated_client: TestClient, test_patient: Patient):
        """Test that patient management API preserves float precision."""
        precise_data = {
            "height": 68.897637795,
            "weight": 183.004409245,
            "first_name": "Precision"
        }

        response = authenticated_client.put(f"/api/v1/patient-management/{test_patient.id}", json=precise_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should preserve reasonable precision
        assert abs(data["height"] - precise_data["height"]) < 0.000001
        assert abs(data["weight"] - precise_data["weight"]) < 0.000001

    def test_cross_api_consistency(self, authenticated_client: TestClient, test_patient: Patient):
        """Test that both patient APIs return consistent data."""
        # Update through regular patients API
        update_data = {
            "height": 69.75,
            "weight": 185.5,
            "first_name": "Consistency"
        }
        
        patients_response = authenticated_client.put("/api/v1/patients/me", json=update_data)
        assert patients_response.status_code == 200
        
        # Get data through patient management API
        mgmt_response = authenticated_client.get(f"/api/v1/patient-management/{test_patient.id}")
        assert mgmt_response.status_code == 200
        
        # Both should return the same data
        patients_data = patients_response.json()
        mgmt_data = mgmt_response.json()
        
        assert patients_data["height"] == mgmt_data["height"] == 69.75
        assert patients_data["weight"] == mgmt_data["weight"] == 185.5
        assert patients_data["first_name"] == mgmt_data["first_name"] == "Consistency"