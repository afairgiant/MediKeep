#!/usr/bin/env python3
"""
Test script to verify login functionality works correctly
"""

import requests
import sys


def test_login():
    """Test the login functionality"""
    base_url = "http://127.0.0.1:8000"

    print("🧪 Testing Medical Records System Login...")

    # Test 1: Get login page
    try:
        response = requests.get(f"{base_url}/login")
        if response.status_code == 200:
            print("✅ Login page accessible")
        else:
            print(f"❌ Login page failed: {response.status_code}")
            return False
    except requests.RequestException as e:
        print(f"❌ Cannot connect to server: {e}")
        return False

    # Test 2: Test login with correct credentials
    try:
        login_data = {"username": "admin", "password": "admin123"}
        response = requests.post(
            f"{base_url}/login", data=login_data, allow_redirects=False
        )

        if response.status_code == 302:  # Redirect after successful login
            redirect_url = response.headers.get("location", "")
            if "/home" in redirect_url:
                print("✅ Login successful - redirects to home")
            else:
                print(f"❌ Login redirects to wrong page: {redirect_url}")
                return False
        else:
            print(f"❌ Login failed: {response.status_code}")
            return False
    except requests.RequestException as e:
        print(f"❌ Login request failed: {e}")
        return False

    # Test 3: Test login with wrong credentials
    try:
        wrong_data = {"username": "admin", "password": "wrongpassword"}
        response = requests.post(f"{base_url}/login", data=wrong_data)

        if (
            response.status_code == 200
            and "Invalid username or password" in response.text
        ):
            print("✅ Invalid credentials properly rejected")
        else:
            print("❌ Invalid credentials test failed")
            return False
    except requests.RequestException as e:
        print(f"❌ Wrong credentials test failed: {e}")
        return False

    # Test 4: Test home page accessibility after login
    try:
        # Create a session to maintain login state
        session = requests.Session()
        session.post(f"{base_url}/login", data=login_data)

        response = session.get(f"{base_url}/home")
        if response.status_code == 200:
            print("✅ Home page accessible after login")
        else:
            print(f"❌ Home page failed: {response.status_code}")
            return False
    except requests.RequestException as e:
        print(f"❌ Home page test failed: {e}")
        return False

    print("🎉 All login tests passed!")
    return True


if __name__ == "__main__":
    success = test_login()
    sys.exit(0 if success else 1)
