"""
Logging configuration for the Medical Records Management System.

This module provides a centralized logging configuration for self-hosted deployment,
focusing on essential logging capabilities with minimal dependencies.
"""

import logging
import logging.handlers
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional
import contextvars

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
        # Create the log record dictionary
        log_record = {
            "time": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add correlation ID if available
        correlation_id = correlation_id_var.get()
        if correlation_id:
            log_record["correlation_id"] = correlation_id
        # Add any extra fields from the record
        for field in ["category", "event", "user_id", "patient_id", "ip", "duration"]:
            value = getattr(record, field, None)
            if value is not None:
                log_record[field] = str(value)

        # Add source location for debug logs
        if record.levelno <= logging.DEBUG:
            log_record["file"] = record.filename
            log_record["line"] = str(record.lineno)
            log_record["function"] = record.funcName

        return json.dumps(log_record, ensure_ascii=False, default=str)


class LoggingConfig:
    """
    Centralized logging configuration for the medical records system.
    """

    def __init__(self):
        self.log_dir = Path(os.getenv("LOG_DIR", "./logs"))
        self.log_level = os.getenv("LOG_LEVEL", "INFO").upper()
        self.debug_mode = os.getenv("DEBUG", "False").lower() == "true"
        self.retention_days = int(os.getenv("LOG_RETENTION_DAYS", "180"))

        # Ensure log directory exists
        self.log_dir.mkdir(exist_ok=True)

        # Configure root logger
        self._setup_logging()

    def _setup_logging(self):
        """Set up the logging configuration."""

        # Clear any existing handlers
        root_logger = logging.getLogger()
        root_logger.handlers.clear()

        # Set log level
        if self.debug_mode:
            root_logger.setLevel(logging.DEBUG)
        else:
            root_logger.setLevel(getattr(logging, self.log_level))

        # Create formatters
        json_formatter = MedicalRecordsJSONFormatter()

        console_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

        # Set up file handlers for different log categories
        self._setup_file_handler("app", json_formatter, logging.INFO)
        self._setup_file_handler("security", json_formatter, logging.WARNING)
        self._setup_file_handler("medical", json_formatter, logging.INFO)
        self._setup_file_handler("performance", json_formatter, logging.WARNING)

        # Set up console handler for development
        if self.debug_mode:
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(console_formatter)
            console_handler.setLevel(logging.DEBUG)
            root_logger.addHandler(console_handler)

    def _setup_file_handler(
        self, category: str, formatter: logging.Formatter, level: int
    ):
        """Set up a rotating file handler for a specific log category."""

        log_file = self.log_dir / f"{category}.log"

        # Create rotating file handler (10MB per file, keep 10 files)
        handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=10,
            encoding="utf-8",
        )

        handler.setFormatter(formatter)
        handler.setLevel(level)

        # Create category-specific logger
        logger = logging.getLogger(f"medical_records.{category}")
        logger.addHandler(handler)
        logger.setLevel(level)
        logger.propagate = False  # Don't propagate to root logger


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

# Export commonly used loggers
app_logger = get_logger(__name__, "app")
security_logger = get_logger(__name__, "security")
medical_logger = get_logger(__name__, "medical")
performance_logger = get_logger(__name__, "performance")
