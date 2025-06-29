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
                f"WARNING: Invalid LOG_LEVEL '{level_str}', defaulting to {DEFAULT_LOG_LEVEL}"
            )
            print(f"Valid levels: {', '.join(VALID_LOG_LEVELS)}")
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
        """Set up a rotating file handler for a specific log category."""

        log_file = self.log_dir / f"{category}.log"

        # Create rotating file handler using shared constants
        handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=LOG_FILE_MAX_BYTES,
            backupCount=LOG_FILE_BACKUP_COUNT,
            encoding=LOG_FILE_ENCODING,
        )

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
        category: Log category (app, security, medical, performance)

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


def log_medical_access(
    logger: logging.Logger,
    event: str,
    user_id: int,
    patient_id: int,
    ip_address: str,
    duration_ms: Optional[int] = None,
    message: Optional[str] = None,
    **kwargs,
):
    """
    Log medical data access events with standardized format.

    Args:
        logger: Logger instance
        event: Type of event (e.g., 'patient_accessed', 'record_modified')
        user_id: ID of the user performing the action
        patient_id: ID of the patient whose data is being accessed
        ip_address: IP address of the request
        duration_ms: Request duration in milliseconds
        message: Human-readable message
        **kwargs: Additional context data
    """
    extra_data = {
        "category": "medical",
        "event": event,
        "user_id": user_id,
        "patient_id": patient_id,
        "ip": ip_address,
        "duration": duration_ms,
        **kwargs,
    }

    logger.info(message or f"Medical data access: {event}", extra=extra_data)


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
            "category": "performance",
            "event": event,
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
