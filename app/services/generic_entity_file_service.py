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
from app.models.models import EntityFile, User, UserPreferences, get_utc_now
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
# New simplified architecture
from app.services.paperless_client import (
    create_paperless_client, 
    PaperlessClientError, 
    PaperlessConnectionError as NewPaperlessConnectionError
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

    async def _create_paperless_client(self, user_prefs, user_id: int):
        """
        Create a paperless client using the new simplified architecture.
        
        This is a transitional helper method that uses the new architecture
        while maintaining compatibility with existing code.
        """
        return create_paperless_client(
            url=user_prefs.paperless_url,
            encrypted_token=user_prefs.paperless_api_token_encrypted,
            encrypted_username=user_prefs.paperless_username_encrypted,
            encrypted_password=user_prefs.paperless_password_encrypted,
            user_id=user_id
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

                # Check if we have either token OR username/password credentials
                has_token = bool(user_prefs.paperless_api_token_encrypted)
                has_credentials = bool(user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted)
                
                if not user_prefs.paperless_url or (not has_token and not has_credentials):
                    raise HTTPException(
                        status_code=400,
                        detail="Paperless configuration is incomplete. Please configure URL and authentication credentials (token or username/password) in settings.",
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
                    # Check if document is missing - if so, don't try to delete from Paperless
                    if file_record.sync_status == "missing":
                        logger.info(
                            f"Document {file_record.paperless_document_id} is marked as missing. "
                            f"Skipping Paperless deletion since document is not accessible."
                        )
                        # Document is missing from Paperless, we'll just remove the database record below
                    else:
                        # Document exists in Paperless, try to delete it
                        logger.info(f"Attempting to delete document {file_record.paperless_document_id} from Paperless (sync_status: {file_record.sync_status})")
                        paperless_deleted = await self._delete_from_paperless(db, file_record, current_user_id)
                        if not paperless_deleted:
                            logger.error(f"Paperless deletion failed for document {file_record.paperless_document_id}")
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
        self, db: Session, file_id: int, current_user_id: Optional[int] = None
    ) -> Tuple[str, str, str]:
        """
        Get file information for download from both local and paperless storage.

        Args:
            db: Database session
            file_id: ID of the file
            current_user_id: ID of the current user for paperless access

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
            logger.info(f"DEBUG: File {file_id} storage backend: {file_record.storage_backend}, paperless_doc_id: {file_record.paperless_document_id}")
            if file_record.storage_backend == "paperless":
                return await self._get_paperless_download_info(db, file_record, current_user_id)
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

    async def get_file_view_info(
        self, db: Session, file_id: int, current_user_id: Optional[int] = None
    ) -> Tuple[str, str, str]:
        """
        Get file information for viewing (inline display).
        Similar to get_file_download_info but optimized for viewing.
        
        Args:
            db: Database session
            file_id: ID of the file
            
        Returns:
            Tuple of (file_path_or_content, filename, content_type)
        """
        try:
            # Get file record from database
            file_record = db.query(EntityFile).filter(EntityFile.id == file_id).first()
            if not file_record:
                raise HTTPException(
                    status_code=404,
                    detail="File not found"
                )

            logger.info(f"Retrieving file for viewing: {file_record.file_name}")
            
            if file_record.storage_backend == 'paperless':
                # Handle Paperless files
                if not file_record.paperless_document_id:
                    raise HTTPException(
                        status_code=404,
                        detail="Paperless document ID not found"
                    )
                
                # Use existing paperless service to get file content
                
                # Get user for paperless credentials
                if not current_user_id:
                    raise HTTPException(
                        status_code=401,
                        detail="User authentication required for file viewing"
                    )
                
                user = db.query(User).filter(User.id == current_user_id).first()
                if not user:
                    raise HTTPException(
                        status_code=404,
                        detail="User not found"
                    )
                
                # Get user preferences for paperless configuration
                user_prefs = (
                    db.query(UserPreferences)
                    .filter(UserPreferences.user_id == user.id)
                    .first()
                )
                
                if not user_prefs or not user_prefs.paperless_enabled:
                    raise HTTPException(
                        status_code=400,
                        detail="Paperless integration is not enabled"
                    )
                
                # Log authentication details for debugging
                logger.debug(f"View debug - User: {user.id}, URL: {user_prefs.paperless_url}")
                logger.debug(f"View debug - Has token: {bool(user_prefs.paperless_api_token_encrypted)}")
                logger.debug(f"View debug - Has username: {bool(user_prefs.paperless_username_encrypted)}")
                logger.debug(f"View debug - Has password: {bool(user_prefs.paperless_password_encrypted)}")
                logger.debug(f"View debug - Document ID: {file_record.paperless_document_id}")
                
                # Create paperless service using token auth (supports 2FA)
                from app.services.paperless_service import create_paperless_service
                paperless_service = create_paperless_service(
                    user_prefs.paperless_url,
                    encrypted_token=user_prefs.paperless_api_token_encrypted,
                    encrypted_username=user_prefs.paperless_username_encrypted,
                    encrypted_password=user_prefs.paperless_password_encrypted,
                    user_id=user.id
                )
                
                logger.debug("Paperless service created successfully")
                
                # First test if we can read document metadata (less restrictive than download)
                logger.debug(f"Testing document access for ID: {file_record.paperless_document_id}")
                async with paperless_service:
                    try:
                        # Try to get document info first to test permissions
                        async with paperless_service._make_request("GET", f"/api/documents/{file_record.paperless_document_id}/") as doc_response:
                            if doc_response.status == 200:
                                doc_info = await doc_response.json()
                                logger.debug(f"Document info accessible: {doc_info.get('title', 'N/A')}")
                            else:
                                logger.debug(f"Document info failed: {doc_response.status}")
                    except Exception as info_error:
                        logger.debug(f"Document info error: {info_error}")
                    
                    # Now try download
                    logger.debug(f"Starting download for document ID: {file_record.paperless_document_id}")
                    file_content = await paperless_service.download_document(
                        document_id=file_record.paperless_document_id
                    )
                logger.debug(f"Download completed, content size: {len(file_content) if file_content else 0}")
                
                return file_content, file_record.file_name, file_record.file_type
            else:
                # Handle local files
                file_path = file_record.file_path
                if not os.path.exists(file_path):
                    raise HTTPException(
                        status_code=404,
                        detail="File not found on disk"
                    )
                
                return file_path, file_record.file_name, file_record.file_type
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving file for viewing: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve file for viewing: {str(e)}"
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

        # Check if we have either token OR username/password credentials
        has_token = bool(user_prefs.paperless_api_token_encrypted)
        has_credentials = bool(user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted)
        
        if not user_prefs.paperless_url or (not has_token and not has_credentials):
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
            
            # Create paperless service using token auth (supports 2FA)
            from app.services.paperless_service import create_paperless_service
            paperless_service = create_paperless_service(
                user_prefs.paperless_url,
                encrypted_token=user_prefs.paperless_api_token_encrypted,
                encrypted_username=user_prefs.paperless_username_encrypted,
                encrypted_password=user_prefs.paperless_password_encrypted,
                user_id=current_user_id
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
                paperless_task_uuid = None  # No need to track task when already processed
                last_sync = get_utc_now()
                logger.info(f"Document processed immediately: {file.filename} -> document_id: {document_id}")
            elif task_id:
                # Document is being processed - store task_id for polling
                sync_status = "processing"
                paperless_id = None  # No document ID yet - don't set until processing completes
                paperless_task_uuid = task_id  # Store task UUID for polling
                last_sync = None
                logger.info(f"Document queued for processing: {file.filename} -> task_id: {task_id}")
            else:
                # No document ID or task ID - something went wrong
                raise Exception("No document ID or task ID returned from Paperless")

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
                paperless_document_id=paperless_id,  # Only set when document is processed
                paperless_task_uuid=paperless_task_uuid,  # Set when document is processing
                sync_status=sync_status,
                last_sync_at=last_sync,
                uploaded_at=get_utc_now(),
            )

            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)

            logger.info(
                f"File uploaded to paperless: {file.filename} for {entity_type} {entity_id} "
                f"(status: {sync_status}, id: {paperless_id}, task_uuid: {paperless_task_uuid})"
            )
            
            # TODO: If sync_status is "processing", start background task to poll for completion
            # For now, you can manually call update_processing_files() to check status
            # Future: Implement with Celery, background threads, or cron job

            response = EntityFileResponse.model_validate(entity_file)
            logger.info(f"Returning response with task_uuid: {response.paperless_task_uuid}")
            return response

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
        if not current_user_id:
            logger.warning(
                f"Cannot delete from paperless: no user ID provided for authentication"
            )
            return False
            
        user_prefs = (
            db.query(UserPreferences)
            .filter(
                UserPreferences.user_id == current_user_id
            )
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            logger.warning(
                f"Cannot delete from paperless: user preferences not found or disabled for user {current_user_id}"
            )
            return False

        try:
            logger.info(f"Starting deletion process for document {file_record.paperless_document_id} for user {current_user_id}")
            
            # Create paperless client using new simplified architecture
            logger.debug("Creating paperless client...")
            async with await self._create_paperless_client(user_prefs, current_user_id) as paperless_client:
                logger.info("Paperless client created successfully, attempting deletion")

                # Delete from paperless - the new client handles errors internally
                logger.info(f"Calling paperless_client.delete_document for document {file_record.paperless_document_id}")
                success = await paperless_client.delete_document(
                    file_record.paperless_document_id
                )
                
                logger.info(f"Paperless client delete_document returned: {success}")
                
                if success:
                    logger.info(
                        f"File successfully deleted from paperless: document_id={file_record.paperless_document_id}"
                    )
                    return True
                else:
                    logger.error(f"Paperless client reported deletion failed for document {file_record.paperless_document_id}")
                    return False

        except (PaperlessClientError, NewPaperlessConnectionError) as e:
            logger.error(f"Paperless client error during deletion: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Exception traceback: {traceback.format_exc()}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during paperless deletion: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Exception traceback: {traceback.format_exc()}")
            return False

    async def _get_paperless_download_info(
        self, db: Session, file_record: EntityFile, current_user_id: Optional[int] = None
    ) -> Tuple[bytes, str, str]:
        """
        Get file download info from paperless-ngx storage.

        Args:
            db: Database session
            file_record: EntityFile record
            current_user_id: ID of the current user for paperless access

        Returns:
            Tuple of (file_content_bytes, filename, content_type)
        """
        if not file_record.paperless_document_id:
            raise HTTPException(
                status_code=404,
                detail=f"Paperless document ID not found for file: {file_record.file_name}",
            )

        # Get user preferences to create paperless service
        if not current_user_id:
            raise HTTPException(
                status_code=401,
                detail="User authentication required for paperless file download"
            )
        
        user_prefs = (
            db.query(UserPreferences)
            .filter(
                UserPreferences.user_id == current_user_id
            )
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            raise HTTPException(
                status_code=400,
                detail="Cannot download from paperless: user preferences not found or disabled",
            )

        try:
            # Log authentication details for debugging
            logger.debug(f"Download debug - User: {current_user_id}, URL: {user_prefs.paperless_url}")
            logger.debug(f"Download debug - Has token: {bool(user_prefs.paperless_api_token_encrypted)}")
            logger.debug(f"Download debug - Has username: {bool(user_prefs.paperless_username_encrypted)}")
            logger.debug(f"Download debug - Has password: {bool(user_prefs.paperless_password_encrypted)}")
            logger.debug(f"Download debug - Document ID: {file_record.paperless_document_id}")
            
            # Create paperless client using new simplified architecture
            async with await self._create_paperless_client(user_prefs, current_user_id) as paperless_client:
                logger.debug("Paperless client created successfully")

                # Download from paperless
                logger.debug(f"Starting download for document ID: {file_record.paperless_document_id}")
                file_content = await paperless_client.download_document(
                    file_record.paperless_document_id
                )
            logger.debug(f"Download completed, content size: {len(file_content) if file_content else 0}")

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

    async def _handle_orphaned_paperless_records(
        self, db: Session, current_user_id: int
    ) -> None:
        """
        Handle orphaned Paperless records - files marked as paperless storage
        but with no document ID (indicating failed/incomplete uploads).
        
        These records need special handling because they can't be checked against 
        Paperless since they don't have a valid document ID to query.
        
        Args:
            db: Database session
            current_user_id: User ID to check orphaned records for
        """
        try:
            from app.models.models import LabResult, Procedure
            from sqlalchemy import or_
            
            logger.info(f"🔍 ORPHAN CHECK - Checking orphaned paperless records for user {current_user_id}")
            
            # Find all paperless files WITHOUT document IDs (orphaned records)
            orphaned_files = []
            
            # Lab result orphaned files (need to join through Patient)
            from app.models.models import Patient
            lab_orphans = (
                db.query(EntityFile)
                .join(LabResult, 
                      (EntityFile.entity_type == "lab-result") & 
                      (EntityFile.entity_id == LabResult.id))
                .join(Patient, LabResult.patient_id == Patient.id)
                .filter(
                    Patient.user_id == current_user_id,
                    EntityFile.storage_backend == "paperless",
                    EntityFile.paperless_document_id.is_(None),  # NO document ID
                )
                .all()
            )
            orphaned_files.extend(lab_orphans)
            
            # Procedure orphaned files (need to join through Patient)
            procedure_orphans = (
                db.query(EntityFile)
                .join(Procedure,
                      (EntityFile.entity_type == "procedure") &
                      (EntityFile.entity_id == Procedure.id))
                .join(Patient, Procedure.patient_id == Patient.id)
                .filter(
                    Patient.user_id == current_user_id,
                    EntityFile.storage_backend == "paperless",
                    EntityFile.paperless_document_id.is_(None),  # NO document ID
                )
                .all()
            )
            orphaned_files.extend(procedure_orphans)
            
            if orphaned_files:
                logger.warning(f"🔍 ORPHAN CHECK - Found {len(orphaned_files)} orphaned paperless records for user {current_user_id}")
                
                for file_record in orphaned_files:
                    old_status = file_record.sync_status
                    
                    # Mark as 'missing' since these files aren't accessible in Paperless
                    file_record.sync_status = "missing"
                    file_record.last_sync_at = get_utc_now()
                    
                    logger.warning(
                        f"ORPHANED RECORD: {file_record.file_name} "
                        f"(id: {file_record.id}, entity_type: {file_record.entity_type}, "
                        f"status: {old_status} -> missing) - NO DOCUMENT ID, upload likely failed"
                    )
                
                # Commit the changes
                db.commit()
                logger.info(f"🔍 ORPHAN CHECK - Updated {len(orphaned_files)} orphaned records to 'missing' status")
            else:
                logger.info(f"🔍 ORPHAN CHECK - No orphaned paperless records found for user {current_user_id}")
                
        except Exception as e:
            logger.error(f"Error handling orphaned paperless records for user {current_user_id}: {str(e)}")
            db.rollback()
            # Don't raise - this shouldn't stop the main sync check

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
        logger.error(f"🔍 SYNC SERVICE - check_paperless_sync_status called for user {current_user_id}")
        
        # First, check for orphaned records (no document ID)
        await self._handle_orphaned_paperless_records(db, current_user_id)
        
        try:
            # Get all paperless files for the user by joining with entity tables
            from app.models.models import LabResult, Procedure
            from sqlalchemy import or_
            
            # First, let's see what entity types actually exist for paperless files
            all_paperless_files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.storage_backend == "paperless",
                    EntityFile.paperless_document_id.isnot(None),
                )
                .all()
            )
            
            logger.debug(f"Total paperless files in system: {len(all_paperless_files)}")
            for f in all_paperless_files:
                logger.debug(f"File {f.id}: entity_type='{f.entity_type}', entity_id={f.entity_id}, document_id={f.paperless_document_id}")
            
            # Build a union query to find paperless files across all entity types for this user
            paperless_files = []
            
            # Query lab result files (need to join through Patient to get user_id)
            logger.debug(f"Querying lab result files for user {current_user_id}")
            from app.models.models import Patient
            lab_files = (
                db.query(EntityFile)
                .join(LabResult, 
                      (EntityFile.entity_type == "lab-result") & 
                      (EntityFile.entity_id == LabResult.id))
                .join(Patient, LabResult.patient_id == Patient.id)
                .filter(
                    Patient.user_id == current_user_id,
                    EntityFile.storage_backend == "paperless",
                )
                .all()
            )
            logger.debug(f"Found {len(lab_files)} lab result files")
            paperless_files.extend(lab_files)
            
            # Query procedure files (need to join through Patient to get user_id)
            logger.debug(f"Querying procedure files for user {current_user_id}")
            procedure_files = (
                db.query(EntityFile)
                .join(Procedure,
                      (EntityFile.entity_type == "procedure") &
                      (EntityFile.entity_id == Procedure.id))
                .join(Patient, Procedure.patient_id == Patient.id)
                .filter(
                    Patient.user_id == current_user_id,
                    EntityFile.storage_backend == "paperless",
                )
                .all()
            )
            logger.debug(f"Found {len(procedure_files)} procedure files")
            paperless_files.extend(procedure_files)
            
            # Query insurance files (need to join through Patient to get user_id)
            logger.debug(f"Querying insurance files for user {current_user_id}")
            from app.models.models import Insurance
            insurance_files = (
                db.query(EntityFile)
                .join(Insurance,
                      (EntityFile.entity_type == "insurance") &
                      (EntityFile.entity_id == Insurance.id))
                .join(Patient, Insurance.patient_id == Patient.id)
                .filter(
                    Patient.user_id == current_user_id,
                    EntityFile.storage_backend == "paperless",
                )
                .all()
            )
            logger.debug(f"Found {len(insurance_files)} insurance files")
            paperless_files.extend(insurance_files)
            
            # Query visit files (need to join through Patient to get user_id)
            logger.debug(f"Querying visit files for user {current_user_id}")
            from app.models.models import Encounter
            visit_files = (
                db.query(EntityFile)
                .join(Encounter,
                      (EntityFile.entity_type == "visit") &
                      (EntityFile.entity_id == Encounter.id))
                .join(Patient, Encounter.patient_id == Patient.id)
                .filter(
                    Patient.user_id == current_user_id,
                    EntityFile.storage_backend == "paperless",
                )
                .all()
            )
            logger.debug(f"Found {len(visit_files)} visit files")
            paperless_files.extend(visit_files)
            
            logger.info(f"Found {len(paperless_files)} paperless files for user {current_user_id}: "
                       f"{len(lab_files)} lab results, {len(procedure_files)} procedures, "
                       f"{len(insurance_files)} insurance, {len(visit_files)} visits")

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

            # Check if credentials exist (either token or username/password)
            has_auth = (user_prefs.paperless_api_token_encrypted or 
                       (user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted))
            if not user_prefs.paperless_url or not has_auth:
                logger.warning(f"Cannot check paperless sync: incomplete paperless configuration (user: {current_user_id})")
                return {}

            # Create paperless service using SAME auth method as upload for consistency
            # This ensures sync check uses the exact same authentication as file uploads,
            # preventing false missing document detection due to auth differences
            from app.services.paperless_service import create_paperless_service
            
            logger.info(f"Creating paperless service for sync check using consistent auth method for user {current_user_id}")
            
            paperless_service = create_paperless_service(
                user_prefs.paperless_url,
                encrypted_token=user_prefs.paperless_api_token_encrypted,
                encrypted_username=user_prefs.paperless_username_encrypted,
                encrypted_password=user_prefs.paperless_password_encrypted,
                user_id=current_user_id,
            )

            sync_status = {}
            missing_count = 0
            error_count = 0
            processing_count = 0
            
            logger.info(f"Starting sync check for {len(paperless_files)} Paperless documents (user: {current_user_id})")
            logger.info(f"Sync check using auth method: {paperless_service.get_auth_type()}")
            
            # First pass: resolve any task UUIDs to document IDs if possible
            await self._resolve_task_uuids_to_document_ids(db, paperless_service, paperless_files)
            
            # Check each document
            async with paperless_service:
                for file_record in paperless_files:
                    try:
                        document_id = file_record.paperless_document_id
                        
                        # Skip files that don't have a valid document ID
                        if not document_id:
                            # If file has task UUID and is marked as missing, try fallback search
                            if file_record.sync_status == "missing" and file_record.paperless_task_uuid:
                                logger.info(f"🔍 SYNC CHECK - File {file_record.file_name} (id: {file_record.id}) marked as missing but has task UUID - attempting fallback search")
                                
                                # Try fallback search for document by filename and upload timestamp
                                fallback_doc_id = await self._search_document_by_filename_and_time(
                                    file_record.file_name, 
                                    file_record.uploaded_at,
                                    paperless_service
                                )
                                
                                if fallback_doc_id:
                                    # Found the document using fallback search
                                    file_record.paperless_document_id = str(fallback_doc_id)
                                    file_record.paperless_task_uuid = None  # Clear task UUID
                                    file_record.sync_status = "synced"
                                    file_record.last_sync_at = get_utc_now()
                                    sync_status[file_record.id] = True  # Mark as found
                                    logger.info(f"🔍 SYNC CHECK - Fallback search found document ID {fallback_doc_id} for file {file_record.file_name}")
                                    # Continue with document existence check now that we have an ID
                                    document_id = str(fallback_doc_id)
                                else:
                                    # Fallback failed - keep as missing
                                    logger.error(f"🔍 SYNC CHECK - Fallback search failed for file {file_record.file_name}")
                                    sync_status[file_record.id] = False  # Mark as missing in sync status
                                    missing_count += 1
                                    continue
                            elif file_record.sync_status == "missing":
                                # If orphan detection already marked this as missing and no task UUID, don't change it
                                logger.info(f"🔍 SYNC CHECK - File {file_record.file_name} (id: {file_record.id}) already marked as missing (orphaned record)")
                                sync_status[file_record.id] = False  # Mark as missing in sync status
                                missing_count += 1
                                continue
                            else:
                                # Mark as processing if not already marked as missing
                                logger.info(f"🔍 SYNC CHECK - Skipping file {file_record.file_name} (id: {file_record.id}) - no document ID yet (likely still processing)")
                                if file_record.sync_status != "processing":
                                    file_record.sync_status = "processing"
                                    file_record.last_sync_at = get_utc_now()
                                    processing_count += 1
                                sync_status[file_record.id] = True  # Don't mark as missing if still processing
                                continue
                        
                        # Only skip if we have an active task UUID (indicating still processing)
                        # Don't skip based on document ID format alone - document IDs can be UUIDs too
                        if file_record.paperless_task_uuid:
                            logger.info(f"🔍 SYNC CHECK - Skipping file {file_record.file_name} (id: {file_record.id}) - has active task UUID {file_record.paperless_task_uuid}, still processing")
                            if file_record.sync_status != "processing":
                                file_record.sync_status = "processing"
                                file_record.last_sync_at = get_utc_now()
                                processing_count += 1
                            sync_status[file_record.id] = True  # Don't mark as missing if still processing
                            continue
                        
                        # Log what we're checking
                        logger.info(f"🔍 SYNC CHECK - Checking document {document_id} for file {file_record.file_name} (id: {file_record.id})")
                        
                        # Check if document exists in Paperless
                        exists = await paperless_service.check_document_exists(document_id)
                        logger.info(f"🔍 SYNC CHECK - Document {document_id} exists: {exists}")
                        
                        # Add detailed logging when marking documents as missing
                        if not exists:
                            logger.warning(f"🚨 SYNC CHECK - Document {document_id} (file: {file_record.file_name}, ID: {file_record.id}) will be marked as MISSING. "
                                         f"This could be due to: 1) Document deleted from Paperless, 2) Authentication/permission issues, 3) Invalid document ID. "
                                         f"Current sync_status: {file_record.sync_status}")
                        
                        sync_status[file_record.id] = exists
                        
                        # Debug: Log what we're about to do
                        logger.info(f"🔍 SYNC CHECK DEBUG - About to update status for document {document_id}: exists={exists}, current_status={file_record.sync_status}")
                        
                        # Update sync status in database based on result
                        if not exists:
                            old_status = file_record.sync_status
                            logger.info(f"🔍 SYNC CHECK DEBUG - Before update: file_record.sync_status = {file_record.sync_status}")
                            
                            file_record.sync_status = "missing"
                            file_record.last_sync_at = get_utc_now()
                            missing_count += 1
                            
                            logger.info(f"🔍 SYNC CHECK DEBUG - After update: file_record.sync_status = {file_record.sync_status}")
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
                        
                    except PaperlessAuthenticationError as auth_error:
                        # Authentication errors should stop the entire sync check
                        logger.error(f"Authentication error during sync check: {str(auth_error)}")
                        raise auth_error
                        
                    except PaperlessError as paperless_error:
                        # Handle specific paperless errors (e.g., connection issues)
                        error_count += 1
                        old_status = file_record.sync_status
                        
                        logger.warning(f"Paperless error checking document {file_record.paperless_document_id} "
                                     f"for file {file_record.file_name}: {str(paperless_error)}")
                        
                        # For connection/network errors, don't mark as missing - mark as error
                        sync_status[file_record.id] = None  # Indicates error, not missing
                        file_record.sync_status = "error"
                        file_record.last_sync_at = get_utc_now()
                        
                        logger.warning(f"Document marked as ERROR: {file_record.file_name} "
                                     f"(id: {file_record.id}, {old_status} -> error)")
                        
                    except Exception as e:
                        # Unexpected errors
                        error_count += 1
                        old_status = file_record.sync_status
                        
                        logger.error(f"🚨 SYNC CHECK EXCEPTION - Unexpected error checking document {file_record.paperless_document_id} "
                                   f"for file {file_record.file_name}: {str(e)}")
                        logger.error(f"🚨 SYNC CHECK EXCEPTION - Exception type: {type(e)}")
                        import traceback
                        logger.error(f"🚨 SYNC CHECK EXCEPTION - Traceback: {traceback.format_exc()}")
                        
                        sync_status[file_record.id] = None  # Indicates error, not missing
                        file_record.sync_status = "error"
                        file_record.last_sync_at = get_utc_now()
                        
                        logger.warning(f"Document marked as ERROR: {file_record.file_name} "
                                     f"(id: {file_record.id}, {old_status} -> error)")

            # Commit all database updates
            try:
                logger.info(f"🔍 SYNC CHECK DEBUG - About to commit database changes. Missing count: {missing_count}")
                db.commit()
                logger.info(f"🔍 SYNC CHECK - Successfully committed database changes. Missing count: {missing_count}")
            except Exception as commit_error:
                logger.error(f"🚨 SYNC CHECK COMMIT ERROR - Failed to commit sync status updates: {str(commit_error)}")
                import traceback
                logger.error(f"🚨 SYNC CHECK COMMIT ERROR - Traceback: {traceback.format_exc()}")
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
            
            # Log error files for debugging
            if error_count > 0:
                error_files = [f for f in paperless_files if sync_status.get(f.id) is None]
                logger.warning(f"Documents with errors during sync check: {[f.file_name for f in error_files]}")

            return sync_status

        except Exception as e:
            logger.error(f"Error checking paperless sync status: {str(e)}")
            # Return empty dict to indicate complete failure
            return {}

    async def _resolve_task_uuids_to_document_ids(self, db: Session, paperless_service, paperless_files: List) -> None:
        """
        Helper method to resolve task UUIDs to document IDs for files that have completed processing.
        
        Args:
            db: Database session
            paperless_service: Paperless service instance
            paperless_files: List of EntityFile records with paperless storage
        """
        try:
            import re
            
            # Find files that have active task UUIDs (in the paperless_task_uuid field)
            files_with_tasks = [
                f for f in paperless_files 
                if f.paperless_task_uuid
            ]
            
            if not files_with_tasks:
                logger.info("No task UUIDs found to resolve during sync check")
                return
                
            logger.info(f"Found {len(files_with_tasks)} files with task UUIDs to resolve during sync check")
            
            for file_record in files_with_tasks:
                try:
                    task_uuid = file_record.paperless_task_uuid
                    logger.info(f"Attempting to resolve task UUID {task_uuid} for file {file_record.file_name}")
                    
                    # Check task status to get document ID
                    async with paperless_service._make_request("GET", f"/api/tasks/?task_id={task_uuid}") as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            # Handle both single task and list responses
                            if isinstance(data, list):
                                if not data:
                                    logger.info(f"Task {task_uuid} not found in API response")
                                    continue
                                task_data = data[0]
                            elif isinstance(data, dict):
                                # If results key exists, it's paginated
                                if "results" in data and data["results"]:
                                    task_data = data["results"][0]
                                else:
                                    task_data = data
                            else:
                                logger.warning(f"Unexpected task response format: {type(data)}")
                                continue
                            
                            status = task_data.get("status", "").lower()
                            
                            if status == "success":
                                # Extract document ID from result
                                result = task_data.get("result", {})
                                document_id = None
                                
                                if isinstance(result, dict):
                                    document_id = result.get("document_id") or result.get("id")
                                elif isinstance(result, str):
                                    # Parse document ID from string like "Success. New document id 2677 created"
                                    match = re.search(r'document id (\d+)', result)
                                    if match:
                                        document_id = match.group(1)
                                    else:
                                        document_id = result
                                else:
                                    document_id = result
                                    
                                # Use centralized validation and fallback logic
                                validated_doc_id = await self._validate_and_process_document_id(
                                    document_id, file_record, paperless_service
                                )
                                
                                if validated_doc_id:
                                    # Successfully validated or found via fallback
                                    old_id = file_record.paperless_document_id
                                    file_record.paperless_document_id = validated_doc_id
                                    file_record.paperless_task_uuid = None  # Clear task UUID
                                    file_record.sync_status = "synced"
                                    file_record.last_sync_at = get_utc_now()
                                    logger.info(f"Resolved task UUID {old_id} to document ID {validated_doc_id} for file {file_record.file_name}")
                                else:
                                    # Validation and fallback both failed
                                    file_record.sync_status = "failed"
                                    file_record.last_sync_at = get_utc_now()
                                    logger.error(f"Task {task_uuid} failed validation and fallback for file {file_record.file_name}")
                                    
                            elif status == "failure":
                                # Task failed - mark as failed
                                error_info = task_data.get("result", "Unknown error")
                                file_record.sync_status = "failed"
                                file_record.last_sync_at = get_utc_now()
                                logger.warning(f"Task {task_uuid} failed for file {file_record.file_name}: {error_info}")
                                
                            # If task is still pending/processing, leave as-is
                                
                except Exception as task_error:
                    logger.error(f"Error resolving task UUID {file_record.paperless_document_id} for file {file_record.file_name}: {str(task_error)}")
                    continue
                    
            # Commit any document ID updates
            try:
                db.commit()
                logger.info("Committed task UUID to document ID resolutions")
            except Exception as commit_error:
                logger.error(f"Failed to commit task UUID resolutions: {str(commit_error)}")
                db.rollback()
                
        except Exception as e:
            logger.error(f"Error in _resolve_task_uuids_to_document_ids: {str(e)}")
            # Don't re-raise - this is a best-effort operation

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
            # Get all processing files - use paperless_task_uuid field for processing files
            processing_files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.storage_backend == "paperless",
                    EntityFile.sync_status == "processing",
                    EntityFile.paperless_task_uuid.isnot(None),
                )
                .all()
            )

            if not processing_files:
                logger.info(f"No processing files found for user {current_user_id}")
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
            
            logger.info(f"Checking {len(processing_files)} processing files for task completion")
            
            # Check each processing file
            async with paperless_service:
                for file_record in processing_files:
                    try:
                        task_uuid = file_record.paperless_task_uuid
                        
                        if not task_uuid:
                            logger.warning(f"File {file_record.id} has processing status but no task UUID")
                            continue
                        
                        # Check task status directly using the endpoint logic
                        try:
                            # Use the session to make direct API call to check task status
                            async with paperless_service._make_request("GET", f"/api/tasks/?task_id={task_uuid}") as response:
                                if response.status == 200:
                                    data = await response.json()
                                    
                                    # Handle both single task and list responses
                                    if isinstance(data, list):
                                        if not data:
                                            logger.warning(f"No task found with UUID {task_uuid}")
                                            continue
                                        task_data = data[0]
                                    elif isinstance(data, dict):
                                        # If results key exists, it's paginated
                                        if "results" in data and data["results"]:
                                            task_data = data["results"][0]
                                        else:
                                            task_data = data
                                    else:
                                        logger.warning(f"Unexpected task response format: {type(data)}")
                                        continue
                                    
                                    status = task_data.get("status", "").lower()
                                    task_name = task_data.get("task_name", "")
                                    
                                    logger.debug(f"Task {task_uuid} status: {status} ({task_name})")
                                    
                                    if status == "success":
                                        # Task completed successfully - extract document ID
                                        result = task_data.get("result", {})
                                        document_id = None
                                        
                                        if isinstance(result, dict):
                                            document_id = result.get("document_id") or result.get("id")
                                        elif isinstance(result, str):
                                            # Parse document ID from string like "Success. New document id 2677 created"
                                            match = re.search(r'document id (\d+)', result)
                                            if match:
                                                document_id = match.group(1)
                                            else:
                                                document_id = result
                                        else:
                                            document_id = result
                                            
                                        # Use centralized validation and fallback logic
                                        validated_doc_id = await self._validate_and_process_document_id(
                                            document_id, file_record, paperless_service
                                        )
                                        
                                        if validated_doc_id:
                                            # Successfully validated or found via fallback
                                            file_record.paperless_document_id = validated_doc_id
                                            file_record.paperless_task_uuid = None  # Clear task UUID since it's complete
                                            file_record.sync_status = "synced"
                                            file_record.last_sync_at = get_utc_now()
                                            status_updates[str(file_record.id)] = "synced"
                                            
                                            logger.info(
                                                f"Task {task_uuid} completed successfully: {file_record.file_name} -> document_id: {validated_doc_id}"
                                            )
                                        else:
                                            # Validation and fallback both failed - might be a duplicate or invalid
                                            file_record.paperless_task_uuid = None  # Clear task UUID
                                            file_record.sync_status = "duplicate"
                                            file_record.last_sync_at = get_utc_now()
                                            status_updates[str(file_record.id)] = "duplicate"
                                            
                                            logger.info(
                                                f"Task {task_uuid} completed but document ID validation failed for {file_record.file_name} - likely duplicate or invalid"
                                            )
                                    
                                    elif status == "failure":
                                        # Task failed - extract error information
                                        error_info = task_data.get("result", "Unknown error")
                                        
                                        # Check if it's a duplicate error
                                        error_str = str(error_info).lower()
                                        is_duplicate = any(keyword in error_str for keyword in [
                                            "duplicate", "already exists", "similar document", 
                                            "document with this checksum", "identical file", "not consuming"
                                        ])
                                        
                                        # Update record accordingly
                                        file_record.paperless_task_uuid = None  # Clear task UUID
                                        if is_duplicate:
                                            file_record.sync_status = "duplicate"
                                            status_updates[str(file_record.id)] = "duplicate"
                                            logger.info(
                                                f"Task {task_uuid} failed with duplicate for {file_record.file_name}: {error_info}"
                                            )
                                        else:
                                            file_record.sync_status = "failed"
                                            status_updates[str(file_record.id)] = "failed"
                                            logger.error(
                                                f"Task {task_uuid} failed for {file_record.file_name}: {error_info}"
                                            )
                                        
                                        file_record.last_sync_at = get_utc_now()
                                    
                                    elif status in ["pending", "started", "retry"]:
                                        # Task still in progress - keep as processing
                                        status_updates[str(file_record.id)] = "processing"
                                        logger.debug(f"Task {task_uuid} still processing for {file_record.file_name}")
                                    
                                    else:
                                        logger.warning(f"Unknown task status: {status} for task {task_uuid}")
                                        status_updates[str(file_record.id)] = "processing"  # Keep checking
                                else:
                                    logger.warning(f"Failed to check task status: HTTP {response.status}")
                                    status_updates[str(file_record.id)] = "processing"  # Keep trying
                                    
                        except Exception as task_check_error:
                            logger.error(f"Error checking task {task_uuid} status: {str(task_check_error)}")
                            # Don't immediately mark as failed - might be a temporary network issue
                            status_updates[str(file_record.id)] = "processing"
                        
                    except Exception as e:
                        logger.error(f"Error processing file {file_record.id} with task {file_record.paperless_task_uuid}: {str(e)}")
                        # Only mark as failed if we can't process the file record itself
                        file_record.sync_status = "failed"
                        file_record.last_sync_at = get_utc_now()
                        status_updates[str(file_record.id)] = "failed"

            # Commit all database updates
            db.commit()

            # Log summary
            status_counts = {}
            for status in status_updates.values():
                status_counts[status] = status_counts.get(status, 0) + 1
            
            logger.info(f"Updated {len(status_updates)} processing files for user {current_user_id}: {status_counts}")
            return status_updates

        except Exception as e:
            logger.error(f"Error updating processing files: {str(e)}")
            return {}

    async def _validate_and_process_document_id(self, document_id, file_record, paperless_service) -> Optional[str]:
        """
        Validate document ID and handle fallback logic for invalid IDs.
        
        Args:
            document_id: Document ID to validate (can be string, int, or None)
            file_record: Database record for the file
            paperless_service: Paperless service instance for fallback search
            
        Returns:
            Valid document ID as string, or None if invalid and fallback failed
        """
        # Check if document_id is valid
        if document_id and str(document_id).lower() not in ["unknown", "none", "null", ""]:
            try:
                # Ensure it's a valid numeric document ID
                doc_id_int = int(document_id)
                if doc_id_int > 0:
                    return str(doc_id_int)
                else:
                    logger.warning(f"Document ID {document_id} is not a positive integer for file {file_record.file_name}")
            except (ValueError, TypeError):
                logger.warning(f"Document ID '{document_id}' is not numeric for file {file_record.file_name}")
        
        # Document ID is invalid - try fallback search
        logger.info(f"Attempting fallback search for file {file_record.file_name} due to invalid document ID '{document_id}'")
        
        try:
            # Use direct await since this method is now async
            fallback_doc_id = await self._search_document_by_filename_and_time(
                file_record.file_name, 
                file_record.uploaded_at,
                paperless_service
            )
            if fallback_doc_id:
                logger.info(f"Fallback search found document ID {fallback_doc_id} for file {file_record.file_name}")
                return str(fallback_doc_id)
            else:
                logger.error(f"Fallback search failed to find document for file {file_record.file_name}")
                return None
                
        except Exception as e:
            logger.error(f"Error in fallback document search for {file_record.file_name}: {str(e)}")
            return None

    async def _search_document_by_filename_and_time(self, filename: str, upload_time, paperless_service) -> Optional[int]:
        """
        Fallback method to search for a document by filename and upload timestamp.
        Used when task resolution returns invalid document IDs.
        
        Args:
            filename: Original filename to search for
            upload_time: When file was uploaded (datetime)
            paperless_service: Paperless service instance for API calls
            
        Returns:
            Document ID if found, None otherwise
        """
        try:
            from datetime import datetime, timedelta
            
            # Convert upload_time to datetime if needed
            if isinstance(upload_time, str):
                upload_time = datetime.fromisoformat(upload_time.replace('Z', '+00:00'))
            
            # Search window: 30 minutes before and after upload time
            search_start = upload_time - timedelta(minutes=30)
            search_end = upload_time + timedelta(minutes=30)
            
            logger.info(f"Searching for document with filename '{filename}' uploaded between {search_start} and {search_end}")
            
            # Call the async search method directly
            result = await self._async_search_document(
                filename, search_start, search_end, paperless_service
            )
            return result
                
        except Exception as e:
            logger.error(f"Error in fallback document search for {filename}: {str(e)}")
            return None
    
    async def _async_search_document(self, filename: str, search_start, search_end, paperless_service) -> Optional[int]:
        """
        Async helper to search for document by filename and time range.
        """
        try:
            # First try searching by original filename
            search_query = f"title:{filename}"
            
            async with paperless_service._make_request("GET", f"/api/documents/?query={search_query}") as response:
                if response.status == 200:
                    data = await response.json()
                    documents = data.get("results", [])
                    
                    # Check each document's created date
                    for doc in documents:
                        doc_created = doc.get("created")
                        if doc_created:
                            doc_time = datetime.fromisoformat(doc_created.replace('Z', '+00:00'))
                            if search_start <= doc_time <= search_end:
                                doc_id = doc.get("id")
                                logger.info(f"Found matching document ID {doc_id} for filename '{filename}' created at {doc_created}")
                                return doc_id
            
            # If filename search failed, try searching recent documents
            formatted_start = search_start.strftime("%Y-%m-%d")
            formatted_end = search_end.strftime("%Y-%m-%d")
            
            async with paperless_service._make_request("GET", f"/api/documents/?created__date__gte={formatted_start}&created__date__lte={formatted_end}&ordering=-created") as response:
                if response.status == 200:
                    data = await response.json()
                    documents = data.get("results", [])
                    
                    # Look for documents with matching filename in title or original_file_name
                    base_filename = filename.lower()
                    for doc in documents:
                        doc_title = (doc.get("title") or "").lower()
                        doc_original = (doc.get("original_file_name") or "").lower()
                        
                        if base_filename in doc_title or base_filename in doc_original or doc_title in base_filename:
                            doc_id = doc.get("id")
                            doc_created = doc.get("created")
                            logger.info(f"Found potential matching document ID {doc_id} for filename '{filename}' with title '{doc.get('title')}' created at {doc_created}")
                            return doc_id
            
            logger.warning(f"No document found for filename '{filename}' in time range {search_start} to {search_end}")
            return None
            
        except Exception as e:
            logger.error(f"Error in async document search for {filename}: {str(e)}")
            return None

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
