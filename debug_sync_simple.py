#!/usr/bin/env python3
"""
Simple debug script to investigate the paperless sync missing document detection issue.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.models import EntityFile, User, UserPreferences
from app.services.generic_entity_file_service import GenericEntityFileService
from app.services.paperless_service import create_paperless_service, create_paperless_service_with_username_password

logger = get_logger(__name__)

def setup_database():
    """Setup database connection for testing."""
    if hasattr(settings, 'DATABASE_URL'):
        engine = create_engine(settings.DATABASE_URL)
    else:
        # Fallback to individual settings
        db_url = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
        engine = create_engine(db_url)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

async def debug_sync_check(user_id: int):
    """Debug the sync check functionality for a specific user."""
    print(f"\nDEBUGGING SYNC CHECK FOR USER {user_id}")
    print("=" * 60)
    
    db = setup_database()
    file_service = GenericEntityFileService()
    
    try:
        # 1. Check if user exists and has paperless configuration
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"ERROR: User {user_id} not found")
            return
        print(f"SUCCESS: User found: {user.email}")
        
        # 2. Check user's paperless preferences
        user_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
        if not user_prefs:
            print(f"ERROR: No user preferences found for user {user_id}")
            return
        
        print(f"SUCCESS: User preferences found:")
        print(f"   - Paperless enabled: {user_prefs.paperless_enabled}")
        print(f"   - Paperless URL: {user_prefs.paperless_url}")
        print(f"   - Has token: {bool(user_prefs.paperless_api_token_encrypted)}")
        print(f"   - Has username: {bool(user_prefs.paperless_username_encrypted)}")
        print(f"   - Has password: {bool(user_prefs.paperless_password_encrypted)}")
        
        if not user_prefs.paperless_enabled:
            print(f"ERROR: Paperless not enabled for user {user_id}")
            return
            
        # Check if credentials exist (either token or username/password)
        has_auth = (user_prefs.paperless_api_token_encrypted or 
                   (user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted))
        if not user_prefs.paperless_url or not has_auth:
            print(f"ERROR: Incomplete paperless configuration for user {user_id}")
            return
        
        # 3. Find all paperless files for this user
        print(f"\nFINDING PAPERLESS FILES:")
        
        # Get all paperless files in the system first
        all_paperless_files = (
            db.query(EntityFile)
            .filter(
                EntityFile.storage_backend == "paperless",
                EntityFile.paperless_document_id.isnot(None),
            )
            .all()
        )
        
        print(f"Total paperless files in system: {len(all_paperless_files)}")
        
        # Now find user's paperless files using the same logic as the service
        from app.models.models import LabResult, Visit, Insurance, Procedure
        
        paperless_files = []
        
        # Query lab result files
        lab_files = (
            db.query(EntityFile)
            .join(LabResult, 
                  (EntityFile.entity_type == "lab-result") & 
                  (EntityFile.entity_id == LabResult.id))
            .filter(
                LabResult.user_id == user_id,
                EntityFile.storage_backend == "paperless",
                EntityFile.paperless_document_id.isnot(None),
            )
            .all()
        )
        print(f"Lab result files: {len(lab_files)}")
        paperless_files.extend(lab_files)
        
        # Query visit files  
        visit_files = (
            db.query(EntityFile)
            .join(Visit,
                  (EntityFile.entity_type.in_(["visit", "encounter"])) &
                  (EntityFile.entity_id == Visit.id))
            .filter(
                Visit.user_id == user_id,
                EntityFile.storage_backend == "paperless", 
                EntityFile.paperless_document_id.isnot(None),
            )
            .all()
        )
        print(f"Visit files: {len(visit_files)}")
        paperless_files.extend(visit_files)
        
        # Query insurance files
        insurance_files = (
            db.query(EntityFile)
            .join(Insurance,
                  (EntityFile.entity_type == "insurance") &
                  (EntityFile.entity_id == Insurance.id))
            .filter(
                Insurance.user_id == user_id,
                EntityFile.storage_backend == "paperless",
                EntityFile.paperless_document_id.isnot(None),
            )
            .all()
        )
        print(f"Insurance files: {len(insurance_files)}")
        paperless_files.extend(insurance_files)
        
        # Query procedure files
        procedure_files = (
            db.query(EntityFile)
            .join(Procedure,
                  (EntityFile.entity_type == "procedure") &
                  (EntityFile.entity_id == Procedure.id))
            .filter(
                Procedure.user_id == user_id,
                EntityFile.storage_backend == "paperless",
                EntityFile.paperless_document_id.isnot(None),
            )
            .all()
        )
        print(f"Procedure files: {len(procedure_files)}")
        paperless_files.extend(procedure_files)
        
        print(f"Total user paperless files: {len(paperless_files)}")
        
        if not paperless_files:
            print(f"ERROR: No paperless files found for user {user_id}")
            return
        
        # Show some example files
        for i, file_record in enumerate(paperless_files[:3]):
            print(f"   Example {i+1}: {file_record.file_name} (ID: {file_record.id}, Doc: {file_record.paperless_document_id}, Status: {file_record.sync_status})")
        
        # 4. Test paperless connection
        print(f"\nTESTING PAPERLESS CONNECTION:")
        
        # Test with smart factory (what sync check uses)
        print(f"Testing with smart factory (create_paperless_service)...")
        try:
            smart_service = create_paperless_service(
                user_prefs.paperless_url,
                encrypted_token=user_prefs.paperless_api_token_encrypted,
                encrypted_username=user_prefs.paperless_username_encrypted,
                encrypted_password=user_prefs.paperless_password_encrypted,
                user_id=user_id,
            )
            async with smart_service:
                connection_result = await smart_service.test_connection()
                print(f"SUCCESS: Smart factory connection successful: {connection_result.get('status')}")
                print(f"   Auth method: {smart_service.get_auth_type()}")
        except Exception as e:
            print(f"ERROR: Smart factory connection failed: {str(e)}")
            
        # Test with username/password (what upload uses)
        if user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted:
            print(f"Testing with username/password...")
            try:
                basic_service = create_paperless_service_with_username_password(
                    user_prefs.paperless_url,
                    user_prefs.paperless_username_encrypted,
                    user_prefs.paperless_password_encrypted,
                    user_id,
                )
                async with basic_service:
                    connection_result = await basic_service.test_connection()
                    print(f"SUCCESS: Username/password connection successful: {connection_result.get('status')}")
            except Exception as e:
                print(f"ERROR: Username/password connection failed: {str(e)}")
        
        # 5. Test document existence checking on a few files
        print(f"\nTESTING DOCUMENT EXISTENCE:")
        
        # Use the same auth method as sync check
        paperless_service = create_paperless_service(
            user_prefs.paperless_url,
            encrypted_token=user_prefs.paperless_api_token_encrypted,
            encrypted_username=user_prefs.paperless_username_encrypted,
            encrypted_password=user_prefs.paperless_password_encrypted,
            user_id=user_id,
        )
        
        async with paperless_service:
            for i, file_record in enumerate(paperless_files[:3]):  # Test first 3 files
                try:
                    document_id = file_record.paperless_document_id
                    print(f"Checking document {document_id} (file: {file_record.file_name})...")
                    
                    exists = await paperless_service.check_document_exists(document_id)
                    print(f"   Result: {'EXISTS' if exists else 'MISSING'}")
                    print(f"   Current sync_status: {file_record.sync_status}")
                    
                except Exception as e:
                    print(f"   ERROR checking: {str(e)}")
        
        # 6. Run the actual sync check
        print(f"\nRUNNING ACTUAL SYNC CHECK:")
        try:
            sync_result = await file_service.check_paperless_sync_status(db, user_id)
            print(f"SUCCESS: Sync check completed!")
            print(f"Results: {len(sync_result)} files checked")
            
            # Show summary
            missing_count = sum(1 for exists in sync_result.values() if not exists)
            existing_count = sum(1 for exists in sync_result.values() if exists)
            
            print(f"   - Existing: {existing_count}")
            print(f"   - Missing: {missing_count}")
            
            # Show missing files
            if missing_count > 0:
                print(f"\nMISSING FILES:")
                for file_record in paperless_files:
                    if sync_result.get(file_record.id) is False:
                        print(f"   - {file_record.file_name} (ID: {file_record.id}, Doc: {file_record.paperless_document_id})")
            
        except Exception as e:
            print(f"ERROR: Sync check failed: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
        
    finally:
        db.close()

async def main():
    """Main debug function."""
    print("PAPERLESS SYNC DEBUG TOOL")
    print("=" * 50)
    
    # You can customize these values:
    user_id = 1  # Change this to the user ID you want to test
    
    if len(sys.argv) > 1:
        user_id = int(sys.argv[1])
    
    # Run the debug
    await debug_sync_check(user_id)

if __name__ == "__main__":
    asyncio.run(main())