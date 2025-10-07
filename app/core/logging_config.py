"""
Logging configuration for the Medical Records Management System.

This module provides a centralized logging configuration for self-hosted deployment,
focusing on essential logging capabilities with minimal dependencies.
"""

import contextvars
import json
import logging
import logging.handlers
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

from .logging_constants import (
    CATEGORIES,
    CONSOLE_LOG_FORMAT,
    CONTAINER_APP_PATH,
    CONTAINER_LOG_DIR,
    DEFAULT_CATEGORY,
    DEFAULT_LOG_LEVEL,
    LOCAL_DEV_LOG_DIR,
    LOG_FILE_BACKUP_COUNT,
    LOG_FILE_ENCODING,
    LOG_FILE_MAX_BYTES,
    SECURITY_CATEGORY,
    VALID_LOG_LEVELS,
    LogFields,
    get_log_level_numeric,
    validate_log_level,
)

# Context variable for correlation ID
correlation_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)


def _is_logrotate_available() -> bool:
    """Check if logrotate is available on the system."""
    return shutil.which("logrotate") is not None


def _parse_size_string(size_str: str) -> int:

    """
    Convert size string (e.g., '50M', '1G') to bytes with robust error handling.
    
    Args:
        size_str: Size string with optional suffix (K, M, G)
        
    Returns:
        Size in bytes
        
    Raises:
        ValueError: If the size string is invalid or out of reasonable bounds
    """
    if not isinstance(size_str, str):
        raise ValueError(f"Size must be a string, got {type(size_str).__name__}: {size_str}")
    
    size_str = size_str.strip()
    if not size_str:
        raise ValueError("Size string cannot be empty")
    
    # Normalize to uppercase for consistent processing
    original_size = size_str
    size_str = size_str.upper()
    
    # Define multipliers and reasonable bounds
    multipliers = {
        'K': 1024,
        'M': 1024 * 1024,
        'G': 1024 * 1024 * 1024
    }
    
    # Parse size and suffix
    try:
        if size_str[-1] in multipliers:
            suffix = size_str[-1]
            number_part = size_str[:-1]
            multiplier = multipliers[suffix]
        else:
            # No suffix, assume bytes
            suffix = 'B'
            number_part = size_str
            multiplier = 1
        
        # Validate and convert the numeric part
        if not number_part:
            raise ValueError(f"Invalid size format '{original_size}': missing numeric part")
        
        try:
            number = float(number_part)
            if number != int(number):
                raise ValueError(f"Invalid size format '{original_size}': decimal numbers not supported")
            number = int(number)
        except ValueError as e:
            if "decimal numbers not supported" in str(e):
                raise
            raise ValueError(f"Invalid size format '{original_size}': numeric part must be an integer")
        
        if number <= 0:
            raise ValueError(f"Invalid size '{original_size}': size must be positive")
        
        # Calculate result in bytes
        result_bytes = number * multiplier
        
        # Validate reasonable bounds (1KB to 10GB)
        min_bytes = 1024  # 1KB minimum
        max_bytes = 10 * 1024 * 1024 * 1024  # 10GB maximum
        
        if result_bytes < min_bytes:
            raise ValueError(f"Size '{original_size}' ({result_bytes} bytes) is too small. Minimum is 1KB")
        
        if result_bytes > max_bytes:
            raise ValueError(f"Size '{original_size}' ({result_bytes} bytes) is too large. Maximum is 10GB")
        
        return result_bytes
        
    except (IndexError, KeyError) as e:
        raise ValueError(f"Invalid size format '{original_size}': {str(e)}")


def _get_rotation_method() -> str:
    """Determine which log rotation method to use."""
    from .config import settings
    
    method = settings.LOG_ROTATION_METHOD.lower()
    
    if method == "auto":
        # Auto-detect: prefer logrotate if available, otherwise use Python
        return "logrotate" if _is_logrotate_available() else "python"
    elif method in ["logrotate", "python"]:
        return method
    else:
        print(f"WARNING: Invalid LOG_ROTATION_METHOD '{method}', defaulting to 'auto'")
        return "logrotate" if _is_logrotate_available() else "python"


class MedicalRecordsJSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for medical records system.
    Adds correlation ID and standardized fields to all log records.
    """

    def format(self, record: logging.LogRecord) -> str:
        # Create the log record dictionary using standardized field names
        log_record = {
            LogFields.TIMESTAMP: datetime.utcnow().isoformat() + "Z",
            LogFields.LEVEL: record.levelname,
            LogFields.LOGGER: record.name,
            LogFields.MESSAGE: record.getMessage(),
        }

        # Add correlation ID if available
        correlation_id = correlation_id_var.get()
        if correlation_id:
            log_record[LogFields.CORRELATION_ID] = correlation_id

        # Add any extra fields from the record using standardized field names
        extra_fields = [
            LogFields.CATEGORY,
            LogFields.EVENT,
            LogFields.USER_ID,
            LogFields.PATIENT_ID,
            LogFields.IP,
            LogFields.DURATION,
        ]
        for field in extra_fields:
            value = getattr(record, field, None)
            if value is not None:
                log_record[field] = str(value)

        # Add source location for debug logs
        if record.levelno <= logging.DEBUG:
            log_record[LogFields.FILE] = record.filename
            log_record[LogFields.LINE] = str(record.lineno)
            log_record[LogFields.FUNCTION] = record.funcName

        return json.dumps(log_record, ensure_ascii=False, default=str)


class LoggingConfig:
    """
    Centralized logging configuration for the medical records system.
    Enhanced with input validation and emergency fallback capabilities.
    """

    def __init__(self):
        # Standardized log directory using constants: container vs local development
        default_log_dir = (
            CONTAINER_LOG_DIR
            if Path(CONTAINER_APP_PATH).exists()
            else LOCAL_DEV_LOG_DIR
        )
        self.log_dir = Path(os.getenv("LOG_DIR", default_log_dir))
        self.debug_mode = os.getenv("DEBUG", "False").lower() == "true"
        self.retention_days = int(os.getenv("LOG_RETENTION_DAYS", "180"))

        # Ensure log directory exists
        self.log_dir.mkdir(exist_ok=True)

        # Configure root logger with error handling
        try:
            self.log_level = self._get_safe_log_level()
            self._setup_logging()
        except Exception as e:
            print(
                f"CRITICAL: Logging setup failed, using emergency console logging: {e}"
            )
            self._setup_emergency_logging()

    def _get_safe_log_level(self) -> int:
        """
        Safely get log level with validation and fallback using shared constants.
        Returns numeric log level for internal use.
        """
        level_str = os.getenv("LOG_LEVEL", DEFAULT_LOG_LEVEL).upper().strip()

        if not validate_log_level(level_str):
            print(
                f"WARNING: Invalid LOG_LEVEL '{level_str}', defaulting to {DEFAULT_LOG_LEVEL}. "
                f"Valid levels: {', '.join(VALID_LOG_LEVELS)}"
            )
            return get_log_level_numeric(DEFAULT_LOG_LEVEL)

        return get_log_level_numeric(level_str)

    def _setup_emergency_logging(self):
        """
        Emergency fallback logging if main setup fails.
        Provides basic console output to ensure logging never completely fails.
        """
        try:
            root_logger = logging.getLogger()
            root_logger.handlers.clear()

            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.INFO)
            console_handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s EMERGENCY [%(name)s] %(levelname)s: %(message)s"
                )
            )

            root_logger.addHandler(console_handler)
            root_logger.setLevel(logging.INFO)

            print("Emergency logging activated - basic console output only")
        except Exception as fallback_error:
            print(f"FATAL: Even emergency logging failed: {fallback_error}")

    def _setup_logging(self):
        """Set up the logging configuration with enhanced error handling."""

        # Clear any existing handlers
        root_logger = logging.getLogger()
        root_logger.handlers.clear()

        # Set root logger level - use validated log level, override with DEBUG if debug_mode
        if self.debug_mode:
            root_logger.setLevel(logging.DEBUG)
        else:
            root_logger.setLevel(self.log_level)

        # Suppress verbose third-party library debug logs
        logging.getLogger('pdfminer').setLevel(logging.WARNING)
        logging.getLogger('PIL').setLevel(logging.WARNING)
        logging.getLogger('pytesseract').setLevel(logging.WARNING)

        # Create formatters
        json_formatter = MedicalRecordsJSONFormatter()

        # Enhanced console formatter for better readability in docker logs
        console_formatter = logging.Formatter(CONSOLE_LOG_FORMAT)

        # Set up console handler - always enabled, respects LOG_LEVEL
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(console_formatter)
        console_handler.setLevel(self.log_level)
        root_logger.addHandler(console_handler)

        # Set up simplified file handlers - only 2 files needed
        self._setup_file_handlers()

    def _setup_file_handlers(self):
        """
        Set up simplified two-file structure using shared constants.
        As specified in Phase 1 requirements.
        """
        json_formatter = MedicalRecordsJSONFormatter()

        # app.log - patient access, API calls, frontend errors, performance, etc.
        self._setup_file_handler(DEFAULT_CATEGORY, json_formatter, self.log_level)

        # security.log - failed logins, suspicious activity, auth failures only
        self._setup_file_handler(SECURITY_CATEGORY, json_formatter, logging.WARNING)

    def _setup_file_handler(
        self, category: str, formatter: logging.Formatter, level: int
    ):
        """Set up a file handler for a specific log category with hybrid rotation support."""
        from .config import settings

        log_file = self.log_dir / f"{category}.log"
        rotation_method = _get_rotation_method()

        if rotation_method == "logrotate":
            # Use simple FileHandler when logrotate handles rotation
            handler = logging.FileHandler(
                log_file,
                encoding=LOG_FILE_ENCODING,
            )

            # Using logrotate for rotation (no Python rotation needed)
            pass
        else:
            # Use Python's built-in rotation as fallback
            try:
                max_bytes = _parse_size_string(settings.LOG_ROTATION_SIZE)
            except ValueError as e:
                # Log warning through print since logging might not be fully set up
                print(f"WARNING: Invalid LOG_ROTATION_SIZE '{settings.LOG_ROTATION_SIZE}': {e}. Using default size of 5MB for {category}.log")
                max_bytes = 5 * 1024 * 1024  # 5MB default
            

            backup_count = settings.LOG_ROTATION_BACKUP_COUNT
            
            handler = logging.handlers.RotatingFileHandler(
                log_file,
                maxBytes=max_bytes,
                backupCount=backup_count,
                encoding=LOG_FILE_ENCODING,
            )

            # Python rotation configured (logged via print to avoid circular logging)
            pass

        handler.setFormatter(formatter)
        handler.setLevel(level)

        # Create category-specific logger and clear existing handlers
        logger = logging.getLogger(f"medical_records.{category}")
        logger.handlers.clear()  # Clear existing handlers to prevent duplication
        logger.addHandler(handler)
        logger.setLevel(level)
        logger.propagate = True  # Allow propagation to root logger for console output


def get_logger(name: str, category: str = "app") -> logging.Logger:
    """
    Get a logger for a specific module with the given category.

    Args:
        name: Usually __name__ of the calling module
        category: Log category (app, security)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(f"medical_records.{category}.{name}")


def set_correlation_id(correlation_id: str):
    """Set the correlation ID for the current context."""
    correlation_id_var.set(correlation_id)


def get_correlation_id() -> Optional[str]:
    """Get the current correlation ID."""
    return correlation_id_var.get()


# Removed log_medical_access function - unused and no corresponding file handler


def log_security_event(
    logger: logging.Logger,
    event: str,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    message: Optional[str] = None,
    **kwargs,
):
    """
    Log security events with standardized format.

    Args:
        logger: Logger instance
        event: Type of security event (e.g., 'login_failed', 'token_expired')
        user_id: ID of the user (if known)
        ip_address: IP address of the request
        message: Human-readable message
        **kwargs: Additional context data
    """
    extra_data = {
        "category": "security",
        "event": event,
        "user_id": user_id,
        "ip": ip_address,
        **kwargs,
    }

    logger.warning(message or f"Security event: {event}", extra=extra_data)


def log_performance_event(
    logger: logging.Logger,
    event: str,
    duration_ms: int,
    threshold_ms: int = 1000,
    message: Optional[str] = None,
    **kwargs,
):
    """
    Log performance events when operations exceed thresholds.

    Args:
        logger: Logger instance
        event: Type of performance event (e.g., 'slow_query', 'high_memory')
        duration_ms: Duration in milliseconds
        threshold_ms: Threshold that was exceeded
        message: Human-readable message
        **kwargs: Additional context data
    """
    if duration_ms > threshold_ms:
        extra_data = {
            "category": "app",
            "event": f"performance_{event}",
            "duration": duration_ms,
            "threshold": threshold_ms,
            **kwargs,
        }

        logger.warning(
            message or f"Performance event: {event} took {duration_ms}ms",
            extra=extra_data,
        )


# Initialize logging configuration when module is imported
logging_config = LoggingConfig()

# Export commonly used loggers - Phase 3 using shared constants
app_logger = get_logger(__name__, DEFAULT_CATEGORY)
security_logger = get_logger(__name__, SECURITY_CATEGORY)
