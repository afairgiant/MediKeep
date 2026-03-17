"""
Papra Client

A clean client for Papra document management operations.
Unlike Paperless, Papra uploads are synchronous - no task polling needed.
"""

from typing import Optional, Tuple
import aiohttp

from app.core.logging.config import get_logger
from app.services.papra_auth import PapraAuth

logger = get_logger(__name__)


class PapraClientError(Exception):
    """Base exception for Papra client errors."""
    pass


class PapraConnectionError(PapraClientError):
    """Connection-related errors."""
    pass


class PapraUploadError(PapraClientError):
    """Upload-related errors."""
    pass


class PapraClient:
    """
    Papra client for document operations.

    All API calls are organization-scoped via the organization_id.
    """

    def __init__(self, auth: PapraAuth):
        """Initialize client with authentication."""
        self.auth = auth
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

            connector = aiohttp.TCPConnector(
                limit=10,
                limit_per_host=5,
                ttl_dns_cache=300
            )

            from app.core.config import settings
            timeout_seconds = getattr(settings, 'PAPRA_REQUEST_TIMEOUT', 30)

            self._session = aiohttp.ClientSession(
                headers=headers,
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=timeout_seconds)
            )

            logger.debug("Created Papra session")

    def _org_url(self, path: str = "") -> str:
        """Build organization-scoped API URL."""
        return f"{self.auth.url}/api/organizations/{self.auth.organization_id}{path}"

    async def test_connection(self) -> Tuple[bool, str]:
        """Test connection to Papra."""
        return await self.auth.test_connection()

    async def upload_document(self, file_data: bytes, filename: str,
                              title: Optional[str] = None,
                              content_type: Optional[str] = None) -> dict:
        """
        Upload a document to Papra. Returns document info synchronously.

        Args:
            file_data: The file content as bytes
            filename: Name of the file
            title: Optional document title
            content_type: MIME type of the file

        Returns:
            Dict with document_id and metadata

        Raises:
            PapraUploadError: If upload fails
        """
        await self._ensure_session()

        try:
            form_data = aiohttp.FormData()
            form_data.add_field(
                'file',
                file_data,
                filename=filename,
                content_type=content_type or 'application/octet-stream'
            )

            if title:
                form_data.add_field('title', title)

            logger.debug(f"Uploading document to Papra: {filename}")

            from app.core.config import settings
            upload_timeout_seconds = getattr(settings, 'PAPRA_UPLOAD_TIMEOUT', 300)
            upload_timeout = aiohttp.ClientTimeout(total=upload_timeout_seconds)

            url = self._org_url("/documents")
            async with self._session.post(url, data=form_data, timeout=upload_timeout) as response:
                if response.status not in [200, 201]:
                    error_text = await response.text()
                    logger.error(f"Papra upload failed: {response.status} - {error_text}")
                    raise PapraUploadError(f"Upload failed with status {response.status}: {error_text}")

                result = await response.json()

                # Papra returns {"document": {"id": "doc_xxx", ...}}
                doc_data = result.get("document", {}) if isinstance(result, dict) else {}
                doc_id = (
                    doc_data.get("id")
                    or result.get("id")
                    or result.get("documentId")
                    or result.get("document_id")
                )
                if not doc_id:
                    logger.error(f"Papra upload response missing document ID: {result}")
                    raise PapraUploadError("No document ID returned from Papra upload")

                logger.info(f"Document uploaded to Papra: {filename} -> {doc_id}")
                return {"document_id": str(doc_id), "metadata": doc_data or result}

        except aiohttp.ClientError as e:
            logger.error(f"Papra upload connection error: {e}")
            raise PapraConnectionError(f"Connection error during upload: {e}")
        except PapraUploadError:
            raise
        except Exception as e:
            logger.error(f"Unexpected Papra upload error: {e}")
            raise PapraUploadError(f"Upload error: {e}")

    async def download_document(self, document_id: str) -> bytes:
        """
        Download a document by ID.

        Args:
            document_id: The document ID to download

        Returns:
            Document content as bytes

        Raises:
            PapraClientError: If download fails
        """
        await self._ensure_session()

        try:
            url = self._org_url(f"/documents/{document_id}/file")

            async with self._session.get(url) as response:
                if response.status == 404:
                    raise PapraClientError(f"Document {document_id} not found")
                elif response.status == 403:
                    raise PapraClientError(f"Access denied to document {document_id}")
                elif response.status != 200:
                    raise PapraClientError(f"Download failed with status {response.status}")

                content = await response.read()
                logger.debug(f"Downloaded Papra document {document_id}: {len(content)} bytes")
                return content

        except aiohttp.ClientError as e:
            logger.error(f"Papra download connection error: {e}")
            raise PapraConnectionError(f"Connection error during download: {e}")

    async def delete_document(self, document_id: str) -> bool:
        """
        Delete a document by ID.

        Args:
            document_id: The document ID to delete

        Returns:
            True if deletion successful

        Raises:
            PapraClientError: If deletion fails
        """
        await self._ensure_session()

        try:
            url = self._org_url(f"/documents/{document_id}")

            async with self._session.delete(url) as response:
                if response.status == 404:
                    logger.warning(f"Papra document {document_id} not found for deletion")
                    return True  # Already gone
                elif response.status not in [200, 204]:
                    raise PapraClientError(f"Delete failed with status {response.status}")

                logger.info(f"Papra document {document_id} deleted successfully")
                return True

        except aiohttp.ClientError as e:
            logger.error(f"Papra delete connection error: {e}")
            raise PapraConnectionError(f"Connection error during delete: {e}")

    async def search_documents(self, query: str = "", page: int = 0, page_size: int = 20) -> dict:
        """
        Search or list documents in the organization.

        Args:
            query: Optional search query string; empty string returns all documents.
            page: Zero-based page index.
            page_size: Number of documents per page.

        Returns:
            Dict with ``documents`` list and ``documentsCount`` integer as returned
            by the Papra API.

        Raises:
            PapraClientError: If the request fails.
        """
        await self._ensure_session()

        try:
            params = {
                "pageIndex": page,
                "pageSize": page_size,
            }
            if query:
                params["searchQuery"] = query

            url = self._org_url("/documents")
            logger.debug(f"Searching Papra documents: query={query!r} page={page} page_size={page_size}")

            async with self._session.get(url, params=params) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise PapraClientError(
                        f"Document search failed with status {response.status}: {error_text}"
                    )

                data = await response.json()
                # Normalise to always return the expected shape
                if isinstance(data, dict):
                    return {
                        "documents": data.get("documents", []),
                        "documentsCount": data.get("documentsCount", 0),
                    }
                # Unexpected shape – return empty
                logger.warning(f"Unexpected Papra search response shape: {type(data)}")
                return {"documents": [], "documentsCount": 0}

        except aiohttp.ClientError as e:
            logger.error(f"Papra search connection error: {e}")
            raise PapraConnectionError(f"Connection error during document search: {e}")
        except PapraClientError:
            raise
        except Exception as e:
            logger.error(f"Unexpected Papra search error: {e}")
            raise PapraClientError(f"Document search error: {e}")

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
            url = self._org_url(f"/documents/{document_id}")

            async with self._session.get(url) as response:
                if response.status == 404:
                    return None
                elif response.status != 200:
                    raise PapraClientError(f"Get info failed with status {response.status}")

                data = await response.json()
                # Papra returns {"document": {...}}
                if isinstance(data, dict) and "document" in data:
                    return data["document"]
                return data

        except aiohttp.ClientError as e:
            logger.error(f"Papra get info connection error: {e}")
            raise PapraConnectionError(f"Connection error getting document info: {e}")


def create_papra_client(url: str, encrypted_token: str,
                        organization_id: str,
                        user_id: int = None) -> PapraClient:
    """
    Factory function to create a PapraClient from encrypted credentials.

    Args:
        url: Papra instance URL
        encrypted_token: Encrypted API token
        organization_id: Organization ID
        user_id: User ID for logging context

    Returns:
        PapraClient instance
    """
    from app.services.papra_auth import create_papra_auth

    auth = create_papra_auth(
        url=url,
        encrypted_token=encrypted_token,
        organization_id=organization_id,
        user_id=user_id
    )

    return PapraClient(auth)
