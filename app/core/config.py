import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DB_USER = os.getenv("DB_USER", "")
DB_PASS = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "")


class Settings:  # App Info
    APP_NAME: str = "Medical Records Management System"
    VERSION: str = "0.19.0"

    DEBUG: bool = (
        os.getenv("DEBUG", "True").lower() == "true"
    )  # Enable debug by default in development    # Database Configuration
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
    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", "./uploads"))
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", str(10 * 1024 * 1024)))  # 10MB

    # Backup Configuration
    BACKUP_DIR: Path = Path(os.getenv("BACKUP_DIR", "./backups"))
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
    TRASH_DIR: Path = Path(os.getenv("TRASH_DIR", "./uploads/trash"))
    TRASH_RETENTION_DAYS: int = int(
        os.getenv("TRASH_RETENTION_DAYS", "30")
    )  # Keep deleted files for 30 days

    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = os.getenv("LOG_DIR", "./logs")
    LOG_RETENTION_DAYS: int = int(os.getenv("LOG_RETENTION_DAYS", "180"))
    ENABLE_DEBUG_LOGS: bool = (
        os.getenv("DEBUG", "False").lower() == "true"
    )
    
    # Log Rotation Configuration
    LOG_ROTATION_METHOD: str = os.getenv("LOG_ROTATION_METHOD", "auto")  # auto|python|logrotate
    LOG_ROTATION_SIZE: str = os.getenv("LOG_ROTATION_SIZE", "5M")
    LOG_ROTATION_TIME: str = os.getenv("LOG_ROTATION_TIME", "daily")  # daily|weekly|monthly
    LOG_ROTATION_BACKUP_COUNT: int = int(os.getenv("LOG_ROTATION_BACKUP_COUNT", "30"))
    LOG_COMPRESSION: bool = os.getenv("LOG_COMPRESSION", "True").lower() == "true"
    
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
