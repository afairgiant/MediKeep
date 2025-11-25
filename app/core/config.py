import json
import logging
import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def _get_windows_path_helper(path_type: str):
    """
    Lazy import helper to avoid circular dependencies.

    Imports windows_config only when needed to get Windows-specific paths.
    """
    try:
        from app.core.platform.windows_config import (
            get_backups_path,
            get_logs_path,
            get_uploads_path,
            is_windows_exe,
        )

        if not is_windows_exe():
            return None

        if path_type == "uploads":
            return get_uploads_path()
        elif path_type == "logs":
            return str(get_logs_path())
        elif path_type == "backups":
            return get_backups_path()
        else:
            return None
    except ImportError:
        # If windows_config can't be imported, fall back to default paths
        return None


# Raw database credentials from environment
_DB_USER_RAW = os.getenv("DB_USER", "")
_DB_PASS_RAW = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "")

# URL-encode credentials to handle special characters (@, :, /, #, etc.)
# This prevents URL parsing issues when passwords contain these characters
DB_USER = quote_plus(_DB_USER_RAW) if _DB_USER_RAW else ""
DB_PASS = quote_plus(_DB_PASS_RAW) if _DB_PASS_RAW else ""


class Settings:  # App Info
    APP_NAME: str = "MediKeep"
    VERSION: str = "0.41 .1"

    DEBUG: bool = (
        os.getenv("DEBUG", "True").lower() == "true"
    )  # Enable debug by default in development
    # Database Configuration
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        (
            f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
            if all([DB_USER, DB_PASS, DB_NAME])
            else ""
        ),
    )

    # SSL Configuration
    # Use standard paths - /app/certs/ for Docker containers, ./certs/ for local development
    SSL_CERTFILE: str = os.getenv(
        "SSL_CERTFILE",
        (
            "/app/certs/localhost.crt"
            if os.path.exists("/app")
            else "./certs/localhost.crt"
        ),
    )
    SSL_KEYFILE: str = os.getenv(
        "SSL_KEYFILE",
        (
            "/app/certs/localhost.key"
            if os.path.exists("/app")
            else "./certs/localhost.key"
        ),
    )
    ENABLE_SSL: bool = os.getenv("ENABLE_SSL", "False").lower() == "true"

    # Security Configuration
    ALGORITHM: str = "HS256"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your_default_secret_key")

    # Token Settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480")
    )  # 8 hours

    # File Storage
    # Use Windows AppData paths when running as EXE, otherwise use default paths
    UPLOAD_DIR: Path = _get_windows_path_helper("uploads") or Path(
        os.getenv("UPLOAD_DIR", "./uploads")
    )
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", str(10 * 1024 * 1024)))  # 10MB

    # Backup Configuration
    # Note: Backups not supported in Windows EXE mode (SQLite-only, no PostgreSQL backups)
    BACKUP_DIR: Path = _get_windows_path_helper("backups") or Path(
        os.getenv("BACKUP_DIR", "./backups")
    )
    BACKUP_RETENTION_DAYS: int = int(
        os.getenv("BACKUP_RETENTION_DAYS", "7")
    )  # Keep it simple initially

    # Enhanced Backup Retention Settings
    BACKUP_MIN_COUNT: int = int(
        os.getenv("BACKUP_MIN_COUNT", "5")
    )  # Always keep at least 5 backups
    BACKUP_MAX_COUNT: int = int(
        os.getenv("BACKUP_MAX_COUNT", "50")
    )  # Warning threshold for too many backups

    # Trash directory settings
    _windows_uploads = _get_windows_path_helper("uploads")
    TRASH_DIR: Path = (
        (_windows_uploads / "trash")
        if _windows_uploads
        else Path(os.getenv("TRASH_DIR", "./uploads/trash"))
    )
    TRASH_RETENTION_DAYS: int = int(
        os.getenv("TRASH_RETENTION_DAYS", "30")
    )  # Keep deleted files for 30 days

    # User Registration Control
    ALLOW_USER_REGISTRATION: bool = (
        os.getenv("ALLOW_USER_REGISTRATION", "True").lower() == "true"
    )  # Default: enabled to avoid lockout scenarios

    # Default Admin Password Configuration
    ADMIN_DEFAULT_PASSWORD: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "admin123")

    # SSO Configuration (Simple and Right-Sized)
    SSO_ENABLED: bool = os.getenv("SSO_ENABLED", "False").lower() == "true"
    SSO_PROVIDER_TYPE: str = os.getenv("SSO_PROVIDER_TYPE", "oidc")
    SSO_CLIENT_ID: str = os.getenv("SSO_CLIENT_ID", "")
    SSO_CLIENT_SECRET: str = os.getenv("SSO_CLIENT_SECRET", "")
    SSO_ISSUER_URL: str = os.getenv("SSO_ISSUER_URL", "")
    SSO_REDIRECT_URI: str = os.getenv("SSO_REDIRECT_URI", "")
    SSO_ALLOWED_DOMAINS: list = json.loads(os.getenv("SSO_ALLOWED_DOMAINS", "[]"))

    # Basic rate limiting (simple approach)
    SSO_RATE_LIMIT_ATTEMPTS: int = int(os.getenv("SSO_RATE_LIMIT_ATTEMPTS", "10"))
    SSO_RATE_LIMIT_WINDOW_MINUTES: int = int(
        os.getenv("SSO_RATE_LIMIT_WINDOW_MINUTES", "10")
    )

    # Paperless-ngx Integration Configuration
    PAPERLESS_REQUEST_TIMEOUT: int = int(
        os.getenv("PAPERLESS_REQUEST_TIMEOUT", "30")
    )  # seconds
    PAPERLESS_CONNECT_TIMEOUT: int = int(
        os.getenv("PAPERLESS_CONNECT_TIMEOUT", "10")
    )  # seconds
    # Extended timeout for upload operations specifically to handle large files
    PAPERLESS_UPLOAD_TIMEOUT: int = int(
        os.getenv("PAPERLESS_UPLOAD_TIMEOUT", "300")
    )  # 5 minutes for uploads
    # Timeout for monitoring processing status - how long to wait without status updates
    PAPERLESS_PROCESSING_TIMEOUT: int = int(
        os.getenv("PAPERLESS_PROCESSING_TIMEOUT", "1800")
    )  # 30 minutes max processing time
    # How often to check processing status
    PAPERLESS_STATUS_CHECK_INTERVAL: int = int(
        os.getenv("PAPERLESS_STATUS_CHECK_INTERVAL", "10")
    )  # Check every 10 seconds
    PAPERLESS_MAX_UPLOAD_SIZE: int = int(
        os.getenv("PAPERLESS_MAX_UPLOAD_SIZE", str(50 * 1024 * 1024))
    )  # 50MB
    PAPERLESS_RETRY_ATTEMPTS: int = int(os.getenv("PAPERLESS_RETRY_ATTEMPTS", "3"))
    PAPERLESS_SALT: str = os.getenv("PAPERLESS_SALT", "paperless_integration_salt_v1")

    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = _get_windows_path_helper("logs") or os.getenv("LOG_DIR", "./logs")
    LOG_RETENTION_DAYS: int = int(os.getenv("LOG_RETENTION_DAYS", "180"))
    ENABLE_DEBUG_LOGS: bool = os.getenv("DEBUG", "False").lower() == "true"

    # Log Rotation Configuration
    LOG_ROTATION_METHOD: str = os.getenv(
        "LOG_ROTATION_METHOD", "auto"
    )  # auto|python|logrotate
    LOG_ROTATION_SIZE: str = os.getenv(
        "LOG_ROTATION_SIZE", "5M"
    )  # Used by both methods
    LOG_ROTATION_TIME: str = os.getenv(
        "LOG_ROTATION_TIME", "daily"
    )  # daily|weekly|monthly (logrotate only - Python uses size-based rotation only)
    LOG_ROTATION_BACKUP_COUNT: int = int(
        os.getenv("LOG_ROTATION_BACKUP_COUNT", "30")
    )  # Used by both methods
    LOG_COMPRESSION: bool = (
        os.getenv("LOG_COMPRESSION", "True").lower() == "true"
    )  # logrotate only

    # Database Sequence Monitoring (configurable for different environments)
    ENABLE_SEQUENCE_MONITORING: bool = (
        os.getenv("ENABLE_SEQUENCE_MONITORING", "True").lower() == "true"
    )
    SEQUENCE_CHECK_ON_STARTUP: bool = (
        os.getenv("SEQUENCE_CHECK_ON_STARTUP", "True").lower() == "true"
    )
    SEQUENCE_AUTO_FIX: bool = os.getenv("SEQUENCE_AUTO_FIX", "True").lower() == "true"
    SEQUENCE_MONITOR_INTERVAL_HOURS: int = int(
        os.getenv("SEQUENCE_MONITOR_INTERVAL_HOURS", "24")
    )

    def __init__(self):
        # Ensure upload directory exists with proper error handling
        self._ensure_directory_exists(self.UPLOAD_DIR, "upload")

        # Ensure backup directory exists with proper error handling
        self._ensure_directory_exists(self.BACKUP_DIR, "backup")

    @property
    def sso_configured(self) -> bool:
        """Check if SSO is properly configured"""
        if not self.SSO_ENABLED:
            return False

        basic_config = bool(
            self.SSO_CLIENT_ID and self.SSO_CLIENT_SECRET and self.SSO_REDIRECT_URI
        )

        # OIDC providers need issuer URL
        if self.SSO_PROVIDER_TYPE in ["oidc", "authentik", "authelia", "keycloak"]:
            return basic_config and bool(self.SSO_ISSUER_URL)

        return basic_config

    def validate_sso_config(self):
        """Simple validation with clear error messages"""
        if not self.SSO_ENABLED:
            return

        if self.SSO_PROVIDER_TYPE not in [
            "google",
            "github",
            "oidc",
            "authentik",
            "authelia",
            "keycloak",
        ]:
            raise ValueError(f"Unsupported SSO provider: {self.SSO_PROVIDER_TYPE}")

        if not self.SSO_CLIENT_ID:
            raise ValueError("SSO_CLIENT_ID is required when SSO is enabled")

        if not self.SSO_CLIENT_SECRET:
            raise ValueError("SSO_CLIENT_SECRET is required when SSO is enabled")

        if not self.SSO_REDIRECT_URI:
            raise ValueError("SSO_REDIRECT_URI is required when SSO is enabled")

        if (
            self.SSO_PROVIDER_TYPE in ["oidc", "authentik", "authelia", "keycloak"]
            and not self.SSO_ISSUER_URL
        ):
            raise ValueError("SSO_ISSUER_URL is required for OIDC providers")

    def _ensure_directory_exists(self, directory: Path, directory_type: str) -> None:
        """Ensure directory exists with proper permission error handling for Docker bind mounts."""
        if not directory.exists():
            try:
                directory.mkdir(parents=True, exist_ok=True)
                logging.info(f"Created {directory_type} directory: {directory}")
            except PermissionError as e:
                error_msg = (
                    f"Permission denied creating {directory_type} directory: {directory}. "
                    "This is likely a Docker bind mount permission issue. "
                    "Please ensure the container has write permissions to the host directory. "
                    "For bind mounts, you may need to: "
                    "1. Set proper ownership: 'sudo chown -R 1000:1000 /host/path' "
                    "2. Or use Docker volumes instead of bind mounts. "
                    f"Error: {str(e)}"
                )
                logging.error(error_msg)
                # Don't raise here to allow the app to start, but log the issue
                # The actual endpoints will handle the error when they try to create files
            except OSError as e:
                error_msg = (
                    f"Failed to create {directory_type} directory {directory}: {str(e)}"
                )
                logging.error(error_msg)
                # Don't raise here to allow the app to start


# Create global settings instance
try:
    settings = Settings()
except Exception as e:
    logging.error(f"Failed to initialize settings: {str(e)}")
    raise
