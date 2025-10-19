"""
Shared logging constants for the Medical Records Management System.
Eliminates magic strings and provides reusable logging components.

"""

import logging
import re
from typing import Dict, List, Optional, Union

# Log level constants with numeric values
LOG_LEVELS: Dict[str, int] = {
    "DEBUG": logging.DEBUG,  # 10
    "INFO": logging.INFO,  # 20
    "WARNING": logging.WARNING,  # 30
    "ERROR": logging.ERROR,  # 40
    "CRITICAL": logging.CRITICAL,  # 50
}

# Default log level when LOG_LEVEL environment variable is not set
DEFAULT_LOG_LEVEL: str = "INFO"

# Valid log level names for validation
VALID_LOG_LEVELS: List[str] = list(LOG_LEVELS.keys())

# Simplified to just 2 categories as per Phase 1 requirements
CATEGORIES: List[str] = ["app", "security"]

# Default category for general application events
DEFAULT_CATEGORY: str = "app"

# Security category for threats and authentication issues
SECURITY_CATEGORY: str = "security"


# Simple decision rule for categorization
SECURITY_EVENTS: List[str] = [
    "login_failed",
    "token_expired",
    "suspicious_activity",
    "multiple_failures",
    "unauthorized_access",
    "authentication_failed",
    "permission_denied",
    "security_breach",
    "account_locked",
    "invalid_credentials",
]


def sanitize_log_input(
    value: Union[str, int, float, None], max_length: int = 1000
) -> str:
    """
    Sanitize user input for safe logging to prevent injection attacks.

    Args:
        value: Input value to sanitize
        max_length: Maximum length of sanitized output

    Returns:
        Sanitized string safe for logging
    """
    if value is None:
        return "None"

    # Convert to string and limit length
    value_str = str(value)[:max_length]

    # Replace potential JSON-breaking characters first (before removing control chars)
    sanitized = value_str.replace('"', "'").replace("\n", " ").replace("\r", " ")

    # Remove remaining control characters (keep printable ASCII + basic Unicode)
    # This prevents log injection attacks while preserving our space replacements
    sanitized = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", sanitized)

    return sanitized


def get_log_category(event_type: Optional[str]) -> str:
    """
    Simple category determination: security threat or normal app event.

    Args:
        event_type: Type of event to categorize

    Returns:
        Category name ('security' for threats, 'app' for everything else)
    """
    if event_type and event_type.lower() in SECURITY_EVENTS:
        return SECURITY_CATEGORY
    return DEFAULT_CATEGORY


def validate_log_level(level: str) -> bool:
    """
    Validate if a log level string is valid.

    Args:
        level: Log level string to validate

    Returns:
        True if valid, False otherwise
    """
    return level.upper().strip() in VALID_LOG_LEVELS


def get_log_level_numeric(level: str) -> int:
    """
    Get numeric value for a log level string.

    Args:
        level: Log level string

    Returns:
        Numeric log level value, defaults to INFO if invalid
    """
    level_upper = level.upper().strip()
    return LOG_LEVELS.get(level_upper, LOG_LEVELS[DEFAULT_LOG_LEVEL])


# Simplified log message templates for common operations
LOG_TEMPLATES: Dict[str, str] = {
    "user_login": "User login attempt - user: {user} ip: {ip} success: {success}",
    "patient_access": "Patient record accessed - user: {user} patient: {patient} ip: {ip}",
    "api_error": "API error - endpoint: {endpoint} method: {method} status: {status}",
    "security_event": "Security event - type: {type} user: {user} ip: {ip} details: {details}",
    "request_start": "Request started: {method} {path}",
    "request_complete": "Request completed: {method} {path} - {status}",
    "health_check": "Health check requested",
    "startup": "Application startup completed",
    "shutdown": "Application shutdown initiated",
    "crud_operation": "CRUD {operation} on {model}",
}


def format_log_message(template_name: str, **kwargs) -> str:
    """
    Format a log message using a predefined template.

    Args:
        template_name: Name of the template to use
        **kwargs: Values to substitute in the template

    Returns:
        Formatted message string, or fallback if template not found
    """
    template = LOG_TEMPLATES.get(template_name)
    if not template:
        return f"Unknown template: {template_name}"

    try:
        # Sanitize all input values
        safe_kwargs = {key: sanitize_log_input(value) for key, value in kwargs.items()}
        return template.format(**safe_kwargs)
    except KeyError as e:
        return f"Template '{template_name}' missing parameter: {e}"
    except Exception as e:
        return f"Template formatting error: {e}"


# File configuration constants
LOG_FILE_MAX_BYTES: int = 50 * 1024 * 1024  # 50MB per file
LOG_FILE_BACKUP_COUNT: int = 10  # Keep 10 backup files
LOG_FILE_ENCODING: str = "utf-8"  # UTF-8 encoding

# Console log format for docker logs (human readable with optional request ID)
CONSOLE_LOG_FORMAT: str = "%(asctime)s %(levelname)s [%(name)s] %(request_id_display)s%(message)s"

# Container detection path
CONTAINER_APP_PATH: str = "/app"
LOCAL_DEV_LOG_DIR: str = "./logs"
CONTAINER_LOG_DIR: str = "/app/logs"


# Standard field names for structured logging
class LogFields:
    """Standard field names for consistent structured logging."""

    # Core logging fields
    TIMESTAMP = "time"
    LEVEL = "level"
    LOGGER = "logger"
    MESSAGE = "message"
    CORRELATION_ID = "correlation_id"
    REQUEST_ID = "request_id"  # Request tracing ID (8-char UUID from middleware)
    CATEGORY = "category"
    EVENT = "event"

    # User and session fields
    USER_ID = "user_id"
    PATIENT_ID = "patient_id"
    IP = "ip"

    # Technical fields
    DURATION = "duration"
    FILE = "file"
    LINE = "line"
    FUNCTION = "function"

    # CRUD operation fields
    OPERATION = "operation"
    MODEL = "model"
    RECORD_ID = "record_id"
    STATUS = "status"
    ERROR = "error"
    DATA = "data"
    FIELD = "field"
    VALUE = "value"
    COUNT = "count"
