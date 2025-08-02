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

    async def create_pending_file_record(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file_name: str,
        file_size: int,
        file_type: str,
        description: Optional[str] = None,
        category: Optional[str] = None,
        storage_backend: str = "local",
        user_id: Optional[int] = None,
    ) -> FileOperationResult:
        """
        Create a pending file record without actual file upload.
        This allows tracking files that will be uploaded asynchronously.

        Args:
            db: Database session
            entity_type: Type of entity
            entity_id: ID of the entity
            file_name: Name of the file
            file_size: Size of the file in bytes
            file_type: MIME type of the file
            description: Optional description
            category: Optional category
            storage_backend: Storage backend to use
            user_id: ID of the user creating the record

        Returns:
            FileOperationResult with the created pending file record
        """
        try:
            # Create entity directory
            entity_dir = self._get_entity_directory(entity_type)
            os.makedirs(entity_dir, exist_ok=True)

            # Generate a placeholder file path for the pending record
            file_extension = Path(file_name).suffix
            unique_filename = f"pending_{uuid.uuid4()}{file_extension}"
            file_path = entity_dir / unique_filename

            # Create pending file record
            file_create = EntityFileCreate(
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file_name,
                file_path=str(file_path),
                file_type=file_type,
                file_size=file_size,
                description=description,
                category=category,
                uploaded_at=get_utc_now(),
                storage_backend=storage_backend,
                sync_status="pending",  # Mark as pending
                last_sync_at=None,
            )

            db_file = EntityFile(**file_create.model_dump())
            db.add(db_file)
            db.commit()
            db.refresh(db_file)

            logger.info(
                f"Created pending file record: {file_name} for {entity_type} {entity_id}",
                extra={
                    "file_id": db_file.id,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "file_name": file_name,
                    "storage_backend": storage_backend,
                    "user_id": user_id,
                },
            )

            return FileOperationResult(
                success=True, file_record=db_file, message="Pending file record created"
            )

        except Exception as e:
            db.rollback()
            logger.error(
                f"Failed to create pending file record: {file_name}",
                extra={
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "file_name": file_name,
                    "error": str(e),
                    "user_id": user_id,
                },
            )
            return FileOperationResult(
                success=False,
                error_message=f"Failed to create pending file record: {str(e)}",
            )

    async def update_file_upload_status(
        self,
        db: Session,
        file_id: int,
        actual_file_path: str,
        sync_status: str = "synced",
        paperless_document_id: Optional[str] = None,
    ) -> FileOperationResult:
        """
        Update a pending file record after successful upload.

        Args:
            db: Database session
            file_id: ID of the file record to update
            actual_file_path: Actual path where the file was saved
            sync_status: New sync status ('synced', 'failed')
            paperless_document_id: Paperless document ID if uploaded to paperless

        Returns:
            FileOperationResult with the updated file record
        """
        try:
            db_file = db.query(EntityFile).filter(EntityFile.id == file_id).first()
            if not db_file:
                return FileOperationResult(
                    success=False, error_message=f"File record {file_id} not found"
                )

            # Update file record
            db_file.file_path = actual_file_path
            db_file.sync_status = sync_status
            db_file.last_sync_at = get_utc_now() if sync_status == "synced" else None
            if paperless_document_id:
                db_file.paperless_document_id = paperless_document_id

            db.commit()
            db.refresh(db_file)

            logger.info(
                f"Updated file record {file_id} status to {sync_status}",
                extra={
                    "file_id": file_id,
                    "sync_status": sync_status,
                    "actual_file_path": actual_file_path,
                    "paperless_document_id": paperless_document_id,
                },
            )

            return FileOperationResult(
                success=True, file_record=db_file, message="File status updated"
            )

        except Exception as e:
            db.rollback()
            logger.error(
                f"Failed to update file record {file_id}",
                extra={"file_id": file_id, "error": str(e)},
            )
            return FileOperationResult(
                success=False,
                error_message=f"Failed to update file record: {str(e)}",
            )

    async def delete_file(self, db: Session, file_id: int, current_user_id: Optional[int] = None) -> FileOperationResult:
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
                # Check if other records reference the same Paperless document
                other_references = (
                    db.query(EntityFile)
                    .filter(
                        EntityFile.paperless_document_id == file_record.paperless_document_id,
                        EntityFile.storage_backend == "paperless",
                        EntityFile.id != file_record.id
                    )
                    .count()
                )
                
                if other_references > 0:
                    logger.info(
                        f"Paperless document {file_record.paperless_document_id} has {other_references} other references. "
                        f"Skipping Paperless deletion, only removing database record."
                    )
                    # Don't delete from Paperless since other records reference it
                else:
                    # No other references, safe to delete from Paperless
                    paperless_deleted = await self._delete_from_paperless(db, file_record, current_user_id)
                    if not paperless_deleted:
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to delete file from Paperless. The document may still exist on the Paperless server.",
                        )
            else:
                # Handle local file deletion
                file_path = file_record.file_path
                if os.path.exists(file_path):
                    trash_result = self.file_management_service.move_to_trash(
                        file_path,
                        reason=f"Deleted via API for {file_record.entity_type} {file_record.entity_id}",
                    )
                    logger.info(f"File moved to trash: {trash_result}")

            # Remove from database only after successful deletion from storage backend
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
            # REMOVED: Problematic duplicate checking that was preventing uploads
            # The previous logic created fake "success" responses without actually
            # uploading files to Paperless, causing documents to never reach Paperless.
            # 
            # Let Paperless handle its own duplicate detection at the server level.
            # This ensures all files are actually uploaded and processed by Paperless.
            
            logger.info(
                f"Uploading '{file.filename}' to Paperless for {entity_type} {entity_id} (user: {current_user_id})"
            )

            # Always upload to Paperless - let Paperless handle duplicate detection
            logger.info(
                f"UPLOAD_DEBUG: Creating Paperless service for user {current_user_id}",
                extra={
                    "file_name": file.filename,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "paperless_url": user_prefs.paperless_url,
                    "user_id": current_user_id,
                }
            )
            
            # Create paperless service
            paperless_service = create_paperless_service_with_username_password(
                user_prefs.paperless_url,
                user_prefs.paperless_username_encrypted,
                user_prefs.paperless_password_encrypted,
                current_user_id,
            )

            # Upload to paperless
            logger.info(
                f"UPLOAD_DEBUG: Starting actual Paperless upload for '{file.filename}'",
                extra={
                    "file_name": file.filename,
                    "file_size": file_size,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "user_id": current_user_id,
                }
            )
            
            async with paperless_service:
                upload_result = await paperless_service.upload_document(
                    file_data=file_content,
                    filename=file.filename,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    description=description,
                )
                
            logger.info(
                f"UPLOAD_DEBUG: Paperless upload completed for '{file.filename}'",
                extra={
                    "file_name": file.filename,
                    "upload_result": upload_result,
                    "user_id": current_user_id,
                }
            )

            # Check if we got a document_id immediately (already processed) or just task_id (processing)
            document_id = upload_result.get("document_id")
            task_id = upload_result.get("task_id")
            
            if document_id:
                # Document was processed immediately - use normal flow
                sync_status = "synced"
                paperless_id = document_id
                last_sync = get_utc_now()
                logger.info(f"Document processed immediately: {file.filename} -> document_id: {document_id}")
            else:
                # Document is being processed - store task_id temporarily and mark as processing
                sync_status = "processing"
                paperless_id = task_id  # Store task UUID temporarily
                last_sync = None
                logger.info(f"Document queued for processing: {file.filename} -> task_id: {task_id}")

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
                paperless_document_id=paperless_id,  # Either document_id or task_id
                sync_status=sync_status,
                last_sync_at=last_sync,
                uploaded_at=get_utc_now(),
            )

            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)

            logger.info(
                f"File uploaded to paperless: {file.filename} for {entity_type} {entity_id} "
                f"(status: {sync_status}, id: {paperless_id})"
            )
            
            # TODO: If sync_status is "processing", start background task to poll for completion
            # For now, you can manually call update_processing_files() to check status
            # Future: Implement with Celery, background threads, or cron job

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
        self, db: Session, file_record: EntityFile, current_user_id: Optional[int] = None
    ) -> bool:
        """
        Delete file from paperless-ngx storage and verify deletion.

        Args:
            db: Database session
            file_record: EntityFile record
            current_user_id: User ID for paperless service

        Returns:
            True if successfully deleted and verified, False otherwise
        """
        if not file_record.paperless_document_id:
            logger.warning(
                f"File {file_record.id} marked as paperless but has no document ID"
            )
            return False

        # Get user preferences to create paperless service
        user_id = current_user_id or 1  # Fallback to user 1 if no user ID provided
        user_prefs = (
            db.query(UserPreferences)
            .filter(
                UserPreferences.user_id == user_id
            )
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            logger.warning(
                f"Cannot delete from paperless: user preferences not found or disabled"
            )
            return False

        try:
            # Create paperless service
            paperless_service = create_paperless_service_with_username_password(
                user_prefs.paperless_url,
                user_prefs.paperless_username_encrypted,
                user_prefs.paperless_password_encrypted,
                user_id,
            )

            async with paperless_service:
                # Delete from paperless
                await paperless_service.delete_document(
                    file_record.paperless_document_id
                )

                # Verify deletion by checking if document still exists
                still_exists = await paperless_service.check_document_exists(
                    file_record.paperless_document_id
                )

                if still_exists:
                    logger.error(
                        f"Document {file_record.paperless_document_id} still exists after deletion attempt"
                    )
                    return False

            logger.info(
                f"File successfully deleted from paperless and verified: document_id={file_record.paperless_document_id}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to delete file from paperless: {str(e)}")
            return False

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
        This is the core function that verifies if documents deleted from Paperless
        are properly detected and marked as missing.

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
                logger.info(f"No Paperless files found for sync check (user: {current_user_id})")
                return {}

            # Get user's paperless configuration
            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            if not user_prefs or not user_prefs.paperless_enabled:
                logger.warning(f"Cannot check paperless sync: user preferences not found or disabled (user: {current_user_id})")
                return {}

            if not all([user_prefs.paperless_url, user_prefs.paperless_username_encrypted, user_prefs.paperless_password_encrypted]):
                logger.warning(f"Cannot check paperless sync: incomplete paperless configuration (user: {current_user_id})")
                return {}

            # Create paperless service
            paperless_service = create_paperless_service_with_username_password(
                user_prefs.paperless_url,
                user_prefs.paperless_username_encrypted,
                user_prefs.paperless_password_encrypted,
                current_user_id,
            )

            sync_status = {}
            missing_count = 0
            error_count = 0
            processing_count = 0
            
            logger.info(f"Starting sync check for {len(paperless_files)} Paperless documents (user: {current_user_id})")
            
            # Check each document
            async with paperless_service:
                for file_record in paperless_files:
                    try:
                        document_id = file_record.paperless_document_id
                        
                        # Log what we're checking
                        logger.debug(f"Checking document {document_id} for file {file_record.file_name} (id: {file_record.id})")
                        
                        # Check if document exists in Paperless
                        exists = await paperless_service.check_document_exists(document_id)
                        sync_status[file_record.id] = exists
                        
                        # Update sync status in database based on result
                        if not exists:
                            old_status = file_record.sync_status
                            file_record.sync_status = "missing"
                            file_record.last_sync_at = get_utc_now()
                            missing_count += 1
                            
                            logger.info(f"Document marked as MISSING: {file_record.file_name} "
                                      f"(id: {file_record.id}, document_id: {document_id}, "
                                      f"old_status: {old_status} -> missing)")
                        else:
                            # Document exists - update status appropriately
                            old_status = file_record.sync_status
                            
                            # If it was previously missing or in error, mark as synced
                            if old_status in ["missing", "error", "processing"]:
                                file_record.sync_status = "synced"
                                file_record.last_sync_at = get_utc_now()
                                logger.info(f"Document status recovered: {file_record.file_name} "
                                          f"(id: {file_record.id}, {old_status} -> synced)")
                            elif old_status == "synced":
                                # Already synced, just update timestamp
                                file_record.last_sync_at = get_utc_now()
                            else:
                                # Processing status - keep as is but update timestamp
                                file_record.last_sync_at = get_utc_now()
                                if old_status == "processing":
                                    processing_count += 1
                        
                    except Exception as e:
                        error_count += 1
                        old_status = file_record.sync_status
                        
                        logger.error(f"Error checking document {file_record.paperless_document_id} "
                                   f"for file {file_record.file_name}: {str(e)}")
                        
                        sync_status[file_record.id] = False
                        file_record.sync_status = "error"
                        file_record.last_sync_at = get_utc_now()
                        
                        logger.warning(f"Document marked as ERROR: {file_record.file_name} "
                                     f"(id: {file_record.id}, {old_status} -> error)")

            # Commit all database updates
            try:
                db.commit()
                logger.info(f"Sync check completed successfully - committed database changes")
            except Exception as commit_error:
                logger.error(f"Failed to commit sync status updates: {str(commit_error)}")
                db.rollback()
                # Return empty dict to indicate failure
                return {}

            # Log summary of sync check results
            synced_count = len(paperless_files) - missing_count - error_count - processing_count
            logger.info(f"Paperless sync check completed (user: {current_user_id}): "
                       f"{len(paperless_files)} total, {synced_count} synced, "
                       f"{missing_count} missing, {processing_count} processing, {error_count} errors")

            # Log missing files for debugging
            if missing_count > 0:
                missing_files = [f for f in paperless_files if sync_status.get(f.id) is False]
                logger.warning(f"Missing documents detected: {[f.file_name for f in missing_files]}")

            return sync_status

        except Exception as e:
            logger.error(f"Error checking paperless sync status: {str(e)}")
            # Return empty dict to indicate complete failure
            return {}

    async def update_processing_files(
        self, db: Session, current_user_id: int
    ) -> Dict[str, str]:
        """
        Update files with 'processing' status by checking their task completion.
        
        Args:
            db: Database session
            current_user_id: User ID for paperless service
            
        Returns:
            Dictionary mapping file_id to new status
        """
        try:
            # Get all processing files
            processing_files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.storage_backend == "paperless",
                    EntityFile.sync_status == "processing",
                    EntityFile.paperless_document_id.isnot(None),
                )
                .all()
            )

            if not processing_files:
                return {}

            # Get user's paperless configuration
            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            if not user_prefs or not user_prefs.paperless_enabled:
                logger.warning("Cannot update processing files: user preferences not found or disabled")
                return {}

            # Create paperless service
            paperless_service = create_paperless_service_with_username_password(
                user_prefs.paperless_url,
                user_prefs.paperless_username_encrypted,
                user_prefs.paperless_password_encrypted,
                current_user_id,
            )

            status_updates = {}
            
            # Check each processing file
            async with paperless_service:
                for file_record in processing_files:
                    try:
                        task_uuid = file_record.paperless_document_id  # Currently storing task UUID
                        
                        # Check if task is complete and get document ID
                        document_id = await paperless_service.wait_for_task_completion(
                            task_uuid, timeout_seconds=5  # Short timeout for polling
                        )
                        
                        if document_id:
                            # Task completed! Update record with actual document ID
                            file_record.paperless_document_id = str(document_id)
                            file_record.sync_status = "synced"
                            file_record.last_sync_at = get_utc_now()
                            status_updates[str(file_record.id)] = "synced"
                            
                            logger.info(
                                f"Processing complete: {file_record.file_name} -> document_id: {document_id} "
                                f"(was task: {task_uuid})"
                            )
                        else:
                            # Still processing
                            status_updates[str(file_record.id)] = "processing"
                        
                    except Exception as e:
                        logger.error(f"Error checking task {file_record.paperless_document_id}: {str(e)}")
                        # Mark as failed if we can't check status
                        file_record.sync_status = "failed"
                        file_record.last_sync_at = get_utc_now()
                        status_updates[str(file_record.id)] = "failed"

            # Commit all database updates
            db.commit()

            logger.info(f"Updated {len(status_updates)} processing files")
            return status_updates

        except Exception as e:
            logger.error(f"Error updating processing files: {str(e)}")
            return {}

    def cleanup_entity_files_on_deletion(
        self, db: Session, entity_type: str, entity_id: int, preserve_paperless: bool = True
    ) -> Dict[str, int]:
        """
        Clean up EntityFiles when an entity is deleted.
        
        Args:
            db: Database session
            entity_type: Type of entity being deleted
            entity_id: ID of the entity being deleted
            preserve_paperless: If True, preserve Paperless documents (default: True)
            
        Returns:
            Dictionary with cleanup statistics
        """
        try:
            # Get all entity files for this entity
            entity_files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.entity_type == entity_type,
                    EntityFile.entity_id == entity_id
                )
                .all()
            )
            
            if not entity_files:
                logger.info(f"No EntityFiles found for {entity_type} {entity_id}")
                return {"files_deleted": 0, "files_preserved": 0, "errors": 0}
            
            deleted_local_files = 0
            preserved_paperless_files = 0
            errors = 0
            
            for file_record in entity_files:
                try:
                    if file_record.storage_backend == "local":
                        # Delete local files (move to trash)
                        if file_record.file_path and os.path.exists(file_record.file_path):
                            trash_result = self.file_management_service.move_to_trash(
                                file_record.file_path,
                                reason=f"{entity_type} {entity_id} deletion"
                            )
                            logger.info(f"Moved local file to trash: {file_record.file_name} -> {trash_result}")
                            deleted_local_files += 1
                        else:
                            logger.warning(f"Local file not found for deletion: {file_record.file_path}")
                            
                    elif file_record.storage_backend == "paperless":
                        if preserve_paperless:
                            # Preserve Paperless files - just log for audit
                            logger.info(f"Preserving Paperless document: {file_record.file_name} (ID: {file_record.paperless_document_id})")
                            preserved_paperless_files += 1
                        else:
                            # This path could be used if we ever want to delete from Paperless
                            logger.info(f"Would delete Paperless document: {file_record.file_name} (preserve_paperless=False)")
                            # TODO: Implement Paperless deletion if needed
                    
                    # Always remove database record
                    db.delete(file_record)
                    
                except Exception as file_error:
                    logger.error(f"Error processing file {file_record.file_name}: {str(file_error)}")
                    errors += 1
                    # Continue with other files
            
            # Commit all file record deletions
            db.commit()
            
            logger.info(f"EntityFile cleanup completed for {entity_type} {entity_id}: "
                       f"{deleted_local_files} local files deleted, "
                       f"{preserved_paperless_files} Paperless files preserved, "
                       f"{errors} errors")
            
            return {
                "files_deleted": deleted_local_files,
                "files_preserved": preserved_paperless_files,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error during entity file cleanup for {entity_type} {entity_id}: {str(e)}")
            return {"files_deleted": 0, "files_preserved": 0, "errors": 1}
