# filepath: e:\Software\Projects\Medical Records-V2\app\api\v1\endpoints\lab_result_file.py
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.core.logging_config import get_logger
from app.core.logging_helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_security_event,
    log_data_access,
    log_validation_error
)
from app.core.logging_constants import LogFields
from app.crud.lab_result import lab_result
from app.crud.lab_result_file import lab_result_file
from app.models.activity_log import EntityType
from app.models.models import LabResultFile, User
from app.schemas.lab_result_file import (
    FileBatchOperation,
    LabResultFileCreate,
    LabResultFileResponse,
    LabResultFileUpdate,
)

logger = get_logger(__name__)
router = APIRouter()

# Configuration
UPLOAD_DIRECTORY = "uploads/lab_result_files"
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".tiff",
    ".bmp",
    ".gif",
    ".txt",
    ".csv",
    ".xml",
    ".json",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".dcm",
}


@router.post(
    "/", response_model=LabResultFileResponse, status_code=status.HTTP_201_CREATED
)
def create_lab_result_file(
    *,
    db: Session = Depends(deps.get_db),
    file_in: LabResultFileCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> LabResultFile:
    """
    Create a new lab result file entry.
    """
    # Verify lab result exists and user has access
    lab_result_obj = lab_result.get(db=db, id=file_in.lab_result_id)
    if not lab_result_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result not found"
        )

    # Check if user has access to this lab result (assuming patient ownership or admin)
    # This would need to be implemented based on your user model and permissions    # Create the file entry
    file_obj = lab_result_file.create(db=db, obj_in=file_in)

    # Log the creation activity using centralized logging
    log_create(
        db=db,
        entity_type=EntityType.LAB_RESULT_FILE,
        entity_obj=file_obj,
        user_id=current_user_id,
    )

    return file_obj


@router.post(
    "/upload/{lab_result_id}",
    response_model=LabResultFileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    *,
    db: Session = Depends(deps.get_db),
    lab_result_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    current_user_id: int = Depends(deps.get_current_user_id),
    request: Request
) -> LabResultFile:
    """
    Upload a file and create a lab result file entry.
    """
    log_endpoint_access(
        logger,
        request,
        current_user_id,
        "lab_result_file_upload_started",
        message=f"Starting file upload for lab result {lab_result_id}",
        lab_result_id=lab_result_id,
        filename=file.filename
    )

    # Verify lab result exists
    lab_result_obj = lab_result.get(db=db, id=lab_result_id)
    if not lab_result_obj:
        log_validation_error(
            logger,
            request,
            f"Lab result {lab_result_id} not found",
            user_id=current_user_id,
            lab_result_id=lab_result_id
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result not found"
        )

    # Validate file
    if not file.filename:
        log_validation_error(
            logger,
            request,
            "No filename provided",
            user_id=current_user_id,
            lab_result_id=lab_result_id
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided"
        )

    # Check file extension
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        log_validation_error(
            logger,
            request,
            f"Invalid file extension: {file_extension}",
            user_id=current_user_id,
            lab_result_id=lab_result_id,
            file_extension=file_extension
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Check file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        log_validation_error(
            logger,
            request,
            f"File too large: {len(file_content)} bytes",
            user_id=current_user_id,
            lab_result_id=lab_result_id,
            file_size=len(file_content),
            max_size=MAX_FILE_SIZE
        )
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    # Create upload directory if it doesn't exist
    os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        logger.info(
            f"File saved successfully: {unique_filename}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "file_saved",
                LogFields.USER_ID: current_user_id,
                LogFields.FILE: file_path,
                "lab_result_id": lab_result_id,
                "file_size": len(file_content),
                "filename": file.filename
            }
        )
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            f"Error saving file: {file.filename}",
            e,
            user_id=current_user_id,
            lab_result_id=lab_result_id,
            file_path=file_path
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving file: {str(e)}",
        )

    # Create file entry in database
    from datetime import datetime

    file_create = LabResultFileCreate(
        lab_result_id=lab_result_id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file.content_type,
        file_size=len(file_content),
        description=description,
        uploaded_at=datetime.utcnow(),
    )

    file_obj = lab_result_file.create(db=db, obj_in=file_create)

    # Log the upload activity using centralized logging
    log_create(
        db=db,
        entity_type=EntityType.LAB_RESULT_FILE,
        entity_obj=file_obj,
        user_id=current_user_id,
    )

    log_endpoint_access(
        logger,
        request,
        current_user_id,
        "lab_result_file_uploaded",
        message=f"File uploaded successfully: {file.filename}",
        lab_result_id=lab_result_id,
        file_id=file_obj.id,
        file_size=len(file_content)
    )

    return file_obj


@router.get("/", response_model=List[LabResultFileResponse])
def read_lab_result_files(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> List[LabResultFile]:
    """
    Retrieve lab result files.
    """
    files = lab_result_file.get_multi(db, skip=skip, limit=limit)
    return files


@router.get("/lab-result/{lab_result_id}", response_model=List[LabResultFileResponse])
def read_files_by_lab_result(
    *,
    db: Session = Depends(deps.get_db),
    lab_result_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> List[LabResultFile]:
    """
    Get all files for a specific lab result.
    """
    # Verify lab result exists
    lab_result_obj = lab_result.get(db=db, id=lab_result_id)
    if not lab_result_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result not found"
        )

    files = lab_result_file.get_by_lab_result(db=db, lab_result_id=lab_result_id)
    return files


@router.get("/patient/{patient_id}", response_model=List[LabResultFileResponse])
def read_files_by_patient(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = 100,
) -> List[LabResultFile]:
    """
    Get all files for a specific patient.
    """
    files = lab_result_file.get_files_by_patient(
        db=db, patient_id=patient_id, skip=skip, limit=limit
    )
    return files


@router.get("/{file_id}", response_model=LabResultFileResponse)
def read_lab_result_file(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> LabResultFile:
    """
    Get a specific lab result file by ID.
    """
    file_obj = lab_result_file.get(db=db, id=file_id)
    if not file_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result file not found"
        )
    return file_obj


@router.put("/{file_id}", response_model=LabResultFileResponse)
def update_lab_result_file(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    file_in: LabResultFileUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> LabResultFile:
    """
    Update a lab result file.
    """
    file_obj = lab_result_file.get(db=db, id=file_id)
    if not file_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result file not found"
        )

    file_obj = lab_result_file.update(db=db, db_obj=file_obj, obj_in=file_in)

    # Log the update activity using centralized logging
    log_update(
        db=db,
        entity_type=EntityType.LAB_RESULT_FILE,
        entity_obj=file_obj,
        user_id=current_user_id,
    )

    return file_obj


@router.delete("/{file_id}")
def delete_lab_result_file(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
    request: Request
):
    """
    Delete a lab result file.
    """
    file_obj = lab_result_file.get(db=db, id=file_id)
    if not file_obj:
        log_validation_error(
            logger,
            request,
            f"Lab result file {file_id} not found",
            user_id=current_user_id,
            file_id=file_id
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result file not found"
        )

    # Log the deletion activity BEFORE deleting using centralized logging
    log_delete(
        db=db,
        entity_type=EntityType.LAB_RESULT_FILE,
        entity_obj=file_obj,
        user_id=current_user_id,
    )

    # Delete physical file
    try:
        file_path = getattr(file_obj, "file_path", None)
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info(
                f"Physical file deleted: {file_path}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "physical_file_deleted",
                    LogFields.USER_ID: current_user_id,
                    LogFields.FILE: file_path,
                    "file_id": file_id
                }
            )
    except Exception as e:
        # Log error but continue with database deletion
        logger.error(
            f"Error deleting physical file: {file_path}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "file_deletion_error",
                LogFields.USER_ID: current_user_id,
                LogFields.ERROR: str(e),
                LogFields.FILE: file_path,
                "file_id": file_id
            }
        )

    # Delete from database
    lab_result_file.delete(db=db, id=file_id)

    log_endpoint_access(
        logger,
        request,
        current_user_id,
        "lab_result_file_deleted",
        message=f"Lab result file {file_id} deleted successfully",
        file_id=file_id
    )

    return {"message": "Lab result file deleted successfully"}


@router.get("/{file_id}/download")
async def download_file(
    *,
    db: Session = Depends(deps.get_db),
    file_id: int,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Download a lab result file.
    """
    file_obj = lab_result_file.get(db=db, id=file_id)
    if not file_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result file not found"
        )

    if not os.path.exists(getattr(file_obj, "file_path", "")):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Physical file not found"
        )

    return FileResponse(
        path=getattr(file_obj, "file_path", ""),
        filename=getattr(file_obj, "file_name", "file"),
        media_type=getattr(file_obj, "file_type", None) or "application/octet-stream",
    )


@router.get("/search/by-filename", response_model=List[LabResultFileResponse])
def search_files_by_filename(
    *,
    db: Session = Depends(deps.get_db),
    filename_pattern: str,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> List[LabResultFile]:
    """
    Search files by filename pattern.
    """
    files = lab_result_file.search_by_filename_pattern(
        db=db, filename_pattern=filename_pattern, skip=skip, limit=limit
    )
    return files


@router.get("/filter/by-type", response_model=List[LabResultFileResponse])
def get_files_by_type(
    *,
    db: Session = Depends(deps.get_db),
    file_type: str,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> List[LabResultFile]:
    """
    Get files by file type.
    """
    files = lab_result_file.get_by_file_type(
        db=db, file_type=file_type, skip=skip, limit=limit
    )
    return files


@router.get("/filter/recent", response_model=List[LabResultFileResponse])
def get_recent_files(
    *,
    db: Session = Depends(deps.get_db),
    days: int = 7,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> List[LabResultFile]:
    """
    Get recently uploaded files.
    """
    files = lab_result_file.get_recent_files(db=db, days=days, skip=skip, limit=limit)
    return files


@router.get("/filter/date-range", response_model=List[LabResultFileResponse])
def get_files_by_date_range(
    *,
    db: Session = Depends(deps.get_db),
    start_date: datetime,
    end_date: datetime,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> List[LabResultFile]:
    """
    Get files uploaded within a date range.
    """
    files = lab_result_file.get_files_by_date_range(
        db=db, start_date=start_date, end_date=end_date, skip=skip, limit=limit
    )
    return files


@router.get("/stats/count-by-lab-result/{lab_result_id}")
def get_file_count_by_lab_result(
    *,
    db: Session = Depends(deps.get_db),
    lab_result_id: int,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get count of files for a specific lab result.
    """
    # Verify lab result exists
    lab_result_obj = lab_result.get(db=db, id=lab_result_id)
    if not lab_result_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result not found"
        )

    count = lab_result_file.count_files_by_lab_result(
        db=db, lab_result_id=lab_result_id
    )
    return {"lab_result_id": lab_result_id, "file_count": count}


@router.post("/stats/batch-counts")
def get_batch_file_counts(
    *,
    db: Session = Depends(deps.get_db),
    lab_result_ids: List[int],
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get file counts for multiple lab results in a single request.
    This is much more efficient than making N separate requests.

    Returns a dictionary mapping lab_result_id to file_count.
    """
    if not lab_result_ids:
        return {}

    # Limit to prevent abuse
    if len(lab_result_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request counts for more than 100 lab results at once"
        )

    # Get counts for all lab results in a single query
    counts = lab_result_file.count_files_by_lab_results_batch(
        db=db, lab_result_ids=lab_result_ids
    )

    return counts


@router.post("/batch-operation")
def batch_file_operation(
    *,
    db: Session = Depends(deps.get_db),
    operation: FileBatchOperation,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Perform batch operations on multiple files.
    """
    results = []
    errors = []

    for file_id in operation.file_ids:
        try:
            file_obj = lab_result_file.get(db=db, id=file_id)
            if not file_obj:
                errors.append(f"File {file_id} not found")
                continue

            if operation.operation == "delete":
                # Delete physical file
                try:
                    file_path = getattr(file_obj, "file_path", None)
                    if file_path and os.path.exists(file_path):
                        os.remove(file_path)
                except Exception as e:
                    errors.append(f"Error deleting physical file {file_id}: {str(e)}")

                # Delete from database
                lab_result_file.delete(db=db, id=file_id)
                results.append(f"File {file_id} deleted successfully")

            elif operation.operation in ["move", "copy"]:
                # These operations would require more complex implementation
                # For now, just return not implemented
                errors.append(
                    f"Operation '{operation.operation}' not yet implemented for file {file_id}"
                )

        except Exception as e:
            errors.append(f"Error processing file {file_id}: {str(e)}")

    return {
        "operation": operation.operation,
        "processed_files": len(results),
        "results": results,
        "errors": errors,
    }


@router.delete("/lab-result/{lab_result_id}/files")
def delete_all_files_for_lab_result(
    *,
    db: Session = Depends(deps.get_db),
    lab_result_id: int,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete all files associated with a lab result.
    """
    # Verify lab result exists
    lab_result_obj = lab_result.get(db=db, id=lab_result_id)
    if not lab_result_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lab result not found"
        )

    # Get all files for this lab result
    files = lab_result_file.get_by_lab_result(db=db, lab_result_id=lab_result_id)

    # Delete physical files
    deleted_files = 0
    errors = []

    for file_obj in files:
        try:
            file_path = getattr(file_obj, "file_path", None)
            file_name = getattr(file_obj, "file_name", "unknown")
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                deleted_files += 1
        except Exception as e:
            file_name = getattr(file_obj, "file_name", "unknown")
            errors.append(f"Error deleting file {file_name}: {str(e)}")

    # Delete from database
    deleted_count = lab_result_file.delete_by_lab_result(
        db=db, lab_result_id=lab_result_id
    )

    return {
        "message": f"Deleted {deleted_count} file records and {deleted_files} physical files",
        "lab_result_id": lab_result_id,
        "deleted_records": deleted_count,
        "deleted_physical_files": deleted_files,
        "errors": errors,
    }


# Health check endpoint for file system
@router.get("/health/storage")
def check_storage_health(current_user: User = Depends(deps.get_current_user)):
    """
    Check storage system health.
    """
    try:
        # Check if upload directory exists and is writable
        os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

        # Check available disk space
        import shutil

        total, used, free = shutil.disk_usage(UPLOAD_DIRECTORY)

        # Test write permissions
        test_file = os.path.join(UPLOAD_DIRECTORY, "health_check.tmp")
        try:
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            write_permission = True
        except Exception:
            write_permission = False

        return {
            "status": "healthy" if write_permission else "unhealthy",
            "upload_directory": UPLOAD_DIRECTORY,
            "write_permission": write_permission,
            "disk_space": {
                "total_gb": round(total / (1024**3), 2),
                "used_gb": round(used / (1024**3), 2),
                "free_gb": round(free / (1024**3), 2),
                "usage_percent": round((used / total) * 100, 1),
            },
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}
