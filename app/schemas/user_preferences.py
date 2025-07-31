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
        if v is None or v == "":
            return v
            
        # Allow HTTP for localhost/local development, require HTTPS for external URLs
        from urllib.parse import urlparse
        parsed = urlparse(v)
        
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        
        # Check if it's a local development URL
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
        
        # For external URLs, require HTTPS for security
        if not is_local and not v.startswith('https://'):
            raise ValueError('External URLs must use HTTPS for security')
        
        # Basic URL format validation - simplified for local development
        import re
        # More permissive regex that allows IP addresses and domains
        url_pattern = re.compile(
            r'^https?://'  # Allow both http and https
            r'(?:'
            r'[a-zA-Z0-9](?:[a-zA-Z0-9\-\.]*[a-zA-Z0-9])?'  # domain or hostname
            r'|'
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'  # IP address
            r')'
            r'(?::\d+)?'  # optional port
            r'(?:/.*)?$', re.IGNORECASE  # optional path
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
        if v is None or v == "":
            return v
            
        # Allow HTTP for localhost/local development, require HTTPS for external URLs
        from urllib.parse import urlparse
        parsed = urlparse(v)
        
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        
        # Check if it's a local development URL
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
        
        # For external URLs, require HTTPS for security
        if not is_local and not v.startswith('https://'):
            raise ValueError('External URLs must use HTTPS for security')
        
        # Basic URL format validation - simplified for local development
        import re
        # More permissive regex that allows IP addresses and domains
        url_pattern = re.compile(
            r'^https?://'  # Allow both http and https
            r'(?:'
            r'[a-zA-Z0-9](?:[a-zA-Z0-9\-\.]*[a-zA-Z0-9])?'  # domain or hostname
            r'|'
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'  # IP address
            r')'
            r'(?::\d+)?'  # optional port
            r'(?:/.*)?$', re.IGNORECASE  # optional path
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
        # Allow HTTP for localhost/local development, require HTTPS for external URLs
        from urllib.parse import urlparse
        parsed = urlparse(v)
        
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        
        # Check if it's a local development URL
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
        
        # For external URLs, require HTTPS for security
        if not is_local and not v.startswith('https://'):
            raise ValueError('External URLs must use HTTPS for security')
        
        # Basic URL format validation - simplified for local development
        import re
        # More permissive regex that allows IP addresses and domains
        url_pattern = re.compile(
            r'^https?://'  # Allow both http and https
            r'(?:'
            r'[a-zA-Z0-9](?:[a-zA-Z0-9\-\.]*[a-zA-Z0-9])?'  # domain or hostname
            r'|'
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'  # IP address
            r')'
            r'(?::\d+)?'  # optional port
            r'(?:/.*)?$', re.IGNORECASE  # optional path
        )
        
        if not url_pattern.match(v):
            raise ValueError('Invalid URL format')
        
        return v.rstrip('/')
    
    @validator('paperless_api_token')
    def validate_token(cls, v):
        """Validate API token format."""
        # Basic validation - tokens should be non-empty strings
        if not v or len(v.strip()) == 0:
            raise ValueError('API token is required')
        # Allow various token formats as paperless may use different formats
        if len(v) < 10:
            raise ValueError('API token seems too short')
        return v
