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
    VERSION: str = "0.9.1"

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
    )  # Database Sequence Monitoring (configurable for different environments)
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
        # Ensure upload directory exists
        if not self.UPLOAD_DIR.exists():
            self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        # Ensure backup directory exists
        if not self.BACKUP_DIR.exists():
            self.BACKUP_DIR.mkdir(parents=True, exist_ok=True)


# Create global settings instance
settings = Settings()
