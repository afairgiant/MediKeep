"""
Paperless-ngx integration API endpoints.

Provides API endpoints for paperless-ngx integration including connection testing,
settings management, and document operations.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.schemas.user_preferences import PaperlessConnectionData
from app.services.paperless_service import create_paperless_service, PaperlessConnectionError, PaperlessAuthenticationError
from app.crud.user_preferences import user_preferences
from app.services.credential_encryption import credential_encryption
from app.core.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/test-connection", response_model=Dict[str, Any])
async def test_paperless_connection(
    connection_data: PaperlessConnectionData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Test connection to paperless-ngx instance.
    
    Args:
        connection_data: Paperless connection details (URL and API token)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Connection test results
        
    Raises:
        HTTPException: If connection test fails
    """
    try:
        logger.info(f"Testing paperless connection for user {current_user.id}", extra={
            "user_id": current_user.id,
            "paperless_url": connection_data.paperless_url,
            "endpoint": "test_paperless_connection"
        })
        
        # Debug: test encryption first
        logger.info("Encrypting token...")
        encrypted_token = credential_encryption.encrypt_token(connection_data.paperless_api_token)
        logger.info(f"Token encrypted successfully, length: {len(encrypted_token) if encrypted_token else 0}")
        
        # Create paperless service for testing
        logger.info("Creating paperless service...")
        async with create_paperless_service(
            connection_data.paperless_url,
            encrypted_token,
            current_user.id
        ) as paperless_service:
            logger.info("Paperless service created successfully")
            
            # Test the connection
            result = await paperless_service.test_connection()
            
            logger.info(f"Paperless connection test successful for user {current_user.id}", extra={
                "user_id": current_user.id,
                "server_version": result.get("server_version"),
                "api_version": result.get("api_version")
            })
            
            return result
            
    except PaperlessAuthenticationError as e:
        logger.warning(f"Paperless authentication failed for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e),
            "paperless_url": connection_data.paperless_url
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API token or authentication failed"
        )
        
    except PaperlessConnectionError as e:
        logger.warning(f"Paperless connection failed for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e),
            "paperless_url": connection_data.paperless_url
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection failed: {str(e)}"
        )
        
    except Exception as e:
        logger.error(f"Unexpected error during paperless connection test for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e),
            "paperless_url": connection_data.paperless_url
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during connection test"
        )


@router.get("/storage-stats", response_model=Dict[str, Any])
async def get_storage_usage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get storage usage statistics for local and paperless backends.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Storage usage statistics
    """
    try:
        # Query local file statistics
        from app.models.models import EntityFile
        
        # Get local files count and size
        local_files = db.query(EntityFile).filter(
            EntityFile.storage_backend == "local"
        ).all()
        
        local_stats = {
            "count": len(local_files),
            "size": sum(f.file_size or 0 for f in local_files)
        }
        
        # Get paperless files count and size
        paperless_files = db.query(EntityFile).filter(
            EntityFile.storage_backend == "paperless"
        ).all()
        
        paperless_stats = {
            "count": len(paperless_files),
            "size": sum(f.file_size or 0 for f in paperless_files)
        }
        
        logger.info(f"Storage stats retrieved for user {current_user.id}", extra={
            "user_id": current_user.id,
            "local_files": local_stats["count"],
            "paperless_files": paperless_stats["count"]
        })
        
        return {
            "local": local_stats,
            "paperless": paperless_stats
        }
        
    except Exception as e:
        logger.error(f"Failed to get storage stats for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e)
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve storage statistics"
        )


@router.get("/settings", response_model=Dict[str, Any])
async def get_paperless_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get paperless settings for current user.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Current paperless settings (without sensitive data)
    """
    try:
        user_prefs = user_preferences.get_by_user_id(db, user_id=current_user.id)
        
        if not user_prefs:
            # Return default settings
            return {
                "paperless_enabled": False,
                "paperless_url": "",
                "default_storage_backend": "local",
                "paperless_auto_sync": False,
                "paperless_sync_tags": True
            }
        
        # Return settings without encrypted token
        return {
            "paperless_enabled": user_prefs.paperless_enabled or False,
            "paperless_url": user_prefs.paperless_url or "",
            "default_storage_backend": user_prefs.default_storage_backend or "local",
            "paperless_auto_sync": user_prefs.paperless_auto_sync or False,
            "paperless_sync_tags": user_prefs.paperless_sync_tags or True
        }
        
    except Exception as e:
        logger.error(f"Failed to get paperless settings for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e)
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve paperless settings"
        )


@router.put("/settings", response_model=Dict[str, Any])
async def update_paperless_settings(
    settings: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Update paperless settings for current user.
    
    Args:
        settings: Settings to update
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Updated settings
    """
    try:
        # Get or create user preferences
        user_prefs = user_preferences.get_by_user_id(db, user_id=current_user.id)
        if not user_prefs:
            # Create default preferences
            user_prefs = user_preferences.get_or_create_by_user_id(db, user_id=current_user.id)
        
        # Update paperless-specific settings
        update_data = {}
        
        if "paperless_enabled" in settings:
            update_data["paperless_enabled"] = settings["paperless_enabled"]
            
        if "paperless_url" in settings:
            update_data["paperless_url"] = settings["paperless_url"]
            
        if "paperless_api_token" in settings and settings["paperless_api_token"]:
            # Encrypt the token before storing
            update_data["paperless_api_token_encrypted"] = credential_encryption.encrypt_token(
                settings["paperless_api_token"]
            )
            
        if "default_storage_backend" in settings:
            update_data["default_storage_backend"] = settings["default_storage_backend"]
            
        if "paperless_auto_sync" in settings:
            update_data["paperless_auto_sync"] = settings["paperless_auto_sync"]
            
        if "paperless_sync_tags" in settings:
            update_data["paperless_sync_tags"] = settings["paperless_sync_tags"]
        
        # Update preferences
        updated_prefs = user_preferences.update(db, db_obj=user_prefs, obj_in=update_data)
        
        logger.info(f"Paperless settings updated for user {current_user.id}", extra={
            "user_id": current_user.id,
            "updated_fields": list(update_data.keys())
        })
        
        # Return updated settings without sensitive data
        return {
            "paperless_enabled": updated_prefs.paperless_enabled or False,
            "paperless_url": updated_prefs.paperless_url or "",
            "default_storage_backend": updated_prefs.default_storage_backend or "local",
            "paperless_auto_sync": updated_prefs.paperless_auto_sync or False,
            "paperless_sync_tags": updated_prefs.paperless_sync_tags or True,
            "unit_system": updated_prefs.unit_system
        }
        
    except Exception as e:
        logger.error(f"Failed to update paperless settings for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e)
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update paperless settings"
        )