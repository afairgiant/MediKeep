#!/usr/bin/env python3
"""
Script to check existing users in the database
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.models import User


def check_users():
    """Check what users exist in the database"""
    print("🔍 Checking existing users in database...")
    print("=" * 50)

    db: Session = SessionLocal()
    try:
        users = db.query(User).all()

        if not users:
            print("❌ No users found in database")
            print("\n💡 You may need to create a user first:")
            print("   - Register through the frontend at http://localhost:3000")
            print("   - Or run the create_test_user.py script")
            return

        print(f"✅ Found {len(users)} user(s):")
        print()

        for i, user in enumerate(users, 1):
            print(f"{i}. Username: {user.username}")
            print(f"   Email: {user.email}")
            print(f"   Active: {user.is_active}")
            print(f"   Created: {user.created_at}")
            print()

        print("💡 Use any of these usernames with their passwords for testing")
        print("💡 If you don't know the password, you can create a new test user")

    except Exception as e:
        print(f"❌ Error checking users: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    check_users()
