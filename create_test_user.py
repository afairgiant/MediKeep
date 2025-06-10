#!/usr/bin/env python3
"""
Create a test user for development and testing
"""

import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.crud.user import user as user_crud
from app.crud.patient import patient as patient_crud
from app.schemas.user import UserCreate
from app.schemas.patient import PatientCreate
from app.models.models import Base
from datetime import date

def create_test_user():
    """Create a test user and patient record for development"""
    
    # Create database tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # Check if test user already exists
        existing_user = user_crud.get_by_username(db, username="testuser")
        if existing_user:
            print("✅ Test user 'testuser' already exists")
            print("📧 Username: testuser")
            print("🔑 Password: testpass123")
            return
        
        # Create test user
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        test_user = user_crud.create(db=db, obj_in=user_data)
        print(f"✅ Created test user with ID: {test_user.id}")
        
        # Create a patient record for the test user
        patient_data = PatientCreate(
            user_id=test_user.id,
            first_name="Test",
            last_name="User",
            birthDate=date(1990, 1, 1),
            gender="other",
            address="123 Test Street, Test City, TC 12345"
        )
        
        test_patient = patient_crud.create(db=db, obj_in=patient_data)
        print(f"✅ Created test patient record with ID: {test_patient.id}")
        
        print("\n🎉 Test user setup complete!")
        print("📧 Username: testuser")
        print("🔑 Password: testpass123")
        print("👤 Patient ID:", test_patient.id)
        
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        db.rollback()
    finally:
        db.close()

def create_admin_user():
    """Create an admin user for development"""
    
    db: Session = SessionLocal()
    
    try:
        # Check if admin user already exists
        existing_admin = user_crud.get_by_username(db, username="admin")
        if existing_admin:
            print("✅ Admin user 'admin' already exists")
            return
        
        # Create admin user
        admin_data = UserCreate(
            username="admin",
            email="admin@example.com",
            password="admin123"
        )
        
        admin_user = user_crud.create(db=db, obj_in=admin_data)
        print(f"✅ Created admin user with ID: {admin_user.id}")
        print("📧 Username: admin")
        print("🔑 Password: admin123")
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Setting up test users for development...")
    print("=" * 50)
    
    create_test_user()
    print()
    create_admin_user()
    
    print("\n🌟 You can now use these credentials to test the application:")
    print("   - Regular user: testuser / testpass123")
    print("   - Admin user: admin / admin123")
