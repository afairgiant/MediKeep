"""
Custom Uvicorn logging configuration for Medical Records Management System.
Makes Uvicorn server logs consistent with our professional logging format.
"""

import logging
import os
from typing import Any, Dict

from .logging_config import ConsoleFormatterWithRequestID
from .logging_constants import CONSOLE_LOG_FORMAT, DEFAULT_LOG_LEVEL, validate_log_level


class UvicornFormatter(ConsoleFormatterWithRequestID):
    """
    Custom formatter for Uvicorn logs to match our application logging format.
    Inherits from ConsoleFormatterWithRequestID to support request_id_display.
    """

    def format(self, record: logging.LogRecord) -> str:
        # Override the logger name to match our format
        if record.name == "uvicorn.access":
            record.name = "medical_records.server.access"
        elif record.name == "uvicorn.error":
            record.name = "medical_records.server.error"
        elif record.name.startswith("uvicorn"):
            record.name = (
                f"medical_records.server.{record.name.replace('uvicorn.', '')}"
            )

        # Use parent's format method which adds request_id_display
        return super().format(record)


def get_uvicorn_log_config() -> Dict[str, Any]:
    """
    Get Uvicorn logging configuration that matches our application format.
    Uses the same LOG_LEVEL environment variable as the rest of the application.

    Returns:
        Dictionary containing Uvicorn logging configuration
    """
    # Get log level from environment variable with validation
    level_str = os.getenv("LOG_LEVEL", DEFAULT_LOG_LEVEL).upper().strip()

    if not validate_log_level(level_str):
        print(
            f"WARNING: Invalid LOG_LEVEL '{level_str}' for Uvicorn, defaulting to {DEFAULT_LOG_LEVEL}"
        )
        level_str = DEFAULT_LOG_LEVEL

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "()": UvicornFormatter,
                "format": CONSOLE_LOG_FORMAT,
            },
            "access": {
                "()": UvicornFormatter,
                "format": CONSOLE_LOG_FORMAT,
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
            "access": {
                "formatter": "access",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["default"],
                "level": level_str,
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": level_str,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["access"],
                "level": level_str,
                "propagate": False,
            },
        },
    }


def configure_uvicorn_logging():
    """
    Configure Uvicorn logging to use our custom format.
    Call this before starting Uvicorn.
    """
    import logging.config

    log_config = get_uvicorn_log_config()
    logging.config.dictConfig(log_config)
