"""
Data migration utilities for transitioning to the generic document management system.
"""

import os
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import LabResultFile, EntityFile, get_utc_now
from app.core.logging_config import get_logger

logger = get_logger(__name__, "migration")

def migrate_lab_result_files_to_entity_files():
    """
    Migrate existing lab_result_files to the new entity_files table.
    This is a one-time migration that ensures zero data loss during the
    transition to the generic document management system.
    
    Returns:
        tuple: (migrated_count, errors_list)
    """
    # Get database session
    db = next(get_db())
    
    try:
        # Quick check: Are there any old-style lab result files at all?
        lab_files_count = db.query(LabResultFile).count()
        
        if lab_files_count == 0:
            logger.debug("No old-style lab result files found - skipping migration")
            return 0, []
        
        logger.info("Starting lab result files migration to entity_files table")
        
        # Step 1: Count existing records
        entity_files_count = db.query(EntityFile).filter(EntityFile.entity_type == 'lab-result').count()
        
        logger.info(f"Migration status: {lab_files_count} lab files, {entity_files_count} already migrated")
        
        # If we have the same number of entity files as lab files, migration is likely complete
        if entity_files_count >= lab_files_count:
            logger.info("Migration appears complete - all files already migrated")
            return 0, []
        
        # Step 2: Find files that haven't been migrated yet
        unmigrated_files = []
        all_lab_files = db.query(LabResultFile).all()
        
        for lab_file in all_lab_files:
            # Check if this file has already been migrated
            existing_entity_file = db.query(EntityFile).filter(
                EntityFile.entity_type == 'lab-result',
                EntityFile.entity_id == lab_file.lab_result_id,
                EntityFile.file_name == lab_file.file_name,
                EntityFile.file_path == lab_file.file_path
            ).first()
            
            if not existing_entity_file:
                unmigrated_files.append(lab_file)
        
        if len(unmigrated_files) == 0:
            logger.info("All lab result files have already been migrated")
            return 0, []
        
        logger.info(f"Migrating {len(unmigrated_files)} lab result files with storage backend detection")
        
        # Step 3: Migrate files
        migrated_count = 0
        errors = []
        
        for lab_file in unmigrated_files:
            try:
                # Determine storage backend based on file existence
                # If file exists on disk, it's local storage
                # If file doesn't exist on disk, it might be in paperless
                storage_backend = 'local'
                paperless_document_id = None
                
                if lab_file.file_path and not os.path.exists(lab_file.file_path):
                    # File doesn't exist locally, might be in paperless
                    # For now, we'll mark it as local but log it for manual review
                    logger.warning(f"File not found on disk: {lab_file.file_path} - may need manual paperless migration")
                    storage_backend = 'local'  # Keep as local for safety
                
                # Create new EntityFile record from LabResultFile
                entity_file = EntityFile(
                    entity_type='lab-result',
                    entity_id=lab_file.lab_result_id,
                    file_name=lab_file.file_name,
                    file_path=lab_file.file_path,
                    file_type=lab_file.file_type or 'application/octet-stream',
                    file_size=lab_file.file_size,
                    description=lab_file.description,
                    category='lab-result',  # Default category for migrated files
                    storage_backend=storage_backend,
                    paperless_document_id=paperless_document_id,
                    sync_status='synced' if storage_backend == 'local' else None,
                    uploaded_at=lab_file.uploaded_at,
                    created_at=get_utc_now(),
                    updated_at=get_utc_now()
                )
                
                db.add(entity_file)
                migrated_count += 1
                
                logger.debug(f"Migrated file: {lab_file.file_name} (Lab Result ID: {lab_file.lab_result_id}, Storage: {storage_backend})")
                
            except Exception as e:
                error_msg = f"Failed to migrate {lab_file.file_name}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        # Step 4: Commit changes
        if migrated_count > 0:
            db.commit()
            logger.info(f"Successfully migrated {migrated_count} files to entity_files table")
        
        # Step 5: Verify migration
        final_entity_files_count = db.query(EntityFile).filter(EntityFile.entity_type == 'lab-result').count()
        
        if final_entity_files_count >= lab_files_count:
            logger.info("Migration verification passed - all files migrated successfully")
        else:
            logger.warning("Migration verification: Some files may not have been migrated")
        
        return migrated_count, errors
        
    except Exception as e:
        logger.error(f"Lab result files migration failed: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

def run_startup_data_migrations():
    """
    Run all necessary data migrations during application startup.
    This function is called automatically when the application starts.
    """
    logger.debug("Checking for pending data migrations")
    
    try:
        # Migration 1: Lab result files to entity files
        migrated_count, errors = migrate_lab_result_files_to_entity_files()
        
        if migrated_count > 0:
            logger.info(f"Lab result files migration completed: {migrated_count} files migrated")
            if errors:
                logger.warning(f"Migration completed with {len(errors)} errors")
        elif migrated_count == 0:
            logger.debug("No migrations were needed")
        
        logger.debug("All startup data migrations completed successfully")
        
    except Exception as e:
        logger.error(f"Startup data migrations failed: {str(e)}")
        # Don't raise here - let the application continue
        # The migration can be run manually if needed
        logger.warning("Application will continue despite migration failure")