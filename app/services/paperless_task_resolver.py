"""
Simplified Paperless Task Resolution

Replaces the complex task resolution logic with a single, clear method.
"""

from typing import Optional, Tuple

import aiohttp

from app.core.logging.config import get_logger
from app.services.paperless_auth import PaperlessAuth
from app.services.paperless_task_status import extract_task, parse_task

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
                return "processing", None

            parsed = parse_task(task_data)
            logger.debug(f"Task {task_uuid} status: {parsed.status}")

            if parsed.is_success:
                document_id = parsed.document_id

                if document_id:
                    # Verify the document actually exists
                    if await self._verify_document_exists(document_id):
                        logger.debug(
                            f"Task {task_uuid} resolved to document {document_id}"
                        )
                        return "success", document_id
                    logger.warning(
                        f"Task {task_uuid} claims success but document {document_id} doesn't exist"
                    )
                    return "failed", None
                logger.warning(f"Task {task_uuid} successful but no document ID found")
                return "failed", None

            if parsed.is_failure:
                logger.debug(f"Task {task_uuid} failed")
                return "failed", None

            # pending, started, retry, etc.
            logger.debug(f"Task {task_uuid} still processing")
            return "processing", None

        except Exception as e:
            logger.error(f"Error resolving task {task_uuid}: {e}")
            return "failed", None

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

                    return extract_task(await response.json())

        except Exception as e:
            logger.debug(f"Error fetching task status for {task_uuid}: {e}")
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
