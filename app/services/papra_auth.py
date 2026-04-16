"""
Papra Authentication Handler

Provides authentication for Papra document management integration.
Bearer token authentication only.
"""

from typing import Tuple
from urllib.parse import urlparse
import aiohttp
from app.core.logging.config import get_logger

logger = get_logger(__name__)


class PapraAuth:
    """Authentication handler for Papra integration."""

    def __init__(self, url: str, token: str, organization_id: str):
        """
        Initialize with bearer token auth.

        Args:
            url: Papra instance URL
            token: API bearer token
            organization_id: Default organization ID
        """
        self.url = url.rstrip("/")
        self.token = token
        self.organization_id = organization_id

        if not self.token:
            raise ValueError("API token is required for Papra authentication")
        if not self.organization_id:
            raise ValueError("Organization ID is required for Papra")

    def get_headers(self) -> dict:
        """Get authentication headers for requests."""
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.token}",
            "User-Agent": "MediKeep/2.0",
        }

    def get_safe_info(self) -> dict:
        """Get safe authentication info for logging (no credentials)."""
        return {
            "url": self.url,
            "auth_type": "bearer",
            "has_token": bool(self.token),
            "organization_id": self.organization_id,
        }

    async def test_connection(self) -> Tuple[bool, str]:
        """
        Test connection to Papra instance by listing organizations.

        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            headers = self.get_headers()

            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(f"{self.url}/api/organizations") as response:
                    if response.status == 200:
                        return True, "Connection successful"
                    elif response.status == 401:
                        return False, "Authentication failed - check API token"
                    elif response.status == 403:
                        return False, "Access forbidden - check token permissions"
                    else:
                        logger.warning(
                            "Papra connection failed",
                            extra={
                                "status_code": response.status,
                                "url_host": urlparse(self.url).hostname,
                            },
                        )
                        return (
                            False,
                            "Unable to connect to Papra. Please verify your settings.",
                        )

        except aiohttp.ClientError as e:
            logger.error(
                "Papra connection error",
                extra={
                    "error_type": type(e).__name__,
                    "url_host": urlparse(self.url).hostname,
                },
            )
            return False, "Unable to connect to Papra. Please check your configuration."
        except Exception as e:
            logger.error(
                "Unexpected error during Papra connection test",
                extra={"error_type": type(e).__name__},
            )
            return False, "An error occurred while connecting to Papra."

    async def list_organizations(self) -> list:
        """
        List available organizations.

        Returns:
            List of organization dicts with id and name
        """
        try:
            headers = self.get_headers()

            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(f"{self.url}/api/organizations") as response:
                    if response.status != 200:
                        logger.error(
                            "Failed to list Papra organizations",
                            extra={"status_code": response.status},
                        )
                        return []

                    data = await response.json()
                    # Papra returns {"organizations": [...]}
                    if isinstance(data, dict) and "organizations" in data:
                        return data["organizations"]
                    elif isinstance(data, list):
                        return data
                    elif isinstance(data, dict) and "items" in data:
                        return data["items"]
                    elif isinstance(data, dict) and "results" in data:
                        return data["results"]
                    return []

        except Exception as e:
            logger.error(
                "Error listing Papra organizations",
                extra={"error_type": type(e).__name__},
            )
            return []


def create_papra_auth(
    url: str, encrypted_token: str, organization_id: str, user_id: int = None
) -> PapraAuth:
    """
    Factory function to create PapraAuth from encrypted credentials.

    Args:
        url: Papra instance URL
        encrypted_token: Encrypted API token
        organization_id: Organization ID
        user_id: User ID for logging context

    Returns:
        PapraAuth instance
    """
    from app.services.credential_encryption import papra_credential_encryption

    logger.debug(f"Creating Papra auth for user {user_id}")

    token = None
    if encrypted_token:
        try:
            token = papra_credential_encryption.decrypt_token(encrypted_token)
            logger.debug("Papra token decryption successful")
        except Exception:
            logger.warning("Papra token decryption failed", exc_info=False)

    try:
        auth = PapraAuth(url, token=token, organization_id=organization_id)
        logger.info(f"Papra auth created for user {user_id}")
        return auth
    except ValueError as e:
        logger.error(f"Failed to create Papra auth for user {user_id}: {e}")
        raise
