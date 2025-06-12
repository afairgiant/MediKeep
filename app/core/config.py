import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:  # App Info
    APP_NAME: str = "Medical Records Management System"
    VERSION: str = "0.0.11"
    DEBUG: bool = (
        os.getenv("DEBUG", "True").lower() == "true"
    )  # Enable debug by default in development

    # Database Configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./medical_records.db")

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

    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = os.getenv("LOG_DIR", "./logs")
    LOG_RETENTION_DAYS: int = int(os.getenv("LOG_RETENTION_DAYS", "180"))
    ENABLE_DEBUG_LOGS: bool = os.getenv("DEBUG", "False").lower() == "true"

    def __init__(self):
        # Ensure upload directory exists
        if not self.UPLOAD_DIR.exists():
            self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# Create global settings instance
settings = Settings()
