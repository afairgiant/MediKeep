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
    Enhanced with input validation and emergency fallback capabilities.
    """

    def __init__(self):
        # Standardized log directory: /app/logs in container, ./logs for local development
        default_log_dir = "/app/logs" if Path("/app").exists() else "./logs"
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
        Safely get log level with validation and fallback.
        Returns numeric log level for internal use.
        """
        level_str = os.getenv("LOG_LEVEL", "INFO").upper().strip()
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

        if level_str not in valid_levels:
            print(f"WARNING: Invalid LOG_LEVEL '{level_str}', defaulting to INFO")
            print(f"Valid levels: {', '.join(valid_levels)}")
            return logging.INFO

        return getattr(logging, level_str)

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
        console_formatter = logging.Formatter(
            "%(asctime)s %(levelname)s [%(name)s] %(message)s"
        )

        # Set up console handler - always enabled, respects LOG_LEVEL
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(console_formatter)
        console_handler.setLevel(self.log_level)
        root_logger.addHandler(console_handler)

        # Set up simplified file handlers - only 2 files needed
        self._setup_file_handlers()

    def _setup_file_handlers(self):
        """
        Set up simplified two-file structure: app.log + security.log
        As specified in Phase 1 requirements.
        """
        json_formatter = MedicalRecordsJSONFormatter()

        # app.log - patient access, API calls, frontend errors, performance, etc.
        self._setup_file_handler("app", json_formatter, self.log_level)

        # security.log - failed logins, suspicious activity, auth failures only
        self._setup_file_handler("security", json_formatter, logging.WARNING)

    def _setup_file_handler(
        self, category: str, formatter: logging.Formatter, level: int
    ):
        """Set up a rotating file handler for a specific log category."""

        log_file = self.log_dir / f"{category}.log"

        # Create rotating file handler (50MB per file, keep 10 files)
        handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=50 * 1024 * 1024,  # 50MB per file as per Phase 1 requirements
            backupCount=10,
            encoding="utf-8",
        )

        handler.setFormatter(formatter)
        handler.setLevel(level)

        # Create category-specific logger and clear existing handlers
        logger = logging.getLogger(f"medical_records.{category}")
        logger.handlers.clear()  # Clear existing handlers to prevent duplication
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

# Export commonly used loggers - Phase 1 simplified structure (2 categories only)
app_logger = get_logger(__name__, "app")
security_logger = get_logger(__name__, "security")
