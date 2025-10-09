"""
Generic Entity File API endpoints for all entity types.
Supports lab-results, insurance, visits, procedures, and future entity types.
"""

import os
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.api.v1.endpoints.utils import handle_not_found, verify_patient_ownership
from app.core.error_handling import NotFoundException, MedicalRecordsAPIException
from app.core.logging_config import get_logger
from app.crud import lab_result, insurance, encounter, procedure, medication, immunization, allergy, condition, treatment
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


def get_entity_by_type_and_id(db: Session, entity_type: str, entity_id: int):
    """Get entity by type and ID for authorization checks
    
    Returns:
        Entity object if found, None if not found
        
    Raises:
        HTTPException: For database errors or unsupported entity types
    """
    entity_map = {
        "lab-result": lab_result.get,
        "procedure": procedure.get,
        "insurance": insurance.get,
        "encounter": encounter.get,
        "visit": encounter.get,  # Alternative name for encounter
        "medication": medication.get,
        "immunization": immunization.get,
        "allergy": allergy.get,
        "condition": condition.get,
        "treatment": treatment.get,
    }
    crud_func = entity_map.get(entity_type)
    if not crud_func:
        raise HTTPException(status_code=400, detail=f"Unsupported entity type: {entity_type}")
    
    try:
        entity = crud_func(db, id=entity_id)
        if not entity:
            logger.debug(f"Entity not found: {entity_type} with ID {entity_id}")
            return None
        return entity
    except SQLAlchemyError as e:
        # Database errors should be logged and re-raised
        logger.error(f"Database error looking up {entity_type} {entity_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while accessing entity"
        )
    except Exception as e:
        # Unexpected errors should be logged with full details
        logger.error(f"Unexpected error looking up {entity_type} {entity_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while accessing entity"
        )


def fix_filename_for_paperless_content(filename: str, content: bytes) -> str:
    """
    Fix filename extension based on actual file content from Paperless.
    
    Paperless-NGX often converts images to PDFs during processing,
    but the original filename is preserved, causing extension/content mismatches.
    
    Args:
        filename: Original filename
        content: Actual file content bytes
        
    Returns:
        Corrected filename with proper extension
    """
    # Check if content is actually a PDF (Paperless converts images to PDF)
    if content.startswith(b'%PDF-'):
        base_name = os.path.splitext(filename)[0]
        corrected_filename = f"{base_name}.pdf"
        logger.debug(f"Paperless file conversion detected: {filename} -> {corrected_filename}")
        return corrected_filename
    
    # Return original filename if no conversion detected
    return filename


@router.get("/{entity_type}/{entity_id}/files", response_model=List[EntityFileResponse])
def get_entity_files(
    *,
    db: Session = Depends(deps.get_db),
    entity_type: str,
    entity_id: int,
    current_user: User = Depends(deps.get_current_user),
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
        # Get the parent entity (lab-result, procedure, etc.) and verify access
        parent_entity = get_entity_by_type_and_id(db, entity_type, entity_id)
        if not parent_entity:
            # If entity doesn't exist, return empty list (matches original behavior)
            return []
        
        # Verify user has access to the patient that owns this entity
        entity_patient_id = getattr(parent_entity, "patient_id", None)
        if entity_patient_id:
            try:
                # Use the multi-patient access verification system
                deps.verify_patient_access(entity_patient_id, db, current_user)
            except (HTTPException, NotFoundException, MedicalRecordsAPIException):
                # Entity exists but user doesn't have access - return empty list
                return []
        
        return file_service.get_entity_files(db, entity_type, entity_id)

    except (HTTPException, NotFoundException, MedicalRecordsAPIException):
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_entity_files: {str(e)}", exc_info=True)
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
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
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
        # Get the parent entity (lab-result, procedure, etc.) and verify ownership
        parent_entity = get_entity_by_type_and_id(db, entity_type, entity_id)
        handle_not_found(parent_entity, entity_type)
        verify_patient_ownership(parent_entity, current_user_patient_id, entity_type)
        
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
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
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
        # Get file record first to check authorization
        file_record = file_service.get_file_by_id(db, file_id)
        handle_not_found(file_record, "File")
        
        # Get the parent entity and verify ownership
        parent_entity = get_entity_by_type_and_id(db, file_record.entity_type, file_record.entity_id)
        handle_not_found(parent_entity, file_record.entity_type)
        verify_patient_ownership(parent_entity, current_user_patient_id, file_record.entity_type)
        
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
    current_user: User = Depends(deps.get_current_user),
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
        
        # Get the parent entity (lab-result, procedure, etc.) and verify access
        parent_entity = get_entity_by_type_and_id(db, entity_type, entity_id)
        if not parent_entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{entity_type.title()} not found"
            )
        
        # Verify user has access to the patient that owns this entity
        entity_patient_id = getattr(parent_entity, "patient_id", None)
        if entity_patient_id:
            deps.verify_patient_access(entity_patient_id, db, current_user)

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

    except (HTTPException, NotFoundException, MedicalRecordsAPIException):
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload_entity_file: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )


@router.get("/files/{file_id}/download")
async def download_file(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Download a file by its ID from both local and paperless storage.

    Args:
        file_id: ID of the file to download

    Returns:
        File response for download
    """
    try:
        # Get file record first to check authorization
        file_record = file_service.get_file_by_id(db, file_id)
        handle_not_found(file_record, "File")
        
        # Get the parent entity and verify access
        parent_entity = get_entity_by_type_and_id(db, file_record.entity_type, file_record.entity_id)
        handle_not_found(parent_entity, file_record.entity_type)
        
        # Verify user has access to the patient that owns this entity
        entity_patient_id = getattr(parent_entity, "patient_id", None)
        if entity_patient_id:
            deps.verify_patient_access(entity_patient_id, db, current_user)

        # Get file information
        file_info, filename, content_type = await file_service.get_file_download_info(
            db, file_id, current_user.id
        )

        # Handle different return types (local path vs paperless content)
        if isinstance(file_info, bytes):
            # Paperless file - fix filename if content was converted
            corrected_filename = fix_filename_for_paperless_content(filename, file_info)
            logger.debug("Processing Paperless download", extra={
                "original_filename": filename,
                "corrected_filename": corrected_filename,
                "content_size": len(file_info),
                "component": "entity_file"
            })

            # Paperless file - return as StreamingResponse with proper binary handling
            from fastapi.responses import Response
            import mimetypes

            # Ensure proper content type - use corrected filename for guessing
            if not content_type or content_type == 'application/octet-stream':
                # Try to guess content type from corrected filename
                guessed_type, _ = mimetypes.guess_type(corrected_filename)
                if guessed_type:
                    content_type = guessed_type
                    logger.debug("Guessed content type from filename", extra={
                        "filename": corrected_filename,
                        "content_type": content_type,
                        "component": "entity_file"
                    })

            # Override content type for PDF files to ensure proper handling
            if corrected_filename.endswith('.pdf'):
                content_type = 'application/pdf'
                logger.debug("Forced content type for PDF file", extra={
                    "component": "entity_file"
                })

            # Set proper headers for binary content
            headers = {
                "Content-Disposition": f"attachment; filename={corrected_filename}",
                "Content-Length": str(len(file_info)),
                "Cache-Control": "no-cache",
            }

            return Response(
                content=file_info,
                media_type=content_type or 'application/octet-stream',
                headers=headers,
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

        # Get current user object for multi-patient access verification
        from app.crud.user import user
        current_user = user.get(db, id=current_user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get file record first to check authorization
        file_record = file_service.get_file_by_id(db, file_id)
        handle_not_found(file_record, "File")
        
        # Get the parent entity and verify access
        parent_entity = get_entity_by_type_and_id(db, file_record.entity_type, file_record.entity_id)
        handle_not_found(parent_entity, file_record.entity_type)
        
        # Verify user has access to the patient that owns this entity
        entity_patient_id = getattr(parent_entity, "patient_id", None)
        if entity_patient_id:
            deps.verify_patient_access(entity_patient_id, db, current_user)
        
        # Get file information
        file_info, filename, content_type = await file_service.get_file_view_info(
            db, file_id, current_user_id
        )

        # Handle different return types (local path vs paperless content)
        if isinstance(file_info, bytes):
            # Paperless file - fix filename if content was converted
            corrected_filename = fix_filename_for_paperless_content(filename, file_info)
            logger.debug("Processing Paperless file view", extra={
                "original_filename": filename,
                "corrected_filename": corrected_filename,
                "content_size": len(file_info),
                "component": "entity_file"
            })

            # Paperless file - return as StreamingResponse with proper binary handling
            from fastapi.responses import Response
            import mimetypes

            # Ensure proper content type - use corrected filename for guessing
            if not content_type or content_type == 'application/octet-stream':
                # Try to guess content type from corrected filename
                guessed_type, _ = mimetypes.guess_type(corrected_filename)
                if guessed_type:
                    content_type = guessed_type
                    logger.debug("Guessed content type for view", extra={
                        "filename": corrected_filename,
                        "content_type": content_type,
                        "component": "entity_file"
                    })

            # Override content type for PDF files to ensure proper handling
            if corrected_filename.endswith('.pdf'):
                content_type = 'application/pdf'
                logger.debug("Forced content type for PDF view", extra={
                    "component": "entity_file"
                })

            # Set secure headers for inline file viewing with proper binary handling
            headers = {
                "Content-Disposition": f"inline; filename={corrected_filename}",
                "Content-Length": str(len(file_info)),
                "X-Content-Type-Options": "nosniff",  # Prevent MIME sniffing
                "X-Frame-Options": "SAMEORIGIN",     # Prevent embedding in frames from other domains
                "Cache-Control": "no-cache",
            }
            
            return Response(
                content=file_info,
                media_type=content_type or 'application/octet-stream',
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
    current_user: User = Depends(deps.get_current_user),
) -> FileOperationResult:
    """
    Delete a file by its ID.

    Args:
        file_id: ID of the file to delete

    Returns:
        File operation result
    """
    try:
        # Get file record before deletion for logging and authorization
        file_record = file_service.get_file_by_id(db, file_id)
        handle_not_found(file_record, "File")
        
        # Get the parent entity and verify access
        parent_entity = get_entity_by_type_and_id(db, file_record.entity_type, file_record.entity_id)
        handle_not_found(parent_entity, file_record.entity_type)
        
        # Verify user has access to the patient that owns this entity
        entity_patient_id = getattr(parent_entity, "patient_id", None)
        if entity_patient_id:
            deps.verify_patient_access(entity_patient_id, db, current_user)

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
    current_user: User = Depends(deps.get_current_user),
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
        # Get original file record for logging and authorization
        original_file = file_service.get_file_by_id(db, file_id)
        handle_not_found(original_file, "File")
        
        # Get the parent entity and verify access
        parent_entity = get_entity_by_type_and_id(db, original_file.entity_type, original_file.entity_id)
        handle_not_found(parent_entity, original_file.entity_type)
        
        # Verify user has access to the patient that owns this entity
        entity_patient_id = getattr(parent_entity, "patient_id", None)
        if entity_patient_id:
            deps.verify_patient_access(entity_patient_id, db, current_user)

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
    current_user: User = Depends(deps.get_current_user),
) -> List[FileBatchCountResponse]:
    """
    Get file counts for multiple entities in batch.

    Args:
        request: Batch count request with entity type and IDs

    Returns:
        List of file counts per entity
    """
    try:
        # Verify user has access to all requested entities
        entity_type = request.entity_type.value
        authorized_entity_ids = []
        skipped_count = 0
        not_found_count = 0
        
        logger.debug(
            f"Processing batch file count request for {len(request.entity_ids)} entities",
            extra={
                "user_id": current_user.id,
                "entity_type": entity_type,
                "requested_count": len(request.entity_ids)
            }
        )
        
        for entity_id in request.entity_ids:
            try:
                parent_entity = get_entity_by_type_and_id(db, entity_type, entity_id)
                if parent_entity:
                    # Verify user has access to the patient that owns this entity
                    entity_patient_id = getattr(parent_entity, "patient_id", None)
                    if entity_patient_id:
                        deps.verify_patient_access(entity_patient_id, db, current_user)
                    
                    authorized_entity_ids.append(entity_id)
                    logger.debug(
                        f"User {current_user.id} authorized for {entity_type} {entity_id}",
                        extra={
                            "user_id": current_user.id,
                            "entity_type": entity_type,
                            "entity_id": entity_id,
                            "patient_id": entity_patient_id
                        }
                    )
                else:
                    not_found_count += 1
                    logger.debug(
                        f"Entity not found during batch count: {entity_type} {entity_id}",
                        extra={
                            "user_id": current_user.id,
                            "entity_type": entity_type,
                            "entity_id": entity_id,
                            "reason": "not_found"
                        }
                    )
            except (HTTPException, NotFoundException, MedicalRecordsAPIException) as e:
                # Log when entities are skipped due to authorization
                skipped_count += 1
                logger.debug(
                    f"User {current_user.id} not authorized for {entity_type} {entity_id}: {str(e)}",
                    extra={
                        "user_id": current_user.id,
                        "entity_type": entity_type,
                        "entity_id": entity_id,
                        "reason": "access_denied",
                        "error": str(e)
                    }
                )
                continue

        # Get file counts from service for authorized entities only
        file_counts = file_service.get_files_count_batch(
            db=db, entity_type=entity_type, entity_ids=authorized_entity_ids
        )
        
        # Log summary of batch processing
        logger.info(
            f"Batch file count completed for user {current_user.id}",
            extra={
                "user_id": current_user.id,
                "entity_type": entity_type,
                "requested_count": len(request.entity_ids),
                "authorized_count": len(authorized_entity_ids),
                "skipped_count": skipped_count,
                "not_found_count": not_found_count
            }
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
    current_user: User = Depends(deps.get_current_user),
) -> EntityFileResponse:
    """
    Get details of a specific file.

    Args:
        file_id: ID of the file

    Returns:
        Entity file details
    """
    try:
        # Get file record and check authorization
        file_record = file_service.get_file_by_id(db, file_id)
        handle_not_found(file_record, "File")
        
        # Get the parent entity and verify access
        parent_entity = get_entity_by_type_and_id(db, file_record.entity_type, file_record.entity_id)
        handle_not_found(parent_entity, file_record.entity_type)
        
        # Verify user has access to the patient that owns this entity
        entity_patient_id = getattr(parent_entity, "patient_id", None)
        if entity_patient_id:
            deps.verify_patient_access(entity_patient_id, db, current_user)

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
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Dict[int, bool]:
    """
    Check sync status for all Paperless documents.
    
    Returns:
        Dictionary mapping file_id to existence status (True = exists, False = missing)
    """
    logger.error(f"🔍 SYNC ENDPOINT - Starting paperless sync check for user {current_user_id}")
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
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
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
    
    IMPORTANT: This endpoint assumes authorization has already been performed
    by the calling endpoint that is deleting the entity. No additional 
    authorization checks are performed here.
    
    Args:
        entity_type: Type of entity being deleted
        entity_id: ID of the entity being deleted  
        preserve_paperless: If True, preserve Paperless documents (default: True)
    
    Returns:
        Dictionary with cleanup statistics
    """
    try:
        logger.debug(
            "Starting entity file cleanup",
            extra={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "preserve_paperless": preserve_paperless,
                "user_id": current_user_id
            }
        )
        
        cleanup_stats = file_service.cleanup_entity_files_on_deletion(
            db=db,
            entity_type=entity_type,
            entity_id=entity_id,
            preserve_paperless=preserve_paperless
        )
        
        logger.info(
            "Entity file cleanup completed",
            extra={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "user_id": current_user_id,
                "cleanup_stats": cleanup_stats,
                "files_deleted": cleanup_stats.get("files_deleted", 0),
                "paperless_preserved": cleanup_stats.get("paperless_preserved", 0)
            }
        )
        
        return cleanup_stats

    except Exception as e:
        logger.error(
            "Failed to cleanup entity files",
            extra={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "user_id": current_user_id,
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup entity files: {str(e)}",
        )
