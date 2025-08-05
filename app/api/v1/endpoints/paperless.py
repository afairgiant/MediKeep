"""
Paperless-ngx integration API endpoints.

Provides API endpoints for paperless-ngx integration including connection testing,
settings management, and document operations.
"""

import os
import json
import re
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
from app.services.paperless_service import (
    create_paperless_service,
    create_paperless_service_with_username_password, 
    create_paperless_service_with_token,
    PaperlessConnectionError, 
    PaperlessAuthenticationError, 
    PaperlessUploadError, 
    PaperlessError
)
from app.crud.user_preferences import user_preferences
from app.services.credential_encryption import credential_encryption, SecurityError
from app.core.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter()


def get_preferred_auth_method(user_prefs) -> str:
    """Determine the preferred authentication method based on available credentials."""
    if user_prefs.paperless_api_token_encrypted:
        return "token"
    elif user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted:
        return "basic_auth"
    return "none"


def _update_entity_file_from_task_result(db: Session, task_uuid: str, task_result: dict) -> None:
    """
    Update EntityFile record based on Paperless task completion result.
    
    Args:
        db: Database session
        task_uuid: Task UUID to find the EntityFile record
        task_result: Task result with status, result, error_type, etc.
    """
    try:
        from app.models.models import EntityFile
        
        # Find the EntityFile record by task UUID
        entity_file = db.query(EntityFile).filter(
            EntityFile.paperless_task_uuid == task_uuid
        ).first()
        
        if not entity_file:
            logger.warning(f"No EntityFile found for task UUID {task_uuid}")
            return
        
        # Update sync_status based on task result
        if task_result.get("status") == "SUCCESS":
            entity_file.sync_status = "synced"
            if task_result.get("document_id"):
                entity_file.paperless_document_id = str(task_result["document_id"])
                
        elif task_result.get("status") == "FAILURE":
            # For Paperless failures, we should delete the database record since the document
            # was never successfully stored in Paperless and the user should not see it
            # in their file list (it creates confusion)
            
            # Only delete if this was supposed to be a Paperless file
            if entity_file.storage_backend == "paperless":
                logger.info(f"Deleting EntityFile {entity_file.id} (paperless) due to task failure: {task_result.get('error_type', 'unknown')}")
                
                # Delete the database record and any local file copy
                file_path = entity_file.file_path
                db.delete(entity_file)
                db.commit()
                
                # Also delete the physical file if it exists locally
                if file_path:
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            logger.info(f"Deleted local file: {file_path}")
                    except Exception as e:
                        logger.warning(f"Could not delete local file {file_path}: {str(e)}")
                
                logger.info(f"EntityFile {entity_file.id} deleted for failed Paperless task {task_uuid}")
                return  # Exit early since we deleted the record
            else:
                # For non-Paperless files, just mark as failed (shouldn't happen for task monitoring)
                entity_file.sync_status = "failed"
        
        # Update last_sync timestamp
        from datetime import datetime
        entity_file.last_sync_at = datetime.utcnow()
        
        # Commit changes
        db.commit()
        
        logger.info(f"Updated EntityFile {entity_file.id} sync_status to {entity_file.sync_status} for task {task_uuid}")
        
    except Exception as e:
        logger.error(f"Failed to update EntityFile for task {task_uuid}: {str(e)}")
        db.rollback()


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
        
        # Determine authentication method and credentials
        use_saved_credentials = (not connection_data.paperless_api_token and 
                               not connection_data.paperless_username and 
                               not connection_data.paperless_password)
        
        encrypted_token = None
        encrypted_username = None
        encrypted_password = None
        
        if use_saved_credentials:
            logger.info("Using saved credentials for connection test")
            # Get user preferences with saved credentials
            user_prefs = user_preferences.get_by_user_id(db, user_id=current_user.id)
            
            if not user_prefs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No saved credentials found. Please provide authentication details."
                )
            
            # Check what saved credentials are available
            has_token = bool(user_prefs.paperless_api_token_encrypted)
            has_basic = bool(user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted)
            
            if not has_token and not has_basic:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No saved authentication credentials found. Please provide token or username/password."
                )
            
            # Use saved encrypted credentials (smart factory will prioritize token)
            encrypted_token = user_prefs.paperless_api_token_encrypted
            encrypted_username = user_prefs.paperless_username_encrypted
            encrypted_password = user_prefs.paperless_password_encrypted
            logger.info(f"Using saved credentials: token={'yes' if has_token else 'no'}, basic={'yes' if has_basic else 'no'}")
        else:
            # Use provided credentials, encrypt them
            logger.error(f"🔍 API DEBUG - Using provided credentials for test")
            logger.error(f"🔍 API DEBUG - Raw token from request: '{connection_data.paperless_api_token}'")
            logger.error(f"🔍 API DEBUG - Raw token length: {len(connection_data.paperless_api_token) if connection_data.paperless_api_token else 0}")
            logger.error(f"🔍 API DEBUG - Raw token type: {type(connection_data.paperless_api_token)}")
            if connection_data.paperless_api_token:
                encrypted_token = credential_encryption.encrypt_token(connection_data.paperless_api_token)
                logger.error(f"🔍 API DEBUG - Token encrypted successfully, length: {len(encrypted_token) if encrypted_token else 0}")
                logger.info("Token provided and encrypted")
            
            if connection_data.paperless_username and connection_data.paperless_password:
                encrypted_username = credential_encryption.encrypt_token(connection_data.paperless_username)
                encrypted_password = credential_encryption.encrypt_token(connection_data.paperless_password)
                logger.info("Username/password provided and encrypted")
        
        # Create paperless service for testing using smart factory
        logger.error(f"🔍 API DEBUG - Creating paperless service with smart factory...")
        logger.error(f"🔍 API DEBUG - URL: {connection_data.paperless_url}")
        logger.error(f"🔍 API DEBUG - Has encrypted_token: {bool(encrypted_token)}")
        logger.error(f"🔍 API DEBUG - Has encrypted_username: {bool(encrypted_username)}")
        logger.error(f"🔍 API DEBUG - Has encrypted_password: {bool(encrypted_password)}")
        logger.error(f"🔍 API DEBUG - User ID: {current_user.id}")
        
        async with create_paperless_service(
            connection_data.paperless_url,
            encrypted_token=encrypted_token,
            encrypted_username=encrypted_username,
            encrypted_password=encrypted_password,
            user_id=current_user.id
        ) as paperless_service:
            logger.info("Paperless service created successfully")
            
            # Test the connection
            logger.error(f"🔍 API DEBUG - About to call test_connection()")
            result = await paperless_service.test_connection()
            logger.error(f"🔍 API DEBUG - test_connection() completed with result: {result}")
            
            # Add authentication method to result
            result["auth_method"] = paperless_service.get_auth_type()
            result["used_saved_credentials"] = use_saved_credentials
            logger.error(f"🔍 API DEBUG - Final result with auth method: {result}")
            
            logger.info(f"Paperless connection test successful for user {current_user.id}", extra={
                "user_id": current_user.id,
                "auth_method": result["auth_method"],
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
        # Log the exception with more detail for debugging
        logger.error(f"Unexpected error in paperless connection test", extra={
            "user_id": current_user.id,
            "paperless_url": connection_data.paperless_url,
            "error_type": type(e).__name__,
            "error_message": str(e),
            "stack_trace": traceback.format_exc()
        })
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
                "paperless_has_token": False,
                "paperless_has_credentials": False,
                "paperless_auth_method": "none",
                "default_storage_backend": "local",
                "paperless_auto_sync": False,
                "paperless_sync_tags": True
            }
        
        # Return settings without encrypted credentials, but include whether they exist
        return {
            "paperless_enabled": user_prefs.paperless_enabled or False,
            "paperless_url": user_prefs.paperless_url or "",
            "paperless_has_token": bool(user_prefs.paperless_api_token_encrypted),
            "paperless_has_credentials": bool(user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted),
            "paperless_auth_method": get_preferred_auth_method(user_prefs),
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
            
        if "paperless_api_token" in settings and settings["paperless_api_token"]:
            # Encrypt the API token before storing
            update_data["paperless_api_token_encrypted"] = credential_encryption.encrypt_token(
                settings["paperless_api_token"]
            )
            
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
            "paperless_has_token": bool(updated_prefs.paperless_api_token_encrypted),
            "paperless_has_credentials": bool(updated_prefs.paperless_username_encrypted and updated_prefs.paperless_password_encrypted),
            "paperless_auth_method": get_preferred_auth_method(updated_prefs),
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
        
        # Check if credentials exist (either token or username/password)
        has_auth = (user_prefs.paperless_api_token_encrypted or 
                   (user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted))
        if not user_prefs.paperless_url or not has_auth:
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
        
        async with create_paperless_service(
            user_prefs.paperless_url,
            encrypted_token=user_prefs.paperless_api_token_encrypted,
            encrypted_username=user_prefs.paperless_username_encrypted,
            encrypted_password=user_prefs.paperless_password_encrypted,
            user_id=current_user.id
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


@router.post("/cleanup", response_model=Dict[str, Any])
async def cleanup_out_of_sync_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Clean up out-of-sync EntityFile records.
    
    This endpoint identifies and deletes EntityFile records with:
    - sync_status of "failed" or "missing"
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Cleanup results with counts of cleaned items
    """
    try:
        from app.models.models import EntityFile
        
        logger.info(f"Starting cleanup of out-of-sync files for user {current_user.id}", extra={
            "user_id": current_user.id,
            "operation": "cleanup_out_of_sync_files"
        })
        
        # Find and delete EntityFile records with missing or failed status
        failed_missing_files = db.query(EntityFile).filter(
            EntityFile.sync_status.in_(["failed", "missing"])
        ).all()
        
        logger.info(f"Found {len(failed_missing_files)} files with failed/missing status")
        
        deleted_count = 0
        for file_record in failed_missing_files:
            logger.info(f"Deleting {file_record.sync_status} file: {file_record.id} - {file_record.file_name}", extra={
                "user_id": current_user.id,
                "file_id": file_record.id,
                "filename": file_record.file_name,
                "sync_status": file_record.sync_status,
                "paperless_document_id": file_record.paperless_document_id
            })
            db.delete(file_record)
            deleted_count += 1
        
        # Commit changes
        db.commit()
        
        logger.info(f"Cleanup completed for user {current_user.id}: {deleted_count} files deleted", extra={
            "user_id": current_user.id,
            "files_deleted": deleted_count
        })
        
        return {
            "files_cleaned": deleted_count,
            "files_deleted": deleted_count,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during cleanup for user {current_user.id}: {str(e)}", extra={
            "user_id": current_user.id,
            "error": str(e)
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred during cleanup"
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Cleanup error for user {current_user.id}: {str(e)}", extra={
            "user_id": current_user.id,
            "error": str(e)
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during cleanup"
        )


@router.get("/tasks/{task_uuid}/status", response_model=Dict[str, Any])
async def get_paperless_task_status(
    task_uuid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get status of a Paperless-ngx task by UUID.
    
    This endpoint allows the frontend to poll the status of a Paperless task
    to determine if document upload/processing has completed, failed, or is still in progress.
    
    Args:
        task_uuid: UUID of the Paperless task to check
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Task status and result information
        
    Raises:
        HTTPException: If task check fails or user doesn't have Paperless configured
    """
    try:
        logger.info(f"Checking Paperless task status for user {current_user.id}", extra={
            "user_id": current_user.id,
            "task_uuid": task_uuid,
            "endpoint": "get_paperless_task_status"
        })
        
        # Get user preferences to verify Paperless is configured
        user_prefs = user_preferences.get_by_user_id(db, user_id=current_user.id)
        
        if not user_prefs or not user_prefs.paperless_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paperless integration is not enabled"
            )
        
        # Check if credentials exist (either token or username/password)
        has_auth = (user_prefs.paperless_api_token_encrypted or 
                   (user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted))
        if not user_prefs.paperless_url or not has_auth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paperless configuration is incomplete - missing URL or authentication credentials"
            )
        
        # FOUND THE BUG! Upload uses create_paperless_service_with_username_password
        # but task status was using create_paperless_service (which tries token first)
        # Let's use the EXACT same method as upload to ensure consistency
        logger.error(f"🔍 TASK STATUS DEBUG - Using EXACT same auth method as upload (username/password)")
        
        # Import the same method used by upload
        from app.services.paperless_service import create_paperless_service_with_username_password
        
        # Create paperless service using SAME method as upload
        async with create_paperless_service_with_username_password(
            user_prefs.paperless_url,
            user_prefs.paperless_username_encrypted,
            user_prefs.paperless_password_encrypted,
            current_user.id
        ) as paperless_service:
            
            # Now using same auth method as upload - should work!
            try:
                logger.info(f"Checking task {task_uuid} status for user {current_user.id} using same auth as upload")
                
                # Use the proper _make_request method 
                async with paperless_service._make_request("GET", f"/api/tasks/?task_id={task_uuid}") as response:
                    logger.info(f"Task status response: HTTP {response.status}")
                    
                    if response.status == 200:
                        tasks = await response.json()
                        
                        # Handle both list format and paginated format
                        if isinstance(tasks, list):
                            task_list = tasks
                        else:
                            task_list = tasks.get('results', [])
                            
                        if task_list and len(task_list) > 0:
                            task = task_list[0]
                            
                            if task['status'] == 'SUCCESS':
                                # Log the raw task response from Paperless for debugging
                                logger.error(f"🔍 RAW PAPERLESS TASK RESPONSE: {json.dumps(task, indent=2)}", extra={
                                    "user_id": current_user.id,
                                    "task_uuid": task_uuid,
                                    "raw_paperless_response": task
                                })
                                
                                # Extract document ID from the task result
                                # Paperless returns document ID in 'id' field for the created document
                                document_id = task.get('id')
                                
                                # Fallback to other possible locations if not found
                                if not document_id:
                                    document_id = task.get('related_document')
                                    if not document_id:
                                        if isinstance(task.get('result'), dict):
                                            document_id = task.get('result', {}).get('document_id')
                                        elif isinstance(task.get('result'), str):
                                            # Try to extract from result string like "Success. New document id 2744 created"
                                            match = re.search(r'document id (\d+)', task.get('result', ''))
                                            if match:
                                                document_id = match.group(1)
                                
                                logger.error(f"🔍 EXTRACTED DOCUMENT ID: {document_id} (type: {type(document_id)})", extra={
                                    "user_id": current_user.id,
                                    "task_uuid": task_uuid,
                                    "extracted_document_id": document_id
                                })
                                
                                # Update database record with successful completion
                                _update_entity_file_from_task_result(db, task_uuid, {
                                    "status": "SUCCESS",
                                    "result": {"document_id": document_id},
                                    "document_id": document_id
                                })
                                
                                result = {
                                    "status": "SUCCESS",
                                    "result": {
                                        "document_id": document_id
                                    },
                                    "task_id": task_uuid,
                                    "timestamp": datetime.utcnow().isoformat()
                                }
                                
                                logger.info(f"Paperless task {task_uuid} completed successfully", extra={
                                    "user_id": current_user.id,
                                    "task_uuid": task_uuid,
                                    "document_id": document_id
                                })
                                
                                return result
                                
                            elif task['status'] == 'FAILURE':
                                # Task failed - extract error information
                                error_message = task.get('result', 'Task failed')
                                
                                # Categorize the error type for better user messaging
                                error_message_lower = error_message.lower()
                                
                                # Determine specific error type
                                if ("duplicate" in error_message_lower or
                                    "already exists" in error_message_lower or
                                    "not consuming" in error_message_lower):
                                    error_type = "duplicate"
                                    is_duplicate = True
                                elif ("corrupted" in error_message_lower or
                                      "corrupt" in error_message_lower or
                                      "invalid format" in error_message_lower or
                                      "cannot parse" in error_message_lower or
                                      "unsupported format" in error_message_lower):
                                    error_type = "corrupted_file"
                                    is_duplicate = False
                                elif ("permission denied" in error_message_lower or
                                      "access denied" in error_message_lower or
                                      "forbidden" in error_message_lower):
                                    error_type = "permission_error"
                                    is_duplicate = False
                                elif ("file too large" in error_message_lower or
                                      "size exceeds" in error_message_lower or
                                      "too big" in error_message_lower):
                                    error_type = "file_too_large"
                                    is_duplicate = False
                                elif ("disk space" in error_message_lower or
                                      "storage full" in error_message_lower or
                                      "no space" in error_message_lower):
                                    error_type = "storage_full"
                                    is_duplicate = False
                                elif ("ocr failed" in error_message_lower or
                                      "text extraction" in error_message_lower):
                                    error_type = "ocr_failed"
                                    is_duplicate = False
                                elif ("timeout" in error_message_lower or
                                      "connection" in error_message_lower):
                                    error_type = "network_error"
                                    is_duplicate = False
                                else:
                                    error_type = "processing_error"
                                    is_duplicate = False
                                
                                # Update database record with failure status
                                _update_entity_file_from_task_result(db, task_uuid, {
                                    "status": "FAILURE",
                                    "result": error_message,
                                    "error_type": error_type,
                                    "is_duplicate": is_duplicate
                                })
                                
                                result = {
                                    "status": "FAILURE",
                                    "result": error_message,
                                    "task_id": task_uuid,
                                    "timestamp": datetime.utcnow().isoformat(),
                                    "error_type": "duplicate" if is_duplicate else "processing_error"
                                }
                                
                                logger.warning(f"Paperless task {task_uuid} failed", extra={
                                    "user_id": current_user.id,
                                    "task_uuid": task_uuid,
                                    "error": error_message,
                                    "is_duplicate": is_duplicate
                                })
                                
                                return result
                            else:
                                # Task is still pending/processing
                                result = {
                                    "status": "PENDING",
                                    "result": None,
                                    "task_id": task_uuid,
                                    "timestamp": datetime.utcnow().isoformat()
                                }
                                
                                logger.debug(f"Paperless task {task_uuid} still processing", extra={
                                    "user_id": current_user.id,
                                    "task_uuid": task_uuid
                                })
                                
                                return result
                        else:
                            # Task not found
                            raise HTTPException(
                                status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Task {task_uuid} not found"
                            )
                    elif response.status == 403:
                        logger.warning(f"Permission denied checking task {task_uuid} - auth may have failed")
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Permission denied accessing task status"
                        )
                    else:
                        response_text = await response.text()
                        logger.warning(f"Task status check failed: HTTP {response.status} - {response_text[:100]}")
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Failed to check task status: HTTP {response.status}"
                        )
                        
            except HTTPException:
                # Re-raise HTTP exceptions as-is
                raise
            except Exception as e:
                logger.error(f"Error checking task status directly", extra={
                    "user_id": current_user.id,
                    "task_uuid": task_uuid,
                    "error": str(e)
                })
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to check task status: {str(e)}"
                )
                
    except PaperlessAuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Paperless authentication failed. Please check your credentials."
        )
        
    except PaperlessConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to connect to Paperless server. Please check your configuration."
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    
    except SecurityError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="A security error occurred while checking task status",
            internal_error=e,
            user_id=current_user.id,
            operation="paperless_task_status_check",
            task_uuid=task_uuid
        )
    
    except SQLAlchemyError as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="A database error occurred while checking task status",
            internal_error=e,
            user_id=current_user.id,
            operation="paperless_task_status_check",
            task_uuid=task_uuid
        )
        
    except Exception as e:
        raise create_sanitized_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            public_message="An internal error occurred while checking task status",
            internal_error=e,
            user_id=current_user.id,
            operation="paperless_task_status_check",
            task_uuid=task_uuid
        )


@router.get("/documents/search")
async def search_paperless_documents(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    query: str = "",
    page: int = 1,
    page_size: int = 25
) -> Dict[str, Any]:
    """
    Search documents in Paperless-ngx.
    
    Args:
        query: Search query string
        page: Page number (default: 1)
        page_size: Number of results per page (default: 25)
    
    Returns:
        Search results from Paperless
    """
    try:
        # Get user preferences
        user_prefs = user_preferences.get_by_user_id(db, current_user.id)
        
        if not user_prefs or not user_prefs.paperless_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paperless integration is not enabled"
            )
        
        # Check if credentials exist
        has_auth = (user_prefs.paperless_api_token_encrypted or 
                   (user_prefs.paperless_username_encrypted and user_prefs.paperless_password_encrypted))
        if not user_prefs.paperless_url or not has_auth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paperless configuration is incomplete"
            )
        
        # Create paperless service using consistent auth method
        paperless_service = create_paperless_service(user_prefs.paperless_url, current_user.id)
        
        # Simple search without user filtering for fallback during uploads
        logger.info(f"Searching Paperless documents with query: {query}")
        
        params = {
            "query": query,
            "page": page,
            "page_size": min(page_size, 100)
        }
        
        # Make direct request to Paperless search API
        async with paperless_service._make_request(
            "GET", "/api/documents/", params=params
        ) as response:
            logger.info(f"Paperless search response status: {response.status}")
            
            if response.status == 401:
                logger.error("Paperless authentication failed during search")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Paperless authentication failed"
                )
            elif response.status != 200:
                error_text = await response.text()
                logger.error(f"Paperless search failed with status {response.status}: {error_text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Paperless search failed: {error_text}"
                )
            
            results = await response.json()
            logger.info(f"Paperless search returned {len(results.get('results', []))} results")
            return results.get("results", [])
        
    except PaperlessAuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Paperless authentication failed. Please check your credentials."
        )
        
    except PaperlessConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to connect to Paperless server. Please check your configuration."
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Error searching Paperless documents: {str(e)}", extra={
            "user_id": current_user.id,
            "query": query,
            "error": str(e),
            "traceback": traceback.format_exc()
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while searching documents: {str(e)}"
        )