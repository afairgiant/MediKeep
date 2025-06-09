#!/usr/bin/env python3
"""
Quick test for medical audit logging fixes.
"""

import requests
import json


def test_patient_access():
    """Test patient record access with fixed logging."""

    print("Testing authentication...")
    auth_data = {"username": "admin", "password": "admin123"}
    response = requests.post("http://localhost:8000/api/v1/auth/login", data=auth_data)
    print(f"Auth status: {response.status_code}")

    if response.status_code == 200:
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Test patient record access
        print("Testing patient record access...")
        response = requests.get(
            "http://localhost:8000/api/v1/patients/me", headers=headers
        )
        print(f"Patient access status: {response.status_code}")

        if response.status_code == 200:
            print("✅ Patient record access working!")
        else:
            print(f"❌ Patient record access failed: {response.text}")

        print("Test completed!")
    else:
        print("❌ Authentication failed")


if __name__ == "__main__":
    test_patient_access()
