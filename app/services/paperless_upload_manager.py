"""
Paperless Upload Manager with smart timeout handling.

This module provides intelligent upload management that doesn't timeout
while Paperless is actively processing documents.
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from enum import Enum

from app.core.config import settings
from app.core.logging.config import get_logger
from app.services.paperless_service import (
    PaperlessServiceBase,
    PaperlessUploadError,
    PaperlessConnectionError,
    PaperlessAuthenticationError
)

logger = get_logger(__name__)


class ProcessingStatus(Enum):
    """Document processing status."""
    UPLOADING = "uploading"
    PENDING = "pending"
    STARTED = "started"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    UNKNOWN = "unknown"


class SmartPaperlessUploadManager:
    """
    Smart upload manager that monitors processing status and prevents
    premature timeouts while Paperless is actively processing.
    """
    
    def __init__(self, paperless_service: PaperlessServiceBase):
        self.service = paperless_service
        self.max_processing_time = settings.PAPERLESS_PROCESSING_TIMEOUT
        self.status_check_interval = settings.PAPERLESS_STATUS_CHECK_INTERVAL
        
    async def upload_with_smart_timeout(
        self,
        file_data: bytes,
        filename: str,
        entity_type: str,
        entity_id: int,
        description: Optional[str] = None,
        tags: Optional[list] = None,
        correspondent: Optional[str] = None,
        document_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Upload document with smart timeout that monitors processing status.
        
        This method:
        1. Uploads the document (with extended upload timeout)
        2. Monitors processing status until completion
        3. Only times out if there's no processing activity
        
        Args:
            file_data: File content as bytes
            filename: Original filename
            entity_type: Medical record entity type
            entity_id: Medical record entity ID
            description: Optional document description
            tags: Optional list of tags
            correspondent: Optional correspondent name
            document_type: Optional document type
            
        Returns:
            Upload result with document ID or task status
            
        Raises:
            PaperlessUploadError: If upload fails or processing times out
            PaperlessConnectionError: If connection fails
            PaperlessAuthenticationError: If authentication fails
        """
        start_time = datetime.utcnow()
        
        try:
            # Phase 1: Upload the document (uses extended upload timeout)
            logger.info(f"Starting smart upload for: {filename} (size: {len(file_data)} bytes)")
            
            upload_result = await self.service.upload_document(
                file_data=file_data,
                filename=filename,
                entity_type=entity_type,
                entity_id=entity_id,
                description=description,
                tags=tags,
                correspondent=correspondent,
                document_type=document_type
            )
            
            task_uuid = upload_result.get("task_id")
            if not task_uuid:
                raise PaperlessUploadError("No task UUID returned from upload")
            
            logger.info(f"Upload initiated successfully, monitoring task: {task_uuid}")
            
            # Phase 2: Smart monitoring of processing status
            return await self._monitor_processing_with_smart_timeout(
                task_uuid, filename, start_time
            )
            
        except (PaperlessUploadError, PaperlessConnectionError, PaperlessAuthenticationError):
            # Re-raise known errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error during smart upload: {e}")
            raise PaperlessUploadError(f"Upload failed: {str(e)}")
    
    async def _monitor_processing_with_smart_timeout(
        self, 
        task_uuid: str, 
        filename: str, 
        start_time: datetime
    ) -> Dict[str, Any]:
        """
        Monitor processing status with intelligent timeout handling.
        
        This method tracks processing activity and only times out if:
        1. Total time exceeds maximum processing time AND
        2. There's been no status change for a significant period
        
        Args:
            task_uuid: Task UUID to monitor
            filename: Filename for logging
            start_time: When the upload started
            
        Returns:
            Processing result with document ID or status
        """
        last_status = ProcessingStatus.UNKNOWN
        last_status_change = datetime.utcnow()
        status_check_count = 0
        
        logger.info(f"Starting smart timeout monitoring for task {task_uuid}")
        
        while True:
            status_check_count += 1
            current_time = datetime.utcnow()
            elapsed_total = (current_time - start_time).total_seconds()
            elapsed_since_change = (current_time - last_status_change).total_seconds()
            
            try:
                # Check task status
                current_status, result = await self._get_task_status(task_uuid)
                
                # Log status check
                logger.debug(f"Status check #{status_check_count} for {task_uuid}: {current_status.value} "
                           f"(total: {elapsed_total:.1f}s, since change: {elapsed_since_change:.1f}s)")
                
                # Track status changes
                if current_status != last_status:
                    logger.info(f"Task {task_uuid} status changed: {last_status.value} -> {current_status.value}")
                    last_status = current_status
                    last_status_change = current_time
                    elapsed_since_change = 0
                
                # Handle completed states
                if current_status == ProcessingStatus.SUCCESS:
                    total_time = elapsed_total
                    logger.info(f"Document processing completed successfully in {total_time:.1f}s: {filename}")
                    return {
                        "status": "completed",
                        "task_id": task_uuid,
                        "document_id": result,
                        "filename": filename,
                        "processing_time": total_time,
                        "status_checks": status_check_count
                    }
                
                elif current_status == ProcessingStatus.FAILURE:
                    logger.error(f"Document processing failed for {filename}: {result}")
                    raise PaperlessUploadError(f"Document processing failed: {result}")
                
                # Handle timeout conditions with intelligence
                timeout_reasons = []
                should_timeout = False
                
                # Hard timeout: Exceeded maximum processing time
                if elapsed_total > self.max_processing_time:
                    timeout_reasons.append(f"exceeded maximum processing time ({self.max_processing_time}s)")
                    should_timeout = True
                
                # Soft timeout: No status change for extended period (only if in non-active state)
                stale_threshold = 300  # 5 minutes without status change
                if (elapsed_since_change > stale_threshold and 
                    current_status not in [ProcessingStatus.STARTED, ProcessingStatus.PROCESSING]):
                    timeout_reasons.append(f"no status change for {elapsed_since_change:.1f}s in {current_status.value} state")
                    should_timeout = True
                
                # Apply timeout
                if should_timeout:
                    timeout_msg = f"Processing timeout for {filename} after {elapsed_total:.1f}s: {', '.join(timeout_reasons)}"
                    logger.warning(timeout_msg)
                    raise PaperlessUploadError(timeout_msg)
                
                # Log progress for long-running operations
                if status_check_count % 6 == 0:  # Every ~1 minute with 10s intervals
                    logger.info(f"Still processing {filename}: {current_status.value} for {elapsed_total:.1f}s "
                              f"(last change {elapsed_since_change:.1f}s ago)")
                
                # Wait before next status check
                await asyncio.sleep(self.status_check_interval)
                
            except (PaperlessUploadError, PaperlessConnectionError, PaperlessAuthenticationError):
                # Re-raise known errors
                raise
            except Exception as e:
                logger.warning(f"Error checking task status: {e}")
                # For temporary errors, continue monitoring unless we've exceeded total timeout
                if elapsed_total > self.max_processing_time:
                    raise PaperlessUploadError(f"Processing timeout after status check error: {e}")
                await asyncio.sleep(self.status_check_interval)
    
    async def _get_task_status(self, task_uuid: str) -> Tuple[ProcessingStatus, Optional[str]]:
        """
        Get task status from Paperless.
        
        Args:
            task_uuid: Task UUID to check
            
        Returns:
            Tuple of (status, result/document_id)
        """
        try:
            # Use the service's task status method
            async with self.service._make_request("GET", f"/api/tasks/?task_id={task_uuid}") as response:
                if response.status != 200:
                    logger.warning(f"Task status check returned {response.status}")
                    return ProcessingStatus.UNKNOWN, None
                
                data = await response.json()
                
                # Handle response format
                if isinstance(data, list):
                    if not data:
                        return ProcessingStatus.UNKNOWN, None
                    task_data = data[0]
                elif isinstance(data, dict):
                    if "results" in data and data["results"]:
                        task_data = data["results"][0]
                    else:
                        task_data = data
                else:
                    return ProcessingStatus.UNKNOWN, None
                
                # Parse status
                status_str = task_data.get("status", "").lower()
                
                if status_str == "success":
                    # Extract document ID
                    document_id = await self._extract_document_id(task_data)
                    return ProcessingStatus.SUCCESS, document_id
                elif status_str == "failure":
                    error_msg = task_data.get("result", "Unknown error")
                    return ProcessingStatus.FAILURE, error_msg
                elif status_str in ["pending", "started", "retry"]:
                    # Map to appropriate processing status
                    if status_str == "started":
                        return ProcessingStatus.STARTED, None
                    else:
                        return ProcessingStatus.PENDING, None
                else:
                    return ProcessingStatus.UNKNOWN, None
                
        except Exception as e:
            logger.warning(f"Error getting task status for {task_uuid}: {e}")
            return ProcessingStatus.UNKNOWN, None
    
    async def _extract_document_id(self, task_data: Dict[str, Any]) -> Optional[str]:
        """Extract document ID from task result."""
        result = task_data.get("result", {})
        
        # Try various ways to extract document ID
        document_id = task_data.get('related_document')
        if document_id:
            return str(document_id)
        
        if isinstance(result, dict):
            document_id = result.get("document_id") or result.get("id")
        elif isinstance(result, str):
            # Parse from result string
            import re
            match = re.search(r'document id (\d+)', result)
            if match:
                document_id = match.group(1)
            else:
                document_id = result
        
        return str(document_id) if document_id else None


async def smart_upload_to_paperless(
    paperless_service: PaperlessServiceBase,
    file_data: bytes,
    filename: str,
    entity_type: str,
    entity_id: int,
    description: Optional[str] = None,
    tags: Optional[list] = None,
    correspondent: Optional[str] = None,
    document_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Convenience function for smart paperless uploads.
    
    This is the main entry point for intelligent paperless uploads that
    won't timeout while documents are actively being processed.
    """
    manager = SmartPaperlessUploadManager(paperless_service)
    
    return await manager.upload_with_smart_timeout(
        file_data=file_data,
        filename=filename,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        tags=tags,
        correspondent=correspondent,
        document_type=document_type
    )