#!/usr/bin/env python3
"""
Test script for patient endpoints.

This script tests the basic patient CRUD operations through the API.
Run this after starting the server to verify everything works.
"""

import requests
import json
from datetime import date

BASE_URL = "http://localhost:8000/api/v1"

def test_patient_endpoints():
    """Test patient endpoints with a sample user"""
    
    print("🏥 Testing Medical Records Patient Endpoints")
    print("=" * 50)
    
    # Test data
    test_user = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
        "full_name": "Test User",
        "role": "user"
    }
    
    test_patient = {
        "first_name": "John",
        "last_name": "Doe", 
        "birthDate": "1990-01-15",
        "gender": "M",
        "address": "123 Main St, Anytown, ST 12345"
    }
    
    # 1. Register a test user
    print("\n1. 👤 Registering test user...")
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=test_user)
        if response.status_code == 200:
            print("✅ User registered successfully")
            user_data = response.json()
        elif response.status_code == 400 and "already registered" in response.text:
            print("ℹ️  User already exists, continuing...")
        else:
            print(f"❌ Failed to register user: {response.status_code}")
            print(response.text)
            return
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure it's running on localhost:8000")
        return
    
    # 2. Login to get token
    print("\n2. 🔐 Logging in...")
    try:
        login_data = {
            "username": test_user["username"],
            "password": test_user["password"]
        }
        response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
        if response.status_code == 200:
            print("✅ Login successful")
            token_data = response.json()
            access_token = token_data["access_token"]
            headers = {"Authorization": f"Bearer {access_token}"}
        else:
            print(f"❌ Failed to login: {response.status_code}")
            print(response.text)
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # 3. Create patient record
    print("\n3. 📝 Creating patient record...")
    try:
        response = requests.post(f"{BASE_URL}/patients/me", json=test_patient, headers=headers)
        if response.status_code == 200:
            print("✅ Patient record created successfully")
            patient_data = response.json()
            print(f"   Patient ID: {patient_data['id']}")
            print(f"   Name: {patient_data['first_name']} {patient_data['last_name']}")
        elif response.status_code == 400 and "already exists" in response.text:
            print("ℹ️  Patient record already exists")
        else:
            print(f"❌ Failed to create patient: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Patient creation error: {e}")
    
    # 4. Get patient record
    print("\n4. 📖 Getting patient record...")
    try:
        response = requests.get(f"{BASE_URL}/patients/me", headers=headers)
        if response.status_code == 200:
            print("✅ Patient record retrieved successfully")
            patient_data = response.json()
            print(f"   Full Name: {patient_data['first_name']} {patient_data['last_name']}")
            print(f"   Birth Date: {patient_data['birthDate']}")
            print(f"   Gender: {patient_data['gender']}")
            print(f"   Address: {patient_data['address']}")
        else:
            print(f"❌ Failed to get patient: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Patient retrieval error: {e}")
    
    # 5. Update patient record
    print("\n5. ✏️  Updating patient record...")
    try:
        update_data = {
            "address": "456 New Street, Updated City, ST 54321"
        }
        response = requests.put(f"{BASE_URL}/patients/me", json=update_data, headers=headers)
        if response.status_code == 200:
            print("✅ Patient record updated successfully")
            updated_patient = response.json()
            print(f"   New Address: {updated_patient['address']}")
        else:
            print(f"❌ Failed to update patient: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Patient update error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Patient endpoint testing completed!")
    print("\nNext steps:")
    print("- Access API docs at: http://localhost:8000/docs")
    print("- Test other endpoints as needed")

if __name__ == "__main__":
    test_patient_endpoints()
