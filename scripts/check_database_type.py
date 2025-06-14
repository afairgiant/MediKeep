#!/usr/bin/env python3
"""
Database Type Checker for Medical Records Management System.

This script helps you determine whether your application is using SQLite or PostgreSQL
by checking the database connection and type.
"""

import os
import sys
from sqlalchemy import text, inspect
from typing import Dict, Any

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "app"))

from app.core.database import engine, db_config


def check_database_type() -> Dict[str, Any]:
    """
    Check the database type and connection details.

    Returns:
        Dictionary containing database information
    """
    info = {
        "database_url": db_config.database_url,
        "database_type": None,
        "connection_successful": False,
        "database_name": None,
        "host": None,
        "port": None,
        "user": None,
        "tables_count": 0,
        "postgresql_specific_check": False,
    }

    try:
        # Determine database type from URL
        if db_config.database_url.startswith("sqlite"):
            info["database_type"] = "SQLite"
            # Extract database file path
            db_file = db_config.database_url.replace("sqlite:///", "")
            info["database_file"] = db_file
            info["file_exists"] = (
                os.path.exists(db_file)
                if not db_file.startswith("./")
                else os.path.exists(db_file[2:])
            )
        elif db_config.database_url.startswith("postgresql"):
            info["database_type"] = "PostgreSQL"
            # Parse PostgreSQL URL components
            url_parts = db_config.database_url.replace("postgresql://", "").split("/")
            if len(url_parts) >= 2:
                auth_host = url_parts[0]
                info["database_name"] = url_parts[1].split("?")[
                    0
                ]  # Remove query params if any

                if "@" in auth_host:
                    auth, host_port = auth_host.split("@")
                    if ":" in auth:
                        info["user"] = auth.split(":")[0]
                    if ":" in host_port:
                        info["host"] = host_port.split(":")[0]
                        info["port"] = host_port.split(":")[1]
                    else:
                        info["host"] = host_port
                        info["port"] = "5432"  # Default PostgreSQL port

        # Test connection
        with engine.connect() as connection:
            info["connection_successful"] = True

            # Get database name from connection
            try:
                if info["database_type"] == "PostgreSQL":
                    result = connection.execute(text("SELECT current_database()"))
                    info["database_name"] = result.scalar()

                    # PostgreSQL specific check
                    result = connection.execute(text("SELECT version()"))
                    version = result.scalar()
                    info["postgresql_version"] = version
                    info["postgresql_specific_check"] = True

                elif info["database_type"] == "SQLite":
                    # SQLite specific check
                    result = connection.execute(text("SELECT sqlite_version()"))
                    version = result.scalar()
                    info["sqlite_version"] = version

            except Exception as e:
                info["version_check_error"] = str(e)

            # Count tables
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            info["tables_count"] = len(tables)
            info["tables"] = tables[:10]  # Show first 10 tables

    except Exception as e:
        info["connection_error"] = str(e)

    return info


def check_environment_variables() -> Dict[str, Any]:
    """
    Check relevant environment variables that affect database configuration.
    """
    env_vars = {
        "DATABASE_URL": os.getenv("DATABASE_URL"),
        "DB_HOST": os.getenv("DB_HOST"),
        "DB_PORT": os.getenv("DB_PORT"),
        "DB_NAME": os.getenv("DB_NAME"),
        "DB_USER": os.getenv("DB_USER"),
        "DB_PASSWORD": "***" if os.getenv("DB_PASSWORD") else None,
    }

    return {k: v for k, v in env_vars.items() if v is not None}


def print_database_status():
    """Print comprehensive database status information."""

    print("=" * 60)
    print("DATABASE TYPE CHECKER")
    print("=" * 60)
    # Check environment variables
    print("\n📋 ENVIRONMENT VARIABLES:")
    env_vars = check_environment_variables()
    if env_vars:
        for key, value in env_vars.items():
            print(f"  {key}: {value}")
    else:
        print("  No database-related environment variables found")

    print("\n🔗 CONFIGURED DATABASE URL:")
    print(f"  {db_config.database_url}")

    # Check database type and connection
    print("\n🔍 DATABASE ANALYSIS:")
    db_info = check_database_type()

    print(f"  Database Type: {db_info['database_type']}")
    print(
        f"  Connection: {'✅ SUCCESS' if db_info['connection_successful'] else '❌ FAILED'}"
    )

    if db_info["connection_successful"]:
        if db_info["database_type"] == "PostgreSQL":
            print(f"  Database Name: {db_info.get('database_name', 'Unknown')}")
            print(f"  Host: {db_info.get('host', 'Unknown')}")
            print(f"  Port: {db_info.get('port', 'Unknown')}")
            print(f"  User: {db_info.get('user', 'Unknown')}")
            if "postgresql_version" in db_info:
                print(f"  PostgreSQL Version: {db_info['postgresql_version']}")
            print(
                f"  PostgreSQL Features Available: {'✅ YES' if db_info['postgresql_specific_check'] else '❌ NO'}"
            )

        elif db_info["database_type"] == "SQLite":
            print(f"  Database File: {db_info.get('database_file', 'Unknown')}")
            print(
                f"  File Exists: {'✅ YES' if db_info.get('file_exists', False) else '❌ NO'}"
            )
            if "sqlite_version" in db_info:
                print(f"  SQLite Version: {db_info['sqlite_version']}")

        print(f"  Tables Count: {db_info['tables_count']}")
        if db_info["tables"]:
            print(f"  Sample Tables: {', '.join(db_info['tables'])}")

    else:
        print(f"  Connection Error: {db_info.get('connection_error', 'Unknown error')}")

    # Provide recommendations
    print("\n💡 RECOMMENDATIONS:")
    if db_info["database_type"] == "SQLite":
        print("  ⚠️  You are using SQLite!")
        print("  🐳 To use PostgreSQL in Docker, ensure:")
        print("     1. Your .env file has proper DB_* variables set")
        print("     2. The DATABASE_URL environment variable is set to PostgreSQL")
        print("     3. The PostgreSQL container is running and healthy")
        print("     4. The app container can connect to the postgres service")

    elif db_info["database_type"] == "PostgreSQL":
        if db_info["connection_successful"] and db_info["postgresql_specific_check"]:
            print("  ✅ You are successfully using PostgreSQL!")
            print("  🎉 All PostgreSQL-specific features are available")
        else:
            print("  ⚠️  PostgreSQL connection configured but having issues")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    try:
        print_database_status()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
    except Exception as e:
        print(f"\n❌ Error running database check: {e}")
        sys.exit(1)
