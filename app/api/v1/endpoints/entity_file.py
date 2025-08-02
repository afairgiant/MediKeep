"""
Generic Entity File API endpoints for all entity types.
Supports lab-results, insurance, visits, procedures, and future entity types.
"""

import os
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.core.logging_config import get_logger
from app.models.activity_log import EntityType as ActivityEntityType
from app.models.models import EntityFile, User
from app.schemas.entity_file import (
    EntityFileResponse,
    EntityType,
    FileBatchCountRequest,
    FileBatchCountResponse,
    FileOperationResult,
    FileUploadRequest,
)
from app.services.generic_entity_file_service import GenericEntityFileService

router = APIRouter()

# Initialize service
file_service = GenericEntityFileService()

# Initialize logger
logger = get_logger(__name__, "app")


@router.get("/{entity_type}/{entity_id}/files", response_model=List[EntityFileResponse])
def get_entity_files(
    *,
    db: Session = Depends(deps.get_db),
    entity_type: str,
    entity_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> List[EntityFileResponse]:
    """
    Get all files for a specific entity.

    Args:
        entity_type: Type of entity (lab-result, insurance, visit, procedure)
        entity_id: ID of the entity

    Returns:
        List of entity files
    """
    try:
        # TODO: Add permission check - ensure user has access to this entity
        # This would depend on your user model and permission system

        return file_service.get_entity_files(db, entity_type, entity_id)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve files: {str(e)}",
        )


@router.post(
    "/{entity_type}/{entity_id}/files/pending",
    response_model=EntityFileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pending_file_record(
    *,
    db: Session = Depends(deps.get_db),
    entity_type: str,
    entity_id: int,
    file_name: str = Form(...),
    file_size: int = Form(...),
    file_type: str = Form(...),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    storage_backend: Optional[str] = Form(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> EntityFileResponse:
    """
    Create a pending file record without actual file upload.
    This allows tracking files that will be uploaded asynchronously.

    Args:
        entity_type: Type of entity (lab-result, insurance, visit, procedure)
        entity_id: ID of the entity
        file_name: Name of the file
        file_size: Size of the file in bytes
        file_type: MIME type of the file
        description: Optional description
        category: Optional category
        storage_backend: Storage backend to use ('local' or 'paperless')

    Returns:
        Created pending file record
    """
    try:
        logger.info(
            f"Creating pending file record for {entity_type} {entity_id}",
            extra={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "file_name": file_name,
                "file_size": file_size,
                "storage_backend": storage_backend,
                "current_user_id": current_user_id,
            },
        )

        # Create pending file record
        result = await file_service.create_pending_file_record(
            db=db,
            entity_type=entity_type,
            entity_id=entity_id,
            file_name=file_name,
            file_size=file_size,
            file_type=file_type,
            description=description,
            category=category,
            storage_backend=storage_backend or "local",
            user_id=current_user_id,
        )

        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=result.error_message
            )

        # Log activity
        log_create(
            db=db,
            entity_type=ActivityEntityType.ENTITY_FILE,
            entity_obj=result.file_record,
            user_id=current_user_id,
            details=f"Created pending file record: {file_name}",
        )

        return result.file_record

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to create pending file record for {entity_type} {entity_id}",
            extra={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "file_name": file_name,
                "error": str(e),
                "current_user_id": current_user_id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pending file record",
        )


@router.put(
    "/files/{file_id}/status",
    response_model=EntityFileResponse,
)
async def update_file_upload_status(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    actual_file_path: str = Form(...),
    sync_status: str = Form("synced"),
    paperless_document_id: Optional[str] = Form(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> EntityFileResponse:
    """
    Update the upload status of a pending file record.

    Args:
        file_id: ID of the file record to update
        actual_file_path: Actual path where the file was saved
        sync_status: New sync status ('synced', 'failed')
        paperless_document_id: Paperless document ID if uploaded to paperless

    Returns:
        Updated file record
    """
    try:
        logger.info(
            f"Updating file {file_id} status to {sync_status}",
            extra={
                "file_id": file_id,
                "sync_status": sync_status,
                "actual_file_path": actual_file_path,
                "current_user_id": current_user_id,
            },
        )

        result = await file_service.update_file_upload_status(
            db=db,
            file_id=file_id,
            actual_file_path=actual_file_path,
            sync_status=sync_status,
            paperless_document_id=paperless_document_id,
        )

        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=result.error_message
            )

        # Log activity
        log_update(
            db=db,
            entity_type=ActivityEntityType.ENTITY_FILE,
            entity_obj=result.file_record,
            user_id=current_user_id,
            details=f"Updated file status to {sync_status}",
        )

        return result.file_record

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to update file {file_id} status",
            extra={
                "file_id": file_id,
                "sync_status": sync_status,
                "error": str(e),
                "current_user_id": current_user_id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update file status",
        )


@router.post(
    "/{entity_type}/{entity_id}/files",
    response_model=EntityFileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_entity_file(
    *,
    db: Session = Depends(deps.get_db),
    entity_type: str,
    entity_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    storage_backend: Optional[str] = Form(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> EntityFileResponse:
    """
    Upload a file for any entity type.

    Args:
        entity_type: Type of entity (lab-result, insurance, visit, procedure)
        entity_id: ID of the entity
        file: File to upload
        description: Optional description
        category: Optional category
        storage_backend: Storage backend to use ('local' or 'paperless')

    Returns:
        Created entity file details
    """
    try:
        # Debug logging to see what storage_backend was received
        logger.info(
            f"File upload request for {entity_type} {entity_id}",
            extra={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "storage_backend": storage_backend,
                "file_name": file.filename,
                "current_user_id": current_user_id,
            },
        )
        # TODO: Add permission check - ensure user has access to this entity
        # This would depend on your user model and permission system

        # Validate file type and size
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided"
            )

        # Upload the file using the service
        result = await file_service.upload_file(
            db=db,
            entity_type=entity_type,
            entity_id=entity_id,
            file=file,
            description=description,
            category=category,
            storage_backend=storage_backend,
            current_user_id=current_user_id,
        )

        # Log the creation activity
        try:
            # Get the database record for logging
            file_record = file_service.get_file_by_id(db, result.id)
            if file_record:
                log_create(
                    db=db,
                    entity_type=ActivityEntityType.ENTITY_FILE,
                    entity_obj=file_record,
                    user_id=current_user_id,
                )
        except Exception as log_error:
            # Don't fail the request if logging fails
            print(f"Failed to log file creation: {log_error}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )


@router.get("/files/{file_id}/download")
async def download_file(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """
    Download a file by its ID from both local and paperless storage.

    Args:
        file_id: ID of the file to download

    Returns:
        File response for download
    """
    try:
        # TODO: Add permission check - ensure user has access to this file
        # This would involve checking if the user has access to the entity that owns the file

        # Get file information
        file_info, filename, content_type = await file_service.get_file_download_info(
            db, file_id, current_user_id
        )

        # Handle different return types (local path vs paperless content)
        if isinstance(file_info, bytes):
            # Paperless file - return as StreamingResponse
            from fastapi.responses import Response

            return Response(
                content=file_info,
                media_type=content_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )
        else:
            # Local file - return as FileResponse
            return FileResponse(
                path=file_info, filename=filename, media_type=content_type
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file: {str(e)}",
        )


@router.get("/files/{file_id}/view")
async def view_file(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    current_user_id: int = Depends(deps.get_current_user_id_flexible_auth),
):
    """
    View a file by its ID in browser (inline display).
    
    Supports authentication via both Authorization header and query parameter.
    This enables opening files in new browser tabs where Authorization headers
    are not automatically included.

    Args:
        file_id: ID of the file to view
        token: Optional JWT token as query parameter (alternative to Authorization header)

    Returns:
        File response for inline viewing in browser with Content-Disposition: inline
        
    Example URLs:
        - With Authorization header: GET /api/v1/entity-files/files/123/view
        - With query token: GET /api/v1/entity-files/files/123/view?token=<jwt_token>
    """
    try:
        logger.info(f"Viewing file {file_id} for user {current_user_id}")

        # Basic permission check - ensure file exists and user has access
        file_record = file_service.get_file_by_id(db, file_id)
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="File not found"
            )
        
        # TODO: Implement entity-level permission checking
        # For now, we allow access to any authenticated user's files
        # In the future, this should check if the user has access to the entity that owns the file
        
        # Get file information
        file_info, filename, content_type = await file_service.get_file_view_info(
            db, file_id, current_user_id
        )

        # Handle different return types (local path vs paperless content)
        if isinstance(file_info, bytes):
            # Paperless file - return as StreamingResponse
            from fastapi.responses import Response

            # Set secure headers for inline file viewing
            headers = {
                "Content-Disposition": f"inline; filename={filename}",
                "X-Content-Type-Options": "nosniff",  # Prevent MIME sniffing
                "X-Frame-Options": "SAMEORIGIN",     # Prevent embedding in frames from other domains
            }
            
            return Response(
                content=file_info,
                media_type=content_type,
                headers=headers,
            )
        else:
            # Local file - return as FileResponse with inline disposition and security headers
            headers = {
                "Content-Disposition": f"inline; filename={filename}",
                "X-Content-Type-Options": "nosniff",  # Prevent MIME sniffing
                "X-Frame-Options": "SAMEORIGIN",     # Prevent embedding in frames from other domains
            }
            
            return FileResponse(
                path=file_info, 
                filename=filename, 
                media_type=content_type,
                headers=headers
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to view file {file_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to view file: {str(e)}",
        )


@router.delete("/files/{file_id}", response_model=FileOperationResult)
async def delete_file(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> FileOperationResult:
    """
    Delete a file by its ID.

    Args:
        file_id: ID of the file to delete

    Returns:
        File operation result
    """
    try:
        # TODO: Add permission check - ensure user has access to this file

        # Get file record before deletion for logging
        file_record = file_service.get_file_by_id(db, file_id)
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
            )

        # Delete the file
        result = await file_service.delete_file(db, file_id, current_user_id)

        # Log the deletion activity
        try:
            log_delete(
                db=db,
                entity_type=ActivityEntityType.ENTITY_FILE,
                entity_obj=file_record,
                user_id=current_user_id,
            )
        except Exception as log_error:
            # Don't fail the request if logging fails
            print(f"Failed to log file deletion: {log_error}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )


@router.put("/files/{file_id}/metadata", response_model=EntityFileResponse)
def update_file_metadata(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> EntityFileResponse:
    """
    Update file metadata (description, category).

    Args:
        file_id: ID of the file to update
        description: New description
        category: New category

    Returns:
        Updated entity file details
    """
    try:
        # TODO: Add permission check - ensure user has access to this file

        # Get original file record for logging
        original_file = file_service.get_file_by_id(db, file_id)
        if not original_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
            )

        # Update metadata
        result = file_service.update_file_metadata(
            db=db, file_id=file_id, description=description, category=category
        )

        # Log the update activity
        try:
            updated_file = file_service.get_file_by_id(db, file_id)
            if updated_file:
                log_update(
                    db=db,
                    entity_type=ActivityEntityType.ENTITY_FILE,
                    entity_obj=updated_file,
                    original_obj=original_file,
                    user_id=current_user_id,
                )
        except Exception as log_error:
            # Don't fail the request if logging fails
            print(f"Failed to log file update: {log_error}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update file metadata: {str(e)}",
        )


@router.post("/files/batch-counts", response_model=List[FileBatchCountResponse])
def get_batch_file_counts(
    *,
    db: Session = Depends(deps.get_db),
    request: FileBatchCountRequest,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> List[FileBatchCountResponse]:
    """
    Get file counts for multiple entities in batch.

    Args:
        request: Batch count request with entity type and IDs

    Returns:
        List of file counts per entity
    """
    try:
        # TODO: Add permission check - ensure user has access to these entities

        # Get file counts from service
        file_counts = file_service.get_files_count_batch(
            db=db, entity_type=request.entity_type.value, entity_ids=request.entity_ids
        )

        # Convert to response format
        return [
            FileBatchCountResponse(entity_id=entity_id, file_count=count)
            for entity_id, count in file_counts.items()
        ]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get batch file counts: {str(e)}",
        )


@router.get("/files/{file_id}", response_model=EntityFileResponse)
def get_file_details(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> EntityFileResponse:
    """
    Get details of a specific file.

    Args:
        file_id: ID of the file

    Returns:
        Entity file details
    """
    try:
        # TODO: Add permission check - ensure user has access to this file

        file_record = file_service.get_file_by_id(db, file_id)
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
            )

        return EntityFileResponse.from_orm(file_record)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file details: {str(e)}",
        )


@router.post("/sync/paperless")
async def check_paperless_sync_status(
    *,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Dict[int, bool]:
    """
    Check sync status for all Paperless documents.
    
    Returns:
        Dictionary mapping file_id to existence status (True = exists, False = missing)
    """
    try:
        sync_status = await file_service.check_paperless_sync_status(db, current_user_id)
        
        logger.info(
            f"Checked paperless sync status for user {current_user_id}: {len(sync_status)} files checked"
        )
        
        return sync_status

    except Exception as e:
        logger.error(f"Failed to check paperless sync status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check paperless sync status: {str(e)}",
        )


@router.post("/processing/update")
async def update_processing_files(
    *,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Dict[str, str]:
    """
    Update files with 'processing' status by checking their task completion.
    
    Returns:
        Dictionary mapping file_id to new status
    """
    try:
        status_updates = await file_service.update_processing_files(db, current_user_id)
        
        logger.info(
            f"Updated processing files for user {current_user_id}: {len(status_updates)} files updated"
        )
        
        return status_updates

    except Exception as e:
        logger.error(f"Failed to update processing files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update processing files: {str(e)}",
        )


@router.post("/{entity_type}/{entity_id}/cleanup")
async def cleanup_entity_files_on_deletion(
    *,
    db: Session = Depends(deps.get_db),
    entity_type: str,
    entity_id: int,
    preserve_paperless: bool = True,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Dict[str, int]:
    """
    Clean up EntityFiles when an entity is deleted.
    Preserves Paperless documents by default, deletes local files.
    
    Args:
        entity_type: Type of entity being deleted
        entity_id: ID of the entity being deleted  
        preserve_paperless: If True, preserve Paperless documents (default: True)
    
    Returns:
        Dictionary with cleanup statistics
    """
    try:
        cleanup_stats = file_service.cleanup_entity_files_on_deletion(
            db=db,
            entity_type=entity_type,
            entity_id=entity_id,
            preserve_paperless=preserve_paperless
        )
        
        logger.info(
            f"Entity file cleanup completed for {entity_type} {entity_id} by user {current_user_id}: {cleanup_stats}"
        )
        
        return cleanup_stats

    except Exception as e:
        logger.error(f"Failed to cleanup entity files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup entity files: {str(e)}",
        )
