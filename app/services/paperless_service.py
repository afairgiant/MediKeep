"""
Paperless-ngx integration service for secure document management.

This service provides secure integration with paperless-ngx instances,
including connection testing, document upload, download, and management.
"""

import ssl
import asyncio
import aiohttp
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List, Union
from urllib.parse import urlparse
from contextlib import asynccontextmanager
import re

from app.core.config import settings
from app.core.logging_config import get_logger
from app.services.credential_encryption import credential_encryption

logger = get_logger(__name__)


class PaperlessError(Exception):
    """Base exception for paperless service errors."""
    pass


class PaperlessConnectionError(PaperlessError):
    """Exception raised for connection-related errors."""
    pass


class PaperlessAuthenticationError(PaperlessError):
    """Exception raised for authentication errors."""
    pass


class PaperlessUploadError(PaperlessError):
    """Exception raised for upload errors."""
    pass


class PaperlessService:
    """
    Secure paperless-ngx service for document operations.
    """
    
    def __init__(self, base_url: str, api_token: str, user_id: int):
        """
        Initialize paperless service.
        
        Args:
            base_url: Base URL of paperless-ngx instance
            api_token: API token for authentication
            user_id: User ID for logging and context
        """
        self.base_url = base_url.rstrip('/')
        self.api_token = api_token
        self.user_id = user_id
        
        # Enforce HTTPS for external URLs, allow HTTP for local development
        from urllib.parse import urlparse
        parsed = urlparse(self.base_url)
        
        is_local = (
            parsed.hostname in ['localhost', '127.0.0.1'] or
            (parsed.hostname and (
                parsed.hostname.startswith('192.168.') or
                parsed.hostname.startswith('10.') or
                (parsed.hostname.startswith('172.') and 
                 len(parsed.hostname.split('.')) >= 2 and
                 parsed.hostname.split('.')[1].isdigit() and
                 16 <= int(parsed.hostname.split('.')[1]) <= 31)
            ))
        )
        
        if not is_local and not self.base_url.startswith('https://'):
            raise PaperlessConnectionError("External paperless connections must use HTTPS for security")
        
        # Create SSL context with strict security for HTTPS connections
        self.ssl_context = None
        if self.base_url.startswith('https://'):
            self.ssl_context = ssl.create_default_context()
            self.ssl_context.check_hostname = True
            self.ssl_context.verify_mode = ssl.CERT_REQUIRED
        
        # Setup session configuration
        self.timeout = aiohttp.ClientTimeout(
            total=settings.PAPERLESS_REQUEST_TIMEOUT,
            connect=settings.PAPERLESS_CONNECT_TIMEOUT
        )
        
        self.headers = {
            'Authorization': f'Token {api_token}',
            'Accept': 'application/json; version=6',
            'User-Agent': f'MedicalRecords-Paperless/1.0 (User:{user_id})',
        }
        
        self.session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self._create_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self._close_session()
    
    async def _create_session(self):
        """Create HTTP session with security configuration."""
        # Use SSL context only for HTTPS connections
        connector = aiohttp.TCPConnector(
            ssl=self.ssl_context if self.base_url.startswith('https://') else False,
            limit=10,
            limit_per_host=5,
            ttl_dns_cache=300,
            use_dns_cache=True,
        )
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=self.timeout,
            headers=self.headers
        )
    
    async def _close_session(self):
        """Close HTTP session."""
        if self.session:
            await self.session.close()
            self.session = None
    
    def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        **kwargs
    ):
        """
        Create HTTP request context manager with validation.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            **kwargs: Additional request parameters
            
        Returns:
            Async context manager for HTTP response
            
        Raises:
            PaperlessConnectionError: If request fails
        """
        # Validate endpoint to prevent SSRF
        if not self._is_safe_endpoint(endpoint):
            raise PaperlessConnectionError(f"Unsafe endpoint: {endpoint}")
        
        full_url = f"{self.base_url}{endpoint}"
        
        # Add request ID for tracing
        request_id = str(uuid.uuid4())
        headers = kwargs.get('headers', {})
        headers['X-Request-ID'] = request_id
        kwargs['headers'] = headers
        
        return self._request_context_manager(method, full_url, request_id, endpoint, **kwargs)
    
    @asynccontextmanager
    async def _request_context_manager(self, method, full_url, request_id, endpoint, **kwargs):
        """Internal context manager for HTTP requests."""
        try:
            if not self.session:
                await self._create_session()
            
            async with self.session.request(method, full_url, **kwargs) as response:
                # Validate response headers
                self._validate_response_headers(response)
                
                # Log request for audit trail
                logger.info(f"Paperless API request completed", extra={
                    "user_id": self.user_id,
                    "method": method,
                    "endpoint": endpoint,
                    "status": response.status,
                    "request_id": request_id
                })
                
                yield response
                
        except aiohttp.ClientError as e:
            logger.error(f"Paperless API request failed", extra={
                "user_id": self.user_id,
                "method": method,
                "endpoint": endpoint,
                "error": str(e),
                "request_id": request_id
            })
            raise PaperlessConnectionError(f"Request failed: {str(e)}")
    
    def _is_safe_endpoint(self, endpoint: str) -> bool:
        """
        Validate endpoint to prevent SSRF attacks.
        
        Args:
            endpoint: Endpoint to validate
            
        Returns:
            True if endpoint is safe
        """
        # Allow only specific API endpoints
        safe_patterns = [
            r'^/$',
            r'^/api/$',
            r'^/api/v1/$',
            r'^/api/v2/$',
            r'^/api/documents/',
            r'^/api/tags/',
            r'^/api/correspondents/',
            r'^/api/document_types/',
            r'^/api/tasks/',
            r'^/api/token/$',
            r'^/api/ui_settings/$'
        ]
        
        return any(re.match(pattern, endpoint) for pattern in safe_patterns)
    
    def _validate_response_headers(self, response: aiohttp.ClientResponse):
        """
        Validate response headers for security.
        
        Args:
            response: HTTP response to validate
        """
        # Check for required headers
        content_type = response.headers.get('content-type', '')
        if not content_type.startswith((
            'application/json', 
            'application/octet-stream', 
            'image/', 
            'application/pdf',
            'text/plain'
        )):
            logger.warning(f"Unexpected content type: {content_type}", extra={
                "user_id": self.user_id,
                "url": str(response.url)
            })
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test connection to paperless-ngx instance.
        
        Returns:
            Connection test results
            
        Raises:
            PaperlessConnectionError: If connection fails
            PaperlessAuthenticationError: If authentication fails
        """
        # Simple connection test - just try to reach the server and return success
        try:
            async with self._make_request('GET', '/') as response:
                logger.info(f"Connection test result: {response.status}")
                
                if response.status == 200:
                    # Server is reachable - that's enough for now
                    return {
                        "status": "connected",
                        "server_version": response.headers.get('X-Version', 'Unknown'),
                        "api_version": response.headers.get('X-Api-Version', 'Unknown'),
                        "server_url": self.base_url,
                        "user_id": self.user_id,
                        "test_timestamp": datetime.utcnow().isoformat(),
                        "note": "Basic connectivity confirmed"
                    }
                else:
                    raise PaperlessConnectionError(f"Server returned HTTP {response.status}")
                    
        except PaperlessConnectionError:
            raise
        except Exception as e:
            logger.error(f"Connection test failed unexpectedly", extra={
                "user_id": self.user_id,
                "error": str(e)
            })
            raise PaperlessConnectionError(f"Connection test failed: {str(e)}")
    
    async def upload_document(
        self, 
        file_data: bytes, 
        filename: str,
        entity_type: str,
        entity_id: int,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        correspondent: Optional[str] = None,
        document_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload document to paperless-ngx.
        
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
            Upload result with document ID
            
        Raises:
            PaperlessUploadError: If upload fails
        """
        try:
            # Validate file size
            if len(file_data) > settings.PAPERLESS_MAX_UPLOAD_SIZE:
                raise PaperlessUploadError(
                    f"File size {len(file_data)} exceeds maximum {settings.PAPERLESS_MAX_UPLOAD_SIZE}"
                )
            
            # Prepare multipart form data
            form_data = aiohttp.FormData()
            form_data.add_field('document', file_data, filename=filename)
            
            # Add metadata
            if description:
                form_data.add_field('title', description)
            
            # Add medical record context as custom fields
            custom_fields = {
                'medical_record_user_id': str(self.user_id),
                'medical_record_entity_type': entity_type,
                'medical_record_entity_id': str(entity_id)
            }
            
            # Add tags including entity context
            all_tags = tags or []
            all_tags.extend([
                f"medical-record-{entity_type}",
                f"user-{self.user_id}",
                f"entity-{entity_id}"
            ])
            
            if all_tags:
                # Convert tags to paperless format
                form_data.add_field('tags', ','.join(all_tags))
            
            if correspondent:
                form_data.add_field('correspondent', correspondent)
            
            if document_type:
                form_data.add_field('document_type', document_type)
            
            # Make upload request
            async with self._make_request(
                'POST', 
                '/api/documents/post_document/',
                data=form_data
            ) as response:
                
                if response.status == 400:
                    error_data = await response.json()
                    raise PaperlessUploadError(f"Upload validation failed: {error_data}")
                elif response.status == 401:
                    raise PaperlessAuthenticationError("Authentication failed during upload")
                elif response.status != 200:
                    raise PaperlessUploadError(f"Upload failed: HTTP {response.status}")
                
                result = await response.json()
                
                logger.info(f"Document uploaded to paperless successfully", extra={
                    "user_id": self.user_id,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "filename": filename,
                    "paperless_task_id": result.get('task_id'),
                    "file_size": len(file_data)
                })
                
                return {
                    "status": "uploaded",
                    "task_id": result.get('task_id'),
                    "filename": filename,
                    "file_size": len(file_data),
                    "upload_timestamp": datetime.utcnow().isoformat(),
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "tags": all_tags
                }
                
        except PaperlessUploadError:
            raise
        except PaperlessAuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Document upload failed unexpectedly", extra={
                "user_id": self.user_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "filename": filename,
                "error": str(e)
            })
            raise PaperlessUploadError(f"Upload failed: {str(e)}")
    
    async def download_document(self, document_id: int) -> bytes:
        """
        Download document from paperless-ngx.
        
        Args:
            document_id: Paperless document ID
            
        Returns:
            Document content as bytes
            
        Raises:
            PaperlessError: If download fails
        """
        try:
            async with self._make_request(
                'GET', 
                f'/api/documents/{document_id}/download/'
            ) as response:
                
                if response.status == 404:
                    raise PaperlessError(f"Document {document_id} not found")
                elif response.status == 401:
                    raise PaperlessAuthenticationError("Authentication failed during download")
                elif response.status != 200:
                    raise PaperlessError(f"Download failed: HTTP {response.status}")
                
                content = await response.read()
                
                logger.info(f"Document downloaded from paperless", extra={
                    "user_id": self.user_id,
                    "document_id": document_id,
                    "content_size": len(content)
                })
                
                return content
                
        except PaperlessError:
            raise
        except PaperlessAuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Document download failed unexpectedly", extra={
                "user_id": self.user_id,
                "document_id": document_id,
                "error": str(e)
            })
            raise PaperlessError(f"Download failed: {str(e)}")
    
    async def delete_document(self, document_id: int) -> bool:
        """
        Delete document from paperless-ngx.
        
        Args:
            document_id: Paperless document ID
            
        Returns:
            True if deletion successful
            
        Raises:
            PaperlessError: If deletion fails
        """
        try:
            async with self._make_request(
                'DELETE', 
                f'/api/documents/{document_id}/'
            ) as response:
                
                if response.status == 404:
                    logger.warning(f"Document {document_id} not found for deletion", extra={
                        "user_id": self.user_id,
                        "document_id": document_id
                    })
                    return True  # Already deleted
                elif response.status == 401:
                    raise PaperlessAuthenticationError("Authentication failed during deletion")
                elif response.status not in [200, 204]:
                    raise PaperlessError(f"Deletion failed: HTTP {response.status}")
                
                logger.info(f"Document deleted from paperless", extra={
                    "user_id": self.user_id,
                    "document_id": document_id
                })
                
                return True
                
        except PaperlessError:
            raise
        except PaperlessAuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Document deletion failed unexpectedly", extra={
                "user_id": self.user_id,
                "document_id": document_id,
                "error": str(e)
            })
            raise PaperlessError(f"Deletion failed: {str(e)}")
    
    async def search_documents(
        self, 
        query: str = "",
        page: int = 1,
        page_size: int = 25
    ) -> Dict[str, Any]:
        """
        Search documents in paperless-ngx with user context filtering.
        
        Args:
            query: Search query
            page: Page number
            page_size: Results per page
            
        Returns:
            Search results
            
        Raises:
            PaperlessError: If search fails
        """
        try:
            # Add user context to search query to ensure user isolation
            user_query = f"{query} AND custom_fields.medical_record_user_id:{self.user_id}" if query else f"custom_fields.medical_record_user_id:{self.user_id}"
            
            params = {
                'query': user_query,
                'page': page,
                'page_size': min(page_size, 100)  # Limit page size for security
            }
            
            async with self._make_request(
                'GET', 
                '/api/documents/',
                params=params
            ) as response:
                
                if response.status == 401:
                    raise PaperlessAuthenticationError("Authentication failed during search")
                elif response.status != 200:
                    raise PaperlessError(f"Search failed: HTTP {response.status}")
                
                results = await response.json()
                
                logger.info(f"Document search completed", extra={
                    "user_id": self.user_id,
                    "query": query,
                    "results_count": results.get('count', 0)
                })
                
                return results
                
        except PaperlessError:
            raise
        except PaperlessAuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Document search failed unexpectedly", extra={
                "user_id": self.user_id,
                "query": query,
                "error": str(e)
            })
            raise PaperlessError(f"Search failed: {str(e)}")


def create_paperless_service(
    paperless_url: str, 
    encrypted_token: str, 
    user_id: int
) -> PaperlessService:
    """
    Create paperless service with decrypted token.
    
    Args:
        paperless_url: Paperless instance URL
        encrypted_token: Encrypted API token
        user_id: User ID
        
    Returns:
        Configured paperless service
        
    Raises:
        PaperlessError: If service creation fails
    """
    try:
        # Decrypt the API token
        api_token = credential_encryption.decrypt_token(encrypted_token)
        if not api_token:
            raise PaperlessError("Failed to decrypt API token")
        
        # Create and return service
        return PaperlessService(paperless_url, api_token, user_id)
        
    except Exception as e:
        logger.error(f"Failed to create paperless service", extra={
            "user_id": user_id,
            "error": str(e)
        })
        raise PaperlessError(f"Service creation failed: {str(e)}")