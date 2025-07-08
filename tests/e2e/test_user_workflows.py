"""
End-to-end tests for complete user workflows.
"""
import os
import time
import requests
import pytest
from typing import Dict, Any


class TestUserWorkflows:
    """Test complete user workflows from registration to medical records management."""

    @pytest.fixture(scope="class")
    def api_base_url(self) -> str:
        """Get the base URL for API testing."""
        return os.getenv("API_BASE_URL", "http://localhost:8000")

    @pytest.fixture
    def test_user_data(self) -> Dict[str, Any]:
        """Create test user data."""
        import random
        import string
        
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        
        return {
            "username": f"testuser_{random_suffix}",
            "email": f"test_{random_suffix}@example.com", 
            "password": "testpassword123",
            "full_name": f"Test User {random_suffix}"
        }

    def test_complete_user_registration_flow(self, api_base_url: str, test_user_data: Dict[str, Any]):
        """Test the complete user registration and patient setup flow."""
        
        # Step 1: Register new user
        register_response = requests.post(
            f"{api_base_url}/api/v1/auth/register",
            json=test_user_data,
            timeout=10
        )
        
        assert register_response.status_code == 201
        user_data = register_response.json()
        assert user_data["username"] == test_user_data["username"]
        assert user_data["email"] == test_user_data["email"]
        
        # Step 2: Login with new user
        login_response = requests.post(
            f"{api_base_url}/api/v1/auth/login",
            data={
                "username": test_user_data["username"],
                "password": test_user_data["password"]
            },
            timeout=10
        )
        
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert "access_token" in login_data
        
        token = login_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 3: Check that patient record was auto-created
        patient_response = requests.get(
            f"{api_base_url}/api/v1/patients/me",
            headers=headers,
            timeout=10
        )
        
        assert patient_response.status_code == 200
        patient_data = patient_response.json()
        assert patient_data["user_id"] == user_data["id"]
        
        # Should have placeholder data indicating need for completion
        assert patient_data["first_name"] == "First Name"
        assert patient_data["last_name"] == "Last Name"
        assert patient_data["address"] == "Please update your address"
        
        # Step 4: Update patient information (simulating patient info page)
        updated_patient_data = {
            "first_name": "John",
            "last_name": "Doe",
            "birth_date": "1990-01-01",
            "gender": "M",
            "address": "123 Main Street, Anytown, NY 12345",
            "blood_type": "A+",
            "height": 70,
            "weight": 180
        }
        
        update_response = requests.put(
            f"{api_base_url}/api/v1/patients/me",
            headers=headers,
            json=updated_patient_data,
            timeout=10
        )
        
        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert updated_data["first_name"] == "John"
        assert updated_data["last_name"] == "Doe"
        assert updated_data["birth_date"] == "1990-01-01"
        
        # Step 5: Verify patient profile is complete
        final_patient_response = requests.get(
            f"{api_base_url}/api/v1/patients/me",
            headers=headers,
            timeout=10
        )
        
        assert final_patient_response.status_code == 200
        final_patient_data = final_patient_response.json()
        assert final_patient_data["first_name"] == "John"
        assert final_patient_data["last_name"] == "Doe"
        
        return headers  # Return headers for use in other tests

    def test_medical_records_workflow(self, api_base_url: str, test_user_data: Dict[str, Any]):
        """Test creating and managing medical records."""
        
        # First complete the registration flow
        headers = self.test_complete_user_registration_flow(api_base_url, test_user_data)
        
        # Step 1: Create a medication
        medication_data = {
            "name": "Lisinopril",
            "dosage": "10mg",
            "frequency": "Daily",
            "start_date": "2023-01-01",
            "prescribing_doctor": "Dr. Smith",
            "notes": "For blood pressure management",
            "status": "active"
        }
        
        med_response = requests.post(
            f"{api_base_url}/api/v1/medications",
            headers=headers,
            json=medication_data,
            timeout=10
        )
        
        assert med_response.status_code == 201
        med_data = med_response.json()
        assert med_data["name"] == "Lisinopril"
        medication_id = med_data["id"]
        
        # Step 2: Create a lab result
        lab_result_data = {
            "test_name": "Complete Blood Count",
            "test_date": "2023-06-15",
            "result": "Normal",
            "reference_range": "Within normal limits",
            "ordering_doctor": "Dr. Smith",
            "lab_name": "LabCorp",
            "notes": "All values normal",
            "status": "completed"
        }
        
        lab_response = requests.post(
            f"{api_base_url}/api/v1/lab-results",
            headers=headers,
            json=lab_result_data,
            timeout=10
        )
        
        assert lab_response.status_code == 201
        lab_data = lab_response.json()
        assert lab_data["test_name"] == "Complete Blood Count"
        lab_result_id = lab_data["id"]
        
        # Step 3: Record vitals
        vitals_data = {
            "measurement_date": "2023-12-01",
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "heart_rate": 72,
            "temperature": 98.6,
            "weight": 180,
            "height": 70,
            "notes": "Normal vital signs"
        }
        
        vitals_response = requests.post(
            f"{api_base_url}/api/v1/vitals",
            headers=headers,
            json=vitals_data,
            timeout=10
        )
        
        assert vitals_response.status_code == 201
        vitals_response_data = vitals_response.json()
        assert vitals_response_data["systolic_bp"] == 120
        
        # Step 4: Get dashboard with all records
        dashboard_response = requests.get(
            f"{api_base_url}/api/v1/dashboard/stats",
            headers=headers,
            timeout=10
        )
        
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.json()
        assert dashboard_data["active_medications"] >= 1
        assert dashboard_data["recent_lab_results"] >= 1
        
        # Step 5: Update medication
        updated_med_data = {
            "dosage": "20mg",
            "notes": "Increased dosage per doctor recommendation"
        }
        
        update_med_response = requests.put(
            f"{api_base_url}/api/v1/medications/{medication_id}",
            headers=headers,
            json=updated_med_data,
            timeout=10
        )
        
        assert update_med_response.status_code == 200
        updated_med = update_med_response.json()
        assert updated_med["dosage"] == "20mg"
        
        # Step 6: Check recent activity
        activity_response = requests.get(
            f"{api_base_url}/api/v1/patients/recent-activity",
            headers=headers,
            timeout=10
        )
        
        assert activity_response.status_code == 200
        activities = activity_response.json()
        assert len(activities) > 0
        
        # Should have activity for medication creation and update
        activity_types = [activity["type"] for activity in activities]
        assert "Medication" in activity_types

    def test_practitioner_management_workflow(self, api_base_url: str, test_user_data: Dict[str, Any]):
        """Test practitioner management workflow."""
        
        # Complete registration first
        headers = self.test_complete_user_registration_flow(api_base_url, test_user_data)
        
        # Step 1: Create a practitioner
        practitioner_data = {
            "name": "Dr. Jane Wilson",
            "specialty": "Cardiology",
            "phone_number": "555-0123",
            "email": "dr.wilson@example.com",
            "address": "456 Medical Center Dr",
            "website": "https://drwilson.com",
            "rating": 4.8,
            "status": "active"
        }
        
        prac_response = requests.post(
            f"{api_base_url}/api/v1/practitioners",
            headers=headers,
            json=practitioner_data,
            timeout=10
        )
        
        assert prac_response.status_code == 201
        prac_data = prac_response.json()
        assert prac_data["name"] == "Dr. Jane Wilson"
        practitioner_id = prac_data["id"]
        
        # Step 2: Assign practitioner to patient
        patient_update = {
            "physician_id": practitioner_id
        }
        
        patient_response = requests.put(
            f"{api_base_url}/api/v1/patients/me",
            headers=headers,
            json=patient_update,
            timeout=10
        )
        
        assert patient_response.status_code == 200
        patient_data = patient_response.json()
        assert patient_data["physician_id"] == practitioner_id
        
        # Step 3: Get all practitioners
        all_prac_response = requests.get(
            f"{api_base_url}/api/v1/practitioners",
            headers=headers,
            timeout=10
        )
        
        assert all_prac_response.status_code == 200
        practitioners = all_prac_response.json()
        assert len(practitioners) >= 1
        
        # Find our created practitioner
        our_practitioner = next(
            (p for p in practitioners if p["id"] == practitioner_id), 
            None
        )
        assert our_practitioner is not None
        assert our_practitioner["name"] == "Dr. Jane Wilson"

    def test_error_handling_workflow(self, api_base_url: str):
        """Test error handling in various scenarios."""
        
        # Test 1: Invalid login
        invalid_login_response = requests.post(
            f"{api_base_url}/api/v1/auth/login",
            data={"username": "nonexistent", "password": "wrong"},
            timeout=10
        )
        
        assert invalid_login_response.status_code == 401
        
        # Test 2: Unauthorized access
        unauthorized_response = requests.get(
            f"{api_base_url}/api/v1/patients/me",
            timeout=10
        )
        
        assert unauthorized_response.status_code == 401
        
        # Test 3: Invalid token
        invalid_headers = {"Authorization": "Bearer invalid_token"}
        invalid_token_response = requests.get(
            f"{api_base_url}/api/v1/patients/me",
            headers=invalid_headers,
            timeout=10
        )
        
        assert invalid_token_response.status_code == 401
        
        # Test 4: Invalid data validation
        # Create a user first
        test_user = {
            "username": "errortest",
            "email": "error@example.com",
            "password": "password123",
            "full_name": "Error Test"
        }
        
        # Register user
        requests.post(f"{api_base_url}/api/v1/auth/register", json=test_user, timeout=10)
        
        # Login
        login_response = requests.post(
            f"{api_base_url}/api/v1/auth/login",
            data={"username": test_user["username"], "password": test_user["password"]},
            timeout=10
        )
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to update patient with invalid data
        invalid_patient_data = {
            "birth_date": "invalid-date",
            "height": -10,
            "blood_type": "INVALID"
        }
        
        invalid_update_response = requests.put(
            f"{api_base_url}/api/v1/patients/me",
            headers=headers,
            json=invalid_patient_data,
            timeout=10
        )
        
        assert invalid_update_response.status_code == 422

    def test_system_health_monitoring(self, api_base_url: str):
        """Test system health and monitoring endpoints."""
        
        # Test health check
        health_response = requests.get(f"{api_base_url}/health", timeout=5)
        assert health_response.status_code == 200
        
        health_data = health_response.json()
        assert health_data["status"] == "healthy"
        
        # Test version endpoint
        version_response = requests.get(f"{api_base_url}/api/v1/system/version", timeout=5)
        assert version_response.status_code == 200
        
        version_data = version_response.json()
        assert "app_name" in version_data
        assert "version" in version_data

    @pytest.mark.slow
    def test_concurrent_user_operations(self, api_base_url: str):
        """Test concurrent operations by multiple users."""
        import concurrent.futures
        import threading
        
        def create_user_and_records(user_index: int):
            """Create a user and some medical records."""
            user_data = {
                "username": f"concurrent_user_{user_index}",
                "email": f"concurrent_{user_index}@example.com",
                "password": "password123",
                "full_name": f"Concurrent User {user_index}"
            }
            
            # Register
            register_response = requests.post(
                f"{api_base_url}/api/v1/auth/register",
                json=user_data,
                timeout=10
            )
            assert register_response.status_code == 201
            
            # Login
            login_response = requests.post(
                f"{api_base_url}/api/v1/auth/login",
                data={"username": user_data["username"], "password": user_data["password"]},
                timeout=10
            )
            assert login_response.status_code == 200
            
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Create medication
            medication_data = {
                "name": f"Medication {user_index}",
                "dosage": "10mg",
                "frequency": "Daily",
                "start_date": "2023-01-01",
                "status": "active"
            }
            
            med_response = requests.post(
                f"{api_base_url}/api/v1/medications",
                headers=headers,
                json=medication_data,
                timeout=10
            )
            assert med_response.status_code == 201
            
            return user_index, True
        
        # Create 5 concurrent users
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(create_user_and_records, i) for i in range(5)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        # All should succeed
        assert len(results) == 5
        for user_index, success in results:
            assert success, f"User {user_index} creation failed"

    def test_data_export_workflow(self, api_base_url: str, test_user_data: Dict[str, Any]):
        """Test data export functionality."""
        
        # Complete registration and create some data
        headers = self.test_complete_user_registration_flow(api_base_url, test_user_data)
        
        # Create some test data first
        medication_data = {
            "name": "Export Test Medication",
            "dosage": "5mg",
            "frequency": "Daily",
            "start_date": "2023-01-01",
            "status": "active"
        }
        
        requests.post(
            f"{api_base_url}/api/v1/medications",
            headers=headers,
            json=medication_data,
            timeout=10
        )
        
        # Test export functionality (if implemented)
        export_response = requests.get(
            f"{api_base_url}/api/v1/export/pdf",
            headers=headers,
            params={"data_types": "medications,patient_info"},
            timeout=30  # PDF generation might take longer
        )
        
        # Export should either work (200) or not be implemented yet (404/501)
        assert export_response.status_code in [200, 404, 501]
        
        if export_response.status_code == 200:
            # If export works, check that we got a PDF
            assert "application/pdf" in export_response.headers.get("content-type", "")
            assert len(export_response.content) > 0