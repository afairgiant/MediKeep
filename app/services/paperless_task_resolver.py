"""
Simplified Paperless Task Resolution

Replaces the complex task resolution logic with a single, clear method.
"""

import re
from typing import Optional, Tuple
import aiohttp
from app.core.logging_config import get_logger
from app.services.paperless_auth import PaperlessAuth

logger = get_logger(__name__)


class PaperlessTaskResolver:
    """Simple, reliable task resolution for Paperless uploads."""
    
    def __init__(self, auth: PaperlessAuth):
        """Initialize with authentication handler."""
        self.auth = auth
    
    async def resolve_task(self, task_uuid: str) -> Tuple[str, Optional[str]]:
        """
        Resolve a Paperless task UUID to get the final document ID.
        
        Args:
            task_uuid: The task UUID from upload
            
        Returns:
            Tuple of (status, document_id)
            - status: 'success', 'failed', 'processing', 'not_found'
            - document_id: The final document ID if successful, None otherwise
        """
        logger.debug(f"Resolving task: {task_uuid}")
        
        try:
            task_data = await self._get_task_status(task_uuid)
            
            if not task_data:
                logger.debug(f"Task {task_uuid} not found or still queued")
                return 'processing', None
            
            status = task_data.get('status', '').lower()
            logger.debug(f"Task {task_uuid} status: {status}")
            
            if status == 'success':
                # Try to extract document ID
                document_id = self._extract_document_id(task_data)
                
                if document_id:
                    # Verify the document actually exists
                    if await self._verify_document_exists(document_id):
                        logger.debug(f"Task {task_uuid} resolved to document {document_id}")
                        return 'success', document_id
                    else:
                        logger.warning(f"Task {task_uuid} claims success but document {document_id} doesn't exist")
                        return 'failed', None
                else:
                    logger.warning(f"Task {task_uuid} successful but no document ID found")
                    return 'failed', None
                    
            elif status in ['failure', 'failed']:
                logger.debug(f"Task {task_uuid} failed")
                return 'failed', None
                
            else:  # pending, started, retry, etc.
                logger.debug(f"Task {task_uuid} still processing")
                return 'processing', None
                
        except Exception as e:
            logger.error(f"Error resolving task {task_uuid}: {e}")
            return 'failed', None
    
    async def _get_task_status(self, task_uuid: str) -> Optional[dict]:
        """Get task status from Paperless API."""
        try:
            headers = self.auth.get_headers()
            auth = self.auth.get_auth()
            
            async with aiohttp.ClientSession(headers=headers, auth=auth) as session:
                url = f"{self.auth.url}/api/tasks/?task_id={task_uuid}"
                
                async with session.get(url) as response:
                    if response.status != 200:
                        logger.debug(f"Task status request failed: {response.status}")
                        return None
                    
                    data = await response.json()
                    
                    # Handle different response formats
                    if isinstance(data, list) and data:
                        return data[0]
                    elif isinstance(data, dict):
                        if "results" in data and data["results"]:
                            return data["results"][0]
                        elif "status" in data:  # Direct task object
                            return data
                    
                    return None
                    
        except Exception as e:
            logger.debug(f"Error fetching task status for {task_uuid}: {e}")
            return None
    
    def _extract_document_id(self, task_data: dict) -> Optional[str]:
        """
        Extract document ID from task result data.
        
        Uses a simple, single-method approach instead of multiple fallbacks.
        """
        result = task_data.get('result', {})
        
        # Try direct extraction from result object
        if isinstance(result, dict):
            # Common locations for document ID
            doc_id = (
                result.get('document_id') or
                result.get('id') or  
                result.get('document') or
                result.get('doc_id')
            )
            if doc_id:
                return str(doc_id)
        
        # Try string parsing for text results
        if isinstance(result, str):
            # Look for patterns like "document id 123" or "created document 456"
            patterns = [
                r'document id (\d+)',
                r'created document (\d+)', 
                r'document (\d+)',
                r'id[:\s]+(\d+)'
            ]
            
            for pattern in patterns:
                match = re.search(pattern, result, re.IGNORECASE)
                if match:
                    return match.group(1)
        
        # Check task data itself for document reference
        doc_id = task_data.get('document_id') or task_data.get('related_document')
        if doc_id:
            return str(doc_id)
        
        return None
    
    async def _verify_document_exists(self, document_id: str) -> bool:
        """Verify that a document actually exists in Paperless."""
        try:
            # Validate it's a numeric ID
            int(document_id)
            
            headers = self.auth.get_headers()
            auth = self.auth.get_auth()
            
            async with aiohttp.ClientSession(headers=headers, auth=auth) as session:
                url = f"{self.auth.url}/api/documents/{document_id}/"
                
                async with session.get(url) as response:
                    exists = response.status == 200
                    logger.debug(f"Document {document_id} exists: {exists}")
                    return exists
                    
        except (ValueError, Exception) as e:
            logger.debug(f"Error verifying document {document_id}: {e}")
            return False