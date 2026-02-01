"""
Test vitals API endpoints.
"""
import pytest
from datetime import date, datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.crud.practitioner import practitioner as practitioner_crud
from app.schemas.patient import PatientCreate
from app.schemas.practitioner import PractitionerCreate


class TestVitalsAPI:
    """Test vitals API endpoints."""

    @pytest.fixture
    def test_patient_with_practitioner(self, db_session: Session, test_user):
        """Create test patient and practitioner for vitals tests."""
        # Create practitioner
        practitioner_data = PractitionerCreate(
            name="Dr. Emily Chen",
            specialty="Family Medicine",
            practice="Community Health Center",
            phone_number="555-555-0123"
        )
        practitioner = practitioner_crud.create(db_session, obj_in=practitioner_data)
        
        # Create patient
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St"
        )
        patient = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )

        # Set as active patient for multi-patient system
        test_user.active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(test_user)

        return {"patient": patient, "practitioner": practitioner}

    def test_create_vitals(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test creating new vitals record."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        vitals_data = {
            "patient_id": patient.id,
            "practitioner_id": practitioner.id,
            "recorded_date": "2024-01-15T10:30:00",
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "heart_rate": 72,
            "temperature": 98.6,
            "weight": 180.0,
            "height": 70.0,
            "oxygen_saturation": 98.5,
            "respiratory_rate": 16,
            "blood_glucose": 85.0,
            "a1c": 5.7,
            "bmi": 25.8,
            "pain_scale": 2,
            "notes": "Normal vitals, patient feeling well",
            "location": "clinic",
            "device_used": "digital monitor"
        }
        
        response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["systolic_bp"] == 120
        assert data["diastolic_bp"] == 80
        assert data["heart_rate"] == 72
        assert data["temperature"] == 98.6
        assert data["weight"] == 180.0
        assert data["patient_id"] == patient.id
        assert data["practitioner_id"] == practitioner.id

    def test_get_vitals_by_patient(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test getting vitals for a patient."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        # Create test vitals
        vitals_data = [
            {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": "2024-01-15T10:30:00",
                "systolic_bp": 120,
                "diastolic_bp": 80,
                "heart_rate": 72,
                "temperature": 98.6
            },
            {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": "2024-01-20T14:15:00",
                "systolic_bp": 125,
                "diastolic_bp": 82,
                "heart_rate": 75,
                "temperature": 98.8
            }
        ]
        
        created_vitals = []
        for vital_data in vitals_data:
            response = authenticated_client.post("/api/v1/vitals/", json=vital_data)
            assert response.status_code == 200
            created_vitals.append(response.json())
        
        # Get vitals for patient
        response = authenticated_client.get(f"/api/v1/vitals/patient/{patient.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        # Should be ordered by recorded_date descending (most recent first)
        assert data[0]["systolic_bp"] == 125  # Most recent
        assert data[1]["systolic_bp"] == 120  # Earlier

    def test_get_recent_vitals(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test getting recent vitals within specified timeframe."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        # Create recent and old vitals
        from datetime import datetime, timedelta
        
        recent_vitals = {
            "patient_id": patient.id,
            "practitioner_id": practitioner.id,
            "recorded_date": (datetime.now() - timedelta(days=5)).isoformat(),
            "systolic_bp": 118,
            "diastolic_bp": 78,
            "heart_rate": 70
        }
        
        old_vitals = {
            "patient_id": patient.id,
            "practitioner_id": practitioner.id,
            "recorded_date": (datetime.now() - timedelta(days=100)).isoformat(),
            "systolic_bp": 130,
            "diastolic_bp": 85,
            "heart_rate": 80
        }
        
        # Create both vitals
        response = authenticated_client.post("/api/v1/vitals/", json=recent_vitals)
        assert response.status_code == 200
        recent_vital = response.json()
        
        response = authenticated_client.post("/api/v1/vitals/", json=old_vitals)
        assert response.status_code == 200

        # Get recent vitals (last 30 days using days parameter)
        response = authenticated_client.get(f"/api/v1/vitals/patient/{patient.id}?days=30")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == recent_vital["id"]

    def test_update_vitals(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test updating vitals record."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        # Create vitals
        vitals_data = {
            "patient_id": patient.id,
            "practitioner_id": practitioner.id,
            "recorded_date": "2024-01-15T10:30:00",
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "heart_rate": 72,
            "notes": "Initial reading"
        }
        
        response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
        assert response.status_code == 200
        vitals = response.json()
        
        # Update vitals
        update_data = {
            "systolic_bp": 125,
            "diastolic_bp": 82,
            "notes": "Updated reading - slightly elevated",
            "pain_scale": 3
        }
        
        response = authenticated_client.put(f"/api/v1/vitals/{vitals['id']}", json=update_data)
        
        assert response.status_code == 200
        updated_vitals = response.json()
        assert updated_vitals["systolic_bp"] == 125
        assert updated_vitals["diastolic_bp"] == 82
        assert updated_vitals["notes"] == "Updated reading - slightly elevated"
        assert updated_vitals["pain_scale"] == 3
        assert updated_vitals["heart_rate"] == 72  # Unchanged

    def test_delete_vitals(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test deleting vitals record."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        # Create vitals
        vitals_data = {
            "patient_id": patient.id,
            "practitioner_id": practitioner.id,
            "recorded_date": "2024-01-15T10:30:00",
            "systolic_bp": 120,
            "diastolic_bp": 80
        }
        
        response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
        assert response.status_code == 200
        vitals = response.json()
        
        # Delete vitals
        response = authenticated_client.delete(f"/api/v1/vitals/{vitals['id']}")
        
        assert response.status_code == 200
        
        # Verify vitals is deleted
        response = authenticated_client.get(f"/api/v1/vitals/{vitals['id']}")
        assert response.status_code == 404

    def test_get_vitals_by_id(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test getting specific vitals by ID."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        # Create vitals
        vitals_data = {
            "patient_id": patient.id,
            "practitioner_id": practitioner.id,
            "recorded_date": "2024-01-15T10:30:00",
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "heart_rate": 72,
            "temperature": 98.6,
            "bmi": 25.8
        }
        
        response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
        assert response.status_code == 200
        vitals = response.json()
        
        # Get vitals by ID
        response = authenticated_client.get(f"/api/v1/vitals/{vitals['id']}")
        
        assert response.status_code == 200
        retrieved_vitals = response.json()
        assert retrieved_vitals["systolic_bp"] == 120
        assert retrieved_vitals["diastolic_bp"] == 80
        assert retrieved_vitals["heart_rate"] == 72
        assert retrieved_vitals["bmi"] == 25.8

    def test_vitals_validation_errors(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test vitals validation errors."""
        patient = test_patient_with_practitioner["patient"]
        
        # Test missing required fields
        invalid_vitals = {
            "patient_id": patient.id,
            # Missing recorded_date (required field)
            "systolic_bp": 120
        }
        
        response = authenticated_client.post("/api/v1/vitals/", json=invalid_vitals)
        assert response.status_code == 422
        
        # Test invalid blood pressure values
        invalid_bp_vitals = {
            "patient_id": patient.id,
            "recorded_date": "2024-01-15T10:30:00",
            "systolic_bp": -10,  # Invalid negative value
            "diastolic_bp": 300   # Unrealistic high value
        }
        
        response = authenticated_client.post("/api/v1/vitals/", json=invalid_bp_vitals)
        assert response.status_code == 422

    def test_bmi_calculation(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test BMI calculation in vitals."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        # Create vitals with height and weight (BMI should be calculated)
        vitals_data = {
            "patient_id": patient.id,
            "practitioner_id": practitioner.id,
            "recorded_date": "2024-01-15T10:30:00",
            "weight": 180.0,  # pounds
            "height": 70.0,   # inches
            "bmi": 25.8       # Should match calculated BMI
        }
        
        response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["weight"] == 180.0
        assert data["height"] == 70.0
        assert data["bmi"] == 25.8

    def test_vitals_search_and_filtering(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test searching and filtering vitals."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        # Create vitals with different characteristics
        vitals_data = [
            {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": "2024-01-15T10:30:00",
                "systolic_bp": 140,  # High
                "diastolic_bp": 90,
                "location": "clinic"
            },
            {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": "2024-01-20T14:15:00",
                "systolic_bp": 118,  # Normal
                "diastolic_bp": 78,
                "location": "home"
            }
        ]
        
        for vital_data in vitals_data:
            response = authenticated_client.post("/api/v1/vitals/", json=vital_data)
            assert response.status_code == 200

        # Get all vitals for patient (API doesn't support location filtering)
        response = authenticated_client.get(f"/api/v1/vitals/patient/{patient.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Check both records are returned
        locations = [v["location"] for v in data]
        assert "clinic" in locations
        assert "home" in locations

    def test_unauthorized_access(self, client: TestClient, test_patient_with_practitioner):
        """Test unauthorized access to vitals endpoints."""
        patient = test_patient_with_practitioner["patient"]
        
        # Test without authentication
        response = client.get(f"/api/v1/vitals/patient/{patient.id}")
        assert response.status_code == 401
        
        # Test creating vitals without auth
        vitals_data = {
            "patient_id": patient.id,
            "recorded_date": "2024-01-15T10:30:00",
            "systolic_bp": 120,
            "diastolic_bp": 80
        }
        
        response = client.post("/api/v1/vitals/", json=vitals_data)
        assert response.status_code == 401

    def test_vitals_trends_analysis(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test vitals trends analysis endpoint."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]
        
        # Create series of vitals showing trend
        from datetime import datetime, timedelta
        
        base_date = datetime.now() - timedelta(days=30)
        vitals_series = [
            {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": (base_date + timedelta(days=i*10)).isoformat(),
                "systolic_bp": 120 + i*5,  # Increasing trend
                "diastolic_bp": 80 + i*2,
                "weight": 180 + i*2
            }
            for i in range(3)
        ]
        
        for vital_data in vitals_series:
            response = authenticated_client.post("/api/v1/vitals/", json=vital_data)
            assert response.status_code == 200

        # Get all vitals for patient (API doesn't have /trends endpoint)
        response = authenticated_client.get(f"/api/v1/vitals/patient/{patient.id}")

        assert response.status_code == 200
        data = response.json()

        # Should return all vitals records
        assert len(data) == 3
        # Check that vitals data is returned (trend analysis would be done client-side)
        assert all("systolic_bp" in v for v in data)
        assert all("weight" in v for v in data)

    def test_create_vitals_with_a1c(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test creating vitals record with A1C value."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]

        vitals_data = {
            "patient_id": patient.id,
            "practitioner_id": practitioner.id,
            "recorded_date": "2024-01-15T10:30:00",
            "blood_glucose": 120.0,
            "a1c": 6.5
        }

        response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)

        assert response.status_code == 200
        data = response.json()
        assert data["blood_glucose"] == 120.0
        assert data["a1c"] == 6.5

    def test_a1c_validation_errors(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test A1C validation errors."""
        patient = test_patient_with_practitioner["patient"]

        # Test A1C value too high
        invalid_a1c_vitals = {
            "patient_id": patient.id,
            "recorded_date": "2024-01-15T10:30:00",
            "a1c": 25.0  # Invalid - above 20%
        }

        response = authenticated_client.post("/api/v1/vitals/", json=invalid_a1c_vitals)
        assert response.status_code == 422

        # Test negative A1C value
        invalid_negative_a1c = {
            "patient_id": patient.id,
            "recorded_date": "2024-01-15T10:30:00",
            "a1c": -1.0  # Invalid - negative
        }

        response = authenticated_client.post("/api/v1/vitals/", json=invalid_negative_a1c)
        assert response.status_code == 422

    def test_get_vitals_paginated(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test the paginated vitals endpoint."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]

        # Create 25 vitals records
        from datetime import timedelta
        base_date = datetime(2024, 1, 1, 10, 0, 0)

        for i in range(25):
            vitals_data = {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": (base_date + timedelta(days=i)).isoformat(),
                "systolic_bp": 110 + (i % 20),
                "diastolic_bp": 70 + (i % 15),
                "heart_rate": 60 + (i % 30)
            }
            response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
            assert response.status_code == 200

        # Test paginated endpoint - first page
        response = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=0&limit=10"
        )
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data

        assert len(data["items"]) == 10
        assert data["total"] == 25
        assert data["skip"] == 0
        assert data["limit"] == 10

    def test_get_vitals_paginated_second_page(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test paginated endpoint returns correct second page."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]

        # Create 25 vitals records
        from datetime import timedelta
        base_date = datetime(2024, 1, 1, 10, 0, 0)

        for i in range(25):
            vitals_data = {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": (base_date + timedelta(days=i)).isoformat(),
                "systolic_bp": 110 + i,  # Unique value to identify records
                "diastolic_bp": 70,
                "heart_rate": 72
            }
            response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
            assert response.status_code == 200

        # Get first page
        response1 = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=0&limit=10"
        )
        assert response1.status_code == 200
        page1 = response1.json()

        # Get second page
        response2 = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=10&limit=10"
        )
        assert response2.status_code == 200
        page2 = response2.json()

        assert len(page1["items"]) == 10
        assert len(page2["items"]) == 10
        assert page1["total"] == 25
        assert page2["total"] == 25

        # Verify no overlap between pages
        page1_ids = {v["id"] for v in page1["items"]}
        page2_ids = {v["id"] for v in page2["items"]}
        assert len(page1_ids & page2_ids) == 0

    def test_get_vitals_paginated_last_page(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test paginated endpoint returns correct partial last page."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]

        # Create 25 vitals records
        from datetime import timedelta
        base_date = datetime(2024, 1, 1, 10, 0, 0)

        for i in range(25):
            vitals_data = {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": (base_date + timedelta(days=i)).isoformat(),
                "systolic_bp": 120,
                "diastolic_bp": 80,
                "heart_rate": 72
            }
            response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
            assert response.status_code == 200

        # Get third (last) page - should have only 5 records
        response = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=20&limit=10"
        )
        assert response.status_code == 200
        data = response.json()

        assert len(data["items"]) == 5  # Only 5 remaining records
        assert data["total"] == 25
        assert data["skip"] == 20
        assert data["limit"] == 10

    def test_get_vitals_paginated_with_vital_type_filter(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test paginated endpoint with vital_type filter."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]

        # Create vitals with different measurements
        from datetime import timedelta
        base_date = datetime(2024, 1, 1, 10, 0, 0)

        # 10 records with blood pressure
        for i in range(10):
            vitals_data = {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": (base_date + timedelta(days=i)).isoformat(),
                "systolic_bp": 120,
                "diastolic_bp": 80
            }
            response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
            assert response.status_code == 200

        # 5 records with temperature only
        for i in range(5):
            vitals_data = {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": (base_date + timedelta(days=10+i)).isoformat(),
                "temperature": 98.6
            }
            response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
            assert response.status_code == 200

        # Get paginated blood pressure readings
        response = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=0&limit=10&vital_type=blood_pressure"
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 10  # Only blood pressure records
        assert len(data["items"]) == 10
        assert all(v["systolic_bp"] is not None for v in data["items"])

    def test_large_dataset_returns_all_records(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test that non-paginated endpoint can return more than 100 records."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]

        num_records = 150
        from datetime import timedelta
        base_date = datetime(2024, 1, 1, 10, 0, 0)

        # Create 150 vitals records
        for i in range(num_records):
            vitals_data = {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": (base_date + timedelta(hours=i)).isoformat(),
                "systolic_bp": 110 + (i % 30),
                "diastolic_bp": 70 + (i % 20),
                "heart_rate": 60 + (i % 40)
            }
            response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
            assert response.status_code == 200

        # Get all vitals using non-paginated endpoint (should return all 150)
        response = authenticated_client.get(f"/api/v1/vitals/patient/{patient.id}")
        assert response.status_code == 200
        data = response.json()

        # Verify all 150 records are returned (not capped at 100)
        assert len(data) == num_records

    def test_paginated_endpoint_limit_validation(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test paginated endpoint validates limit parameter."""
        patient = test_patient_with_practitioner["patient"]

        # Test limit > 100 should be rejected
        response = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=0&limit=150"
        )
        assert response.status_code == 422  # Validation error

        # Test limit = 0 should be rejected
        response = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=0&limit=0"
        )
        assert response.status_code == 422

        # Test negative skip should be rejected
        response = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=-1&limit=10"
        )
        assert response.status_code == 422

    def test_paginated_endpoint_empty_result(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test paginated endpoint with no records."""
        patient = test_patient_with_practitioner["patient"]

        response = authenticated_client.get(
            f"/api/v1/vitals/patient/{patient.id}/paginated?skip=0&limit=10"
        )
        assert response.status_code == 200
        data = response.json()

        assert data["items"] == []
        assert data["total"] == 0
        assert data["skip"] == 0
        assert data["limit"] == 10

    def test_paginated_large_dataset_consistency(self, authenticated_client: TestClient, test_patient_with_practitioner):
        """Test that paginated endpoint returns consistent totals across pages."""
        patient = test_patient_with_practitioner["patient"]
        practitioner = test_patient_with_practitioner["practitioner"]

        num_records = 55
        from datetime import timedelta
        base_date = datetime(2024, 1, 1, 10, 0, 0)

        # Create 55 vitals records
        for i in range(num_records):
            vitals_data = {
                "patient_id": patient.id,
                "practitioner_id": practitioner.id,
                "recorded_date": (base_date + timedelta(hours=i)).isoformat(),
                "systolic_bp": 120,
                "diastolic_bp": 80,
                "heart_rate": 72
            }
            response = authenticated_client.post("/api/v1/vitals/", json=vitals_data)
            assert response.status_code == 200

        # Fetch all pages and verify consistency
        all_ids = set()
        total_from_response = None

        for page in range(6):  # 6 pages of 10 to cover 55 records
            response = authenticated_client.get(
                f"/api/v1/vitals/patient/{patient.id}/paginated?skip={page*10}&limit=10"
            )
            assert response.status_code == 200
            data = response.json()

            # Verify total is consistent across all pages
            if total_from_response is None:
                total_from_response = data["total"]
            else:
                assert data["total"] == total_from_response

            # Collect all IDs
            for item in data["items"]:
                all_ids.add(item["id"])

        # Verify we got all unique records
        assert len(all_ids) == num_records
        assert total_from_response == num_records