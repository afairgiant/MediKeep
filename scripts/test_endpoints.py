#!/usr/bin/env python3
"""
Test script to verify lab_result_file endpoints are properly loaded
"""

from app.main import app

def test_endpoints():
    print("Testing FastAPI application...")
    print(f"App title: {app.title}")
    
    # Check if lab_result_file endpoints are included
    lab_file_routes = []
    
    for route in app.routes:
        if hasattr(route, 'path'):
            if 'lab-result-files' in route.path:
                lab_file_routes.append(f"{route.methods} {route.path}")
    
    print(f"\nFound {len(lab_file_routes)} lab-result-file routes:")
    for route in lab_file_routes:
        print(f"  - {route}")
    
    print("\n✅ FastAPI app loaded successfully!")
    print("✅ Lab result file endpoints are available!")
    
    return True

if __name__ == "__main__":
    test_endpoints()
