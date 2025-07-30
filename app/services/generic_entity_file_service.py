"""
Generic Entity File Service for handling file operations across all entity types.
Supports lab-results, insurance, visits, procedures, and future entity types.
"""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.models import EntityFile, get_utc_now
from app.schemas.entity_file import (
    EntityFileCreate,
    EntityFileResponse,
    EntityType,
    FileOperationResult
)
from app.services.file_management_service import FileManagementService

logger = get_logger(__name__, "app")


class GenericEntityFileService:
    """Service for managing files across all entity types."""

    def __init__(self):
        self.uploads_dir = Path(settings.UPLOAD_DIR)
        self.file_management_service = FileManagementService()
        
        # Entity type to directory mapping
        self.entity_dirs = {
            EntityType.LAB_RESULT: "lab-results",
            EntityType.INSURANCE: "insurance", 
            EntityType.VISIT: "visits",
            EntityType.ENCOUNTER: "visits",  # encounters and visits use same directory
            EntityType.PROCEDURE: "procedures"
        }

    def _get_entity_directory(self, entity_type: str) -> Path:
        """Get the directory path for a specific entity type."""
        entity_type_enum = EntityType(entity_type)
        dir_name = self.entity_dirs.get(entity_type_enum, entity_type)
        entity_dir = self.uploads_dir / "files" / dir_name
        entity_dir.mkdir(parents=True, exist_ok=True)
        return entity_dir

    def _generate_unique_filename(self, original_filename: str, entity_dir: Path) -> str:
        """Generate a unique filename to prevent conflicts."""
        file_extension = Path(original_filename).suffix
        base_name = Path(original_filename).stem
        
        # Use UUID for uniqueness
        unique_id = str(uuid.uuid4())
        unique_filename = f"{base_name}_{unique_id}{file_extension}"
        
        # Ensure uniqueness (though UUID collision is extremely unlikely)
        counter = 1
        while (entity_dir / unique_filename).exists():
            unique_filename = f"{base_name}_{unique_id}_{counter}{file_extension}"
            counter += 1
            
        return unique_filename

    def _validate_entity_type(self, entity_type: str) -> None:
        """Validate that the entity type is supported."""
        try:
            EntityType(entity_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported entity type: {entity_type}. "
                       f"Supported types: {[t.value for t in EntityType]}"
            )

    async def upload_file(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file: UploadFile,
        description: Optional[str] = None,
        category: Optional[str] = None
    ) -> EntityFileResponse:
        """
        Upload a file for any entity type.
        
        Args:
            db: Database session
            entity_type: Type of entity (lab-result, insurance, visit, procedure)
            entity_id: ID of the entity
            file: File to upload
            description: Optional description
            category: Optional category
            
        Returns:
            EntityFileResponse with file details
        """
        try:
            # Validate entity type
            self._validate_entity_type(entity_type)
            
            # Get entity directory
            entity_dir = self._get_entity_directory(entity_type)
            
            # Generate unique filename
            unique_filename = self._generate_unique_filename(file.filename, entity_dir)
            file_path = entity_dir / unique_filename
            
            # Read file content
            file_content = await file.read()
            file_size = len(file_content)
            
            # Validate file size (100MB limit)
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                raise HTTPException(
                    status_code=413,
                    detail=f"File size ({file_size} bytes) exceeds maximum allowed size ({max_size} bytes)"
                )
            
            # Save file to disk
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # Create database record
            entity_file = EntityFile(
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file.filename,
                file_path=str(file_path),
                file_type=file.content_type,
                file_size=file_size,
                description=description,
                category=category,
                uploaded_at=get_utc_now()
            )
            
            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)
            
            logger.info(f"File uploaded successfully: {file.filename} for {entity_type} {entity_id}")
            
            return EntityFileResponse.from_orm(entity_file)
            
        except HTTPException:
            raise
        except Exception as e:
            # Clean up file if database operation failed
            if 'file_path' in locals() and file_path.exists():
                file_path.unlink()
            
            logger.error(f"Error uploading file: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload file: {str(e)}"
            )

    def get_entity_files(
        self,
        db: Session,
        entity_type: str,
        entity_id: int
    ) -> List[EntityFileResponse]:
        """
        Get all files for a specific entity.
        
        Args:
            db: Database session
            entity_type: Type of entity
            entity_id: ID of the entity
            
        Returns:
            List of EntityFileResponse objects
        """
        try:
            # Validate entity type
            self._validate_entity_type(entity_type)
            
            # Query files from database
            files = db.query(EntityFile).filter(
                EntityFile.entity_type == entity_type,
                EntityFile.entity_id == entity_id
            ).order_by(EntityFile.uploaded_at.desc()).all()
            
            return [EntityFileResponse.from_orm(file) for file in files]
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving files for {entity_type} {entity_id}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve files: {str(e)}"
            )

    def get_file_by_id(self, db: Session, file_id: int) -> Optional[EntityFile]:
        """
        Get a file by its ID.
        
        Args:
            db: Database session
            file_id: ID of the file
            
        Returns:
            EntityFile object or None
        """
        try:
            return db.query(EntityFile).filter(EntityFile.id == file_id).first()
        except Exception as e:
            logger.error(f"Error retrieving file {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve file: {str(e)}"
            )

    async def delete_file(self, db: Session, file_id: int) -> FileOperationResult:
        """
        Delete a file by its ID.
        
        Args:
            db: Database session
            file_id: ID of the file to delete
            
        Returns:
            FileOperationResult with operation details
        """
        try:
            # Get file record
            file_record = self.get_file_by_id(db, file_id)
            if not file_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found: {file_id}"
                )
            
            # Move file to trash instead of permanent deletion
            file_path = file_record.file_path
            if os.path.exists(file_path):
                trash_result = self.file_management_service.move_to_trash(
                    file_path, 
                    reason=f"Deleted via API for {file_record.entity_type} {file_record.entity_id}"
                )
                logger.info(f"File moved to trash: {trash_result}")
            
            # Remove from database
            db.delete(file_record)
            db.commit()
            
            logger.info(f"File deleted successfully: {file_record.file_name}")
            
            return FileOperationResult(
                success=True,
                message="File deleted successfully",
                file_id=file_id,
                file_path=file_path
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete file: {str(e)}"
            )

    def get_file_download_info(self, db: Session, file_id: int) -> Tuple[str, str, str]:
        """
        Get file information for download.
        
        Args:
            db: Database session
            file_id: ID of the file
            
        Returns:
            Tuple of (file_path, filename, content_type)
        """
        try:
            file_record = self.get_file_by_id(db, file_id)
            if not file_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found: {file_id}"
                )
            
            # Check if file exists on disk
            if not os.path.exists(file_record.file_path):
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found on disk: {file_record.file_name}"
                )
            
            return (
                file_record.file_path,
                file_record.file_name,
                file_record.file_type or "application/octet-stream"
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting download info for file {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get file download info: {str(e)}"
            )

    def get_files_count_batch(
        self,
        db: Session,
        entity_type: str,
        entity_ids: List[int]
    ) -> Dict[int, int]:
        """
        Get file counts for multiple entities in batch.
        
        Args:
            db: Database session
            entity_type: Type of entity
            entity_ids: List of entity IDs
            
        Returns:
            Dictionary mapping entity_id to file_count
        """
        try:
            # Validate entity type
            self._validate_entity_type(entity_type)
            
            # Query file counts
            from sqlalchemy import func
            results = db.query(
                EntityFile.entity_id,
                func.count(EntityFile.id).label('file_count')
            ).filter(
                EntityFile.entity_type == entity_type,
                EntityFile.entity_id.in_(entity_ids)
            ).group_by(EntityFile.entity_id).all()
            
            # Create result dictionary with 0 counts for entities with no files
            file_counts = {entity_id: 0 for entity_id in entity_ids}
            for entity_id, count in results:
                file_counts[entity_id] = count
            
            return file_counts
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting batch file counts: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get file counts: {str(e)}"
            )

    def update_file_metadata(
        self,
        db: Session,
        file_id: int,
        description: Optional[str] = None,
        category: Optional[str] = None
    ) -> EntityFileResponse:
        """
        Update file metadata (description, category).
        
        Args:
            db: Database session
            file_id: ID of the file to update
            description: New description
            category: New category
            
        Returns:
            Updated EntityFileResponse
        """
        try:
            file_record = self.get_file_by_id(db, file_id)
            if not file_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found: {file_id}"
                )
            
            # Update metadata
            if description is not None:
                file_record.description = description
            if category is not None:
                file_record.category = category
            
            file_record.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(file_record)
            
            logger.info(f"File metadata updated: {file_id}")
            
            return EntityFileResponse.from_orm(file_record)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating file metadata {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to update file metadata: {str(e)}"
            )