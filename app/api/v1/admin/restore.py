"""
Admin Restore API Endpoints

Provides admin-only endpoints for restore operations.
Phase 2 implementation: Basic restore functionality with safety checks.
"""

import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_db
from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.models import User
from app.services.restore_service import RestoreService

logger = get_logger(__name__, "app")

router = APIRouter()


class RestorePreviewResponse(BaseModel):
    backup_id: int
    backup_type: str
    backup_created: str
    backup_size: int
    backup_description: Optional[str]
    warnings: list
    affected_data: dict


class RestoreExecuteRequest(BaseModel):
    confirmation_token: str


class RestoreExecuteResponse(BaseModel):
    success: bool
    message: str
    backup_id: int
    backup_type: str
    safety_backup_id: int
    restore_completed: str
    warnings: Optional[str] = None


class UploadBackupResponse(BaseModel):
    success: bool
    message: str
    backup_id: int
    backup_type: str
    backup_size: int
    backup_description: str


@router.post("/upload", response_model=UploadBackupResponse)
async def upload_backup_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
) -> UploadBackupResponse:
    """
    Upload an external backup file for restore.
    Supports .sql (database), .zip (files or full backup) files.
    """
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # Validate file type
        filename = file.filename.lower()
        if not (filename.endswith(".sql") or filename.endswith(".zip")):
            raise HTTPException(
                status_code=400, detail="Only .sql and .zip backup files are supported"
            )

        # Create temporary file to store upload
        temp_dir = Path(tempfile.mkdtemp(prefix="backup_upload_"))
        temp_file = temp_dir / file.filename

        try:
            # Save uploaded file
            with open(temp_file, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Process the uploaded backup
            restore_service = RestoreService(db)
            backup_record = await restore_service.process_uploaded_backup(
                temp_file, current_user.username
            )

            logger.info(
                f"Admin {current_user.username} uploaded backup file: {file.filename}"
            )

            return UploadBackupResponse(
                success=True,
                message=f"Backup file '{file.filename}' uploaded successfully",
                backup_id=backup_record.id,
                backup_type=backup_record.backup_type,
                backup_size=backup_record.size_bytes,
                backup_description=backup_record.description or "Uploaded backup",
            )

        finally:
            # Clean up temporary directory
            if temp_dir.exists():
                shutil.rmtree(temp_dir)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload backup file: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to upload backup file: {str(e)}"
        )


@router.post("/preview/{backup_id}", response_model=RestorePreviewResponse)
async def preview_restore(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
) -> RestorePreviewResponse:
    """
    Preview what will be affected by a restore operation.
    """
    try:
        restore_service = RestoreService(db)
        preview_data = await restore_service.preview_restore(backup_id)

        logger.info(
            f"Admin {current_user.username} previewed restore for backup {backup_id}"
        )

        return RestorePreviewResponse(**preview_data)

    except ValueError as e:
        logger.warning(f"Invalid restore preview request: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to preview restore: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to preview restore: {str(e)}"
        )


@router.post("/execute/{backup_id}", response_model=RestoreExecuteResponse)
async def execute_restore(
    backup_id: int,
    request: RestoreExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
) -> RestoreExecuteResponse:
    """
    Execute a restore operation with safety checks.
    Requires a valid confirmation token.
    """
    try:
        # Extract user info before restore to prevent session issues
        username = current_user.username

        restore_service = RestoreService(db)
        result = await restore_service.execute_restore(
            backup_id, request.confirmation_token
        )

        logger.info(f"Admin {username} executed restore for backup {backup_id}")

        return RestoreExecuteResponse(**result)

    except ValueError as e:
        logger.warning(f"Invalid restore request: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to execute restore: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to execute restore: {str(e)}"
        )


@router.get("/confirmation-token/{backup_id}")
async def get_confirmation_token(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
) -> dict:
    """
    Generate a confirmation token for restore operation.
    This adds an extra security step for dangerous operations.
    """
    try:
        restore_service = RestoreService(db)
        token = restore_service.generate_confirmation_token(backup_id)

        logger.info(
            f"Admin {current_user.username} requested confirmation token for backup {backup_id}"
        )

        return {
            "backup_id": backup_id,
            "confirmation_token": token,
            "expires_at": "End of day (UTC)",
            "warning": "This token allows irreversible restore operations. Use with caution.",
        }

    except Exception as e:
        logger.error(f"Failed to generate confirmation token: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate confirmation token: {str(e)}"
        )
