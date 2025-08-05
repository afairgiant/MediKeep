"""
Simplified Paperless Client

A clean, maintainable client for Paperless operations without the complexity
of the original inheritance-based architecture.
"""

from typing import Optional, Tuple, BinaryIO
import aiohttp
from pathlib import Path

from app.core.logging_config import get_logger
from app.services.paperless_auth import PaperlessAuth
from app.services.paperless_task_resolver import PaperlessTaskResolver

logger = get_logger(__name__)


class PaperlessClientError(Exception):
    """Base exception for Paperless client errors."""
    pass


class PaperlessConnectionError(PaperlessClientError):
    """Connection-related errors."""
    pass


class PaperlessUploadError(PaperlessClientError):
    """Upload-related errors."""
    pass


class PaperlessClient:
    """
    Simplified Paperless client with clean, focused functionality.
    
    Replaces the complex inheritance hierarchy with a single, maintainable class.
    """
    
    def __init__(self, auth: PaperlessAuth):
        """Initialize client with authentication."""
        self.auth = auth
        self.task_resolver = PaperlessTaskResolver(auth)
        self._session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._session:
            await self._session.close()
            self._session = None
    
    async def _ensure_session(self):
        """Ensure HTTP session is created."""
        if not self._session:
            headers = self.auth.get_headers()
            auth = self.auth.get_auth()
            
            connector = aiohttp.TCPConnector(
                limit=10,
                limit_per_host=5,
                ttl_dns_cache=300
            )
            
            self._session = aiohttp.ClientSession(
                headers=headers,
                auth=auth,
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=30)
            )
            
            logger.debug(f"Created Paperless session: {self.auth.get_auth_type()} auth")
    
    async def test_connection(self) -> Tuple[bool, str]:
        """Test connection to Paperless."""
        return await self.auth.test_connection()
    
    async def upload_document(self, 
                            file_data: bytes, 
                            filename: str,
                            title: Optional[str] = None,
                            tags: Optional[list] = None) -> str:
        """
        Upload a document to Paperless.
        
        Args:
            file_data: The file content as bytes
            filename: Name of the file
            title: Optional document title
            tags: Optional list of tag names
            
        Returns:
            Task UUID for tracking the upload
            
        Raises:
            PaperlessUploadError: If upload fails
        """
        await self._ensure_session()
        
        try:
            # Prepare form data
            form_data = aiohttp.FormData()
            form_data.add_field(
                'document', 
                file_data, 
                filename=filename,
                content_type='application/octet-stream'
            )
            
            if title:
                form_data.add_field('title', title)
            
            if tags:
                for tag in tags:
                    form_data.add_field('tags', tag)
            
            logger.debug(f"Uploading document: {filename}")
            
            # Upload document
            url = f"{self.auth.url}/api/documents/post_document/"
            async with self._session.post(url, data=form_data) as response:
                
                if response.status not in [200, 201]:
                    error_text = await response.text()
                    logger.error(f"Document upload failed: {response.status} - {error_text}")
                    raise PaperlessUploadError(f"Upload failed with status {response.status}: {error_text}")
                
                # Extract task UUID from response
                task_uuid = await response.text()
                task_uuid = task_uuid.strip().strip('"')
                
                if not task_uuid:
                    raise PaperlessUploadError("No task UUID returned from upload")
                
                logger.info(f"Document uploaded successfully: {filename} -> task {task_uuid}")
                return task_uuid
                
        except aiohttp.ClientError as e:
            logger.error(f"Upload connection error: {e}")
            raise PaperlessConnectionError(f"Connection error during upload: {e}")
        except Exception as e:
            logger.error(f"Unexpected upload error: {e}")
            raise PaperlessUploadError(f"Upload error: {e}")
    
    async def resolve_task(self, task_uuid: str) -> Tuple[str, Optional[str]]:
        """
        Resolve upload task to get document ID.
        
        Returns:
            Tuple of (status, document_id)
        """
        return await self.task_resolver.resolve_task(task_uuid)
    
    async def download_document(self, document_id: str) -> bytes:
        """
        Download a document by ID.
        
        Args:
            document_id: The document ID to download
            
        Returns:
            Document content as bytes
            
        Raises:
            PaperlessClientError: If download fails
        """
        await self._ensure_session()
        
        try:
            url = f"{self.auth.url}/api/documents/{document_id}/download/"
            
            async with self._session.get(url) as response:
                if response.status == 404:
                    raise PaperlessClientError(f"Document {document_id} not found")
                elif response.status == 403:
                    raise PaperlessClientError(f"Access denied to document {document_id}")
                elif response.status != 200:
                    raise PaperlessClientError(f"Download failed with status {response.status}")
                
                content = await response.read()
                logger.debug(f"Downloaded document {document_id}: {len(content)} bytes")
                return content
                
        except aiohttp.ClientError as e:
            logger.error(f"Download connection error: {e}")
            raise PaperlessConnectionError(f"Connection error during download: {e}")
    
    async def delete_document(self, document_id: str) -> bool:
        """
        Delete a document by ID.
        
        Args:
            document_id: The document ID to delete
            
        Returns:
            True if deletion successful
            
        Raises:
            PaperlessClientError: If deletion fails
        """
        await self._ensure_session()
        
        try:
            url = f"{self.auth.url}/api/documents/{document_id}/"
            
            async with self._session.delete(url) as response:
                if response.status == 404:
                    logger.warning(f"Document {document_id} not found for deletion")
                    return True  # Already gone
                elif response.status not in [200, 204]:
                    raise PaperlessClientError(f"Delete failed with status {response.status}")
                
                logger.info(f"Document {document_id} deleted successfully")
                return True
                
        except aiohttp.ClientError as e:
            logger.error(f"Delete connection error: {e}")
            raise PaperlessConnectionError(f"Connection error during delete: {e}")
    
    async def get_document_info(self, document_id: str) -> Optional[dict]:
        """
        Get document metadata.
        
        Args:
            document_id: The document ID
            
        Returns:
            Document metadata dict or None if not found
        """
        await self._ensure_session()
        
        try:
            url = f"{self.auth.url}/api/documents/{document_id}/"
            
            async with self._session.get(url) as response:
                if response.status == 404:
                    return None
                elif response.status != 200:
                    raise PaperlessClientError(f"Get info failed with status {response.status}")
                
                return await response.json()
                
        except aiohttp.ClientError as e:
            logger.error(f"Get info connection error: {e}")
            raise PaperlessConnectionError(f"Connection error getting document info: {e}")


def create_paperless_client(url: str, 
                           encrypted_token: str = None,
                           encrypted_username: str = None, 
                           encrypted_password: str = None,
                           user_id: int = None) -> PaperlessClient:
    """
    Factory function to create a PaperlessClient from encrypted credentials.
    
    Args:
        url: Paperless instance URL
        encrypted_token: Encrypted API token  
        encrypted_username: Encrypted username
        encrypted_password: Encrypted password
        user_id: User ID for logging context
        
    Returns:
        PaperlessClient instance
    """
    from app.services.paperless_auth import create_paperless_auth
    
    auth = create_paperless_auth(
        url=url,
        encrypted_token=encrypted_token,
        encrypted_username=encrypted_username,
        encrypted_password=encrypted_password,
        user_id=user_id
    )
    
    return PaperlessClient(auth)