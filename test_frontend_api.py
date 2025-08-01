#!/usr/bin/env python3
"""
Test script to verify the API endpoint accepts username/password.
"""

import requests
import json

def test_paperless_api():
    """Test the paperless API endpoint directly."""
    
    # Test data
    test_data = {
        "paperless_url": "http://192.168.0.175:8000",
        "paperless_username": "alex",
        "paperless_password": "paperless2k!"
    }
    
    print("Testing paperless API endpoint...")
    print(f"Sending request with data: {json.dumps({k: v if k != 'paperless_password' else '*' * len(v) for k, v in test_data.items()}, indent=2)}")
    
    try:
        # Make request to the API endpoint
        # Note: This would need authentication token in real scenario
        response = requests.post(
            "http://localhost:8000/api/v1/paperless/test-connection",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print("SUCCESS!")
            print(f"Response: {json.dumps(result, indent=2)}")
        else:
            print("ERROR!")
            print(f"Response text: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_paperless_api()