#!/usr/bin/env python3
"""
Test script for the Medical Records Management System
Tests the patient management functionality end-to-end
"""

import requests

# Configuration
BASE_URL = "http://127.0.0.1:8000/api/v1"
TEST_USER_EMAIL = "testuser@example.com"
TEST_USER_PASSWORD = "testpass123"

def test_user_registration_and_patient_creation():
    """
    Test the complete flow:
    1. Register a new user
    2. Login to get access token
    3. Create a patient profile
    4. Retrieve patient information
    5. Update patient information
    """
    print("=" * 60)
    print("MEDICAL RECORDS SYSTEM - PATIENT MANAGEMENT TEST")
    print("=" * 60)
    
    # Step 1: Register a new user
    print("\n1. Testing User Registration...")
    user_data = {
        "username": "testuser",
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
        "full_name": "Test User",
        "role": "user"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
        if response.status_code == 200:
            print("✅ User registration successful!")
            user_info = response.json()
            print(f"   User ID: {user_info['id']}")
            print(f"   Email: {user_info['email']}")
            print(f"   Full Name: {user_info['full_name']}")
        elif response.status_code == 400 and "already registered" in response.json().get("detail", ""):
            print("⚠️  User already exists, continuing with login...")
        else:
            print(f"❌ User registration failed: {response.status_code} - {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure the server is running on http://127.0.0.1:8000")
        return False
    
    # Step 2: Login to get access token
    print("\n2. Testing User Login...")
    login_data = {
        "username": TEST_USER_EMAIL,  # FastAPI OAuth2 uses 'username' field
        "password": TEST_USER_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
        if response.status_code == 200:
            print("✅ User login successful!")
            token_info = response.json()
            access_token = token_info["access_token"]
            print(f"   Token Type: {token_info['token_type']}")
            print(f"   Access Token: {access_token[:20]}...")
        else:
            print(f"❌ User login failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False
      # Set up authorization headers
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Step 3: Create a patient profile
    print("\n3. Testing Patient Profile Creation...")
    patient_data = {
        "first_name": "John",
        "last_name": "Doe",
        "birthDate": "1990-05-15",
        "gender": "Male",
        "address": "123 Main St, Anytown, USA"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/patients/me", json=patient_data, headers=headers)
        if response.status_code == 200:
            print("✅ Patient profile created successfully!")
            patient_info = response.json()
            patient_id = patient_info["id"]
            print(f"   Patient ID: {patient_id}")
            print(f"   Name: {patient_info['first_name']} {patient_info['last_name']}")
            print(f"   Date of Birth: {patient_info['birthDate']}")
            print(f"   Gender: {patient_info['gender']}")
            print(f"   Address: {patient_info['address']}")
        else:
            print(f"❌ Patient creation failed: {response.status_code} - {response.text}")
            return False    
    except Exception as e:
        print(f"❌ Patient creation error: {e}")
    return False
    
    # Step 4: Retrieve patient information
    print("\n4. Testing Patient Information Retrieval...")
    try:
        response = requests.get(f"{BASE_URL}/patients/me", headers=headers)
        if response.status_code == 200:
            print("✅ Patient information retrieved successfully!")
            retrieved_patient = response.json()
            print(f"   Retrieved Patient: {retrieved_patient['first_name']} {retrieved_patient['last_name']}")
            print(f"   Address: {retrieved_patient['address']}")
        else:
            print(f"❌ Patient retrieval failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Patient retrieval error: {e}")
        return False
    
    # Step 5: Update patient information
    print("\n5. Testing Patient Information Update...")
    update_data = {
        "phone": "+1-555-999-8888",
        "address": "456 Oak Avenue, New City, USA"
    }
    
    try:
        response = requests.put(f"{BASE_URL}/patients/{patient_id}", json=update_data, headers=headers)
        if response.status_code == 200:
            print("✅ Patient information updated successfully!")
            updated_patient = response.json()
            print(f"   Updated Phone: {updated_patient['phone']}")
            print(f"   Updated Address: {updated_patient['address']}")
        else:
            print(f"❌ Patient update failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Patient update error: {e}")
        return False
    
    # Step 6: List all patients for the user
    print("\n6. Testing Patient List Retrieval...")
    try:
        response = requests.get(f"{BASE_URL}/patients/", headers=headers)
        if response.status_code == 200:
            print("✅ Patient list retrieved successfully!")
            patients_list = response.json()
            print(f"   Total patients for user: {len(patients_list)}")
            for patient in patients_list:
                print(f"   - {patient['first_name']} {patient['last_name']} (ID: {patient['id']})")
        else:
            print(f"❌ Patient list retrieval failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Patient list retrieval error: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 ALL TESTS PASSED! Patient management system is working correctly!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Access the API documentation at: http://127.0.0.1:8000/docs")
    print("2. Build additional medical record entities (encounters, conditions, etc.)")
    print("3. Implement frontend interface")
    print("4. Add more comprehensive testing")
    
    return True

if __name__ == "__main__":
    test_user_registration_and_patient_creation()
