"""
Paperless-ngx integration service for secure document management.

This service provides secure integration with paperless-ngx instances,
including connection testing, document upload, download, and management.
"""

import asyncio
import re
import ssl
import uuid
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

import aiohttp

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


class PaperlessServiceBase(ABC):
    """
    Abstract base class for paperless-ngx service with common functionality.
    """

    def __init__(self, base_url: str, user_id: int):
        """
        Initialize base paperless service.

        Args:
            base_url: Base URL of paperless-ngx instance
            user_id: User ID for logging and context
        """
        self.base_url = base_url.rstrip("/")
        self.user_id = user_id

        # Enforce HTTPS for external URLs, allow HTTP for local development
        parsed = urlparse(self.base_url)

        is_local = parsed.hostname in ["localhost", "127.0.0.1"] or (
            parsed.hostname
            and (
                parsed.hostname.startswith("192.168.")
                or parsed.hostname.startswith("10.")
                or (
                    parsed.hostname.startswith("172.")
                    and len(parsed.hostname.split(".")) >= 2
                    and parsed.hostname.split(".")[1].isdigit()
                    and 16 <= int(parsed.hostname.split(".")[1]) <= 31
                )
            )
        )

        if not is_local and not self.base_url.startswith("https://"):
            raise PaperlessConnectionError(
                "External paperless connections must use HTTPS for security"
            )

        # Create SSL context with strict security for HTTPS connections
        self.ssl_context = None
        if self.base_url.startswith("https://"):
            self.ssl_context = ssl.create_default_context()
            self.ssl_context.check_hostname = True
            self.ssl_context.verify_mode = ssl.CERT_REQUIRED

        # Setup session configuration
        self.timeout = aiohttp.ClientTimeout(
            total=settings.PAPERLESS_REQUEST_TIMEOUT,
            connect=settings.PAPERLESS_CONNECT_TIMEOUT,
        )

        # Test without API version to troubleshoot 403 errors
        self.headers = {
            "Accept": "application/json",
            "User-Agent": f"MedicalRecords-Paperless/1.0 (User:{user_id})",
        }

        self.session = None

    async def __aenter__(self):
        """Async context manager entry."""
        await self._create_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self._close_session()

    @abstractmethod
    async def _create_session(self):
        """Create HTTP session with authentication - must be implemented by subclasses."""
        pass

    @abstractmethod
    def get_auth_type(self) -> str:
        """Return authentication type for logging."""
        pass

    async def _close_session(self):
        """Close HTTP session."""
        if self.session:
            await self.session.close()
            self.session = None

    def _make_request(self, method: str, endpoint: str, **kwargs):
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
        headers = kwargs.get("headers", {})
        headers["X-Request-ID"] = request_id
        kwargs["headers"] = headers

        return self._request_context_manager(
            method, full_url, request_id, endpoint, **kwargs
        )

    @asynccontextmanager
    async def _request_context_manager(
        self, method, full_url, request_id, endpoint, **kwargs
    ):
        """Internal context manager for HTTP requests."""
        try:
            if not self.session:
                await self._create_session()

            # Debug logging - show what we're sending
            headers_to_log = dict(self.session.headers)
            if "Authorization" in headers_to_log:
                auth_header = headers_to_log["Authorization"]
                if auth_header.startswith("Token "):
                    token = auth_header[6:]  # Remove "Token " prefix
                    headers_to_log["Authorization"] = f"Token {token[:8]}...{token[-4:]}" if len(token) > 12 else f"Token {token}"
            
            # Enhanced logging - show EXACT request details
            logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Method: {method}")
            logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Full URL: {full_url}")
            logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Session Headers: {dict(self.session.headers)}")
            logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Request kwargs: {kwargs}")
            logger.error(f"🔍 PAPERLESS REQUEST DEBUG - User ID: {self.user_id}")
            
            logger.info(
                f"Making Paperless HTTP request",
                extra={
                    "user_id": self.user_id,
                    "method": method,
                    "url": full_url,
                    "request_id": request_id,
                    "session_headers": headers_to_log,
                    "request_kwargs": {k: v for k, v in kwargs.items() if k != "headers"}
                }
            )

            async with self.session.request(method, full_url, **kwargs) as response:
                # Enhanced response logging
                response_text = ""
                try:
                    response_text = await response.text()
                    logger.error(f"🔍 PAPERLESS RESPONSE DEBUG - Status: {response.status}")
                    logger.error(f"🔍 PAPERLESS RESPONSE DEBUG - Headers: {dict(response.headers)}")
                    logger.error(f"🔍 PAPERLESS RESPONSE DEBUG - Body: {response_text[:500]}...")
                except Exception as read_error:
                    logger.error(f"🔍 PAPERLESS RESPONSE DEBUG - Could not read response: {read_error}")
                
                # Validate response headers
                self._validate_response_headers(response)

                # Log request for audit trail
                logger.info(
                    f"Paperless API request completed",
                    extra={
                        "user_id": self.user_id,
                        "method": method,
                        "endpoint": endpoint,
                        "status": response.status,
                        "request_id": request_id,
                    },
                )

                yield response

        except aiohttp.ClientError as e:
            logger.error(f"🔍 PAPERLESS ERROR DEBUG - ClientError: {type(e).__name__}: {str(e)}")
            logger.error(
                f"Paperless API request failed",
                extra={
                    "user_id": self.user_id,
                    "method": method,
                    "endpoint": endpoint,
                    "error": str(e),
                    "request_id": request_id,
                },
            )
            raise PaperlessConnectionError(f"Request failed: {str(e)}")
        except Exception as e:
            logger.error(f"🔍 PAPERLESS ERROR DEBUG - Unexpected Exception: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"🔍 PAPERLESS ERROR DEBUG - Traceback: {traceback.format_exc()}")
            raise

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
            r"^/$",
            r"^/api/$",
            r"^/api/v1/$",
            r"^/api/v2/$",
            r"^/api/documents/",
            r"^/api/tags/",
            r"^/api/correspondents/",
            r"^/api/document_types/",
            r"^/api/tasks/",
            r"^/api/token/$",
            r"^/api/ui_settings/$",
        ]

        return any(re.match(pattern, endpoint) for pattern in safe_patterns)

    def _validate_response_headers(self, response: aiohttp.ClientResponse):
        """
        Validate response headers for security.

        Args:
            response: HTTP response to validate
        """
        # Check for required headers
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith(
            (
                "application/json",
                "application/octet-stream",
                "image/",
                "application/pdf",
                "text/plain",
            )
        ):
            logger.warning(
                f"Unexpected content type: {content_type}",
                extra={"user_id": self.user_id, "url": str(response.url)},
            )

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test connection to paperless-ngx instance.

        Returns:
            Connection test results

        Raises:
            PaperlessConnectionError: If connection fails
            PaperlessAuthenticationError: If authentication fails
        """
        # Test authentication by accessing a protected API endpoint
        try:
            async with self._make_request("GET", "/api/ui_settings/") as response:
                logger.info(f"Connection test result: {response.status}")

                if response.status == 200:
                    # Server is reachable and authentication works
                    return {
                        "status": "connected",
                        "server_url": self.base_url,
                        "user_id": self.user_id,
                        "test_timestamp": datetime.utcnow().isoformat(),
                        "note": "Connection successful",
                    }
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed - invalid username or password"
                    )
                elif response.status == 403:
                    raise PaperlessAuthenticationError(
                        "Access forbidden - check user permissions"
                    )
                else:
                    raise PaperlessConnectionError(
                        f"Server returned HTTP {response.status}"
                    )

        except PaperlessConnectionError:
            raise
        except Exception as e:
            logger.error(
                f"Connection test failed unexpectedly",
                extra={"user_id": self.user_id, "error": str(e)},
            )
            raise PaperlessConnectionError(f"Connection test failed: {str(e)}")

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get the status of a task in paperless-ngx.
        
        Args:
            task_id: Task UUID to check
            
        Returns:
            Task status information
            
        Raises:
            PaperlessError: If task status check fails
        """
        try:
            async with self._make_request("GET", f"/api/tasks/{task_id}/") as response:
                if response.status == 200:
                    task_data = await response.json()
                    logger.debug(
                        f"Task {task_id} status retrieved",
                        extra={
                            "user_id": self.user_id,
                            "task_id": task_id,
                            "status": task_data.get("status"),
                        },
                    )
                    return task_data
                elif response.status == 404:
                    raise PaperlessError(f"Task {task_id} not found")
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during task status check"
                    )
                else:
                    raise PaperlessError(f"Task status check failed: HTTP {response.status}")

        except PaperlessError:
            raise
        except Exception as e:
            logger.error(
                f"Task status check failed unexpectedly",
                extra={"user_id": self.user_id, "task_id": task_id, "error": str(e)},
            )
            raise PaperlessError(f"Task status check failed: {str(e)}")


class PaperlessServiceToken(PaperlessServiceBase):
    """
    Secure paperless-ngx service using API token authentication.
    """

    def __init__(self, base_url: str, api_token: str, user_id: int):
        """
        Initialize paperless service with token authentication.

        Args:
            base_url: Base URL of paperless-ngx instance
            api_token: API token for authentication
            user_id: User ID for logging and context
        """
        super().__init__(base_url, user_id)
        logger.error(f"🔍 TOKEN SERVICE DEBUG - Initializing with token: '{api_token[:10] if api_token else None}...'")
        logger.error(f"🔍 TOKEN SERVICE DEBUG - Token length: {len(api_token) if api_token else 0}")
        self.api_token = api_token

    async def _create_session(self):
        """Create HTTP session with token authentication."""
        # Add token to headers
        auth_headers = self.headers.copy()
        logger.error(f"🔍 SESSION DEBUG - About to set Authorization header with token: '{self.api_token[:10] if self.api_token else None}...'")
        auth_headers["Authorization"] = f"Token {self.api_token}"
        logger.error(f"🔍 SESSION DEBUG - Authorization header set to: '{auth_headers['Authorization'][:20]}...'")
        logger.info("Creating Paperless session with token auth")

        # Debug logging to verify headers
        logger.info(
            f"Creating Paperless session with token auth",
            extra={
                "user_id": self.user_id,
                "base_url": self.base_url,
                "auth_header": f"Token {self.api_token[:8]}...{self.api_token[-4:]}" if len(self.api_token) > 12 else f"Token {self.api_token}",
                "headers": {k: v for k, v in auth_headers.items() if k != "Authorization"}
            }
        )

        # Use SSL context only for HTTPS connections
        connector = aiohttp.TCPConnector(
            ssl=self.ssl_context if self.base_url.startswith("https://") else False,
            limit=10,
            limit_per_host=5,
            ttl_dns_cache=300,
            use_dns_cache=True,
        )

        self.session = aiohttp.ClientSession(
            connector=connector, timeout=self.timeout, headers=auth_headers
        )

    def get_auth_type(self) -> str:
        """Return authentication type for logging."""
        return "token"

    async def upload_document(
        self,
        file_data: bytes,
        filename: str,
        entity_type: str,
        entity_id: int,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        correspondent: Optional[str] = None,
        document_type: Optional[str] = None,
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
            form_data.add_field("document", file_data, filename=filename)

            # Add metadata
            if description:
                form_data.add_field("title", description)

            # Add medical record context as custom fields
            custom_fields = {
                "medical_record_user_id": str(self.user_id),
                "medical_record_entity_type": entity_type,
                "medical_record_entity_id": str(entity_id),
            }

            # Add tags including entity context
            # TODO: Implement proper tag creation/lookup for Paperless
            # For now, skip custom tags to avoid validation errors
            # all_tags = tags or []
            # all_tags.extend(
            #     [
            #         f"medical-record-{entity_type}",
            #         f"user-{self.user_id}",
            #         f"entity-{entity_id}",
            #     ]
            # )

            # if all_tags:
            #     # Convert tags to paperless format
            #     form_data.add_field("tags", ",".join(all_tags))

            if correspondent:
                form_data.add_field("correspondent", correspondent)

            if document_type:
                form_data.add_field("document_type", document_type)

            # Make upload request
            logger.info(f"Uploading document to Paperless: {filename} (size: {len(file_data)} bytes)")
            async with self._make_request(
                "POST", "/api/documents/post_document/", data=form_data
            ) as response:

                logger.info(f"Paperless upload response: HTTP {response.status}")
                if response.status == 400:
                    try:
                        error_data = await response.json()
                        error_message = self._parse_upload_error(error_data, filename)
                        raise PaperlessUploadError(error_message)
                    except Exception:
                        error_text = await response.text()
                        error_message = self._parse_upload_error(error_text, filename)
                        raise PaperlessUploadError(error_message)
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during upload"
                    )
                elif response.status not in [200, 201]:
                    response_text = await response.text()
                    raise PaperlessUploadError(
                        f"Upload failed: HTTP {response.status} - {response_text}"
                    )

                # Get task UUID from response - read as text first then try to parse
                response_text = await response.text()
                logger.info(f"Raw upload response text: '{response_text}'")
                
                task_uuid = None
                
                # Try to parse as JSON
                try:
                    import json
                    result = json.loads(response_text)
                    logger.info(f"Parsed JSON response: {result}")
                    # Response should be just the task UUID as a string
                    if isinstance(result, str):
                        task_uuid = result
                    elif isinstance(result, dict):
                        task_uuid = result.get("task_id") or result.get("id")
                except Exception as e:
                    logger.info(f"Not JSON, treating as plain text: {e}")
                    # Paperless returns a simple string (UUID) for successful uploads
                    response_text_clean = response_text.strip().strip('"')
                    if response_text_clean:
                        task_uuid = response_text_clean

                if not task_uuid:
                    raise PaperlessUploadError("No task UUID returned from upload")

                logger.info(f"Document upload started with task UUID: {task_uuid}")

                # Return immediately with task UUID - don't wait for completion
                # The frontend will poll the task status separately
                logger.info(f"Document uploaded to paperless, returning task UUID for polling: {filename} (task_id: {task_uuid})")

                return {
                    "status": "processing",
                    "task_id": task_uuid,
                    "document_id": None,  # Will be set once task completes
                    "document_filename": filename,
                    "file_size": len(file_data),
                    "upload_timestamp": datetime.utcnow().isoformat(),
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "tags": [],  # No custom tags for now
                }

        except PaperlessUploadError:
            raise
        except PaperlessAuthenticationError:
            raise
        except Exception as e:
            logger.error(
                f"Document upload failed unexpectedly",
                extra={
                    "user_id": self.user_id,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "document_filename": filename,
                    "error": str(e),
                },
            )
            raise PaperlessUploadError(f"Upload failed: {str(e)}")

    def _parse_upload_error(self, error_data: Union[Dict, str], filename: str) -> str:
        """
        Parse Paperless upload error and return user-friendly message.
        
        Args:
            error_data: Error response from Paperless API
            filename: Original filename for context
            
        Returns:
            User-friendly error message
        """
        if isinstance(error_data, dict):
            # Handle structured error responses
            if "non_field_errors" in error_data:
                errors = error_data["non_field_errors"]
                if isinstance(errors, list) and errors:
                    error_msg = errors[0]
                else:
                    error_msg = str(errors)
            elif "detail" in error_data:
                error_msg = error_data["detail"]
            elif "error" in error_data:
                error_msg = error_data["error"]
            else:
                error_msg = str(error_data)
        else:
            error_msg = str(error_data)
        
        # Check for common error patterns and provide user-friendly messages
        error_lower = error_msg.lower()
        
        # Duplicate document detection
        if any(keyword in error_lower for keyword in [
            "duplicate", "already exists", "similar document", 
            "document with this checksum", "identical file"
        ]):
            return f"Document '{filename}' appears to be a duplicate. A similar or identical document already exists in Paperless. Please check your Paperless instance for existing documents."
        
        # File format/type errors
        if any(keyword in error_lower for keyword in [
            "unsupported file", "invalid file type", "file format", 
            "not supported", "invalid format"
        ]):
            return f"File '{filename}' has an unsupported format. Please check that the file type is supported by Paperless-ngx."
        
        # File size errors
        if any(keyword in error_lower for keyword in [
            "file too large", "size exceeds", "maximum file size", "too big"
        ]):
            return f"File '{filename}' is too large for Paperless. Please reduce the file size or check your Paperless configuration."
        
        # Permission/access errors
        if any(keyword in error_lower for keyword in [
            "permission denied", "access denied", "not authorized", "forbidden"
        ]):
            return f"Permission denied uploading '{filename}'. Please check your Paperless user permissions."
        
        # Storage/disk space errors
        if any(keyword in error_lower for keyword in [
            "disk space", "storage full", "no space", "insufficient space"
        ]):
            return f"Paperless storage is full. Unable to upload '{filename}'. Please contact your administrator."
        
        # OCR/processing errors
        if any(keyword in error_lower for keyword in [
            "ocr failed", "processing failed", "document processing", "text extraction"
        ]):
            return f"Paperless had trouble processing '{filename}'. The document was uploaded but text extraction may have failed."
        
        # Network/timeout errors
        if any(keyword in error_lower for keyword in [
            "timeout", "connection", "network", "request failed"
        ]):
            return f"Network error uploading '{filename}' to Paperless. Please try again."
        
        # Default message for unknown errors
        return f"Upload of '{filename}' failed: {error_msg}. Please check your Paperless configuration or contact support."

    async def wait_for_task_completion(self, task_uuid: str, timeout_seconds: int = 60) -> Optional[str]:
        """
        Public method to wait for task completion and get document ID.
        
        Args:
            task_uuid: Task UUID to check
            timeout_seconds: Maximum time to wait in seconds
            
        Returns:
            Document ID as string if completed successfully, None if still processing
            
        Raises:
            PaperlessUploadError: If task fails
        """
        try:
            return await self._wait_for_task_completion(task_uuid, "document", timeout_seconds)
        except PaperlessUploadError as e:
            # Re-raise upload errors
            raise e
        except Exception as e:
            # For other errors, return None to indicate still processing
            logger.warning(f"Task check failed for {task_uuid}: {str(e)}")
            return None

    async def _wait_for_task_completion(self, task_uuid: str, filename: str, max_wait_time: int = 60) -> str:
        """
        Poll the tasks endpoint to wait for document consumption completion and get document ID.
        
        Args:
            task_uuid: Task UUID returned from upload
            filename: Original filename for logging
            max_wait_time: Maximum time to wait in seconds
            
        Returns:
            Document ID as string
            
        Raises:
            PaperlessUploadError: If task fails or times out
        """
        logger.info(f"Polling task status for {filename} (task: {task_uuid})")
        
        start_time = datetime.utcnow()
        poll_interval = 2  # Start with 2 second intervals
        max_poll_interval = 10  # Cap at 10 seconds
        
        while True:
            try:
                async with self._make_request("GET", f"/api/tasks/?task_id={task_uuid}") as response:
                    if response.status != 200:
                        logger.warning(f"Task status check failed: HTTP {response.status}")
                        await asyncio.sleep(poll_interval)
                        continue
                    
                    data = await response.json()
                    logger.debug(f"Raw task API response: {data}")
                    
                    # Handle both single task and list responses
                    if isinstance(data, list):
                        if not data:
                            logger.warning(f"No task found with UUID {task_uuid}")
                            await asyncio.sleep(poll_interval)
                            continue
                        task_data = data[0]
                    elif isinstance(data, dict):
                        # If results key exists, it's paginated
                        if "results" in data and data["results"]:
                            task_data = data["results"][0]
                        else:
                            task_data = data
                    else:
                        logger.warning(f"Unexpected task response format: {type(data)}")
                        await asyncio.sleep(poll_interval)
                        continue
                    
                    status = task_data.get("status", "").lower()
                    task_name = task_data.get("task_name", "")
                    
                    logger.debug(f"Task {task_uuid} status: {status} ({task_name})")
                    
                    if status == "success":
                        # Task completed successfully - get document ID
                        result = task_data.get("result", {})
                        document_id = None
                        
                        # Log the full result for debugging
                        logger.info(f"Task result: {result}")
                        
                        if isinstance(result, dict):
                            document_id = result.get("document_id") or result.get("id")
                        elif isinstance(result, str):
                            # Parse document ID from string like "Success. New document id 2677 created"
                            import re
                            match = re.search(r'document id (\d+)', result)
                            if match:
                                document_id = match.group(1)
                            else:
                                document_id = result
                        else:
                            document_id = result
                            
                        if document_id:
                            logger.info(f"Task completed successfully: document_id={document_id}")
                            return str(document_id)
                        else:
                            raise PaperlessUploadError(f"Task completed but no document ID returned for '{filename}'. This might indicate a duplicate document was detected.")
                    
                    elif status == "failure":
                        # Task failed
                        error_info = task_data.get("result", "Unknown error")
                        raise PaperlessUploadError(f"Document processing failed for '{filename}': {error_info}")
                    
                    elif status in ["pending", "started", "retry"]:
                        # Task still in progress
                        elapsed = (datetime.utcnow() - start_time).total_seconds()
                        if elapsed > max_wait_time:
                            raise PaperlessUploadError(f"Upload of '{filename}' timed out after {max_wait_time} seconds")
                        
                        # Wait before next poll with exponential backoff
                        await asyncio.sleep(poll_interval)
                        poll_interval = min(poll_interval * 1.5, max_poll_interval)
                        continue
                    
                    else:
                        logger.warning(f"Unknown task status: {status}")
                        await asyncio.sleep(poll_interval)
                        continue
                        
            except Exception as e:
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                if elapsed > max_wait_time:
                    raise PaperlessUploadError(f"Upload of '{filename}' timed out after {max_wait_time} seconds")
                
                logger.warning(f"Error checking task status: {e}")
                await asyncio.sleep(poll_interval)
                continue

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
                "GET", f"/api/documents/{document_id}/download/"
            ) as response:

                if response.status == 404:
                    raise PaperlessError(f"Document {document_id} not found")
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during download"
                    )
                elif response.status != 200:
                    raise PaperlessError(f"Download failed: HTTP {response.status}")

                content = await response.read()

                logger.info(
                    f"Document downloaded from paperless",
                    extra={
                        "user_id": self.user_id,
                        "document_id": document_id,
                        "content_size": len(content),
                    },
                )

                return content

        except PaperlessError:
            raise
        except Exception as e:
            logger.error(
                f"Document download failed unexpectedly",
                extra={
                    "user_id": self.user_id,
                    "document_id": document_id,
                    "error": str(e),
                },
            )
            raise PaperlessError(f"Download failed: {str(e)}")

    async def check_document_exists(self, document_id: Union[int, str]) -> bool:
        """
        Check if a document exists in paperless-ngx without downloading it.
        Handles both numeric document IDs and task UUIDs.

        Args:
            document_id: Paperless document ID (int) or task UUID (str)

        Returns:
            True if document exists, False otherwise
        """
        try:
            # Convert document_id to string and validate format
            doc_id_str = str(document_id).strip()
            
            # Check if it's a UUID (task ID) vs numeric document ID
            if len(doc_id_str) == 36 and '-' in doc_id_str:
                # This is likely a task UUID, not a document ID
                logger.info(
                    f"Document ID {doc_id_str} appears to be a task UUID, not a document ID",
                    extra={
                        "user_id": self.user_id,
                        "document_id": doc_id_str,
                    },
                )
                return False
            
            # Validate numeric document ID
            try:
                numeric_id = int(doc_id_str)
                if numeric_id <= 0:
                    logger.warning(
                        f"Invalid document ID: {numeric_id} (must be positive)",
                        extra={
                            "user_id": self.user_id,
                            "document_id": doc_id_str,
                        },
                    )
                    return False
            except ValueError:
                logger.warning(
                    f"Invalid document ID format: {doc_id_str} (not numeric)",
                    extra={
                        "user_id": self.user_id,
                        "document_id": doc_id_str,
                    },
                )
                return False

            async with self._make_request(
                "GET", f"/api/documents/{numeric_id}/"
            ) as response:
                if response.status == 404:
                    # Check for the specific "No Document matches the given query." message
                    try:
                        error_data = await response.json()
                        detail = error_data.get("detail", "")
                        if "No Document matches the given query" in detail:
                            logger.info(
                                f"Document {numeric_id} confirmed missing in paperless: {detail}",
                                extra={
                                    "user_id": self.user_id,
                                    "document_id": numeric_id,
                                    "detail": detail,
                                },
                            )
                        else:
                            logger.info(
                                f"Document {numeric_id} not found in paperless (404): {detail}",
                                extra={
                                    "user_id": self.user_id,
                                    "document_id": numeric_id,
                                    "detail": detail,
                                },
                            )
                    except Exception as json_error:
                        logger.info(
                            f"Document {numeric_id} not found in paperless (404 - could not parse response)",
                            extra={
                                "user_id": self.user_id,
                                "document_id": numeric_id,
                                "json_error": str(json_error),
                            },
                        )
                    return False
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during document check"
                    )
                elif response.status == 403:
                    # Try to get more details about the 403 error
                    try:
                        error_data = await response.json()
                        detail = error_data.get("detail", "No detail provided")
                        logger.warning(
                            f"🚨 403 FORBIDDEN - Document {numeric_id} access denied: {detail}. "
                            f"This suggests the document exists but auth/permissions are insufficient",
                            extra={
                                "user_id": self.user_id,
                                "document_id": numeric_id,
                                "error_detail": detail,
                            },
                        )
                    except Exception:
                        logger.warning(
                            f"🚨 403 FORBIDDEN - Document {numeric_id} access denied (could not parse error response). "
                            f"This suggests the document exists but auth/permissions are insufficient",
                            extra={
                                "user_id": self.user_id,
                                "document_id": numeric_id,
                            },
                        )
                    return False
                elif response.status == 200:
                    # HTTP 200 means document exists - that's all we need to check
                    logger.debug(
                        f"Document {numeric_id} exists in paperless (200 OK)",
                        extra={
                            "user_id": self.user_id,
                            "document_id": numeric_id,
                        },
                    )
                    return True
                else:
                    logger.warning(
                        f"Unexpected status code when checking document existence: {response.status}",
                        extra={
                            "user_id": self.user_id,
                            "document_id": numeric_id,
                            "status": response.status,
                        },
                    )
                    return False

        except PaperlessAuthenticationError:
            raise
        except Exception as e:
            logger.error(
                f"Document existence check failed unexpectedly",
                extra={
                    "user_id": self.user_id,
                    "document_id": document_id,
                    "error": str(e),
                },
            )
            # For network/connection errors, we should not automatically mark as missing
            # Instead, propagate the error so sync check can decide how to handle it
            # Only return False for actual 404 responses (document truly doesn't exist)
            if "404" in str(e) or "not found" in str(e).lower():
                return False
            else:
                # Re-raise other errors so they can be handled at a higher level
                raise PaperlessError(f"Document existence check failed: {str(e)}")

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
                "DELETE", f"/api/documents/{document_id}/"
            ) as response:

                if response.status == 404:
                    logger.warning(
                        f"Document {document_id} not found for deletion",
                        extra={"user_id": self.user_id, "document_id": document_id},
                    )
                    return True  # Already deleted
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during deletion"
                    )
                elif response.status not in [200, 204]:
                    raise PaperlessError(f"Deletion failed: HTTP {response.status}")

                logger.info(
                    f"Document deleted from paperless",
                    extra={"user_id": self.user_id, "document_id": document_id},
                )

                return True

        except PaperlessError:
            raise
        except Exception as e:
            logger.error(
                f"Document deletion failed unexpectedly",
                extra={
                    "user_id": self.user_id,
                    "document_id": document_id,
                    "error": str(e),
                },
            )
            raise PaperlessError(f"Deletion failed: {str(e)}")

    async def search_documents(
        self, query: str = "", page: int = 1, page_size: int = 25
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
            user_query = (
                f"{query} AND custom_fields.medical_record_user_id:{self.user_id}"
                if query
                else f"custom_fields.medical_record_user_id:{self.user_id}"
            )

            params = {
                "query": user_query,
                "page": page,
                "page_size": min(page_size, 100),  # Limit page size for security
            }

            async with self._make_request(
                "GET", "/api/documents/", params=params
            ) as response:

                if response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during search"
                    )
                elif response.status != 200:
                    raise PaperlessError(f"Search failed: HTTP {response.status}")

                results = await response.json()

                logger.info(
                    f"Document search completed",
                    extra={
                        "user_id": self.user_id,
                        "query": query,
                        "results_count": results.get("count", 0),
                    },
                )

                return results

        except PaperlessError:
            raise
        except Exception as e:
            logger.error(
                f"Document search failed unexpectedly",
                extra={"user_id": self.user_id, "query": query, "error": str(e)},
            )
            raise PaperlessError(f"Search failed: {str(e)}")
            


class PaperlessService(PaperlessServiceBase):
    """
    Secure paperless-ngx service using username/password authentication (HTTP Basic Auth).
    """

    def __init__(self, base_url: str, username: str, password: str, user_id: int):
        """
        Initialize paperless service with username/password authentication.

        Args:
            base_url: Base URL of paperless-ngx instance
            username: Username for authentication
            password: Password for authentication
            user_id: User ID for logging and context
        """
        super().__init__(base_url, user_id)
        self.username = username
        self.password = password

    async def _create_session(self):
        """Create HTTP session with basic authentication."""
        # Use SSL context only for HTTPS connections
        connector = aiohttp.TCPConnector(
            ssl=self.ssl_context if self.base_url.startswith("https://") else False,
            limit=10,
            limit_per_host=5,
            ttl_dns_cache=300,
            use_dns_cache=True,
        )

        # Create BasicAuth for username/password authentication
        auth = aiohttp.BasicAuth(self.username, self.password)

        self.session = aiohttp.ClientSession(
            connector=connector, timeout=self.timeout, headers=self.headers, auth=auth
        )

    def get_auth_type(self) -> str:
        """Return authentication type for logging."""
        return "basic_auth"

    async def upload_document(
        self,
        file_data: bytes,
        filename: str,
        entity_type: str,
        entity_id: int,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        correspondent: Optional[str] = None,
        document_type: Optional[str] = None,
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
            form_data.add_field("document", file_data, filename=filename)

            # Add metadata
            if description:
                form_data.add_field("title", description)

            # Add medical record context as custom fields
            custom_fields = {
                "medical_record_user_id": str(self.user_id),
                "medical_record_entity_type": entity_type,
                "medical_record_entity_id": str(entity_id),
            }

            # Add tags including entity context
            # TODO: Implement proper tag creation/lookup for Paperless
            # For now, skip custom tags to avoid validation errors
            # all_tags = tags or []
            # all_tags.extend(
            #     [
            #         f"medical-record-{entity_type}",
            #         f"user-{self.user_id}",
            #         f"entity-{entity_id}",
            #     ]
            # )

            # if all_tags:
            #     # Convert tags to paperless format
            #     form_data.add_field("tags", ",".join(all_tags))

            if correspondent:
                form_data.add_field("correspondent", correspondent)

            if document_type:
                form_data.add_field("document_type", document_type)

            # Make upload request
            logger.info(f"Uploading document to Paperless: {filename} (size: {len(file_data)} bytes)")
            async with self._make_request(
                "POST", "/api/documents/post_document/", data=form_data
            ) as response:

                logger.info(f"Paperless upload response: HTTP {response.status}")
                if response.status == 400:
                    try:
                        error_data = await response.json()
                        error_message = self._parse_upload_error(error_data, filename)
                        raise PaperlessUploadError(error_message)
                    except Exception:
                        error_text = await response.text()
                        error_message = self._parse_upload_error(error_text, filename)
                        raise PaperlessUploadError(error_message)
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during upload"
                    )
                elif response.status not in [200, 201]:
                    response_text = await response.text()
                    raise PaperlessUploadError(
                        f"Upload failed: HTTP {response.status} - {response_text}"
                    )

                # Get task UUID from response - read as text first then try to parse
                response_text = await response.text()
                logger.info(f"Raw upload response text: '{response_text}'")
                
                task_uuid = None
                
                # Try to parse as JSON
                try:
                    import json
                    result = json.loads(response_text)
                    logger.info(f"Parsed JSON response: {result}")
                    # Response should be just the task UUID as a string
                    if isinstance(result, str):
                        task_uuid = result
                    elif isinstance(result, dict):
                        task_uuid = result.get("task_id") or result.get("id")
                except Exception as e:
                    logger.info(f"Not JSON, treating as plain text: {e}")
                    # Paperless returns a simple string (UUID) for successful uploads
                    response_text_clean = response_text.strip().strip('"')
                    if response_text_clean:
                        task_uuid = response_text_clean

                if not task_uuid:
                    raise PaperlessUploadError("No task UUID returned from upload")

                logger.info(f"Document upload started with task UUID: {task_uuid}")

                # Return immediately with task UUID - don't wait for completion
                # The frontend will poll the task status separately
                logger.info(f"Document uploaded to paperless, returning task UUID for polling: {filename} (task_id: {task_uuid})")

                return {
                    "status": "processing",
                    "task_id": task_uuid,
                    "document_id": None,  # Will be set once task completes
                    "document_filename": filename,
                    "file_size": len(file_data),
                    "upload_timestamp": datetime.utcnow().isoformat(),
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "tags": [],  # No custom tags for now
                }

        except PaperlessUploadError:
            raise
        except PaperlessAuthenticationError:
            raise
        except Exception as e:
            logger.error(
                f"Document upload failed unexpectedly",
                extra={
                    "user_id": self.user_id,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "document_filename": filename,
                    "error": str(e),
                },
            )
            raise PaperlessUploadError(f"Upload failed: {str(e)}")

    def _parse_upload_error(self, error_data: Union[Dict, str], filename: str) -> str:
        """
        Parse Paperless upload error and return user-friendly message.
        
        Args:
            error_data: Error response from Paperless API
            filename: Original filename for context
            
        Returns:
            User-friendly error message
        """
        if isinstance(error_data, dict):
            # Handle structured error responses
            if "non_field_errors" in error_data:
                errors = error_data["non_field_errors"]
                if isinstance(errors, list) and errors:
                    error_msg = errors[0]
                else:
                    error_msg = str(errors)
            elif "detail" in error_data:
                error_msg = error_data["detail"]
            elif "error" in error_data:
                error_msg = error_data["error"]
            else:
                error_msg = str(error_data)
        else:
            error_msg = str(error_data)
        
        # Check for common error patterns and provide user-friendly messages
        error_lower = error_msg.lower()
        
        # Duplicate document detection
        if any(keyword in error_lower for keyword in [
            "duplicate", "already exists", "similar document", 
            "document with this checksum", "identical file"
        ]):
            return f"Document '{filename}' appears to be a duplicate. A similar or identical document already exists in Paperless. Please check your Paperless instance for existing documents."
        
        # File format/type errors
        if any(keyword in error_lower for keyword in [
            "unsupported file", "invalid file type", "file format", 
            "not supported", "invalid format"
        ]):
            return f"File '{filename}' has an unsupported format. Please check that the file type is supported by Paperless-ngx."
        
        # File size errors
        if any(keyword in error_lower for keyword in [
            "file too large", "size exceeds", "maximum file size", "too big"
        ]):
            return f"File '{filename}' is too large for Paperless. Please reduce the file size or check your Paperless configuration."
        
        # Permission/access errors
        if any(keyword in error_lower for keyword in [
            "permission denied", "access denied", "not authorized", "forbidden"
        ]):
            return f"Permission denied uploading '{filename}'. Please check your Paperless user permissions."
        
        # Storage/disk space errors
        if any(keyword in error_lower for keyword in [
            "disk space", "storage full", "no space", "insufficient space"
        ]):
            return f"Paperless storage is full. Unable to upload '{filename}'. Please contact your administrator."
        
        # OCR/processing errors
        if any(keyword in error_lower for keyword in [
            "ocr failed", "processing failed", "document processing", "text extraction"
        ]):
            return f"Paperless had trouble processing '{filename}'. The document was uploaded but text extraction may have failed."
        
        # Network/timeout errors
        if any(keyword in error_lower for keyword in [
            "timeout", "connection", "network", "request failed"
        ]):
            return f"Network error uploading '{filename}' to Paperless. Please try again."
        
        # Default message for unknown errors
        return f"Upload of '{filename}' failed: {error_msg}. Please check your Paperless configuration or contact support."

    async def wait_for_task_completion(self, task_uuid: str, timeout_seconds: int = 60) -> Optional[str]:
        """
        Public method to wait for task completion and get document ID.
        
        Args:
            task_uuid: Task UUID to check
            timeout_seconds: Maximum time to wait in seconds
            
        Returns:
            Document ID as string if completed successfully, None if still processing
            
        Raises:
            PaperlessUploadError: If task fails
        """
        try:
            return await self._wait_for_task_completion(task_uuid, "document", timeout_seconds)
        except PaperlessUploadError as e:
            # Re-raise upload errors
            raise e
        except Exception as e:
            # For other errors, return None to indicate still processing
            logger.warning(f"Task check failed for {task_uuid}: {str(e)}")
            return None

    async def _wait_for_task_completion(self, task_uuid: str, filename: str, max_wait_time: int = 60) -> str:
        """
        Poll the tasks endpoint to wait for document consumption completion and get document ID.
        
        Args:
            task_uuid: Task UUID returned from upload
            filename: Original filename for logging
            max_wait_time: Maximum time to wait in seconds
            
        Returns:
            Document ID as string
            
        Raises:
            PaperlessUploadError: If task fails or times out
        """
        logger.info(f"Polling task status for {filename} (task: {task_uuid})")
        
        start_time = datetime.utcnow()
        poll_interval = 2  # Start with 2 second intervals
        max_poll_interval = 10  # Cap at 10 seconds
        
        while True:
            try:
                async with self._make_request("GET", f"/api/tasks/?task_id={task_uuid}") as response:
                    if response.status != 200:
                        logger.warning(f"Task status check failed: HTTP {response.status}")
                        await asyncio.sleep(poll_interval)
                        continue
                    
                    data = await response.json()
                    logger.debug(f"Raw task API response: {data}")
                    
                    # Handle both single task and list responses
                    if isinstance(data, list):
                        if not data:
                            logger.warning(f"No task found with UUID {task_uuid}")
                            await asyncio.sleep(poll_interval)
                            continue
                        task_data = data[0]
                    elif isinstance(data, dict):
                        # If results key exists, it's paginated
                        if "results" in data and data["results"]:
                            task_data = data["results"][0]
                        else:
                            task_data = data
                    else:
                        logger.warning(f"Unexpected task response format: {type(data)}")
                        await asyncio.sleep(poll_interval)
                        continue
                    
                    status = task_data.get("status", "").lower()
                    task_name = task_data.get("task_name", "")
                    
                    logger.debug(f"Task {task_uuid} status: {status} ({task_name})")
                    
                    if status == "success":
                        # Task completed successfully - get document ID
                        result = task_data.get("result", {})
                        document_id = None
                        
                        # Log the full result for debugging
                        logger.info(f"Task result: {result}")
                        
                        if isinstance(result, dict):
                            document_id = result.get("document_id") or result.get("id")
                        elif isinstance(result, str):
                            # Parse document ID from string like "Success. New document id 2677 created"
                            import re
                            match = re.search(r'document id (\d+)', result)
                            if match:
                                document_id = match.group(1)
                            else:
                                document_id = result
                        else:
                            document_id = result
                            
                        if document_id:
                            logger.info(f"Task completed successfully: document_id={document_id}")
                            return str(document_id)
                        else:
                            raise PaperlessUploadError(f"Task completed but no document ID returned for '{filename}'. This might indicate a duplicate document was detected.")
                    
                    elif status == "failure":
                        # Task failed
                        error_info = task_data.get("result", "Unknown error")
                        raise PaperlessUploadError(f"Document processing failed for '{filename}': {error_info}")
                    
                    elif status in ["pending", "started", "retry"]:
                        # Task still in progress
                        elapsed = (datetime.utcnow() - start_time).total_seconds()
                        if elapsed > max_wait_time:
                            raise PaperlessUploadError(f"Upload of '{filename}' timed out after {max_wait_time} seconds")
                        
                        # Wait before next poll with exponential backoff
                        await asyncio.sleep(poll_interval)
                        poll_interval = min(poll_interval * 1.5, max_poll_interval)
                        continue
                    
                    else:
                        logger.warning(f"Unknown task status: {status}")
                        await asyncio.sleep(poll_interval)
                        continue
                        
            except Exception as e:
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                if elapsed > max_wait_time:
                    raise PaperlessUploadError(f"Upload of '{filename}' timed out after {max_wait_time} seconds")
                
                logger.warning(f"Error checking task status: {e}")
                await asyncio.sleep(poll_interval)
                continue

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
                "GET", f"/api/documents/{document_id}/download/"
            ) as response:

                if response.status == 404:
                    raise PaperlessError(f"Document {document_id} not found")
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during download"
                    )
                elif response.status != 200:
                    raise PaperlessError(f"Download failed: HTTP {response.status}")

                content = await response.read()

                logger.info(
                    f"Document downloaded from paperless",
                    extra={
                        "user_id": self.user_id,
                        "document_id": document_id,
                        "content_size": len(content),
                    },
                )

                return content

        except PaperlessError:
            raise
        except Exception as e:
            logger.error(
                f"Document download failed unexpectedly",
                extra={
                    "user_id": self.user_id,
                    "document_id": document_id,
                    "error": str(e),
                },
            )
            raise PaperlessError(f"Download failed: {str(e)}")

    async def check_document_exists(self, document_id: Union[int, str]) -> bool:
        """
        Check if a document exists in paperless-ngx without downloading it.
        Handles both numeric document IDs and task UUIDs.

        Args:
            document_id: Paperless document ID (int) or task UUID (str)

        Returns:
            True if document exists, False otherwise
        """
        try:
            # Convert document_id to string and validate format
            doc_id_str = str(document_id).strip()
            
            # Check if it's a UUID (task ID) vs numeric document ID
            if len(doc_id_str) == 36 and '-' in doc_id_str:
                # This is likely a task UUID, not a document ID
                logger.info(
                    f"Document ID {doc_id_str} appears to be a task UUID, not a document ID",
                    extra={
                        "user_id": self.user_id,
                        "document_id": doc_id_str,
                    },
                )
                return False
            
            # Validate numeric document ID
            try:
                numeric_id = int(doc_id_str)
                if numeric_id <= 0:
                    logger.warning(
                        f"Invalid document ID: {numeric_id} (must be positive)",
                        extra={
                            "user_id": self.user_id,
                            "document_id": doc_id_str,
                        },
                    )
                    return False
            except ValueError:
                logger.warning(
                    f"Invalid document ID format: {doc_id_str} (not numeric)",
                    extra={
                        "user_id": self.user_id,
                        "document_id": doc_id_str,
                    },
                )
                return False

            async with self._make_request(
                "GET", f"/api/documents/{numeric_id}/"
            ) as response:
                if response.status == 404:
                    # Check for the specific "No Document matches the given query." message
                    try:
                        error_data = await response.json()
                        detail = error_data.get("detail", "")
                        if "No Document matches the given query" in detail:
                            logger.info(
                                f"Document {numeric_id} confirmed missing in paperless: {detail}",
                                extra={
                                    "user_id": self.user_id,
                                    "document_id": numeric_id,
                                    "detail": detail,
                                },
                            )
                        else:
                            logger.info(
                                f"Document {numeric_id} not found in paperless (404): {detail}",
                                extra={
                                    "user_id": self.user_id,
                                    "document_id": numeric_id,
                                    "detail": detail,
                                },
                            )
                    except Exception as json_error:
                        logger.info(
                            f"Document {numeric_id} not found in paperless (404 - could not parse response)",
                            extra={
                                "user_id": self.user_id,
                                "document_id": numeric_id,
                                "json_error": str(json_error),
                            },
                        )
                    return False
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during document check"
                    )
                elif response.status == 403:
                    # Try to get more details about the 403 error
                    try:
                        error_data = await response.json()
                        detail = error_data.get("detail", "No detail provided")
                        logger.warning(
                            f"🚨 403 FORBIDDEN - Document {numeric_id} access denied: {detail}. "
                            f"This suggests the document exists but auth/permissions are insufficient",
                            extra={
                                "user_id": self.user_id,
                                "document_id": numeric_id,
                                "error_detail": detail,
                            },
                        )
                    except Exception:
                        logger.warning(
                            f"🚨 403 FORBIDDEN - Document {numeric_id} access denied (could not parse error response). "
                            f"This suggests the document exists but auth/permissions are insufficient",
                            extra={
                                "user_id": self.user_id,
                                "document_id": numeric_id,
                            },
                        )
                    return False
                elif response.status == 200:
                    # HTTP 200 means document exists - that's all we need to check
                    logger.debug(
                        f"Document {numeric_id} exists in paperless (200 OK)",
                        extra={
                            "user_id": self.user_id,
                            "document_id": numeric_id,
                        },
                    )
                    return True
                else:
                    logger.warning(
                        f"Unexpected status code when checking document existence: {response.status}",
                        extra={
                            "user_id": self.user_id,
                            "document_id": numeric_id,
                            "status": response.status,
                        },
                    )
                    return False

        except PaperlessAuthenticationError:
            raise
        except Exception as e:
            logger.error(
                f"Document existence check failed unexpectedly",
                extra={
                    "user_id": self.user_id,
                    "document_id": document_id,
                    "error": str(e),
                },
            )
            # For network/connection errors, we should not automatically mark as missing
            # Instead, propagate the error so sync check can decide how to handle it
            # Only return False for actual 404 responses (document truly doesn't exist)
            if "404" in str(e) or "not found" in str(e).lower():
                return False
            else:
                # Re-raise other errors so they can be handled at a higher level
                raise PaperlessError(f"Document existence check failed: {str(e)}")

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
                "DELETE", f"/api/documents/{document_id}/"
            ) as response:

                if response.status == 404:
                    logger.warning(
                        f"Document {document_id} not found for deletion",
                        extra={"user_id": self.user_id, "document_id": document_id},
                    )
                    return True  # Already deleted
                elif response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during deletion"
                    )
                elif response.status not in [200, 204]:
                    raise PaperlessError(f"Deletion failed: HTTP {response.status}")

                logger.info(
                    f"Document deleted from paperless",
                    extra={"user_id": self.user_id, "document_id": document_id},
                )

                return True

        except PaperlessError:
            raise
        except Exception as e:
            logger.error(
                f"Document deletion failed unexpectedly",
                extra={
                    "user_id": self.user_id,
                    "document_id": document_id,
                    "error": str(e),
                },
            )
            raise PaperlessError(f"Deletion failed: {str(e)}")

    async def search_documents(
        self, query: str = "", page: int = 1, page_size: int = 25
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
            user_query = (
                f"{query} AND custom_fields.medical_record_user_id:{self.user_id}"
                if query
                else f"custom_fields.medical_record_user_id:{self.user_id}"
            )

            params = {
                "query": user_query,
                "page": page,
                "page_size": min(page_size, 100),  # Limit page size for security
            }

            async with self._make_request(
                "GET", "/api/documents/", params=params
            ) as response:

                if response.status == 401:
                    raise PaperlessAuthenticationError(
                        "Authentication failed during search"
                    )
                elif response.status != 200:
                    raise PaperlessError(f"Search failed: HTTP {response.status}")

                results = await response.json()

                logger.info(
                    f"Document search completed",
                    extra={
                        "user_id": self.user_id,
                        "query": query,
                        "results_count": results.get("count", 0),
                    },
                )

                return results

        except PaperlessError:
            raise
        except Exception as e:
            logger.error(
                f"Document search failed unexpectedly",
                extra={"user_id": self.user_id, "query": query, "error": str(e)},
            )
            raise PaperlessError(f"Search failed: {str(e)}")


def create_paperless_service_with_username_password(
    paperless_url: str, encrypted_username: str, encrypted_password: str, user_id: int
) -> PaperlessService:
    """
    Create paperless service with decrypted username/password credentials.

    Args:
        paperless_url: Paperless instance URL
        encrypted_username: Encrypted username
        encrypted_password: Encrypted password
        user_id: User ID

    Returns:
        Configured paperless service

    Raises:
        PaperlessError: If service creation fails
    """
    try:
        # Decrypt the credentials
        username = credential_encryption.decrypt_token(encrypted_username)
        password = credential_encryption.decrypt_token(encrypted_password)

        if not username or not password:
            raise PaperlessError("Failed to decrypt credentials")

        # Credentials decrypted successfully

        # Create and return service
        return PaperlessService(paperless_url, username, password, user_id)

    except Exception as e:
        logger.error(
            f"Failed to create paperless service",
            extra={"user_id": user_id, "error": str(e)},
        )
        raise PaperlessError(f"Service creation failed: {str(e)}")


def create_paperless_service_with_token(
    paperless_url: str, encrypted_token: str, user_id: int
) -> PaperlessServiceToken:
    """
    Create paperless service with decrypted token authentication.

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

        # Create and return service with token authentication
        return PaperlessServiceToken(paperless_url, api_token, user_id)

    except Exception as e:
        logger.error(
            f"Failed to create paperless service with token",
            extra={"user_id": user_id, "error": str(e)},
        )
        raise PaperlessError(f"Service creation failed: {str(e)}")


class PaperlessServiceWithFallback:
    """Wrapper service that attempts token auth first, then falls back to basic auth."""
    
    def __init__(self, 
                 paperless_url: str,
                 encrypted_token: Optional[str] = None,
                 encrypted_username: Optional[str] = None,
                 encrypted_password: Optional[str] = None,
                 user_id: int = 0):
        self.paperless_url = paperless_url
        self.encrypted_token = encrypted_token
        self.encrypted_username = encrypted_username
        self.encrypted_password = encrypted_password
        self.user_id = user_id
        self.active_service = None
        
    async def __aenter__(self):
        """Try primary service, fallback on auth error."""
        # Try token auth first if available
        if self.encrypted_token:
            try:
                token_service = create_paperless_service_with_token(
                    self.paperless_url, self.encrypted_token, self.user_id
                )
                await token_service.__aenter__()
                # Test authentication
                await token_service.test_connection()
                self.active_service = token_service
                logger.info(f"Using token authentication for user {self.user_id}")
                return token_service
            except PaperlessAuthenticationError as e:
                logger.warning(f"Token auth failed for user {self.user_id}, trying basic auth: {e}")
                if token_service:
                    try:
                        await token_service.__aexit__(None, None, None)
                    except:
                        pass
        
        # Fallback to username/password if available
        if self.encrypted_username and self.encrypted_password:
            try:
                basic_service = create_paperless_service_with_username_password(
                    self.paperless_url, self.encrypted_username, self.encrypted_password, self.user_id
                )
                await basic_service.__aenter__()
                self.active_service = basic_service
                logger.info(f"Using basic authentication for user {self.user_id}")
                return basic_service
            except PaperlessAuthenticationError as e:
                logger.error(f"Both auth methods failed for user {self.user_id}: {e}")
                raise
        else:
            raise PaperlessError("No fallback authentication method available")
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Clean up active service."""
        if self.active_service:
            await self.active_service.__aexit__(exc_type, exc_val, exc_tb)


def create_paperless_service(
    paperless_url: str,
    encrypted_token: Optional[str] = None,
    encrypted_username: Optional[str] = None,
    encrypted_password: Optional[str] = None,
    user_id: int = 0
) -> PaperlessServiceBase:
    """
    Create paperless service with automatic authentication method selection.
    
    Priority:
    1. Token authentication (if token provided) - supports 2FA
    2. Username/Password authentication (if both provided)
    3. Raise error if no valid credentials
    
    Args:
        paperless_url: Paperless instance URL
        encrypted_token: Optional encrypted API token
        encrypted_username: Optional encrypted username
        encrypted_password: Optional encrypted password
        user_id: User ID for logging and context
        
    Returns:
        Configured paperless service with appropriate authentication
        
    Raises:
        PaperlessError: If no valid credentials provided or service creation fails
    """
    try:
        # Priority 1: Token authentication (supports 2FA)
        if encrypted_token:
            try:
                logger.error(f"🔍 FACTORY DEBUG - Encrypted token received: '{encrypted_token[:50]}...'")
                api_token = credential_encryption.decrypt_token(encrypted_token)
                logger.error(f"🔍 FACTORY DEBUG - Decrypted token: '{api_token[:10] if api_token else None}...'")
                if api_token:
                    logger.info(f"Creating paperless service with token auth for user {user_id}")
                    return PaperlessServiceToken(paperless_url, api_token, user_id)
            except Exception as e:
                logger.warning(f"Token decryption failed for user {user_id}: {e}")
        
        # Priority 2: Username/Password authentication
        if encrypted_username and encrypted_password:
            try:
                username = credential_encryption.decrypt_token(encrypted_username)
                password = credential_encryption.decrypt_token(encrypted_password)
                if username and password:
                    logger.info(f"Creating paperless service with basic auth for user {user_id}")
                    return PaperlessService(paperless_url, username, password, user_id)
            except Exception as e:
                logger.warning(f"Username/password decryption failed for user {user_id}: {e}")
        
        # No valid credentials found
        raise PaperlessError("No valid authentication credentials provided")
        
    except PaperlessError:
        raise
    except Exception as e:
        logger.error(
            f"Failed to create paperless service",
            extra={"user_id": user_id, "error": str(e)},
        )
        raise PaperlessError(f"Service creation failed: {str(e)}")


# Alias for backward compatibility - now uses smart factory
create_paperless_service_smart = create_paperless_service
