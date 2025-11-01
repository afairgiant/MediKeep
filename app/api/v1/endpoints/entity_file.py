"""
Generic Entity File API endpoints for all entity types.
Supports lab-results, insurance, visits, procedures, and future entity types.
"""

import os
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.api.v1.endpoints.utils import handle_not_found, verify_patient_ownership
from app.core.http.error_handling import NotFoundException, MedicalRecordsAPIException
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_data_access,
    log_security_event,
    log_debug,
)
from app.crud import lab_result, insurance, encounter, procedure, medication, immunization, allergy, condition, treatment, symptom_parent
from app.models.activity_log import EntityType as ActivityEntityType
from app.models.models import EntityFile, User
from app.schemas.entity_file import (
    EntityFileResponse,
    EntityType,
    EntityFileLinkPaperlessRequest,
    FileBatchCountRequest,
    FileBatchCountResponse,
    FileOperationResult,
    FileUploadRequest,
)
from app.services.generic_entity_file_service import GenericEntityFileService
from app.services.paperless_client import (
    create_paperless_client,
    PaperlessClientError,
    PaperlessConnectionError as NewPaperlessConnectionError,
)
from app.crud.user_preferences import user_preferences
from app.core.utils.datetime_utils import get_utc_now

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
        "symptom": symptom_parent.get,
    }
    crud_func = entity_map.get(entity_type)
    if not crud_func:
        raise HTTPException(status_code=400, detail=f"Unsupported entity type: {entity_type}")
    
    try:
        entity = crud_func(db, id=entity_id)
        if not entity:
            log_debug(
                logger,
                f"Entity not found: {entity_type} with ID {entity_id}",
                entity_type=entity_type,
                entity_id=entity_id
            )
            return None
        return entity
    except SQLAlchemyError as e:
        # Database errors should be logged and re-raised
        logger.error(
            f"Database error looking up {entity_type} {entity_id}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "database_error",
                LogFields.ERROR: str(e),
                "entity_type": entity_type,
                "entity_id": entity_id
            }
        )
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while accessing entity"
        )
    except Exception as e:
        # Unexpected errors should be logged with full details
        logger.error(
            f"Unexpected error looking up {entity_type} {entity_id}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "unexpected_error",
                LogFields.ERROR: str(e),
                "entity_type": entity_type,
                "entity_id": entity_id
            },
            exc_info=True
        )
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
        log_debug(
            logger,
            f"Paperless file conversion detected: {filename} -> {corrected_filename}",
            original_file_name=filename,
            corrected_file_name=corrected_filename
        )
        return corrected_filename

    # Return original filename if no conversion detected
    return filename


@router.get("/{entity_type}/{entity_id}/files", response_model=List[EntityFileResponse])
def get_entity_files(
    *,
    request: Request,
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
        log_endpoint_error(
            logger,
            request,
            "Unexpected error retrieving entity files",
            e,
            user_id=current_user.id,
            entity_type=entity_type,
            entity_id=entity_id
        )
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
    request: Request,
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

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "pending_file_record_created",
            message=f"Creating pending file record for {entity_type} {entity_id}",
            entity_type=entity_type,
            entity_id=entity_id,
            file_name=file_name,
            file_size=file_size,
            storage_backend=storage_backend
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
        log_endpoint_error(
            logger,
            request,
            f"Failed to create pending file record for {entity_type} {entity_id}",
            e,
            user_id=current_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            file_name=file_name
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
    request: Request,
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

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "file_status_updated",
            message=f"Updating file {file_id} status to {sync_status}",
            file_id=file_id,
            sync_status=sync_status,
            actual_file_path=actual_file_path
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
        log_endpoint_error(
            logger,
            request,
            f"Failed to update file {file_id} status",
            e,
            user_id=current_user_id,
            file_id=file_id,
            sync_status=sync_status
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
    request: Request,
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
        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "file_upload_requested",
            message=f"File upload request for {entity_type} {entity_id}",
            entity_type=entity_type,
            entity_id=entity_id,
            storage_backend=storage_backend,
            file_name=file.filename
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
            logger.error(f"Failed to log file creation: {log_error}", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "logging_failure",
                LogFields.ERROR: str(log_error)
            })

        return result

    except (HTTPException, NotFoundException, MedicalRecordsAPIException):
        raise
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Unexpected error uploading entity file",
            e,
            user_id=current_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            file_name=file.filename if file else None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )


@router.post(
    "/{entity_type}/{entity_id}/link-paperless",
    response_model=EntityFileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def link_paperless_document(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    entity_type: str,
    entity_id: int,
    link_request: EntityFileLinkPaperlessRequest,
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
) -> EntityFileResponse:
    """
    Link an existing Paperless document to an entity without uploading.

    This creates an EntityFile record that references a document already in Paperless,
    allowing users to associate existing Paperless documents with MediKeep records
    without duplicating files.

    Args:
        entity_type: Type of entity (lab-result, insurance, visit, procedure, etc.)
        entity_id: ID of the entity
        link_request: Link request with paperless_document_id and optional description

    Returns:
        Created EntityFile record

    Raises:
        HTTPException: If document doesn't exist in Paperless or user lacks access
    """
    try:
        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "paperless_document_link_requested",
            message=f"Paperless document link request for {entity_type} {entity_id}",
            entity_type=entity_type,
            entity_id=entity_id,
            paperless_document_id=link_request.paperless_document_id
        )

        # Get the parent entity and verify access
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

        # Get user's Paperless preferences
        user_prefs = user_preferences.get_by_user_id(db, user_id=current_user_id)

        if not user_prefs or not user_prefs.paperless_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paperless integration is not enabled"
            )

        # Check if credentials exist
        has_auth = (user_prefs.paperless_api_token_encrypted or
                   (user_prefs.paperless_username_encrypted and
                    user_prefs.paperless_password_encrypted))

        if not user_prefs.paperless_url or not has_auth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paperless configuration is incomplete"
            )

        # Create Paperless client and verify document exists
        paperless_client = create_paperless_client(
            url=user_prefs.paperless_url,
            encrypted_token=user_prefs.paperless_api_token_encrypted,
            encrypted_username=user_prefs.paperless_username_encrypted,
            encrypted_password=user_prefs.paperless_password_encrypted,
            user_id=current_user_id
        )

        # Verify document exists in Paperless
        async with paperless_client:
            doc_info = await paperless_client.get_document_info(link_request.paperless_document_id)

            if not doc_info:
                log_endpoint_error(
                    logger,
                    request,
                    "Document not found in Paperless",
                    Exception(f"Document {link_request.paperless_document_id} not found"),
                    user_id=current_user_id,
                    paperless_document_id=link_request.paperless_document_id
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Document {link_request.paperless_document_id} not found in Paperless"
                )

            # Extract metadata from Paperless
            file_type = doc_info.get('mime_type') or 'application/pdf'

            # Determine file extension from mime type
            mime_to_ext = {
                'application/pdf': '.pdf',
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/tiff': '.tiff',
                'text/plain': '.txt',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                'application/msword': '.doc',
            }
            extension = mime_to_ext.get(file_type, '')

            # Get filename with appropriate fallback
            file_name = doc_info.get('original_file_name') or doc_info.get('title') or f'document_{link_request.paperless_document_id}{extension}'

            # Get file size from Paperless metadata if available
            file_size = doc_info.get('archive_size') or doc_info.get('size')

            # Create placeholder file_path
            file_path = f"paperless://document/{link_request.paperless_document_id}"

            # Create EntityFile record (no local file - exists only in Paperless)
            entity_file = EntityFile(
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file_name,
                file_path=file_path,  # Placeholder path
                file_type=file_type,
                file_size=file_size,  # File size from Paperless metadata
                description=link_request.description or f"Linked from Paperless (ID: {link_request.paperless_document_id})",
                category=link_request.category,
                storage_backend='paperless',
                paperless_document_id=link_request.paperless_document_id,
                sync_status='synced',  # Already in Paperless
                uploaded_at=get_utc_now(),
                created_at=get_utc_now(),
                updated_at=get_utc_now(),
            )

            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)

            # Log the creation activity
            try:
                log_create(
                    db=db,
                    entity_type=ActivityEntityType.ENTITY_FILE,
                    entity_obj=entity_file,
                    user_id=current_user_id,
                )
            except Exception as log_error:
                # Don't fail the request if logging fails
                logger.error(f"Failed to log file link: {log_error}", extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "logging_failure",
                    LogFields.ERROR: str(log_error)
                })

            log_data_access(
                logger,
                request,
                current_user_id,
                "create",
                "EntityFile",
                record_id=entity_file.id,
                entity_type=entity_type,
                entity_id=entity_id,
                paperless_document_id=link_request.paperless_document_id,
                link_type="existing_document"
            )

            return EntityFileResponse.from_orm(entity_file)

    except (HTTPException, NotFoundException, MedicalRecordsAPIException):
        raise

    except NewPaperlessConnectionError as e:
        log_endpoint_error(
            logger,
            request,
            "Paperless connection error during link",
            e,
            user_id=current_user_id,
            entity_type=entity_type,
            paperless_document_id=link_request.paperless_document_id
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to connect to Paperless: {str(e)}"
        )

    except PaperlessClientError as e:
        log_endpoint_error(
            logger,
            request,
            "Paperless client error during link",
            e,
            user_id=current_user_id,
            entity_type=entity_type,
            paperless_document_id=link_request.paperless_document_id
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Paperless error: {str(e)}"
        )

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Unexpected error linking Paperless document",
            e,
            user_id=current_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            paperless_document_id=link_request.paperless_document_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to link document: {str(e)}",
        )


@router.get("/files/{file_id}/download")
async def download_file(
    *,
    request: Request,
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
            log_debug(
                logger,
                "Processing Paperless download",
                original_file_name=filename,
                corrected_file_name=corrected_filename,
                content_size=len(file_info),
                file_id=file_id
            )

            # Paperless file - return as StreamingResponse with proper binary handling
            from fastapi.responses import Response
            import mimetypes

            # Ensure proper content type - use corrected filename for guessing
            if not content_type or content_type == 'application/octet-stream':
                # Try to guess content type from corrected filename
                guessed_type, _ = mimetypes.guess_type(corrected_filename)
                if guessed_type:
                    content_type = guessed_type
                    log_debug(
                        logger,
                        "Guessed content type from filename",
                        file_name=corrected_filename,
                        content_type=content_type,
                        file_id=file_id
                    )

            # Override content type for PDF files to ensure proper handling
            if corrected_filename.endswith('.pdf'):
                content_type = 'application/pdf'
                log_debug(
                    logger,
                    "Forced content type for PDF file",
                    file_id=file_id,
                    file_name=corrected_filename
                )

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
    request: Request,
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
        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "file_view_requested",
            message=f"Viewing file {file_id}",
            file_id=file_id
        )

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
            log_debug(
                logger,
                "Processing Paperless file view",
                original_file_name=filename,
                corrected_file_name=corrected_filename,
                content_size=len(file_info),
                file_id=file_id
            )

            # Paperless file - return as StreamingResponse with proper binary handling
            from fastapi.responses import Response
            import mimetypes

            # Ensure proper content type - use corrected filename for guessing
            if not content_type or content_type == 'application/octet-stream':
                # Try to guess content type from corrected filename
                guessed_type, _ = mimetypes.guess_type(corrected_filename)
                if guessed_type:
                    content_type = guessed_type
                    log_debug(
                        logger,
                        "Guessed content type for view",
                        file_name=corrected_filename,
                        content_type=content_type,
                        file_id=file_id
                    )

            # Override content type for PDF files to ensure proper handling
            if corrected_filename.endswith('.pdf'):
                content_type = 'application/pdf'
                log_debug(
                    logger,
                    "Forced content type for PDF view",
                    file_id=file_id,
                    file_name=corrected_filename
                )

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
        log_endpoint_error(
            logger,
            request,
            f"Failed to view file {file_id}",
            e,
            user_id=current_user_id,
            file_id=file_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to view file: {str(e)}",
        )


@router.delete("/files/{file_id}", response_model=FileOperationResult)
async def delete_file(
    *,
    request: Request,
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
            logger.error(f"Failed to log file deletion: {log_error}", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "logging_failure",
                LogFields.ERROR: str(log_error)
            })

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
    request: Request,
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
            logger.error(f"Failed to log file update: {log_error}", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "logging_failure",
                LogFields.ERROR: str(log_error)
            })

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
    request: Request,
    db: Session = Depends(deps.get_db),
    batch_request: FileBatchCountRequest,
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
        entity_type = batch_request.entity_type.value
        authorized_entity_ids = []
        skipped_count = 0
        not_found_count = 0

        log_debug(
            logger,
            f"Processing batch file count request for {len(batch_request.entity_ids)} entities",
            user_id=current_user.id,
            entity_type=entity_type,
            requested_count=len(batch_request.entity_ids)
        )

        for entity_id in batch_request.entity_ids:
            try:
                parent_entity = get_entity_by_type_and_id(db, entity_type, entity_id)
                if parent_entity:
                    # Verify user has access to the patient that owns this entity
                    entity_patient_id = getattr(parent_entity, "patient_id", None)
                    if entity_patient_id:
                        deps.verify_patient_access(entity_patient_id, db, current_user)
                    
                    authorized_entity_ids.append(entity_id)
                    log_debug(
                        logger,
                        f"User {current_user.id} authorized for {entity_type} {entity_id}",
                        user_id=current_user.id,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        patient_id=entity_patient_id
                    )
                else:
                    not_found_count += 1
                    log_debug(
                        logger,
                        f"Entity not found during batch count: {entity_type} {entity_id}",
                        user_id=current_user.id,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        reason="not_found"
                    )
            except (HTTPException, NotFoundException, MedicalRecordsAPIException) as e:
                # Log when entities are skipped due to authorization
                skipped_count += 1
                log_debug(
                    logger,
                    f"User {current_user.id} not authorized for {entity_type} {entity_id}",
                    user_id=current_user.id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    reason="access_denied",
                    error=str(e)
                )
                continue

        # Get file counts from service for authorized entities only
        file_counts = file_service.get_files_count_batch(
            db=db, entity_type=entity_type, entity_ids=authorized_entity_ids
        )

        # Log summary of batch processing
        log_endpoint_access(
            logger,
            request,
            current_user.id,
            "batch_file_count_completed",
            message=f"Batch file count completed for user {current_user.id}",
            entity_type=entity_type,
            requested_count=len(batch_request.entity_ids),
            authorized_count=len(authorized_entity_ids),
            skipped_count=skipped_count,
            not_found_count=not_found_count
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
    request: Request,
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
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Dict[int, bool]:
    """
    Check sync status for all Paperless documents.

    Returns:
        Dictionary mapping file_id to existence status (True = exists, False = missing)
    """
    log_endpoint_access(
        logger,
        request,
        current_user_id,
        "paperless_sync_check_started",
        message=f"Starting paperless sync check for user {current_user_id}"
    )
    try:
        sync_status = await file_service.check_paperless_sync_status(db, current_user_id)

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "paperless_sync_check_completed",
            message=f"Checked paperless sync status for user {current_user_id}",
            files_checked=len(sync_status)
        )

        return sync_status

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to check paperless sync status",
            e,
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check paperless sync status: {str(e)}",
        )


@router.post("/processing/update")
async def update_processing_files(
    *,
    request: Request,
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

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "processing_files_updated",
            message=f"Updated processing files for user {current_user_id}",
            files_updated=len(status_updates)
        )

        return status_updates

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to update processing files",
            e,
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update processing files: {str(e)}",
        )


@router.post("/{entity_type}/{entity_id}/cleanup")
async def cleanup_entity_files_on_deletion(
    *,
    request: Request,
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
        log_debug(
            logger,
            "Starting entity file cleanup",
            entity_type=entity_type,
            entity_id=entity_id,
            preserve_paperless=preserve_paperless,
            user_id=current_user_id
        )

        cleanup_stats = file_service.cleanup_entity_files_on_deletion(
            db=db,
            entity_type=entity_type,
            entity_id=entity_id,
            preserve_paperless=preserve_paperless
        )

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "entity_file_cleanup_completed",
            message="Entity file cleanup completed",
            entity_type=entity_type,
            entity_id=entity_id,
            files_deleted=cleanup_stats.get("files_deleted", 0),
            paperless_preserved=cleanup_stats.get("paperless_preserved", 0)
        )

        return cleanup_stats

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to cleanup entity files",
            e,
            user_id=current_user_id,
            entity_type=entity_type,
            entity_id=entity_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup entity files: {str(e)}",
        )
