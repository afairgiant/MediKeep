"""
Test patient height/weight updates with float values and edge cases.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import Patient


class TestPatientHeightWeightUpdates:
    """Test patient height and weight updates with comprehensive scenarios."""

    def test_update_patient_with_float_height_weight(self, authenticated_client: TestClient, test_patient: Patient):
        """Test updating patient with float height and weight values."""
        update_data = {
            "height": 68.9,  # Precise inches (Admin Fair's value)
            "weight": 182.98,  # Precise pounds
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["height"] == update_data["height"]
        assert data["weight"] == update_data["weight"]

    def test_update_patient_metric_conversions(self, authenticated_client: TestClient, test_patient: Patient):
        """Test updating patient with metric conversion values."""
        # Values that would come from frontend metric conversion
        # 175 cm = 68.898 inches, 83 kg = 183.0 lbs (approximately)
        update_data = {
            "height": 68.898,  # 175 cm converted
            "weight": 183.0,   # 83 kg converted  
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert abs(data["height"] - update_data["height"]) < 0.001
        assert abs(data["weight"] - update_data["weight"]) < 0.001

    def test_update_patient_precision_values(self, authenticated_client: TestClient, test_patient: Patient):
        """Test updating patient with high precision float values."""
        update_data = {
            "height": 70.866141732,  # Very precise conversion
            "weight": 187.393208,    # Very precise conversion
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        # Verify values are preserved with reasonable precision
        assert abs(data["height"] - update_data["height"]) < 0.0001
        assert abs(data["weight"] - update_data["weight"]) < 0.0001

    def test_update_patient_edge_case_values(self, authenticated_client: TestClient, test_patient: Patient):
        """Test updating patient with edge case float values."""
        edge_cases = [
            {"height": 12.0, "weight": 1.0},    # Minimum values
            {"height": 107.99, "weight": 991.9},  # Near maximum values
            {"height": 60.5, "weight": 150.25},   # Common values with decimals
        ]

        for update_data in edge_cases:
            response = authenticated_client.put("/api/v1/patients/me", json=update_data)

            assert response.status_code == 200
            data = response.json()
            assert data["height"] == update_data["height"]
            assert data["weight"] == update_data["weight"]

    def test_update_patient_invalid_float_values(self, authenticated_client: TestClient, test_patient: Patient):
        """Test updating patient with invalid float values."""
        invalid_cases = [
            {"height": -5.5, "weight": 150.0},    # Negative height
            {"height": 70.0, "weight": -10.2},    # Negative weight
            {"height": 200.5, "weight": 150.0},   # Height too large
            {"height": 70.0, "weight": 1500.7},   # Weight too large
            {"height": 0.0, "weight": 150.0},     # Zero height
            {"height": 70.0, "weight": 0.0},      # Zero weight
        ]

        for update_data in invalid_cases:
            response = authenticated_client.put("/api/v1/patients/me", json=update_data)
            assert response.status_code == 422

    def test_update_patient_only_height(self, authenticated_client: TestClient, test_patient: Patient, db_session: Session):
        """Test updating only height while preserving weight."""
        # Get current patient data
        response = authenticated_client.get("/api/v1/patients/me")
        original_data = response.json()
        original_weight = original_data.get("weight")

        # Update only height
        update_data = {"height": 71.25}
        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["height"] == 71.25
        # Weight should remain unchanged
        assert data["weight"] == original_weight

    def test_update_patient_only_weight(self, authenticated_client: TestClient, test_patient: Patient, db_session: Session):
        """Test updating only weight while preserving height."""
        # Get current patient data
        response = authenticated_client.get("/api/v1/patients/me")
        original_data = response.json()
        original_height = original_data.get("height")

        # Update only weight  
        update_data = {"weight": 175.5}
        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["weight"] == 175.5
        # Height should remain unchanged
        assert data["height"] == original_height

    def test_update_patient_null_values(self, authenticated_client: TestClient, test_patient: Patient):
        """Test updating patient with null height/weight values."""
        update_data = {
            "height": None,
            "weight": None,
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["height"] is None
        assert data["weight"] is None

    def test_patient_management_api_with_floats(self, authenticated_client: TestClient, test_patient: Patient):
        """Test patient management API handles float values correctly."""
        # Test the patient management endpoint as well
        response = authenticated_client.get("/api/v1/patient-management/")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return patient list without validation errors
        assert "patients" in data
        assert len(data["patients"]) > 0
        
        # First patient should have properly handled float values
        first_patient = data["patients"][0]
        if first_patient.get("height") is not None:
            assert isinstance(first_patient["height"], (int, float))
        if first_patient.get("weight") is not None:
            assert isinstance(first_patient["weight"], (int, float))

    @pytest.mark.parametrize("height,weight", [
        (68.9, 182.98),      # Admin Fair's actual values
        (70.866, 187.39),    # Metric conversion values
        (72.0, 200.0),       # Round numbers  
        (65.5, 130.25),      # Typical values
        (60.0, 100.0),       # Smaller person
        (75.0, 250.0),       # Larger person
    ])
    def test_multiple_height_weight_combinations(self, authenticated_client: TestClient, test_patient: Patient, height: float, weight: float):
        """Test various height/weight combinations that should all work."""
        update_data = {
            "height": height,
            "weight": weight,
        }

        response = authenticated_client.put("/api/v1/patients/me", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["height"] == height
        assert data["weight"] == weight

    def test_sequential_updates_preserve_values(self, authenticated_client: TestClient, test_patient: Patient):
        """Test that sequential updates properly preserve and change values."""
        # First update
        update1 = {"height": 68.5, "weight": 180.0}
        response1 = authenticated_client.put("/api/v1/patients/me", json=update1)
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["height"] == 68.5
        assert data1["weight"] == 180.0

        # Second update - change only height
        update2 = {"height": 69.75}
        response2 = authenticated_client.put("/api/v1/patients/me", json=update2)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["height"] == 69.75
        assert data2["weight"] == 180.0  # Should preserve previous weight

        # Third update - change only weight  
        update3 = {"weight": 175.25}
        response3 = authenticated_client.put("/api/v1/patients/me", json=update3)
        assert response3.status_code == 200
        data3 = response3.json()
        assert data3["height"] == 69.75   # Should preserve previous height
        assert data3["weight"] == 175.25

    def test_database_precision_handling(self, authenticated_client: TestClient, test_patient: Patient, db_session: Session):
        """Test that database properly handles float precision."""
        # Update with very precise values
        precise_values = {
            "height": 68.897637795,
            "weight": 183.004409245,
        }

        response = authenticated_client.put("/api/v1/patients/me", json=precise_values)
        assert response.status_code == 200

        # Retrieve directly from database to check precision
        db_patient = db_session.query(Patient).filter(Patient.id == test_patient.id).first()
        
        # Should preserve reasonable precision (PostgreSQL double precision)
        assert abs(db_patient.height - precise_values["height"]) < 0.000001
        assert abs(db_patient.weight - precise_values["weight"]) < 0.000001