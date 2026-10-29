"""
Admin Backup API Endpoints

Provides admin-only endpoints for backup and restore operations.
Phase 1 implementation: Basic manual backup functionality.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, PrivateAttr, StrictInt, model_validator
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_db
from app.api.v1.admin.csv_utils import stream_csv
from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_security_event,
)
from app.core.persisted_settings import (
    KEY_BACKUP_MIN_COUNT,
    KEY_BACKUP_RETENTION_DAYS,
    PERSISTED_SETTINGS,
)
from app.models.models import User
from app.services.backup_scheduler_service import clean_schedule
from app.services.backup_service import BackupService

_RETENTION_DAYS = PERSISTED_SETTINGS[KEY_BACKUP_RETENTION_DAYS]
_MIN_COUNT = PERSISTED_SETTINGS[KEY_BACKUP_MIN_COUNT]

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


class AutoBackupScheduleResponse(BaseModel):
    preset: str
    time_of_day: str
    interval_hours: int
    days_of_week: List[str]
    day_of_month: int
    enabled: bool
    last_run_at: Optional[str] = None
    last_run_status: Optional[str] = None
    last_run_error: Optional[str] = None
    next_run_at: Optional[str] = None
    upcoming_runs: List[str] = []
    timezone: str


class AutoBackupScheduleUpdate(BaseModel):
    preset: str
    time_of_day: Optional[str] = None
    # Strict so a JSON true or 5.0 is rejected rather than read as a number.
    interval_hours: Optional[StrictInt] = None
    days_of_week: Optional[List[str]] = None
    day_of_month: Optional[StrictInt] = None
    _cleaned: dict = PrivateAttr(default_factory=dict)

    @model_validator(mode="after")
    def validate_for_preset(self):
        # ScheduleValidationError is a ValueError, so it becomes a 422.
        self._cleaned = clean_schedule(
            self.preset,
            self.time_of_day,
            self.interval_hours,
            self.days_of_week,
            self.day_of_month,
        )
        return self

    def cleaned(self) -> dict:
        """The validated fields for this preset, as clean_schedule() returns them."""
        return self._cleaned


class AutoBackupSchedulePreviewRequest(AutoBackupScheduleUpdate):
    """A draft schedule plus draft retention settings; omitted settings use the saved ones."""

    backup_retention_days: Optional[int] = Field(
        None, ge=_RETENTION_DAYS.min_value, le=_RETENTION_DAYS.max_value
    )
    backup_min_count: Optional[int] = Field(
        None, ge=_MIN_COUNT.min_value, le=_MIN_COUNT.max_value
    )


class AutoBackupSchedulePreviewResponse(BaseModel):
    upcoming_runs: List[str]
    timezone: str
    latest_backup_size_bytes: Optional[int] = None
    retained_count: Optional[int] = None
    estimated_bytes: Optional[int] = None


@router.post("/create-database", response_model=BackupResponse)
async def create_database_backup(
    backup_request: BackupCreateRequest,
    request: Request,
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
            description=backup_request.description
        )

        log_security_event(
            logger,
            "database_backup_created",
            request,
            f"Database backup created: {backup_result['filename']}",
            user_id=current_user.id,
            backup_id=backup_result["id"],
            backup_filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
        )

        return BackupResponse(
            id=backup_result["id"],
            backup_type=backup_result["backup_type"],
            filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
            status=backup_result["status"],
            created_at=backup_result["created_at"],
            description=backup_request.description,
        )

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to create database backup",
            e,
            user_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create database backup: {str(e)}",
        )


@router.post("/create-files", response_model=BackupResponse)
async def create_files_backup(
    backup_request: BackupCreateRequest,
    request: Request,
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
            description=backup_request.description
        )

        log_security_event(
            logger,
            "files_backup_created",
            request,
            f"Files backup created: {backup_result['filename']}",
            user_id=current_user.id,
            backup_id=backup_result["id"],
            backup_filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
        )

        return BackupResponse(
            id=backup_result["id"],
            backup_type=backup_result["backup_type"],
            filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
            status=backup_result["status"],
            created_at=backup_result["created_at"],
            description=backup_request.description,
        )

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to create files backup", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create files backup: {str(e)}",
        )


@router.post("/create-full", response_model=BackupResponse)
async def create_full_backup(
    backup_request: BackupCreateRequest,
    request: Request,
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
            description=backup_request.description
        )

        log_security_event(
            logger,
            "full_backup_created",
            request,
            f"Full backup created: {backup_result['filename']}",
            user_id=current_user.id,
            backup_id=backup_result["id"],
            backup_filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
        )

        return BackupResponse(
            id=backup_result["id"],
            backup_type=backup_result["backup_type"],
            filename=backup_result["filename"],
            size_bytes=backup_result["size_bytes"],
            status=backup_result["status"],
            created_at=backup_result["created_at"],
            description=backup_request.description,
        )

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to create full backup", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create full backup: {str(e)}",
        )


@router.get("/")
async def list_backups(
    request: Request,
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
        log_endpoint_error(
            logger, request, "Failed to list backups", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list backups: {str(e)}",
        )


@router.get("/export")
async def export_backup_history(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Export backup history as CSV."""
    log_endpoint_access(logger, request, current_user.id, "backup_history_export")

    try:
        backup_service = BackupService(db)
        backups = await backup_service.list_backups()

        headers = [
            "ID",
            "Backup Type",
            "Status",
            "Filename",
            "Size (bytes)",
            "Created At",
            "Description",
            "File Exists",
        ]
        field_keys = [
            "id",
            "backup_type",
            "status",
            "filename",
            "size_bytes",
            "created_at",
            "description",
            "file_exists",
        ]

        rows = []
        for backup in backups:
            row = {}
            for header, key in zip(headers, field_keys):
                value = backup.get(key, "")
                if key == "file_exists":
                    value = "Yes" if value else "No"
                row[header] = value if value is not None else ""
            rows.append(row)

        return stream_csv(headers, rows, "backup_history_export.csv")

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to export backup history",
            e,
            user_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export backup history",
        )


@router.get("/{backup_id}/download")
async def download_backup(
    backup_id: int,
    request: Request,
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

        log_security_event(
            logger,
            "backup_downloaded",
            request,
            f"Backup downloaded: {backup['filename']}",
            user_id=current_user.id,
            backup_id=backup_id,
            backup_filename=backup["filename"],
        )

        return FileResponse(
            path=backup["file_path"],
            filename=backup["filename"],
            media_type="application/octet-stream",
        )

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            f"Failed to download backup {backup_id}",
            e,
            user_id=current_user.id,
            backup_id=backup_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download backup: {str(e)}",
        )


@router.post("/{backup_id}/verify")
async def verify_backup(
    backup_id: int,
    request: Request,
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

        log_security_event(
            logger,
            "backup_verified",
            request,
            f"Backup verification requested",
            user_id=current_user.id,
            backup_id=backup_id,
        )

        return verification_result

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            f"Failed to verify backup {backup_id}",
            e,
            user_id=current_user.id,
            backup_id=backup_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while verifying the backup.",
        )


@router.delete("/{backup_id}")
async def delete_backup(
    backup_id: int,
    request: Request,
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

        log_security_event(
            logger,
            "backup_deleted",
            request,
            f"Backup deleted",
            user_id=current_user.id,
            backup_id=backup_id,
        )

        return deletion_result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            f"Failed to delete backup {backup_id}",
            e,
            user_id=current_user.id,
            backup_id=backup_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete backup: {str(e)}",
        )


@router.post("/cleanup")
async def cleanup_old_backups(
    request: Request,
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

        log_security_event(
            logger,
            "backup_cleanup_triggered",
            request,
            "Backup cleanup triggered",
            user_id=current_user.id,
        )

        return cleanup_result

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to cleanup backups", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup backups: {str(e)}",
        )


@router.post("/cleanup-orphaned")
async def cleanup_orphaned_files(
    request: Request,
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

        log_security_event(
            logger,
            "orphaned_cleanup_triggered",
            request,
            "Orphaned file cleanup triggered",
            user_id=current_user.id,
        )

        return cleanup_result

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to cleanup orphaned files",
            e,
            user_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup orphaned files: {str(e)}",
        )


@router.post("/cleanup-all")
async def cleanup_all_old_data(
    request: Request,
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

        log_security_event(
            logger,
            "complete_cleanup_triggered",
            request,
            "Complete cleanup triggered",
            user_id=current_user.id,
        )

        return cleanup_result

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to cleanup old data", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup old data: {str(e)}",
        )


@router.get("/retention/stats")
async def get_retention_stats(
    request: Request,
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
        log_endpoint_error(
            logger, request, "Failed to get retention stats", e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to get retention stats: {str(e)}"
        )


@router.get("/settings/schedule", response_model=AutoBackupScheduleResponse)
async def get_auto_backup_schedule(
    current_user: User = Depends(get_current_admin_user),
) -> AutoBackupScheduleResponse:
    """Get current auto-backup schedule configuration."""
    from app.services.backup_scheduler_service import BackupSchedulerService

    scheduler_service = BackupSchedulerService.get_instance()
    config = scheduler_service.get_schedule()
    return AutoBackupScheduleResponse(**config)


@router.post(
    "/settings/schedule/preview", response_model=AutoBackupSchedulePreviewResponse
)
def preview_auto_backup_schedule(
    preview_request: AutoBackupSchedulePreviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
) -> AutoBackupSchedulePreviewResponse:
    """Upcoming runs and disk estimate for a draft schedule; saves nothing."""
    from app.services.backup_scheduler_service import BackupSchedulerService

    retention_days = preview_request.backup_retention_days
    min_count = preview_request.backup_min_count
    try:
        preview = BackupSchedulerService.get_instance().preview_schedule(
            preview_request.cleaned(),
            retention_days=(
                settings.BACKUP_RETENTION_DAYS
                if retention_days is None
                else retention_days
            ),
            min_count=settings.BACKUP_MIN_COUNT if min_count is None else min_count,
            latest_backup_size=BackupService(db).latest_full_backup_size(),
        )
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to preview auto-backup schedule",
            e,
            user_id=current_user.id,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to preview schedule")
    return AutoBackupSchedulePreviewResponse(**preview)


@router.post("/settings/schedule")
async def update_auto_backup_schedule(
    schedule_update: AutoBackupScheduleUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
):
    """Update auto-backup schedule configuration."""
    from app.services.backup_scheduler_service import BackupSchedulerService

    try:
        scheduler_service = BackupSchedulerService.get_instance()
        config = scheduler_service.update_schedule(**schedule_update.cleaned())

        log_security_event(
            logger,
            "auto_backup_schedule_updated",
            request,
            f"Auto-backup schedule set to: {schedule_update.preset}",
            user_id=current_user.id,
            username=current_user.username,
            preset=schedule_update.preset,
        )

        return {
            "message": "Auto-backup schedule updated successfully",
            "schedule": config,
        }

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to update auto-backup schedule",
            e,
            user_id=current_user.id,
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to update schedule",
        )
