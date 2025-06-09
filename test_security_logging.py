#!/usr/bin/env python3
"""
Test script for Step 3: Security and Audit Logging implementation.

This script tests the comprehensive security logging system by making various API requests
and checking that appropriate logs are generated.
"""

import requests
import json
import time
from datetime import datetime

# Base URL for the API
BASE_URL = "http://localhost:8000"


def test_authentication_logging():
    """Test authentication attempt logging."""
    print("=== Testing Authentication Logging ===")

    # Test 1: Failed login attempt
    print("1. Testing failed login attempt...")
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        data={"username": "nonexistent_user", "password": "wrong_password"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    print(f"   Response: {response.status_code}")

    # Test 2: User registration
    print("2. Testing user registration...")
    test_user = {
        "username": f"testuser_{int(time.time())}",
        "password": "testpassword123",
    }
    response = requests.post(f"{BASE_URL}/api/v1/auth/register", json=test_user)
    print(f"   Response: {response.status_code}")

    if response.status_code == 200:
        # Test 3: Successful login
        print("3. Testing successful login...")
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            data={"username": test_user["username"], "password": test_user["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        print(f"   Response: {response.status_code}")

        if response.status_code == 200:
            token = response.json().get("access_token")
            return token, test_user["username"]

    return None, None


def test_suspicious_request_detection():
    """Test suspicious request pattern detection."""
    print("\n=== Testing Suspicious Request Detection ===")

    # Test 1: SQL injection attempt
    print("1. Testing SQL injection detection...")
    response = requests.get(f"{BASE_URL}/api/v1/patients/me?id=1' OR '1'='1")
    print(f"   Response: {response.status_code}")

    # Test 2: XSS attempt
    print("2. Testing XSS detection...")
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/login?username=<script>alert('xss')</script>"
    )
    print(f"   Response: {response.status_code}")

    # Test 3: Path traversal attempt
    print("3. Testing path traversal detection...")
    response = requests.get(f"{BASE_URL}/api/v1/patients/../../../etc/passwd")
    print(f"   Response: {response.status_code}")


def test_rate_limiting():
    """Test rate limiting functionality."""
    print("\n=== Testing Rate Limiting ===")

    # Make rapid requests to trigger rate limiting
    print("Making rapid requests to test rate limiting...")
    for i in range(15):  # Make 15 rapid requests
        response = requests.get(f"{BASE_URL}/health")
        print(f"   Request {i + 1}: {response.status_code}")
        if response.status_code == 429:
            print("   Rate limiting triggered!")
            break
        time.sleep(0.1)  # Small delay between requests


def test_medical_data_access_logging(token):
    """Test medical data access logging."""
    if not token:
        print("\n=== Skipping Medical Data Access Logging (no token) ===")
        return

    print("\n=== Testing Medical Data Access Logging ===")

    headers = {"Authorization": f"Bearer {token}"}

    # Test patient record access
    print("1. Testing patient record access...")
    response = requests.get(f"{BASE_URL}/api/v1/patients/me", headers=headers)
    print(f"   Response: {response.status_code}")


def check_log_files():
    """Check the generated log files."""
    print("\n=== Checking Generated Log Files ===")

    log_files = [
        "logs/security.log",
        "logs/app.log",
        "logs/medical.log",
        "logs/performance.log",
    ]

    for log_file in log_files:
        try:
            with open(log_file, "r") as f:
                lines = f.readlines()
                print(f"{log_file}: {len(lines)} log entries")

                # Show last few entries for security log
                if "security" in log_file and lines:
                    print(f"   Last security log entry:")
                    try:
                        last_entry = json.loads(lines[-1])
                        print(f"   Event: {last_entry.get('event', 'unknown')}")
                        print(f"   Time: {last_entry.get('timestamp', 'unknown')}")
                        print(f"   IP: {last_entry.get('ip_address', 'unknown')}")
                    except json.JSONDecodeError:
                        print(f"   Raw: {lines[-1].strip()}")

        except FileNotFoundError:
            print(f"{log_file}: File not found")
        except Exception as e:
            print(f"{log_file}: Error reading file - {e}")


def main():
    """Run all security logging tests."""
    print(f"Security Logging Test Suite - {datetime.now()}")
    print("=" * 60)

    # Test authentication logging
    token, username = test_authentication_logging()

    # Test suspicious request detection
    test_suspicious_request_detection()

    # Test rate limiting
    test_rate_limiting()

    # Test medical data access logging
    test_medical_data_access_logging(token)

    # Wait a moment for logs to be written
    time.sleep(2)

    # Check log files
    check_log_files()

    print("\n" + "=" * 60)
    print("Security logging tests completed!")
    print("Check the logs/ directory for detailed logging output.")


if __name__ == "__main__":
    main()
