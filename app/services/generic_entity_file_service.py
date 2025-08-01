"""
Generic Entity File Service for handling file operations across all entity types.
Supports lab-results, insurance, visits, procedures, and future entity types.
"""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.models import EntityFile, UserPreferences, get_utc_now
from app.schemas.entity_file import (
    EntityFileCreate,
    EntityFileResponse,
    EntityType,
    FileOperationResult,
)
from app.services.file_management_service import FileManagementService
from app.services.paperless_service import (
    create_paperless_service_with_username_password,
)

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
            EntityType.PROCEDURE: "procedures",
        }

    def _get_entity_directory(self, entity_type: str) -> Path:
        """Get the directory path for a specific entity type."""
        entity_type_enum = EntityType(entity_type)
        dir_name = self.entity_dirs.get(entity_type_enum, entity_type)
        entity_dir = self.uploads_dir / "files" / dir_name
        entity_dir.mkdir(parents=True, exist_ok=True)
        return entity_dir

    def _generate_unique_filename(
        self, original_filename: str, entity_dir: Path
    ) -> str:
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
                f"Supported types: {[t.value for t in EntityType]}",
            )

    async def upload_file(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file: UploadFile,
        description: Optional[str] = None,
        category: Optional[str] = None,
        storage_backend: Optional[str] = "local",
        current_user_id: Optional[int] = None,
    ) -> EntityFileResponse:
        """
        Upload a file for any entity type with dual storage backend support.

        Args:
            db: Database session
            entity_type: Type of entity (lab-result, insurance, visit, procedure)
            entity_id: ID of the entity
            file: File to upload
            description: Optional description
            category: Optional category
            storage_backend: Storage backend ('local' or 'paperless')
            current_user_id: ID of the user uploading the file

        Returns:
            EntityFileResponse with file details
        """
        # If no storage backend specified, use user's default preference
        if storage_backend is None:
            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )
            storage_backend = (
                user_prefs.default_storage_backend if user_prefs else "local"
            )
            logger.info(
                f"No storage backend specified, using user default: {storage_backend}"
            )

        logger.info(
            f"Starting file upload: {file.filename} to {storage_backend} storage for {entity_type} {entity_id} (user: {current_user_id})"
        )
        try:
            # Validate entity type
            self._validate_entity_type(entity_type)

            # Validate storage backend
            if storage_backend not in ["local", "paperless"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid storage backend: {storage_backend}. Must be 'local' or 'paperless'",
                )

            # If paperless is selected, validate configuration before attempting upload
            if storage_backend == "paperless":
                user_prefs = (
                    db.query(UserPreferences)
                    .filter(UserPreferences.user_id == current_user_id)
                    .first()
                )

                if not user_prefs or not user_prefs.paperless_enabled:
                    raise HTTPException(
                        status_code=400,
                        detail="Paperless integration is not enabled. Please enable it in settings before uploading to Paperless.",
                    )

                if (
                    not user_prefs.paperless_url
                    or not user_prefs.paperless_username_encrypted
                    or not user_prefs.paperless_password_encrypted
                ):
                    raise HTTPException(
                        status_code=400,
                        detail="Paperless configuration is incomplete. Please configure URL and credentials in settings.",
                    )

            # Read file content once for both backends
            file_content = await file.read()
            file_size = len(file_content)

            # Validate file size (100MB limit)
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                raise HTTPException(
                    status_code=413,
                    detail=f"File size ({file_size} bytes) exceeds maximum allowed size ({max_size} bytes)",
                )

            # Route to appropriate storage backend
            logger.info(f"Routing upload to {storage_backend} backend")
            if storage_backend == "paperless":
                result = await self._upload_to_paperless(
                    db,
                    entity_type,
                    entity_id,
                    file,
                    file_content,
                    file_size,
                    description,
                    category,
                    current_user_id,
                )
                logger.info(f"Paperless upload completed: file_id={result.id}")
                return result
            else:
                result = await self._upload_to_local(
                    db,
                    entity_type,
                    entity_id,
                    file,
                    file_content,
                    file_size,
                    description,
                    category,
                )
                logger.info(f"Local upload completed: file_id={result.id}")
                return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to upload file: {str(e)}"
            )

    def get_entity_files(
        self, db: Session, entity_type: str, entity_id: int
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
            files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.entity_type == entity_type,
                    EntityFile.entity_id == entity_id,
                )
                .order_by(EntityFile.uploaded_at.desc())
                .all()
            )

            return [EntityFileResponse.model_validate(file) for file in files]

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"Error retrieving files for {entity_type} {entity_id}: {str(e)}"
            )
            raise HTTPException(
                status_code=500, detail=f"Failed to retrieve files: {str(e)}"
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
                status_code=500, detail=f"Failed to retrieve file: {str(e)}"
            )

    async def delete_file(self, db: Session, file_id: int) -> FileOperationResult:
        """
        Delete a file by its ID from both local and paperless storage.

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
                    status_code=404, detail=f"File not found: {file_id}"
                )

            # Route to appropriate storage backend for deletion
            if file_record.storage_backend == "paperless":
                await self._delete_from_paperless(db, file_record)
            else:
                # Handle local file deletion
                file_path = file_record.file_path
                if os.path.exists(file_path):
                    trash_result = self.file_management_service.move_to_trash(
                        file_path,
                        reason=f"Deleted via API for {file_record.entity_type} {file_record.entity_id}",
                    )
                    logger.info(f"File moved to trash: {trash_result}")

            # Remove from database
            db.delete(file_record)
            db.commit()

            logger.info(
                f"File deleted successfully: {file_record.file_name} from {file_record.storage_backend} storage"
            )

            return FileOperationResult(
                success=True,
                message="File deleted successfully",
                file_id=file_id,
                file_path=file_record.file_path
                or f"paperless:{file_record.paperless_document_id}",
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to delete file: {str(e)}"
            )

    async def get_file_download_info(
        self, db: Session, file_id: int
    ) -> Tuple[str, str, str]:
        """
        Get file information for download from both local and paperless storage.

        Args:
            db: Database session
            file_id: ID of the file

        Returns:
            Tuple of (file_path_or_content, filename, content_type)
        """
        try:
            file_record = self.get_file_by_id(db, file_id)
            if not file_record:
                raise HTTPException(
                    status_code=404, detail=f"File not found: {file_id}"
                )

            # Route to appropriate storage backend for download
            if file_record.storage_backend == "paperless":
                return await self._get_paperless_download_info(db, file_record)
            else:
                # Handle local file download
                if not os.path.exists(file_record.file_path):
                    raise HTTPException(
                        status_code=404,
                        detail=f"File not found on disk: {file_record.file_name}",
                    )

                return (
                    file_record.file_path,
                    file_record.file_name,
                    file_record.file_type or "application/octet-stream",
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting download info for file {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get file download info: {str(e)}"
            )

    def get_files_count_batch(
        self, db: Session, entity_type: str, entity_ids: List[int]
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

            results = (
                db.query(
                    EntityFile.entity_id, func.count(EntityFile.id).label("file_count")
                )
                .filter(
                    EntityFile.entity_type == entity_type,
                    EntityFile.entity_id.in_(entity_ids),
                )
                .group_by(EntityFile.entity_id)
                .all()
            )

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
                status_code=500, detail=f"Failed to get file counts: {str(e)}"
            )

    async def _upload_to_local(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file: UploadFile,
        file_content: bytes,
        file_size: int,
        description: Optional[str] = None,
        category: Optional[str] = None,
    ) -> EntityFileResponse:
        """
        Upload file to local storage.

        Args:
            db: Database session
            entity_type: Type of entity
            entity_id: ID of the entity
            file: File to upload
            file_content: File content bytes
            file_size: Size of file in bytes
            description: Optional description
            category: Optional category

        Returns:
            EntityFileResponse with file details
        """
        # Get entity directory
        entity_dir = self._get_entity_directory(entity_type)

        # Generate unique filename
        unique_filename = self._generate_unique_filename(file.filename, entity_dir)
        file_path = entity_dir / unique_filename

        try:
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
                storage_backend="local",
                uploaded_at=get_utc_now(),
            )

            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)

            logger.info(
                f"File uploaded to local storage: {file.filename} for {entity_type} {entity_id}"
            )

            return EntityFileResponse.model_validate(entity_file)

        except Exception as e:
            # Clean up file if database operation failed
            if file_path.exists():
                file_path.unlink()
            raise e

    async def _upload_to_paperless(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file: UploadFile,
        file_content: bytes,
        file_size: int,
        description: Optional[str] = None,
        category: Optional[str] = None,
        current_user_id: Optional[int] = None,
    ) -> EntityFileResponse:
        """
        Upload file to paperless-ngx.

        Args:
            db: Database session
            entity_type: Type of entity
            entity_id: ID of the entity
            file: File to upload
            file_content: File content bytes
            file_size: Size of file in bytes
            description: Optional description
            category: Optional category
            current_user_id: ID of the user uploading the file

        Returns:
            EntityFileResponse with file details
        """
        if not current_user_id:
            raise HTTPException(
                status_code=400, detail="User ID is required for paperless uploads"
            )

        # Get user's paperless configuration
        user_prefs = (
            db.query(UserPreferences)
            .filter(UserPreferences.user_id == current_user_id)
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            raise HTTPException(
                status_code=400,
                detail="Paperless integration is not enabled for this user",
            )

        if (
            not user_prefs.paperless_url
            or not user_prefs.paperless_username_encrypted
            or not user_prefs.paperless_password_encrypted
        ):
            raise HTTPException(
                status_code=400, detail="Paperless configuration is incomplete"
            )

        try:
            # Check if this file already exists in our database for this user
            existing_paperless_file = (
                db.query(EntityFile)
                .filter(
                    EntityFile.file_name == file.filename,
                    EntityFile.storage_backend == "paperless",
                    EntityFile.paperless_document_id.isnot(None)
                )
                .first()
            )

            if existing_paperless_file:
                logger.info(
                    f"Found existing Paperless document for '{file.filename}': {existing_paperless_file.paperless_document_id}"
                )
                
                # Create new database record pointing to same Paperless document
                entity_file = EntityFile(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    file_name=file.filename,
                    file_path="paperless://",
                    file_type=file.content_type,
                    file_size=file_size,
                    description=description,
                    category=category,
                    storage_backend="paperless",
                    paperless_document_id=existing_paperless_file.paperless_document_id,
                    sync_status="synced",
                    last_sync_at=get_utc_now(),
                    uploaded_at=get_utc_now(),
                )

                db.add(entity_file)
                db.commit()
                db.refresh(entity_file)

                logger.info(
                    f"Created reference to existing Paperless document: {file.filename} for {entity_type} {entity_id} (reusing document {existing_paperless_file.paperless_document_id})"
                )
                
                # Note: We could add a success message here if we want to inform users
                # that we reused an existing document instead of uploading a duplicate

                return EntityFileResponse.model_validate(entity_file)

            # File doesn't exist, proceed with upload
            # Create paperless service
            paperless_service = create_paperless_service_with_username_password(
                user_prefs.paperless_url,
                user_prefs.paperless_username_encrypted,
                user_prefs.paperless_password_encrypted,
                current_user_id,
            )

            # Upload to paperless
            async with paperless_service:
                upload_result = await paperless_service.upload_document(
                    file_data=file_content,
                    filename=file.filename,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    description=description,
                )

            # Create database record for paperless file
            entity_file = EntityFile(
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file.filename,
                file_path="paperless://",  # Paperless storage, no local path
                file_type=file.content_type,
                file_size=file_size,
                description=description,
                category=category,
                storage_backend="paperless",
                paperless_document_id=upload_result.get("document_id"),
                sync_status="synced",
                last_sync_at=get_utc_now(),
                uploaded_at=get_utc_now(),
            )

            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)

            logger.info(
                f"File uploaded to paperless: {file.filename} for {entity_type} {entity_id} (task_id: {upload_result.get('task_id')})"
            )

            return EntityFileResponse.model_validate(entity_file)

        except Exception as e:
            logger.error(f"Error uploading to paperless: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to upload to paperless: {str(e)}"
            )

    def update_file_metadata(
        self,
        db: Session,
        file_id: int,
        description: Optional[str] = None,
        category: Optional[str] = None,
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
                    status_code=404, detail=f"File not found: {file_id}"
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

            return EntityFileResponse.model_validate(file_record)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating file metadata {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to update file metadata: {str(e)}"
            )

    async def _delete_from_paperless(
        self, db: Session, file_record: EntityFile
    ) -> None:
        """
        Delete file from paperless-ngx storage.

        Args:
            db: Database session
            file_record: EntityFile record
        """
        if not file_record.paperless_document_id:
            logger.warning(
                f"File {file_record.id} marked as paperless but has no document ID"
            )
            return

        # Get user preferences to create paperless service
        user_prefs = (
            db.query(UserPreferences)
            .filter(
                UserPreferences.user_id == 1  # TODO: Get actual user ID from context
            )
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            logger.warning(
                f"Cannot delete from paperless: user preferences not found or disabled"
            )
            return

        try:
            # Create paperless service
            paperless_service = create_paperless_service_with_username_password(
                user_prefs.paperless_url,
                user_prefs.paperless_username_encrypted,
                user_prefs.paperless_password_encrypted,
                1,  # TODO: Get actual user ID from context
            )

            # Delete from paperless
            async with paperless_service:
                await paperless_service.delete_document(
                    file_record.paperless_document_id
                )

            logger.info(
                f"File deleted from paperless: document_id={file_record.paperless_document_id}"
            )

        except Exception as e:
            logger.error(f"Failed to delete file from paperless: {str(e)}")
            # Don't fail the entire operation if paperless deletion fails
            # The database record will still be removed

    async def _get_paperless_download_info(
        self, db: Session, file_record: EntityFile
    ) -> Tuple[bytes, str, str]:
        """
        Get file download info from paperless-ngx storage.

        Args:
            db: Database session
            file_record: EntityFile record

        Returns:
            Tuple of (file_content_bytes, filename, content_type)
        """
        if not file_record.paperless_document_id:
            raise HTTPException(
                status_code=404,
                detail=f"Paperless document ID not found for file: {file_record.file_name}",
            )

        # Get user preferences to create paperless service
        user_prefs = (
            db.query(UserPreferences)
            .filter(
                UserPreferences.user_id == 1  # TODO: Get actual user ID from context
            )
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            raise HTTPException(
                status_code=400,
                detail="Cannot download from paperless: user preferences not found or disabled",
            )

        try:
            # Create paperless service
            paperless_service = create_paperless_service_with_username_password(
                user_prefs.paperless_url,
                user_prefs.paperless_username_encrypted,
                user_prefs.paperless_password_encrypted,
                1,  # TODO: Get actual user ID from context
            )

            # Download from paperless
            async with paperless_service:
                file_content = await paperless_service.download_document(
                    file_record.paperless_document_id
                )

            logger.info(
                f"File downloaded from paperless: document_id={file_record.paperless_document_id}, size={len(file_content)}"
            )

            return (
                file_content,
                file_record.file_name,
                file_record.file_type or "application/octet-stream",
            )

        except Exception as e:
            logger.error(f"Failed to download file from paperless: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to download file from paperless: {str(e)}",
            )

    async def check_paperless_sync_status(
        self, db: Session, current_user_id: int
    ) -> Dict[int, bool]:
        """
        Check sync status for all Paperless documents for a user.

        Args:
            db: Database session
            current_user_id: User ID to check documents for

        Returns:
            Dictionary mapping file_id to existence status (True = exists, False = missing)
        """
        try:
            # Get all paperless files for the user
            paperless_files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.storage_backend == "paperless",
                    EntityFile.paperless_document_id.isnot(None),
                    # Filter by user would require joining with entities, for now check all
                )
                .all()
            )

            if not paperless_files:
                return {}

            # Get user's paperless configuration
            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            if not user_prefs or not user_prefs.paperless_enabled:
                logger.warning("Cannot check paperless sync: user preferences not found or disabled")
                return {}

            # Create paperless service
            paperless_service = create_paperless_service_with_username_password(
                user_prefs.paperless_url,
                user_prefs.paperless_username_encrypted,
                user_prefs.paperless_password_encrypted,
                current_user_id,
            )

            sync_status = {}
            
            # Check each document
            async with paperless_service:
                for file_record in paperless_files:
                    try:
                        exists = await paperless_service.check_document_exists(
                            file_record.paperless_document_id
                        )
                        sync_status[file_record.id] = exists
                        
                        # Update sync status in database
                        if not exists:
                            file_record.sync_status = "missing"
                            file_record.last_sync_at = get_utc_now()
                        else:
                            file_record.sync_status = "synced"
                            file_record.last_sync_at = get_utc_now()
                        
                    except Exception as e:
                        logger.error(f"Error checking document {file_record.paperless_document_id}: {str(e)}")
                        sync_status[file_record.id] = False
                        file_record.sync_status = "error"
                        file_record.last_sync_at = get_utc_now()

            # Commit database updates
            db.commit()

            logger.info(f"Checked sync status for {len(paperless_files)} paperless documents")
            return sync_status

        except Exception as e:
            logger.error(f"Error checking paperless sync status: {str(e)}")
            return {}
