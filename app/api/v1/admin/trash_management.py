"""
Admin API endpoints for trash management.
"""

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_db
from app.models.models import User
from app.services.file_management_service import file_management_service

router = APIRouter()


@router.get("/trash/", response_model=List[Dict])
async def list_trash_contents(
    current_user: User = Depends(get_current_admin_user),
) -> List[Dict]:
    """
    List all files currently in trash.
    """
    try:
        return file_management_service.list_trash_contents()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trash/cleanup")
async def cleanup_old_trash(
    current_user: User = Depends(get_current_admin_user),
) -> Dict[str, int]:
    """
    Clean up old files from trash based on retention policy.
    """
    try:
        return file_management_service.cleanup_old_trash()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trash/restore")
async def restore_file_from_trash(
    trash_path: str,
    restore_path: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
) -> Dict[str, str]:
    """
    Restore a file from trash to its original location or specified path.
    """
    try:
        return file_management_service.restore_from_trash(trash_path, restore_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found in trash")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/trash/permanently-delete")
async def permanently_delete_from_trash(
    trash_path: str,
    current_user: User = Depends(get_current_admin_user),
) -> Dict[str, str]:
    """
    Permanently delete a file from trash (cannot be recovered).
    """
    try:
        import os
        from pathlib import Path

        from app.core.config import settings

        # Validate and normalize trash_path to prevent directory traversal
        normalized_trash_path = os.path.normpath(trash_path)
        if not normalized_trash_path.startswith(str(settings.TRASH_DIR)):
            raise ValueError(f"Invalid trash path: {trash_path}")

        trash_file = Path(normalized_trash_path)
        if not trash_file.exists():
            raise HTTPException(status_code=404, detail="File not found in trash")

        # Remove the file and its metadata
        trash_file.unlink()

        metadata_path = trash_file.with_suffix(trash_file.suffix + ".meta")
        if metadata_path.exists():
            metadata_path.unlink()

        return {
            "status": "success",
            "message": f"File permanently deleted: {trash_path}",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
