import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    # App Info
    APP_NAME: str = "Medical Records Management System"
    VERSION: str = "0.0.8"
    DEBUG: bool = (
        os.getenv("DEBUG", "True").lower() == "true"
    )  # Enable debug by default in development

    # Database Configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./medical_records.db")

    # Security Configuration
    ALGORITHM: str = "HS256"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your_default_secret_key")
    
    # Development Security Toggles - Disable security features for easier development
    DISABLE_SECURITY_IN_DEV: bool = os.getenv("DISABLE_SECURITY_IN_DEV", "True").lower() == "true"
    
    # Token and Session Settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = (
        int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours in dev
        if DEBUG and DISABLE_SECURITY_IN_DEV
        else int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))  # 30 minutes in prod
    )
    
    # Rate Limiting Settings
    ENABLE_RATE_LIMITING: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_RATE_LIMITING", "True").lower() == "true"
    )
    
    # Authentication Security
    ENABLE_FAILED_LOGIN_TRACKING: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_FAILED_LOGIN_TRACKING", "True").lower() == "true"
    )
    
    # Input Validation Security
    ENABLE_SUSPICIOUS_INPUT_DETECTION: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_SUSPICIOUS_INPUT_DETECTION", "True").lower() == "true"
    )
    
    # Security Logging
    ENABLE_SECURITY_AUDIT_LOGGING: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_SECURITY_AUDIT_LOGGING", "True").lower() == "true"
    )
    
    # Request Monitoring
    ENABLE_REQUEST_MONITORING: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_REQUEST_MONITORING", "True").lower() == "true"
    )
    
    # CORS Settings (more permissive in development)
    CORS_ALLOW_ALL_ORIGINS: bool = (
        True if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("CORS_ALLOW_ALL_ORIGINS", "False").lower() == "true"
    )
    
    # Session Security
    ENABLE_SESSION_TIMEOUT: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_SESSION_TIMEOUT", "True").lower() == "true"
    )
    
    # Password Security (for development ease)
    ENABLE_PASSWORD_COMPLEXITY: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_PASSWORD_COMPLEXITY", "True").lower() == "true"
    )
    
    # File Upload Security
    ENABLE_FILE_TYPE_VALIDATION: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_FILE_TYPE_VALIDATION", "True").lower() == "true"
    )
    
    # Medical Data Access Logging
    ENABLE_MEDICAL_AUDIT_LOGGING: bool = (
        False if DEBUG and DISABLE_SECURITY_IN_DEV
        else os.getenv("ENABLE_MEDICAL_AUDIT_LOGGING", "True").lower() == "true"
    )# File Storage
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
