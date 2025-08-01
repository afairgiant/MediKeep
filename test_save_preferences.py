#!/usr/bin/env python3
"""
Test script to try saving paperless preferences directly via API.
"""

import requests
import json

def test_save_preferences():
    """Test saving paperless preferences via API."""
    
    # Test data - what should be sent when user saves settings
    test_preferences = {
        "paperless_enabled": True,
        "paperless_url": "http://192.168.0.175:8000",
        "paperless_username": "alex",
        "paperless_password": "paperless2k!",
        "default_storage_backend": "paperless",
        "paperless_auto_sync": False,
        "paperless_sync_tags": True
    }
    
    print("Testing preferences save API...")
    print(f"Data to save: {json.dumps({k: v if k != 'paperless_password' else '*' * len(v) for k, v in test_preferences.items()}, indent=2)}")
    
    try:
        # Note: This would need authentication token in real scenario
        response = requests.put(
            "http://localhost:8000/api/v1/users/me/preferences",
            json=test_preferences,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print("SUCCESS!")
            print(f"Saved preferences: {json.dumps(result, indent=2, default=str)}")
        else:
            print("ERROR!")
            print(f"Response text: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_save_preferences()