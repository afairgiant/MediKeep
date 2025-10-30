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
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database.database import get_db
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
# New simplified architecture
from app.services.paperless_client import (
    create_paperless_client,
    PaperlessClient,
    PaperlessClientError,
    PaperlessConnectionError as NewPaperlessConnectionError,
    PaperlessUploadError as NewPaperlessUploadError
)
from app.services.paperless_auth import create_paperless_auth
from app.crud.user_preferences import user_preferences
from app.services.credential_encryption import credential_encryption, SecurityError
from app.core.logging.config import get_logger
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_security_event,
    log_data_access,
    log_validation_error,
    log_external_service,
    log_debug
)
from app.core.logging.constants import LogFields

logger = get_logger(__name__)
router = APIRouter()


class MockRequest:
    """Mock Request object for logging when FastAPI Request is not available."""
    def __init__(self, ip: str = "unknown"):
        self.client = type('obj', (object,), {'host': ip})()


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
            mock_req = MockRequest()
            logger.warning(
                f"No EntityFile found for task UUID {task_uuid}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "entity_file_not_found",
                    "task_uuid": task_uuid
                }
            )
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
                logger.info(
                    f"Deleting EntityFile {entity_file.id} (paperless) due to task failure",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: "entity_file_deleted",
                        "entity_file_id": entity_file.id,
                        "task_uuid": task_uuid,
                        "error_type": task_result.get('error_type', 'unknown'),
                        "storage_backend": "paperless"
                    }
                )

                # Delete the database record and any local file copy
                file_path = entity_file.file_path
                db.delete(entity_file)
                db.commit()

                # Also delete the physical file if it exists locally
                if file_path:
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            logger.info(
                                f"Deleted local file: {file_path}",
                                extra={
                                    LogFields.CATEGORY: "app",
                                    LogFields.EVENT: "local_file_deleted",
                                    LogFields.FILE: file_path,
                                    "entity_file_id": entity_file.id
                                }
                            )
                    except Exception as e:
                        logger.warning(
                            f"Could not delete local file {file_path}",
                            extra={
                                LogFields.CATEGORY: "app",
                                LogFields.EVENT: "file_deletion_failed",
                                LogFields.FILE: file_path,
                                LogFields.ERROR: str(e),
                                "entity_file_id": entity_file.id
                            }
                        )

                logger.info(
                    f"EntityFile {entity_file.id} deleted for failed Paperless task",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: "paperless_task_cleanup_complete",
                        "entity_file_id": entity_file.id,
                        "task_uuid": task_uuid
                    }
                )
                return  # Exit early since we deleted the record
            else:
                # For non-Paperless files, just mark as failed (shouldn't happen for task monitoring)
                entity_file.sync_status = "failed"
        
        # Update last_sync timestamp
        from datetime import datetime
        entity_file.last_sync_at = datetime.utcnow()
        
        # Commit changes
        db.commit()

        logger.info(
            f"Updated EntityFile {entity_file.id} sync_status to {entity_file.sync_status}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "entity_file_updated",
                "entity_file_id": entity_file.id,
                "task_uuid": task_uuid,
                "sync_status": entity_file.sync_status
            }
        )

    except Exception as e:
        logger.error(
            f"Failed to update EntityFile for task {task_uuid}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "entity_file_update_failed",
                LogFields.ERROR: str(e),
                "task_uuid": task_uuid
            }
        )
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
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "internal_error",
            LogFields.USER_ID: user_id,
            LogFields.OPERATION: operation,
            LogFields.ERROR: str(internal_error),
            "error_type": type(internal_error).__name__,
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
    db: Session = Depends(get_db),
    request: Request = None
) -> Dict[str, Any]:
    """
    Test connection to paperless-ngx instance.

    Args:
        connection_data: Paperless connection details (URL, username, and password)
        current_user: Current authenticated user
        db: Database session
        request: FastAPI request object

    Returns:
        Connection test results

    Raises:
        HTTPException: If connection test fails
    """
    try:
        if not request:
            request = MockRequest()

        log_external_service(
            logger,
            service="paperless",
            operation="connection_test",
            success=False,  # Will update on success
            user_id=current_user.id,
            paperless_url=connection_data.paperless_url,
            endpoint="test_paperless_connection"
        )
        
        # Determine authentication method and credentials
        use_saved_credentials = (not connection_data.paperless_api_token and 
                               not connection_data.paperless_username and 
                               not connection_data.paperless_password)
        
        encrypted_token = None
        encrypted_username = None
        encrypted_password = None
        
        if use_saved_credentials:
            log_debug(logger, "Using saved credentials for connection test", user_id=current_user.id)
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
            logger.debug("Using provided credentials for test")
            logger.debug(f"Token provided: {bool(connection_data.paperless_api_token)}")
            if connection_data.paperless_api_token:
                encrypted_token = credential_encryption.encrypt_token(connection_data.paperless_api_token)
                logger.debug("Token encrypted successfully")
                logger.info("Token provided and encrypted")
            
            if connection_data.paperless_username and connection_data.paperless_password:
                encrypted_username = credential_encryption.encrypt_token(connection_data.paperless_username)
                encrypted_password = credential_encryption.encrypt_token(connection_data.paperless_password)
                logger.info("Username/password provided and encrypted")
        
        # Create paperless service for testing using smart factory
        logger.debug("Creating paperless service with smart factory")
        logger.debug(f"URL: {connection_data.paperless_url}")
        logger.debug(f"Has encrypted_token: {bool(encrypted_token)}")
        logger.debug(f"Has encrypted_username: {bool(encrypted_username)}")
        logger.debug(f"Has encrypted_password: {bool(encrypted_password)}")
        logger.debug(f"User ID: {current_user.id}")
        
        async with create_paperless_service(
            connection_data.paperless_url,
            encrypted_token=encrypted_token,
            encrypted_username=encrypted_username,
            encrypted_password=encrypted_password,
            user_id=current_user.id
        ) as paperless_service:
            logger.info("Paperless service created successfully")
            
            # Test the connection
            logger.debug("About to call test_connection()")
            result = await paperless_service.test_connection()
            logger.debug(f"test_connection() completed with result: {result}")
            
            # Add authentication method to result
            result["auth_method"] = paperless_service.get_auth_type()
            result["used_saved_credentials"] = use_saved_credentials
            logger.debug(f"Final result with auth method: {result}")
            
            log_external_service(
                logger,
                service="paperless",
                operation="connection_test",
                success=True,
                user_id=current_user.id,
                auth_method=result["auth_method"],
                server_version=result.get("server_version"),
                api_version=result.get("api_version"),
                used_saved_credentials=use_saved_credentials,
                paperless_url=connection_data.paperless_url
            )

            return result

    except PaperlessAuthenticationError as e:
        log_security_event(
            logger,
            "paperless_auth_failed",
            request,
            f"Paperless authentication failed for user {current_user.id}",
            user_id=current_user.id,
            paperless_url=connection_data.paperless_url
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Please check your credentials."
        )

    except PaperlessConnectionError as e:
        log_external_service(
            logger,
            service="paperless",
            operation="connection_test",
            success=False,
            error=str(e),
            user_id=current_user.id,
            paperless_url=connection_data.paperless_url
        )
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
        logger.error(
            "Unexpected error in paperless connection test",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "paperless_connection_error",
                LogFields.USER_ID: current_user.id,
                LogFields.ERROR: str(e),
                "paperless_url": connection_data.paperless_url,
                "error_type": type(e).__name__,
                "stack_trace": traceback.format_exc()
            }
        )
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
    db: Session = Depends(get_db),
    request: Request = None
) -> Dict[str, Any]:
    """
    Get storage usage statistics for local and paperless backends.

    Args:
        current_user: Current authenticated user
        db: Database session
        request: FastAPI request object

    Returns:
        Storage usage statistics
    """
    if not request:
        request = MockRequest()
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
        
        log_endpoint_access(
            logger,
            request,
            current_user.id,
            "storage_stats_retrieved",
            message=f"Storage stats retrieved for user {current_user.id}",
            local_files=local_stats["count"],
            paperless_files=paperless_stats["count"]
        )

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
                "file_name": file_record.file_name,
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
        
        # Use the smart factory that supports both token and username/password auth
        logger.debug("Using smart auth factory (supports both token and username/password)")
        
        # Import the same method used by upload
        from app.services.paperless_service import create_paperless_service_with_username_password
        
        # Create paperless service using SAME method as upload - supports both token and username/password
        async with create_paperless_service(
            user_prefs.paperless_url,
            encrypted_token=user_prefs.paperless_api_token_encrypted,
            encrypted_username=user_prefs.paperless_username_encrypted,
            encrypted_password=user_prefs.paperless_password_encrypted,
            user_id=current_user.id
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
                                # Paperless returns document ID in 'related_document' field, NOT 'id' (which is task ID)
                                logger.debug(f"Document ID extraction - Full task result: {task}")
                                logger.debug(f"task.get('id'): {task.get('id')}")
                                logger.debug(f"task.get('related_document'): {task.get('related_document')}")
                                logger.debug(f"task.get('result'): {task.get('result')}")
                                
                                # FIXED: Try related_document FIRST (this is the actual document ID)
                                document_id = task.get('related_document')
                                extraction_method = "task.related_document"
                                
                                # Fallback to other possible locations if not found
                                if not document_id:
                                    if isinstance(task.get('result'), dict):
                                        document_id = task.get('result', {}).get('document_id')
                                        extraction_method = "task.result.document_id"
                                    elif isinstance(task.get('result'), str):
                                        # Try to extract from result string like "Success. New document id 2744 created"
                                        match = re.search(r'document id (\d+)', task.get('result', ''))
                                        if match:
                                            document_id = match.group(1)
                                            extraction_method = "regex_from_result_string"
                                    # Only use task.id as LAST resort since it's the task ID, not document ID
                                    if not document_id:
                                        document_id = task.get('id')
                                        extraction_method = "task.id (fallback - may be incorrect)"
                                
                                logger.error(f"🔍 EXTRACTED DOCUMENT ID: {document_id} (type: {type(document_id)}) via {extraction_method}", extra={
                                    "user_id": current_user.id,
                                    "task_uuid": task_uuid,
                                    "extracted_document_id": document_id,
                                    "extraction_method": extraction_method,
                                    "full_task_result": task
                                })
                                
                                # VALIDATE: Check if extracted document ID actually exists in Paperless
                                if document_id:
                                    try:
                                        exists = await paperless_service.check_document_exists(document_id)
                                        logger.error(f"🔍 VALIDATION - Document {document_id} exists in Paperless: {exists}")
                                        if not exists:
                                            logger.error(f"🚨 BUG DETECTED - Extracted document ID {document_id} does not exist in Paperless! Task result may be wrong.")
                                    except Exception as e:
                                        logger.error(f"🔍 VALIDATION - Failed to check document existence: {e}")
                                
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


# =============================================================================
# NEW SIMPLIFIED ARCHITECTURE ENDPOINTS
# =============================================================================

@router.post("/test-connection-v2", response_model=Dict[str, Any])
async def test_paperless_connection_v2(
    connection_data: PaperlessConnectionData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Test connection to paperless-ngx instance using new simplified architecture.
    
    This is the new, cleaner implementation that will replace the original
    test-connection endpoint once fully tested.
    """
    try:
        # Determine if we should use saved credentials
        use_saved_credentials = not any([
            connection_data.paperless_api_token,
            connection_data.paperless_username,
            connection_data.paperless_password
        ])
        
        if use_saved_credentials:
            # Get saved credentials from database
            user_prefs = user_preferences.get_by_user_id(db, current_user.id)
            if not user_prefs:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "No saved credentials found")
            
            # Use saved encrypted credentials
            encrypted_token = user_prefs.paperless_api_token_encrypted
            encrypted_username = user_prefs.paperless_username_encrypted
            encrypted_password = user_prefs.paperless_password_encrypted
            
            logger.info(f"Testing with saved credentials for user {current_user.id}")
        else:
            # Encrypt provided credentials
            encrypted_token = None
            encrypted_username = None
            encrypted_password = None
            
            if connection_data.paperless_api_token:
                encrypted_token = credential_encryption.encrypt_token(connection_data.paperless_api_token)
            
            if connection_data.paperless_username and connection_data.paperless_password:
                encrypted_username = credential_encryption.encrypt_token(connection_data.paperless_username)
                encrypted_password = credential_encryption.encrypt_token(connection_data.paperless_password)
            
            logger.info(f"Testing with provided credentials for user {current_user.id}")
        
        # Create authentication handler
        auth = create_paperless_auth(
            url=connection_data.paperless_url,
            encrypted_token=encrypted_token,
            encrypted_username=encrypted_username,
            encrypted_password=encrypted_password,
            user_id=current_user.id
        )
        
        # Test connection
        success, message = await auth.test_connection()
        
        if success:
            result = {
                "status": "success",
                "message": message,
                "auth_method": auth.get_auth_type(),
                "used_saved_credentials": use_saved_credentials,
                "url": connection_data.paperless_url
            }
            
            logger.info(f"Connection test successful for user {current_user.id}", extra={
                "user_id": current_user.id,
                "auth_method": result["auth_method"],
                "used_saved_credentials": use_saved_credentials,
                "url": connection_data.paperless_url
            })
            
            return result
        else:
            # Connection failed
            logger.warning(f"Connection test failed for user {current_user.id}: {message}")
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Connection failed: {message}")
            
    except HTTPException:
        raise
    except ValueError as e:
        # Authentication setup error (no credentials provided)
        logger.warning(f"Invalid credentials for user {current_user.id}: {e}")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    except SecurityError as e:
        logger.error(f"Security error during connection test for user {current_user.id}: {e}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Security error occurred")
    except Exception as e:
        logger.error(f"Unexpected error during connection test for user {current_user.id}: {e}", extra={
            "user_id": current_user.id,
            "error": str(e),
            "url": connection_data.paperless_url
        })
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Connection test failed")


class BackgroundTaskRequest(BaseModel):
    """Request model for setting background task"""
    entity_type: str = Field(..., description="Type of entity (e.g., 'visit', 'medication')")
    entity_id: int = Field(..., description="ID of the entity")
    file_name: str = Field(..., description="Name of the uploaded file")
    task_uuid: str = Field(..., description="Paperless task UUID")
    sync_status: str = Field(default="processing", description="Sync status to set")


@router.post("/entity-files/set-background-task")
async def set_background_task(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request_data: BackgroundTaskRequest
) -> Dict[str, Any]:
    """
    Set an entity file to background processing status with task UUID.
    
    This endpoint is called when an upload takes longer than expected
    and needs to be tracked in the background.
    """
    try:
        logger.info(f"Setting background task for {request_data.entity_type} {request_data.entity_id}", extra={
            "user_id": current_user.id,
            "entity_type": request_data.entity_type,
            "entity_id": request_data.entity_id,
            "file_name": request_data.file_name,
            "task_uuid": request_data.task_uuid,
            "sync_status": request_data.sync_status
        })

        # Find the entity file record
        from app.models.models import EntityFile
        
        # Look for the most recent entity file for this entity and filename
        entity_file_record = db.query(EntityFile).filter(
            EntityFile.entity_type == request_data.entity_type,
            EntityFile.entity_id == request_data.entity_id,
            EntityFile.file_name == request_data.file_name
        ).order_by(EntityFile.created_at.desc()).first()

        if not entity_file_record:
            logger.error(f"Entity file not found for background task", extra={
                "user_id": current_user.id,
                "entity_type": request_data.entity_type,
                "entity_id": request_data.entity_id,
                "file_name": request_data.file_name
            })
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entity file not found"
            )

        # Update the record with background task information
        entity_file_record.paperless_task_uuid = request_data.task_uuid
        entity_file_record.sync_status = request_data.sync_status
        
        # Commit the changes
        db.commit()
        db.refresh(entity_file_record)
        
        updated_file = entity_file_record
        
        logger.info(f"Successfully set background task for entity file {updated_file.id}", extra={
            "user_id": current_user.id,
            "entity_file_id": updated_file.id,
            "task_uuid": request_data.task_uuid,
            "sync_status": request_data.sync_status
        })

        return {
            "success": True,
            "message": "Background task set successfully",
            "entity_file_id": updated_file.id,
            "task_uuid": request_data.task_uuid,
            "sync_status": request_data.sync_status
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set background task", extra={
            "user_id": current_user.id,
            "entity_type": request_data.entity_type,
            "entity_id": request_data.entity_id,
            "file_name": request_data.file_name,
            "error": str(e)
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set background task"
        )


class BackgroundTaskUpdateRequest(BaseModel):
    """Request model for updating background task result"""
    entity_type: str = Field(..., description="Type of entity")
    entity_id: int = Field(..., description="ID of the entity")
    file_name: str = Field(..., description="Name of the uploaded file")
    task_uuid: str = Field(..., description="Paperless task UUID")
    task_result: Dict[str, Any] = Field(..., description="Final task result from Paperless")
    sync_status: str = Field(..., description="Final sync status ('synced' or 'failed')")


@router.post("/entity-files/update-background-task")
async def update_background_task(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request_data: BackgroundTaskUpdateRequest
) -> Dict[str, Any]:
    """
    Update an entity file with the final result of background task processing.
    
    This endpoint is called when a background task completes to update
    the entity file with the document ID and final sync status.
    """
    try:
        logger.info(f"Updating background task result for {request_data.entity_type} {request_data.entity_id}", extra={
            "user_id": current_user.id,
            "entity_type": request_data.entity_type,
            "entity_id": request_data.entity_id,
            "file_name": request_data.file_name,
            "task_uuid": request_data.task_uuid,
            "task_status": request_data.task_result.get('status'),
            "sync_status": request_data.sync_status
        })

        # Find the entity file record
        from app.models.models import EntityFile
        
        # Look for the entity file with this task UUID
        entity_file_record = db.query(EntityFile).filter(
            EntityFile.entity_type == request_data.entity_type,
            EntityFile.entity_id == request_data.entity_id,
            EntityFile.file_name == request_data.file_name,
            EntityFile.paperless_task_uuid == request_data.task_uuid
        ).first()

        if not entity_file_record:
            logger.error(f"Entity file not found for background task update", extra={
                "user_id": current_user.id,
                "entity_type": request_data.entity_type,
                "entity_id": request_data.entity_id,
                "file_name": request_data.file_name,
                "task_uuid": request_data.task_uuid
            })
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entity file not found"
            )

        # Extract document ID if task was successful
        document_id = None
        if request_data.sync_status == 'synced' and request_data.task_result.get('status') == 'SUCCESS':
            task_result = request_data.task_result
            # Use the same extraction logic as the main task processing
            document_id = (task_result.get('related_document') or 
                          task_result.get('id') or 
                          (task_result.get('result', {}).get('document_id') if isinstance(task_result.get('result'), dict) else None))

        # Update the record with final result
        entity_file_record.sync_status = request_data.sync_status
        if document_id:
            entity_file_record.paperless_document_id = str(document_id)
        
        # Clear the task UUID since the task is now complete (success or failure)
        entity_file_record.paperless_task_uuid = None
        
        # Update last sync timestamp
        from datetime import datetime
        entity_file_record.last_sync_at = datetime.utcnow()
        
        # Commit the changes
        db.commit()
        db.refresh(entity_file_record)
        
        updated_file = entity_file_record
        
        logger.info(f"Successfully updated background task for entity file {updated_file.id}", extra={
            "user_id": current_user.id,
            "entity_file_id": updated_file.id,
            "task_uuid": request_data.task_uuid,
            "sync_status": request_data.sync_status,
            "document_id": document_id
        })

        return {
            "success": True,
            "message": "Background task updated successfully",
            "entity_file_id": updated_file.id,
            "task_uuid": request_data.task_uuid,
            "sync_status": request_data.sync_status,
            "document_id": document_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update background task", extra={
            "user_id": current_user.id,
            "entity_type": request_data.entity_type,
            "entity_id": request_data.entity_id,
            "file_name": request_data.file_name,
            "task_uuid": request_data.task_uuid,
            "error": str(e)
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update background task"
        )