"""
Secure credential encryption service for paperless-ngx API tokens.

This service provides secure encryption and decryption of API tokens using
Fernet encryption with PBKDF2 key derivation for enhanced security.
"""

import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import settings
from app.core.logging.config import get_logger

logger = get_logger(__name__)


class SecurityError(Exception):
    """Exception raised for security-related errors."""
    pass


class CredentialEncryption:
    """Secure encryption/decryption of paperless API tokens."""
    
    def __init__(self):
        """Initialize the encryption service with derived key."""
        # Use environment variable for salt, with fallback
        self.salt = os.environ.get('PAPERLESS_SALT', 'paperless_integration_salt_v1').encode()
        
        # Derive encryption key from SECRET_KEY + salt
        self.key = self._derive_key(settings.SECRET_KEY.encode(), self.salt)
        self.cipher = Fernet(self.key)
    
    def _derive_key(self, password: bytes, salt: bytes) -> bytes:
        """
        Derive encryption key using PBKDF2.
        
        Args:
            password: The password/secret key to derive from
            salt: Salt for key derivation
            
        Returns:
            Base64-encoded encryption key
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,  # High iteration count for security
        )
        key = base64.urlsafe_b64encode(kdf.derive(password))
        return key
    
    def encrypt_token(self, token: str) -> Optional[str]:
        """
        Encrypt API token for database storage.
        
        Args:
            token: The API token to encrypt
            
        Returns:
            Base64-encoded encrypted token, or None if token is empty
            
        Raises:
            SecurityError: If encryption fails
        """
        if not token:
            return None
        
        try:
            # Basic validation - ensure token is not empty and reasonable length
            if len(token.strip()) < 2:
                logger.warning("Token too short for encryption")
                raise SecurityError("Invalid credential format")
            
            encrypted_token = self.cipher.encrypt(token.encode())
            return base64.urlsafe_b64encode(encrypted_token).decode()
            
        except SecurityError:
            raise
        except Exception as e:
            logger.error(f"Token encryption failed: {str(e)}")
            raise SecurityError("Failed to encrypt credential")
    
    def decrypt_token(self, encrypted_token: str) -> Optional[str]:
        """
        Decrypt API token for use.
        
        Args:
            encrypted_token: The encrypted token to decrypt
            
        Returns:
            Decrypted token, or None if encrypted_token is empty
            
        Raises:
            SecurityError: If decryption fails
        """
        if not encrypted_token:
            return None
            
        try:
            encrypted_data = base64.urlsafe_b64decode(encrypted_token.encode())
            decrypted_token = self.cipher.decrypt(encrypted_data)
            return decrypted_token.decode()
            
        except Exception as e:
            logger.error(f"Token decryption failed: {str(e)}")
            raise SecurityError("Failed to decrypt API token")
    
    def is_encrypted(self, token: str) -> bool:
        """
        Check if token is already encrypted.
        
        Args:
            token: Token to check
            
        Returns:
            True if token appears to be encrypted, False otherwise
        """
        if not token:
            return False
            
        try:
            # Try to decode as base64 - encrypted tokens should be base64
            base64.urlsafe_b64decode(token.encode())
            # If it's much longer than original token, it's likely encrypted
            return len(token) > 60  # Paperless tokens are ~40 chars, encrypted much longer
        except (ValueError, TypeError):
            return False  # Invalid base64 or encoding
    
    def _is_valid_token_format(self, token: str) -> bool:
        """
        Basic validation of API token format.
        
        Args:
            token: Token to validate
            
        Returns:
            True if token format appears valid
        """
        if not token:
            return False
            
        # Paperless tokens are typically 40 characters of hex
        import re
        return bool(re.match(r'^[a-f0-9]{40}$', token))


# Global instance for use throughout the application
credential_encryption = CredentialEncryption()


def encrypt_paperless_token(token: str) -> Optional[str]:
    """
    Convenience function to encrypt a paperless API token.
    
    Args:
        token: The API token to encrypt
        
    Returns:
        Encrypted token or None if token is empty
    """
    return credential_encryption.encrypt_token(token)


def decrypt_paperless_token(encrypted_token: str) -> Optional[str]:
    """
    Convenience function to decrypt a paperless API token.
    
    Args:
        encrypted_token: The encrypted token to decrypt
        
    Returns:
        Decrypted token or None if encrypted_token is empty
    """
    return credential_encryption.decrypt_token(encrypted_token)