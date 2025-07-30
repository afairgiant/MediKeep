from datetime import datetime
from typing import Optional

from pydantic import BaseModel, validator


class UserPreferencesBase(BaseModel):
    """Base User Preferences schema with common fields."""

    unit_system: str
    paperless_enabled: Optional[bool] = False
    paperless_url: Optional[str] = None
    default_storage_backend: Optional[str] = "local"
    paperless_auto_sync: Optional[bool] = False
    paperless_sync_tags: Optional[bool] = True

    @validator("unit_system")
    def validate_unit_system(cls, v):
        """
        Validate that the unit system is one of the allowed values.

        Args:
            v: The unit system value to validate

        Returns:
            Cleaned unit system (lowercase)

        Raises:
            ValueError: If unit system is not in allowed list
        """
        allowed_systems = ["imperial", "metric"]
        if v.lower() not in allowed_systems:
            raise ValueError(
                f"Unit system must be one of: {', '.join(allowed_systems)}"
            )
        return v.lower()
    
    @validator("paperless_url")
    def validate_paperless_url(cls, v):
        """Validate paperless URL format if provided."""
        if v is None:
            return v
            
        # Must be HTTPS for security
        if not v.startswith('https://'):
            raise ValueError('Paperless URL must use HTTPS')
        
        # Basic URL format validation
        import re
        url_pattern = re.compile(
            r'^https://'
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\\.)+[A-Z]{2,6}\\.?|'
            r'localhost(?::\\d+)?|'
            r'\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(?::\\d+)?)'
            r'(?:/.*)?$', re.IGNORECASE
        )
        
        if not url_pattern.match(v):
            raise ValueError('Invalid URL format')
        
        return v.rstrip('/')
    
    @validator("default_storage_backend")
    def validate_storage_backend(cls, v):
        """Validate storage backend selection."""
        if v is None:
            return "local"
            
        allowed_backends = ["local", "paperless"]
        if v not in allowed_backends:
            raise ValueError(
                f"Storage backend must be one of: {', '.join(allowed_backends)}"
            )
        return v


class UserPreferencesCreate(UserPreferencesBase):
    """Schema for creating user preferences."""

    pass


class UserPreferencesUpdate(BaseModel):
    """Schema for updating user preferences."""

    unit_system: Optional[str] = None
    paperless_enabled: Optional[bool] = None
    paperless_url: Optional[str] = None
    default_storage_backend: Optional[str] = None
    paperless_auto_sync: Optional[bool] = None
    paperless_sync_tags: Optional[bool] = None

    @validator("unit_system")
    def validate_unit_system(cls, v):
        """Validate unit system if provided."""
        if v is not None:
            allowed_systems = ["imperial", "metric"]
            if v.lower() not in allowed_systems:
                raise ValueError(
                    f"Unit system must be one of: {', '.join(allowed_systems)}"
                )
            return v.lower()
        return v
    
    @validator("paperless_url")
    def validate_paperless_url(cls, v):
        """Validate paperless URL format if provided."""
        if v is None:
            return v
            
        # Must be HTTPS for security
        if not v.startswith('https://'):
            raise ValueError('Paperless URL must use HTTPS')
        
        # Basic URL format validation
        import re
        url_pattern = re.compile(
            r'^https://'
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\\.)+[A-Z]{2,6}\\.?|'
            r'localhost(?::\\d+)?|'
            r'\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(?::\\d+)?)'
            r'(?:/.*)?$', re.IGNORECASE
        )
        
        if not url_pattern.match(v):
            raise ValueError('Invalid URL format')
        
        return v.rstrip('/')
    
    @validator("default_storage_backend")
    def validate_storage_backend(cls, v):
        """Validate storage backend selection."""
        if v is None:
            return v
            
        allowed_backends = ["local", "paperless"]
        if v not in allowed_backends:
            raise ValueError(
                f"Storage backend must be one of: {', '.join(allowed_backends)}"
            )
        return v


class UserPreferences(UserPreferencesBase):
    """Schema for reading/returning user preferences data."""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration for SQLAlchemy compatibility."""

        from_attributes = True


class PaperlessConnectionData(BaseModel):
    """Schema for paperless connection data with validation."""
    
    paperless_url: str
    paperless_api_token: str
    
    @validator('paperless_url')
    def validate_url(cls, v):
        """Validate paperless URL format and security."""
        # Must be HTTPS
        if not v.startswith('https://'):
            raise ValueError('Paperless URL must use HTTPS')
        
        # URL format validation
        import re
        url_pattern = re.compile(
            r'^https://'
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\\.)+[A-Z]{2,6}\\.?|'
            r'localhost(?::\\d+)?|'
            r'\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(?::\\d+)?)'
            r'(?:/.*)?$', re.IGNORECASE
        )
        
        if not url_pattern.match(v):
            raise ValueError('Invalid URL format')
        
        # Prevent access to internal/private networks in production
        from urllib.parse import urlparse
        parsed = urlparse(v)
        
        # Block common internal/private IPs (except localhost for development)
        blocked_patterns = [
            r'^10\\.',            # private class A
            r'^192\\.168\\.',      # private class C
            r'^172\\.(1[6-9]|2[0-9]|3[0-1])\\.',  # private class B
            r'^169\\.254\\.',      # link-local
            r'^::1$',            # IPv6 localhost
            r'^fc00:',           # IPv6 private
        ]
        
        hostname = parsed.hostname
        if hostname and hostname != 'localhost':
            import re
            if any(re.match(pattern, hostname) for pattern in blocked_patterns):
                raise ValueError('Access to private/internal networks not allowed')
        
        return v.rstrip('/')
    
    @validator('paperless_api_token')
    def validate_token(cls, v):
        """Validate API token format."""
        # Paperless tokens are typically 40-character hex strings
        import re
        if not re.match(r'^[a-f0-9]{40}$', v):
            raise ValueError('Invalid API token format')
        return v
