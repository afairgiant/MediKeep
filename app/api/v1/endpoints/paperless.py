"""
Paperless-ngx integration API endpoints.

Provides API endpoints for paperless-ngx integration including connection testing,
settings management, and document operations.
"""

import traceback
from typing import Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.schemas.user_preferences import PaperlessConnectionData
from app.services.paperless_service import create_paperless_service_with_username_password, PaperlessConnectionError, PaperlessAuthenticationError, PaperlessUploadError, PaperlessError
from app.crud.user_preferences import user_preferences
from app.services.credential_encryption import credential_encryption, SecurityError
from app.core.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter()


def create_sanitized_error_response(
    status_code: int,
    public_message: str,
    internal_error: Exception,
    user_id: int,
    operation: str,
    **log_context
) -> HTTPException:
    """
    Create a sanitized error response that hides internal details from clients.
    
    Args:
        status_code: HTTP status code to return
        public_message: Safe message to show to client
        internal_error: The actual exception that occurred
        user_id: User ID for logging context
        operation: Description of the operation that failed
        **log_context: Additional context for logging
        
    Returns:
        HTTPException with sanitized error message
    """
    # Log the full error details server-side for debugging
    logger.error(
        f"Internal error during {operation} for user {user_id}",
        extra={
            "user_id": user_id,
            "operation": operation,
            "error_type": type(internal_error).__name__,
            "error_message": str(internal_error),
            "stack_trace": traceback.format_exc(),
            **log_context
        }
    )
    
    # Return generic error message to client
    return HTTPException(
        status_code=status_code,
        detail=public_message
    )


@router.post("/test-connection", response_model=Dict[str, Any])
async def test_paperless_connection(
    connection_data: PaperlessConnectionData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Test connection to paperless-ngx instance.
    
    Args:
        connection_data: Paperless connection details (URL, username, and password)
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
        
        # Check if we need to use saved credentials
        use_saved_credentials = (not connection_data.paperless_username or 
                               not connection_data.paperless_password)
        
        if use_saved_credentials:
            logger.info("Using saved credentials for connection test")
            # Get user preferences with saved credentials
            user_prefs = user_preferences.get_by_user_id(db, user_id=current_user.id)
            
            if not user_prefs or not user_prefs.paperless_username_encrypted or not user_prefs.paperless_password_encrypted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No saved credentials found. Please enter username and password."
                )
            
            # Use saved encrypted credentials
            encrypted_username = user_prefs.paperless_username_encrypted
            encrypted_password = user_prefs.paperless_password_encrypted
            logger.info("Using saved encrypted credentials for test")
        else:
            # Use provided credentials, encrypt them
            logger.info("Encrypting provided credentials...")
            encrypted_username = credential_encryption.encrypt_token(connection_data.paperless_username)
            encrypted_password = credential_encryption.encrypt_token(connection_data.paperless_password)
            logger.info("Credentials encrypted successfully")
        
        # Create paperless service for testing
        logger.info("Creating paperless service...")
        async with create_paperless_service_with_username_password(
            connection_data.paperless_url,
            encrypted_username,
            encrypted_password,
            current_user.id
        ) as paperless_service:
            logger.info("Paperless service created successfully")
            
            # Test the connection
            result = await paperless_service.test_connection()
            
            logger.info(f"Paperless connection test successful for user {current_user.id}", extra={
                "user_id": current_user.id,
                "server_version": result.get("server_version"),
                "api_version": result.get("api_version"),
                "used_saved_credentials": use_saved_credentials
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
            detail="Authentication failed. Please check your credentials."
        )
        
    except PaperlessConnectionError as e:
        logger.warning(f"Paperless connection failed for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e),
            "paperless_url": connection_data.paperless_url
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to connect to the Paperless server. Please check the URL and network connectivity."
        )
    
    except SecurityError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="A security error occurred during connection test",
            internal_error=e,
            user_id=current_user.id,
            operation="paperless_connection_test",
            paperless_url=connection_data.paperless_url
        )
    
    except SQLAlchemyError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="A database error occurred during connection test",
            internal_error=e,
            user_id=current_user.id,
            operation="paperless_connection_test",
            paperless_url=connection_data.paperless_url
        )
        
    except ValueError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            public_message="Invalid connection parameters provided",
            internal_error=e,
            user_id=current_user.id,
            operation="paperless_connection_test",
            paperless_url=connection_data.paperless_url
        )
        
    except Exception as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="An internal error occurred during connection test",
            internal_error=e,
            user_id=current_user.id,
            operation="paperless_connection_test",
            paperless_url=connection_data.paperless_url
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
    
    except SQLAlchemyError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="A database error occurred while retrieving storage statistics",
            internal_error=e,
            user_id=current_user.id,
            operation="get_storage_stats"
        )
        
    except Exception as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="An internal error occurred while retrieving storage statistics",
            internal_error=e,
            user_id=current_user.id,
            operation="get_storage_stats"
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
                "paperless_has_credentials": False,
                "default_storage_backend": "local",
                "paperless_auto_sync": False,
                "paperless_sync_tags": True
            }
        
        # Return settings without encrypted credentials, but include whether they exist
        return {
            "paperless_enabled": user_prefs.paperless_enabled or False,
            "paperless_url": user_prefs.paperless_url or "",
            "paperless_has_credentials": bool(user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted),
            "default_storage_backend": user_prefs.default_storage_backend or "local",
            "paperless_auto_sync": user_prefs.paperless_auto_sync or False,
            "paperless_sync_tags": user_prefs.paperless_sync_tags or True
        }
    
    except SQLAlchemyError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="A database error occurred while retrieving settings",
            internal_error=e,
            user_id=current_user.id,
            operation="get_paperless_settings"
        )
        
    except Exception as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="An internal error occurred while retrieving settings",
            internal_error=e,
            user_id=current_user.id,
            operation="get_paperless_settings"
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
            
        if "paperless_username" in settings and settings["paperless_username"]:
            # Encrypt the username before storing
            update_data["paperless_username_encrypted"] = credential_encryption.encrypt_token(
                settings["paperless_username"]
            )
            
        if "paperless_password" in settings and settings["paperless_password"]:
            # Encrypt the password before storing
            update_data["paperless_password_encrypted"] = credential_encryption.encrypt_token(
                settings["paperless_password"]
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
            "paperless_has_credentials": bool(updated_prefs.paperless_username_encrypted and updated_prefs.paperless_password_encrypted),
            "default_storage_backend": updated_prefs.default_storage_backend or "local",
            "paperless_auto_sync": updated_prefs.paperless_auto_sync or False,
            "paperless_sync_tags": updated_prefs.paperless_sync_tags or True,
            "unit_system": updated_prefs.unit_system
        }
    
    except SecurityError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="A security error occurred while updating settings",
            internal_error=e,
            user_id=current_user.id,
            operation="update_paperless_settings"
        )
    
    except SQLAlchemyError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="A database error occurred while updating settings",
            internal_error=e,
            user_id=current_user.id,
            operation="update_paperless_settings"
        )
    
    except ValueError as e:
        # Handle validation errors for settings
        raise create_sanitized_error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            public_message="Invalid settings data provided",
            internal_error=e,
            user_id=current_user.id,
            operation="update_paperless_settings"
        )
        
    except Exception as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="An internal error occurred while updating settings",
            internal_error=e,
            user_id=current_user.id,
            operation="update_paperless_settings"
        )


@router.get("/health/paperless", response_model=Dict[str, Any])
async def check_paperless_health(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Check health of paperless-ngx connectivity.
    
    This endpoint verifies that:
    1. User has paperless enabled
    2. Valid credentials are stored
    3. Connection to paperless instance is working
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Health check results with status and details
    """
    try:
        # Get user preferences
        user_prefs = user_preferences.get_by_user_id(db, user_id=current_user.id)
        
        # Check if paperless is enabled
        if not user_prefs or not user_prefs.paperless_enabled:
            return {
                "status": "disabled",
                "message": "Paperless integration is not enabled",
                "details": {
                    "paperless_enabled": False,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        
        # Check if credentials exist
        if not user_prefs.paperless_url or not user_prefs.paperless_username_encrypted or not user_prefs.paperless_password_encrypted:
            return {
                "status": "unconfigured",
                "message": "Paperless configuration incomplete",
                "details": {
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        
        # Test actual connection
        logger.info(f"Performing paperless health check for user {current_user.id}", extra={
            "user_id": current_user.id,
            "paperless_url": user_prefs.paperless_url
        })
        
        async with create_paperless_service_with_username_password(
            user_prefs.paperless_url,
            user_prefs.paperless_username_encrypted,
            user_prefs.paperless_password_encrypted,
            current_user.id
        ) as paperless_service:
            result = await paperless_service.test_connection()
            
            logger.info(f"Paperless health check successful for user {current_user.id}", extra={
                "user_id": current_user.id,
                "status": "healthy"
            })
            
            return {
                "status": "healthy",
                "message": "Paperless connection is working",
                "details": {
                    "server_url": user_prefs.paperless_url,
                    "timestamp": datetime.utcnow().isoformat(),
                    "connection_test": result
                }
            }
            
    except PaperlessAuthenticationError as e:
        logger.warning(f"Paperless health check failed - authentication error for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e)
        })
        return {
            "status": "unhealthy",
            "message": "Authentication failed",
            "details": {
                "error_type": "authentication",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except PaperlessConnectionError as e:
        logger.warning(f"Paperless health check failed - connection error for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e)
        })
        return {
            "status": "unhealthy", 
            "message": "Connection failed",
            "details": {
                "error_type": "connection",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    
    except SQLAlchemyError as e:
        # Log the full error but return sanitized response
        logger.error(f"Database error during paperless health check for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e),
            "error_type": type(e).__name__,
            "stack_trace": traceback.format_exc()
        })
        return {
            "status": "unhealthy",
            "message": "Health check failed due to internal error",
            "details": {
                "error_type": "internal",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        # Log the full error but return sanitized response
        logger.error(f"Paperless health check failed unexpectedly for user {current_user.id}", extra={
            "user_id": current_user.id,
            "error": str(e),
            "error_type": type(e).__name__,
            "stack_trace": traceback.format_exc()
        })
        return {
            "status": "unhealthy",
            "message": "Health check failed due to internal error",
            "details": {
                "error_type": "internal",
                "timestamp": datetime.utcnow().isoformat()
            }
        }