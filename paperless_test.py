#!/usr/bin/env python3
"""
Quick test script to verify Paperless-ngx username/password authentication works.
"""

import asyncio
import sys
from app.services.paperless_service import PaperlessService

async def test_paperless_auth():
    """Test paperless authentication with username/password."""
    
    # Test configuration
    PAPERLESS_URL = "http://192.168.0.175:8000"
    USERNAME = "alex"
    PASSWORD = "paperless2k!"
    
    print(f"Using username: {USERNAME}")
    print(f"Using password: {'*' * len(PASSWORD)}")
    
    print(f"Testing connection to {PAPERLESS_URL}...")
    
    try:
        # Create paperless service with username/password
        paperless_service = PaperlessService(
            base_url=PAPERLESS_URL,
            username=USERNAME,
            password=PASSWORD,
            user_id=1  # Test user ID
        )
        
        # Test the connection
        async with paperless_service:
            print("Calling test_connection()...")
            result = await paperless_service.test_connection()
            
            print("SUCCESS: Connection successful!")
            print(f"Results:")
            print(f"   Status: {result.get('status')}")
            print(f"   Server URL: {result.get('server_url')}")
            print(f"   Server Version: {result.get('server_version')}")
            print(f"   API Version: {result.get('api_version')}")
            print(f"   Test Time: {result.get('test_timestamp')}")
            print(f"   Note: {result.get('note')}")
            if result.get('config_info'):
                config = result['config_info']
                print(f"   App Title: {config.get('app_title')}")
                print(f"   Config Version: {config.get('version')}")
                print(f"   User Args: {config.get('user_args')}")
            
            return True
            
    except Exception as e:
        print(f"ERROR: Connection failed: {str(e)}")
        print(f"   Error type: {type(e).__name__}")
        return False

if __name__ == "__main__":
    print("Paperless-ngx Authentication Test")
    print("=" * 40)
    
    success = asyncio.run(test_paperless_auth())
    
    if success:
        print("\nTest completed successfully!")
        sys.exit(0)
    else:
        print("\nTest failed!")
        sys.exit(1)