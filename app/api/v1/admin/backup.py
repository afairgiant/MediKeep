"""
Admin Backup API Endpoints

Provides admin-only endpoints for backup and restore operations.
Phase 1 implementation: Basic manual backup functionality.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_db
from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.models import User
from app.services.backup_service import BackupService

logger = get_logger(__name__, "app")

router = APIRouter()


class BackupCreateRequest(BaseModel):
    description: Optional[str] = None


class BackupResponse(BaseModel):
    id: int
    backup_type: str
    filename: str
    size_bytes: int
    status: str
    created_at: str
    description: Optional[str]


class RetentionSettingsResponse(BaseModel):
    backup_retention_days: int
    trash_retention_days: int
    backup_min_count: int
    backup_max_count: int


class RetentionSettingsUpdate(BaseModel):
    backup_retention_days: Optional[int] = None
    trash_retention_days: Optional[int] = None
    backup_min_count: Optional[int] = None
    backup_max_count: Optional[int] = None


@router.post("/create-database", response_model=BackupResponse)
async def create_database_backup(
    request: BackupCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a database backup.

    Only admin users can create backups.
    """
    try:
        backup_service = BackupService(db)
        backup_result = await backup_service.create_database_backup(
            description=request.description
        )

        logger.info(
            f"Database backup created by admin user {current_user.id}: {backup_result['filename']}"
        )

        return BackupResponse(
            id=backup_result["id"],
            backup_type=backup_result["backup_type"],
            filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
            status=backup_result["status"],
            created_at=backup_result["created_at"],
            description=request.description,
        )

    except Exception as e:
        logger.error(f"Failed to create database backup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create database backup: {str(e)}",
        )


@router.post("/create-files", response_model=BackupResponse)
async def create_files_backup(
    request: BackupCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a files backup.

    Only admin users can create backups.
    """
    try:
        backup_service = BackupService(db)
        backup_result = await backup_service.create_files_backup(
            description=request.description
        )

        logger.info(
            f"Files backup created by admin user {current_user.id}: {backup_result['filename']}"
        )

        return BackupResponse(
            id=backup_result["id"],
            backup_type=backup_result["backup_type"],
            filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
            status=backup_result["status"],
            created_at=backup_result["created_at"],
            description=request.description,
        )

    except Exception as e:
        logger.error(f"Failed to create files backup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create files backup: {str(e)}",
        )


@router.post("/create-full", response_model=BackupResponse)
async def create_full_backup(
    request: BackupCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a full system backup (database + files).

    Only admin users can create backups.
    """
    try:
        backup_service = BackupService(db)
        backup_result = await backup_service.create_full_backup(
            description=request.description
        )

        logger.info(
            f"Full backup created by admin user {current_user.id}: {backup_result['filename']}"
        )

        return BackupResponse(
            id=backup_result["id"],
            backup_type=backup_result["backup_type"],
            filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
            status=backup_result["status"],
            created_at=backup_result["created_at"],
            description=request.description,
        )

    except Exception as e:
        logger.error(f"Failed to create full backup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create full backup: {str(e)}",
        )


@router.get("/")
async def list_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    List all backup records.

    Only admin users can view backups.
    """
    try:
        backup_service = BackupService(db)
        backups = await backup_service.list_backups()

        return {"backups": backups, "total": len(backups)}

    except Exception as e:
        logger.error(f"Failed to list backups: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list backups: {str(e)}",
        )


@router.get("/{backup_id}/download")
async def download_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Download a backup file.

    Only admin users can download backups.
    """
    try:
        backup_service = BackupService(db)
        backups = await backup_service.list_backups()

        # Find the backup record
        backup = None
        for b in backups:
            if b["id"] == backup_id:
                backup = b
                break

        if not backup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found"
            )

        if not backup["file_exists"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backup file does not exist",
            )

        logger.info(f"Backup {backup_id} downloaded by admin user {current_user.id}")

        return FileResponse(
            path=backup["file_path"],
            filename=backup["filename"],
            media_type="application/octet-stream",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download backup {backup_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download backup: {str(e)}",
        )


@router.post("/{backup_id}/verify")
async def verify_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Verify the integrity of a backup.

    Only admin users can verify backups.
    """
    try:
        backup_service = BackupService(db)
        verification_result = await backup_service.verify_backup(backup_id)

        logger.info(
            f"Backup {backup_id} verification requested by admin user {current_user.id}"
        )

        return verification_result

    except Exception as e:
        logger.error(f"Failed to verify backup {backup_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while verifying the backup.",
        )


@router.delete("/{backup_id}")
async def delete_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete a backup record and its associated file.

    Only admin users can delete backups.
    """
    try:
        backup_service = BackupService(db)
        deletion_result = await backup_service.delete_backup(backup_id)

        logger.info(f"Backup {backup_id} deleted by admin user {current_user.id}")

        return deletion_result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete backup {backup_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete backup: {str(e)}",
        )


@router.post("/cleanup")
async def cleanup_old_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Clean up old backups based on retention policy.

    Only admin users can trigger cleanup.
    """
    try:
        backup_service = BackupService(db)
        cleanup_result = await backup_service.cleanup_old_backups()

        logger.info(f"Backup cleanup triggered by admin user {current_user.id}")

        return cleanup_result

    except Exception as e:
        logger.error(f"Failed to cleanup backups: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup backups: {str(e)}",
        )


@router.post("/cleanup-orphaned")
async def cleanup_orphaned_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Clean up orphaned backup files (files that exist but aren't tracked in database).

    Only admin users can trigger cleanup.
    """
    try:
        backup_service = BackupService(db)
        cleanup_result = await backup_service.cleanup_orphaned_files()

        logger.info(f"Orphaned file cleanup triggered by admin user {current_user.id}")

        return cleanup_result

    except Exception as e:
        logger.error(f"Failed to cleanup orphaned files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup orphaned files: {str(e)}",
        )


@router.post("/cleanup-all")
async def cleanup_all_old_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Clean up old backups, orphaned files, and old trash files.

    Only admin users can trigger cleanup.
    """
    try:
        backup_service = BackupService(db)
        cleanup_result = await backup_service.cleanup_all_old_data()

        logger.info(f"Complete cleanup triggered by admin user {current_user.id}")

        return cleanup_result

    except Exception as e:
        logger.error(f"Failed to cleanup old data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup old data: {str(e)}",
        )


@router.get("/settings/retention", response_model=RetentionSettingsResponse)
async def get_retention_settings(
    current_user: User = Depends(get_current_admin_user),
) -> RetentionSettingsResponse:
    """Get current retention settings for backups and trash."""
    return RetentionSettingsResponse(
        backup_retention_days=settings.BACKUP_RETENTION_DAYS,
        trash_retention_days=settings.TRASH_RETENTION_DAYS,
        backup_min_count=settings.BACKUP_MIN_COUNT,
        backup_max_count=settings.BACKUP_MAX_COUNT,
    )


@router.post("/settings/retention")
async def update_retention_settings(
    settings_update: RetentionSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
):
    """Update retention settings for backups and trash."""
    try:
        updated_settings = {}

        if settings_update.backup_retention_days is not None:
            if settings_update.backup_retention_days < 1:
                raise HTTPException(
                    status_code=400, detail="Backup retention days must be at least 1"
                )
            settings.BACKUP_RETENTION_DAYS = settings_update.backup_retention_days
            updated_settings["backup_retention_days"] = (
                settings_update.backup_retention_days
            )

        if settings_update.trash_retention_days is not None:
            if settings_update.trash_retention_days < 1:
                raise HTTPException(
                    status_code=400, detail="Trash retention days must be at least 1"
                )
            settings.TRASH_RETENTION_DAYS = settings_update.trash_retention_days
            updated_settings["trash_retention_days"] = (
                settings_update.trash_retention_days
            )

        if settings_update.backup_min_count is not None:
            if settings_update.backup_min_count < 1:
                raise HTTPException(
                    status_code=400, detail="Minimum backup count must be at least 1"
                )
            # Validate that min count is not greater than max count
            current_max = (
                settings_update.backup_max_count
                if settings_update.backup_max_count is not None
                else settings.BACKUP_MAX_COUNT
            )
            if settings_update.backup_min_count > current_max:
                raise HTTPException(
                    status_code=400,
                    detail="Minimum backup count must be less than or equal to maximum backup count",
                )
            settings.BACKUP_MIN_COUNT = settings_update.backup_min_count
            updated_settings["backup_min_count"] = settings_update.backup_min_count

        if settings_update.backup_max_count is not None:
            if settings_update.backup_max_count < 1:
                raise HTTPException(
                    status_code=400, detail="Maximum backup count must be at least 1"
                )
            # Validate that max count is greater than or equal to min count
            current_min = (
                settings_update.backup_min_count
                if settings_update.backup_min_count is not None
                else settings.BACKUP_MIN_COUNT
            )
            if settings_update.backup_max_count < current_min:
                raise HTTPException(
                    status_code=400,
                    detail="Maximum backup count must be greater than or equal to minimum backup count",
                )
            settings.BACKUP_MAX_COUNT = settings_update.backup_max_count
            updated_settings["backup_max_count"] = settings_update.backup_max_count

        logger.info(
            f"Admin {current_user.username} updated retention settings: {updated_settings}"
        )

        return {
            "message": "Retention settings updated successfully",
            "updated_settings": updated_settings,
            "current_settings": {
                "backup_retention_days": settings.BACKUP_RETENTION_DAYS,
                "trash_retention_days": settings.TRASH_RETENTION_DAYS,
                "backup_min_count": settings.BACKUP_MIN_COUNT,
                "backup_max_count": settings.BACKUP_MAX_COUNT,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update retention settings: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update retention settings: {str(e)}"
        )


@router.get("/retention/stats")
async def get_retention_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get current backup retention statistics and cleanup preview."""
    try:
        backup_service = BackupService(db)
        stats = await backup_service.get_retention_stats()

        return {
            "message": "Retention statistics retrieved successfully",
            "stats": stats,
        }

    except Exception as e:
        logger.error(f"Failed to get retention stats: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get retention stats: {str(e)}"
        )
