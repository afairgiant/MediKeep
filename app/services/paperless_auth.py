"""
Simplified Paperless Authentication Handler

Provides a clean, single interface for paperless authentication
without the complexity of multiple inheritance patterns.
"""

from typing import Optional, Tuple
import aiohttp
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class PaperlessAuth:
    """Simple, clean authentication handler for Paperless integration."""
    
    def __init__(self, url: str, token: str = None, username: str = None, password: str = None):
        """
        Initialize authentication with either token OR username/password.
        
        Args:
            url: Paperless instance URL
            token: API token (preferred method)
            username: Username for basic auth (if no token)
            password: Password for basic auth (if no token)
        """
        self.url = url.rstrip("/")
        self.token = token
        self.username = username
        self.password = password
        
        # Validate we have some form of authentication
        if not self.token and not (self.username and self.password):
            raise ValueError("Must provide either API token or username/password")
    
    def get_auth_type(self) -> str:
        """Get the authentication type being used."""
        if self.token:
            return "token"
        elif self.username and self.password:
            return "basic"
        return "none"
    
    def get_headers(self) -> dict:
        """Get authentication headers for requests."""
        headers = {
            "Accept": "application/json",
            "User-Agent": "MedicalRecords/2.0"
        }
        
        if self.token:
            headers["Authorization"] = f"Token {self.token}"
        
        return headers
    
    def get_auth(self) -> Optional[aiohttp.BasicAuth]:
        """Get basic auth object if using username/password (only if no token available)."""
        # Only use basic auth if we don't have a token (token takes priority)
        if not self.token and self.username and self.password:
            return aiohttp.BasicAuth(self.username, self.password)
        return None
    
    def get_safe_info(self) -> dict:
        """Get safe authentication info for logging (no credentials)."""
        return {
            "url": self.url,
            "auth_type": self.get_auth_type(),
            "has_token": bool(self.token),
            "has_credentials": bool(self.username and self.password)
        }
    
    async def test_connection(self) -> Tuple[bool, str]:
        """
        Test connection to Paperless instance.
        
        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            headers = self.get_headers()
            auth = self.get_auth()
            
            async with aiohttp.ClientSession(headers=headers, auth=auth) as session:
                async with session.get(f"{self.url}/api/ui_settings/") as response:
                    if response.status == 200:
                        return True, "Connection successful"
                    elif response.status == 401:
                        return False, "Authentication failed - check credentials"
                    elif response.status == 403:
                        return False, "Access forbidden - check permissions"
                    else:
                        return False, f"Connection failed with status {response.status}"
                        
        except aiohttp.ClientError as e:
            return False, f"Connection error: {str(e)}"
        except Exception as e:
            logger.error(f"Unexpected error testing paperless connection: {e}")
            return False, f"Unexpected error: {str(e)}"


def create_paperless_auth(url: str, encrypted_token: str = None, 
                         encrypted_username: str = None, encrypted_password: str = None,
                         user_id: int = None) -> PaperlessAuth:
    """
    Factory function to create PaperlessAuth from encrypted credentials.
    
    Args:
        url: Paperless instance URL
        encrypted_token: Encrypted API token
        encrypted_username: Encrypted username
        encrypted_password: Encrypted password  
        user_id: User ID for logging context
        
    Returns:
        PaperlessAuth instance
    """
    from app.services.credential_encryption import credential_encryption
    
    logger.debug(f"Creating paperless auth for user {user_id}")
    
    # Decrypt credentials
    token = None
    username = None  
    password = None
    
    if encrypted_token:
        try:
            token = credential_encryption.decrypt_token(encrypted_token)
            logger.debug("Token decryption successful")
        except Exception as e:
            logger.warning(f"Token decryption failed: {e}")
    
    if encrypted_username and encrypted_password:
        try:
            username = credential_encryption.decrypt_token(encrypted_username)
            password = credential_encryption.decrypt_token(encrypted_password)
            logger.debug("Username/password decryption successful")
        except Exception as e:
            logger.warning(f"Username/password decryption failed: {e}")
    
    # Create auth handler
    try:
        auth = PaperlessAuth(url, token=token, username=username, password=password)
        logger.info(f"Paperless auth created for user {user_id}: {auth.get_auth_type()} auth")
        return auth
    except ValueError as e:
        logger.error(f"Failed to create paperless auth for user {user_id}: {e}")
        raise