from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator, ValidationInfo, ConfigDict

# Supported languages - single source of truth
SUPPORTED_LANGUAGES = ["en", "fr", "de", "es", "it", "pt"]

# Supported date formats - single source of truth
# mdy = MM/DD/YYYY (US), dmy = DD/MM/YYYY (European), ymd = YYYY-MM-DD (ISO)
SUPPORTED_DATE_FORMATS = ["mdy", "dmy", "ymd"]


class UserPreferencesBase(BaseModel):
    """Base User Preferences schema with common fields."""

    unit_system: str
    session_timeout_minutes: Optional[int] = 30
    language: Optional[str] = "en"
    date_format: Optional[str] = "mdy"
    paperless_enabled: Optional[bool] = False
    paperless_url: Optional[str] = None
    paperless_api_token: Optional[str] = None
    paperless_username: Optional[str] = None
    paperless_password: Optional[str] = None
    default_storage_backend: Optional[str] = "local"
    paperless_auto_sync: Optional[bool] = False
    paperless_sync_tags: Optional[bool] = True

    @field_validator("session_timeout_minutes")
    @classmethod
    def validate_session_timeout(cls, v):
        """
        Validate that the session timeout is within reasonable bounds.

        Args:
            v: The session timeout in minutes

        Returns:
            Validated timeout value

        Raises:
            ValueError: If timeout is not within allowed range
        """
        if v is not None:
            if v < 5:
                raise ValueError("Session timeout must be at least 5 minutes")
            if v > 1440:  # 24 hours
                raise ValueError("Session timeout cannot exceed 1440 minutes (24 hours)")
        return v

    @field_validator("unit_system")
    @classmethod
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

    @field_validator("language")
    @classmethod
    def validate_language(cls, v):
        """
        Validate that the language is one of the supported values.

        Args:
            v: The language code to validate (ISO 639-1)

        Returns:
            Validated language code (lowercase)

        Raises:
            ValueError: If language is not in supported list
        """
        if v is not None:
            if v.lower() not in SUPPORTED_LANGUAGES:
                raise ValueError(
                    f"Language must be one of: {', '.join(SUPPORTED_LANGUAGES)}"
                )
            return v.lower()
        return v

    @field_validator("date_format")
    @classmethod
    def validate_date_format(cls, v):
        """
        Validate that the date format is one of the supported values.

        Args:
            v: The date format code to validate

        Returns:
            Validated date format code (lowercase)

        Raises:
            ValueError: If date format is not in supported list
        """
        if v is not None:
            if v.lower() not in SUPPORTED_DATE_FORMATS:
                raise ValueError(
                    f"Date format must be one of: {', '.join(SUPPORTED_DATE_FORMATS)}"
                )
            return v.lower()
        return v

    @field_validator("paperless_url")
    @classmethod
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

    @field_validator("default_storage_backend")
    @classmethod
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
    session_timeout_minutes: Optional[int] = None
    language: Optional[str] = None
    date_format: Optional[str] = None
    paperless_enabled: Optional[bool] = None
    paperless_url: Optional[str] = None
    paperless_username: Optional[str] = None
    paperless_password: Optional[str] = None
    default_storage_backend: Optional[str] = None
    paperless_auto_sync: Optional[bool] = None
    paperless_sync_tags: Optional[bool] = None

    @field_validator("session_timeout_minutes")
    @classmethod
    def validate_session_timeout(cls, v):
        """Validate session timeout if provided."""
        if v is not None:
            if v < 5:
                raise ValueError("Session timeout must be at least 5 minutes")
            if v > 1440:  # 24 hours
                raise ValueError("Session timeout cannot exceed 1440 minutes (24 hours)")
        return v

    @field_validator("unit_system")
    @classmethod
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

    @field_validator("language")
    @classmethod
    def validate_language(cls, v):
        """Validate language if provided."""
        if v is not None:
            if v.lower() not in SUPPORTED_LANGUAGES:
                raise ValueError(
                    f"Language must be one of: {', '.join(SUPPORTED_LANGUAGES)}"
                )
            return v.lower()
        return v

    @field_validator("date_format")
    @classmethod
    def validate_date_format(cls, v):
        """Validate date format if provided."""
        if v is not None:
            if v.lower() not in SUPPORTED_DATE_FORMATS:
                raise ValueError(
                    f"Date format must be one of: {', '.join(SUPPORTED_DATE_FORMATS)}"
                )
            return v.lower()
        return v

    @field_validator("paperless_url")
    @classmethod
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

    @field_validator("default_storage_backend")
    @classmethod
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

    model_config = ConfigDict(from_attributes=True)


class PaperlessConnectionData(BaseModel):
    """Schema for paperless connection data with validation."""

    paperless_url: str
    paperless_api_token: Optional[str] = None
    paperless_username: Optional[str] = None
    paperless_password: Optional[str] = None

    @field_validator('paperless_url')
    @classmethod
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

    @field_validator('paperless_api_token')
    @classmethod
    def validate_api_token(cls, v):
        """Validate API token format if provided."""
        if v is not None and v.strip():
            if len(v.strip()) < 10:
                raise ValueError('API token appears to be too short')
            return v.strip()
        return v

    @field_validator('paperless_username')
    @classmethod
    def validate_username(cls, v, info: ValidationInfo):
        """Validate username format when provided."""
        # If token is provided, username is optional
        if info.data.get('paperless_api_token'):
            return v.strip() if v else v

        # If no token, username is required
        if not v or len(v.strip()) == 0:
            raise ValueError('Username is required when no API token is provided')
        if len(v) < 2:
            raise ValueError('Username too short')
        return v.strip()

    @field_validator('paperless_password')
    @classmethod
    def validate_password(cls, v, info: ValidationInfo):
        """Validate password format when provided."""
        # If token is provided, password is optional
        if info.data.get('paperless_api_token'):
            return v

        # If no token, password is required
        if not v or len(v.strip()) == 0:
            raise ValueError('Password is required when no API token is provided')
        if len(v) < 3:
            raise ValueError('Password too short')

        # Check for valid authentication method
        token = info.data.get('paperless_api_token')
        username = info.data.get('paperless_username')

        # If no token and no username/password combination
        if not token and (not username or not v):
            raise ValueError('Either API token or username/password combination is required')

        return v
