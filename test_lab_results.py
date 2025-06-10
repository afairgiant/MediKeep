#!/usr/bin/env python3
"""
Quick test script to verify lab result functionality
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin123"


def test_lab_results():
    print("🧪 Testing Lab Results API...")

    # First, let's try to login
    try:
        login_data = {"username": TEST_USERNAME, "password": TEST_PASSWORD}

        login_response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("✅ Login successful")
        else:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is it running on localhost:8000?")
        return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

    # Test getting lab results
    try:
        response = requests.get(f"{BASE_URL}/api/v1/lab-results", headers=headers)
        print(f"📋 Get lab results: {response.status_code}")
        if response.status_code == 200:
            lab_results = response.json()
            print(f"   Found {len(lab_results)} lab results")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"❌ Error getting lab results: {e}")    # Test creating a lab result with simplified schema
    try:
        test_lab_result = {
            "test_name": "Complete Blood Count",
            "test_code": "CBC",
            "test_category": "blood work",
            "status": "ordered", 
            "ordered_date": "2024-01-15T10:00:00",
            "notes": "Routine annual checkup",
            "patient_id": 1,  # Assuming patient with ID 1 exists
        }

        response = requests.post(
            f"{BASE_URL}/api/v1/lab-results", json=test_lab_result, headers=headers
        )
        print(f"➕ Create lab result: {response.status_code}")
        if response.status_code == 200:
            created_result = response.json()
            print(f"   Created lab result ID: {created_result.get('id')}")
            return created_result.get("id")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"❌ Error creating lab result: {e}")

    # Test lab result files endpoints
    try:
        response = requests.get(f"{BASE_URL}/api/v1/lab-result-files", headers=headers)
        print(f"📁 Get lab result files: {response.status_code}")
        if response.status_code == 200:
            files = response.json()
            print(f"   Found {len(files)} files")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"❌ Error getting lab result files: {e}")

    return True


def test_frontend_availability():
    print("\n🌐 Testing Frontend availability...")
    try:
        response = requests.get("http://localhost:3000")
        if response.status_code == 200:
            print("✅ Frontend is running on localhost:3000")
        else:
            print(f"⚠️ Frontend returned status: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("❌ Frontend not accessible. Is it running on localhost:3000?")
    except Exception as e:
        print(f"❌ Frontend test error: {e}")


if __name__ == "__main__":
    print("🔬 Medical Records Lab Results Test")
    print("=" * 50)

    success = test_lab_results()
    test_frontend_availability()

    print("\n" + "=" * 50)
    if success:
        print("✅ Lab Results functionality appears to be working!")
        print("\n📝 Next steps:")
        print("1. Start the frontend: cd frontend && npm start")
        print("2. Navigate to http://localhost:3000/lab-results")
        print("3. Test the lab results interface")
    else:
        print("❌ Some tests failed. Check the backend setup.")
        print("\n🔧 Troubleshooting:")
        print("1. Make sure the backend is running: python run.py")
        print("2. Create a test user if needed")
        print("3. Check database connection")
