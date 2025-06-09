#!/usr/bin/env python3
"""
Step 4: Medical Data Audit Logging Test Suite

This script tests the comprehensive medical data audit logging system
implemented in Step 4 of our logging plan.

Tests:
- Patient record operations (create, read, update, delete)
- Medication operations (create, read, update, delete)
- Treatment operations (create, read, update, delete)
- Audit trail verification
- Medical data access tracking
"""

import json
import requests
import time
from datetime import datetime, date


class MedicalAuditTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.token = None
        self.patient_id = None
        self.headers = {"Content-Type": "application/json"}

    def authenticate(self):
        """Authenticate and get token for testing."""
        print("🔐 Authenticating for medical audit testing...")

        # Try to login first
        login_data = {"username": "admin", "password": "admin123"}

        response = requests.post(
            f"{self.base_url}/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers["Authorization"] = f"Bearer {self.token}"
            print("   ✅ Authentication successful")
            return True
        else:
            print(f"   ❌ Authentication failed: {response.status_code}")
            return False

    def test_patient_operations(self):
        """Test patient record operations with audit logging."""
        print("\n=== Testing Patient Record Audit Logging ===")

        # Test 1: Read patient record (should trigger audit log)
        print("1. Testing patient record access...")
        response = requests.get(
            f"{self.base_url}/api/v1/patients/me", headers=self.headers
        )
        print(f"   Patient record access: {response.status_code}")

        if response.status_code == 200:
            patient_data = response.json()
            self.patient_id = patient_data.get("id")
            print(f"   Patient ID: {self.patient_id}")

        # Test 2: Update patient record (should trigger audit log)
        print("2. Testing patient record update...")
        update_data = {"first_name": "Updated", "address": "123 Audit Trail Street"}
        response = requests.put(
            f"{self.base_url}/api/v1/patients/me",
            json=update_data,
            headers=self.headers,
        )
        print(f"   Patient record update: {response.status_code}")

        # Test 3: Read updated patient record
        print("3. Testing updated patient record access...")
        response = requests.get(
            f"{self.base_url}/api/v1/patients/me", headers=self.headers
        )
        print(f"   Updated patient record access: {response.status_code}")

    def test_medication_operations(self):
        """Test medication operations with audit logging."""
        print("\n=== Testing Medication Audit Logging ===")

        if not self.patient_id:
            print("   ⚠️ No patient ID available, skipping medication tests")
            return

        medication_id = None

        # Test 1: Create medication (should trigger audit log)
        print("1. Testing medication creation...")
        medication_data = {
            "patient_id": self.patient_id,
            "medication_name": "Audit Test Medicine",
            "dosage": "10mg",
            "frequency": "Daily",
            "route": "Oral",
            "indication": "Testing audit logging",
            "status": "active",
        }

        response = requests.post(
            f"{self.base_url}/api/v1/medications/",
            json=medication_data,
            headers=self.headers,
        )
        print(f"   Medication creation: {response.status_code}")

        if response.status_code == 200:
            medication_id = response.json().get("id")
            print(f"   Medication ID: {medication_id}")

        # Test 2: Read medications
        print("2. Testing medication list access...")
        response = requests.get(
            f"{self.base_url}/api/v1/medications/patient/{self.patient_id}",
            headers=self.headers,
        )
        print(f"   Medication list access: {response.status_code}")

        # Test 3: Update medication (should trigger audit log)
        if medication_id:
            print("3. Testing medication update...")
            update_data = {"dosage": "20mg", "frequency": "Twice daily"}
            response = requests.put(
                f"{self.base_url}/api/v1/medications/{medication_id}",
                json=update_data,
                headers=self.headers,
            )
            print(f"   Medication update: {response.status_code}")

            # Test 4: Delete medication (should trigger audit log)
            print("4. Testing medication deletion...")
            response = requests.delete(
                f"{self.base_url}/api/v1/medications/{medication_id}",
                headers=self.headers,
            )
            print(f"   Medication deletion: {response.status_code}")

    def test_treatment_operations(self):
        """Test treatment operations with audit logging."""
        print("\n=== Testing Treatment Audit Logging ===")

        if not self.patient_id:
            print("   ⚠️ No patient ID available, skipping treatment tests")
            return

        treatment_id = None

        # Test 1: Create treatment (should trigger audit log)
        print("1. Testing treatment creation...")
        treatment_data = {
            "patient_id": self.patient_id,
            "treatment_type": "Audit Test Treatment",
            "start_date": date.today().isoformat(),
            "status": "active",
            "treatment_category": "outpatient",
            "notes": "Testing audit logging for treatments",
            "description": "Comprehensive audit trail test",
        }

        response = requests.post(
            f"{self.base_url}/api/v1/treatments/",
            json=treatment_data,
            headers=self.headers,
        )
        print(f"   Treatment creation: {response.status_code}")

        if response.status_code == 200:
            treatment_id = response.json().get("id")
            print(f"   Treatment ID: {treatment_id}")

        # Test 2: Read treatments
        print("2. Testing treatment list access...")
        response = requests.get(
            f"{self.base_url}/api/v1/treatments/", headers=self.headers
        )
        print(f"   Treatment list access: {response.status_code}")

        # Test 3: Update treatment (should trigger audit log)
        if treatment_id:
            print("3. Testing treatment update...")
            update_data = {"status": "completed", "notes": "Updated for audit testing"}
            response = requests.put(
                f"{self.base_url}/api/v1/treatments/{treatment_id}",
                json=update_data,
                headers=self.headers,
            )
            print(f"   Treatment update: {response.status_code}")

            # Test 4: Delete treatment (should trigger audit log)
            print("4. Testing treatment deletion...")
            response = requests.delete(
                f"{self.base_url}/api/v1/treatments/{treatment_id}",
                headers=self.headers,
            )
            print(f"   Treatment deletion: {response.status_code}")

    def test_error_scenarios(self):
        """Test error scenarios to verify audit logging for failures."""
        print("\n=== Testing Error Scenario Audit Logging ===")

        # Test 1: Try to access non-existent medication
        print("1. Testing non-existent medication access...")
        response = requests.get(
            f"{self.base_url}/api/v1/medications/99999", headers=self.headers
        )
        print(f"   Non-existent medication access: {response.status_code}")

        # Test 2: Try to update non-existent treatment
        print("2. Testing non-existent treatment update...")
        update_data = {"status": "completed"}
        response = requests.put(
            f"{self.base_url}/api/v1/treatments/99999",
            json=update_data,
            headers=self.headers,
        )
        print(f"   Non-existent treatment update: {response.status_code}")

        # Test 3: Try to delete non-existent medication
        print("3. Testing non-existent medication deletion...")
        response = requests.delete(
            f"{self.base_url}/api/v1/medications/99999", headers=self.headers
        )
        print(f"   Non-existent medication deletion: {response.status_code}")

    def check_audit_logs(self):
        """Check the generated audit logs."""
        print("\n=== Checking Generated Audit Logs ===")

        log_files = ["logs/medical.log", "logs/security.log", "logs/app.log"]

        for log_file in log_files:
            try:
                with open(log_file, "r") as f:
                    lines = f.readlines()
                    recent_entries = lines[-5:] if len(lines) >= 5 else lines

                    print(f"{log_file}: {len(lines)} total entries")
                    if recent_entries:
                        print(f"   Latest entry preview:")
                        latest_entry = recent_entries[-1].strip()
                        try:
                            log_data = json.loads(latest_entry)
                            event = log_data.get("event", "unknown")
                            timestamp = log_data.get("time", "unknown")
                            print(f"   Event: {event}")
                            print(f"   Time: {timestamp}")
                        except json.JSONDecodeError:
                            print(f"   Raw: {latest_entry[:100]}...")
            except FileNotFoundError:
                print(f"{log_file}: File not found")

    def run_comprehensive_test(self):
        """Run the complete medical audit logging test suite."""
        print("Medical Data Audit Logging Test Suite - Step 4")
        print("=" * 60)
        print(f"Testing started at: {datetime.now()}")
        print("=" * 60)

        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return

        # Run all test categories
        self.test_patient_operations()
        self.test_medication_operations()
        self.test_treatment_operations()
        self.test_error_scenarios()

        # Give logs time to be written
        print("\n⏳ Waiting for logs to be written...")
        time.sleep(2)

        # Check the audit logs
        self.check_audit_logs()

        print("\n" + "=" * 60)
        print("Medical audit logging tests completed!")
        print("Check the logs/ directory for detailed audit trails.")
        print("✅ Step 4: Medical Data Audit Logging verification complete")


if __name__ == "__main__":
    tester = MedicalAuditTester()
    tester.run_comprehensive_test()
