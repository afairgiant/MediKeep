#!/usr/bin/env python3
"""
Emergency Admin User Creation Script

This script can be used to create a default admin user in emergency situations,
such as when all admin users have been accidentally deleted.

Usage:
        # Via docker exec (from host machine):
    docker exec <container_name> python app/scripts/create_emergency_admin.py

    # Or directly on the server:
    python app/scripts/create_emergency_admin.py

    # With custom credentials:
    python app/scripts/create_emergency_admin.py --username emergency_admin --password custom_password

Security Note:
    This script should only be used in emergency situations.
    Change the default password immediately after logging in.
"""

import argparse
import getpass
import os
import sys
from pathlib import Path

# Add the project root to Python path so we can import our app modules

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.crud.user import user
    from app.services.auth import AuthService
except ImportError as e:
    print(f"❌ Error importing app modules: {e}")
    print("Make sure you're running this script from the project root directory")
    sys.exit(1)


def check_database_connection():
    """Check if database is accessible"""
    try:
        from sqlalchemy import text

        db = SessionLocal()
        # Simple query to test connection
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


def create_emergency_admin(
    username: str = "admin", password: str = "admin123", force: bool = False
):
    """
    Create an emergency admin user.

    Args:
        username: Username for the admin user
        password: Password for the admin user
        force: If True, create even if admin users exist
    """
    print("🚨 Emergency Admin User Creation Script")
    print("=" * 50)

    # Check database connection
    print("🔍 Checking database connection...")
    if not check_database_connection():
        print(
            "❌ Cannot connect to database. Please check your database configuration."
        )
        return False

    print("✅ Database connection successful")

    db = SessionLocal()
    try:
        # Check current admin count
        admin_count = user.get_admin_count(db)
        total_users = user.get_total_count(db)

        print(f"📊 Current system status:")
        print(f"   • Total users: {total_users}")
        print(f"   • Admin users: {admin_count}")

        # Check if user with same username exists
        existing_user = AuthService.get_user_by_username(db, username)
        if existing_user:
            print(f"⚠️  User '{username}' already exists!")
            if existing_user.role.lower() in ["admin", "administrator"]:
                print(f"   This user already has admin privileges.")
                return False
            else:
                print(f"   This user has role '{existing_user.role}' (not admin)")
                return False

        # Warn if admin users exist and force is not set
        if admin_count > 0 and not force:
            print(
                f"⚠️  Warning: {admin_count} admin user(s) already exist in the system."
            )
            print("   This script should only be used when NO admin users exist.")
            print(
                "   Use --force flag if you really want to create another admin user."
            )
            return False

        # Create the emergency admin user
        print(f"🔧 Creating emergency admin user '{username}'...")

        new_user = AuthService.create_user(
            db, username=username, password=password, is_superuser=True
        )

        print("✅ Emergency admin user created successfully!")
        print("")
        print("🔐 Login Credentials:")
        print(f"   • Username: {username}")
        print("   • Password: [Hidden for security]")
        print("")
        print("⚠️  IMPORTANT SECURITY NOTICE:")
        print("   1. Log in immediately and change this password")
        print("   2. Consider creating a proper admin user with a secure password")
        print("   3. Delete this emergency user once you have proper access")
        print("")

        return True

    except Exception as e:
        print(f"❌ Error creating emergency admin user: {e}")
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Create an emergency admin user for system recovery",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
    Examples:
    # Create default admin user (admin/admin123)
    python app/scripts/create_emergency_admin.py

    # Create custom admin user
    python app/scripts/create_emergency_admin.py --username emergency_admin --password my_secure_password

    # Force creation even if admin users exist
    python app/scripts/create_emergency_admin.py --force

    # Via Docker (from host machine)
    docker exec medical-records-app python app/scripts/create_emergency_admin.py
        """,
    )

    parser.add_argument(
        "--username",
        default="admin",
        help="Username for the emergency admin user (default: admin)",
    )

    parser.add_argument(
        "--password",
        help="Password for the emergency admin user (will prompt if not provided)",
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Create admin user even if other admin users exist",
    )

    args = parser.parse_args()

    # Get password securely if not provided
    if not args.password:
        print(f"Creating emergency admin user '{args.username}'")
        print("Please enter a secure password for this admin account:")
        password = getpass.getpass("Password: ")
        password_confirm = getpass.getpass("Confirm password: ")
        
        if password != password_confirm:
            print("❌ Passwords do not match. Operation cancelled.")
            return
        
        if len(password) < 8:
            print("❌ Password must be at least 8 characters long. Operation cancelled.")
            return
    else:
        password = args.password

    # Confirm action with user
    if not args.force:
        print(
            f"This will create an emergency admin user with username '{args.username}'"
        )
        confirm = input("Are you sure you want to continue? (yes/no): ").lower().strip()
        if confirm not in ["yes", "y"]:
            print("Operation cancelled.")
            return

    success = create_emergency_admin(
        username=args.username, password=password, force=args.force
    )

    if success:
        print("🎉 Emergency admin user creation completed successfully!")
        sys.exit(0)
    else:
        print("❌ Emergency admin user creation failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
