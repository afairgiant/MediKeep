"""
System endpoints for medical records application.
Phase 4: Backend Log Level Endpoint implementation.

Provides system configuration and logging level information for frontend integration.
"""

import os
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.logging_config import get_logger
from app.core.logging_helpers import log_security_event
from app.core.logging_constants import (
    CATEGORIES,
    DEFAULT_LOG_LEVEL,
    VALID_LOG_LEVELS,
    LogFields,
    get_log_level_numeric,
    sanitize_log_input,
    validate_log_level,
)

router = APIRouter()

# Initialize loggers using shared constants
app_logger = get_logger(__name__, "app")
security_logger = get_logger(__name__, "security")


# Simple rate limiting implementation (10 requests per minute)
# Using collections for efficiency and automatic cleanup
class SimpleRateLimiter:
    """
    Simple in-memory rate limiter for log level endpoint.
    Tracks requests per IP address with automatic cleanup.
    """

    def __init__(self, max_requests: int = 10, window_minutes: int = 1):
        self.max_requests = max_requests
        self.window_seconds = window_minutes * 60
        self.requests: Dict[str, deque] = defaultdict(deque)

    def is_allowed(self, client_ip: str) -> bool:
        """
        Check if client IP is allowed to make a request.

        Args:
            client_ip: IP address of the client

        Returns:
            True if allowed, False if rate limited
        """
        now = time.time()
        client_requests = self.requests[client_ip]

        # Remove old requests outside the window
        while client_requests and client_requests[0] <= now - self.window_seconds:
            client_requests.popleft()

        # Check if under limit
        if len(client_requests) < self.max_requests:
            client_requests.append(now)
            return True

        return False

    def get_remaining_requests(self, client_ip: str) -> int:
        """Get number of remaining requests for client."""
        now = time.time()
        client_requests = self.requests[client_ip]

        # Remove old requests
        while client_requests and client_requests[0] <= now - self.window_seconds:
            client_requests.popleft()

        return max(0, self.max_requests - len(client_requests))

    def get_reset_time(self, client_ip: str) -> float:
        """Get timestamp when rate limit resets for client."""
        client_requests = self.requests[client_ip]
        if not client_requests:
            return time.time()
        return client_requests[0] + self.window_seconds


# Initialize rate limiter for log level endpoint
# 60 requests per minute = 1 per second (reasonable for frontend usage)
rate_limiter = SimpleRateLimiter(max_requests=60, window_minutes=1)


def get_client_ip(request: Request) -> str:
    """
    Safely extract client IP address from request.

    Args:
        request: FastAPI request object

    Returns:
        Sanitized client IP address
    """
    # Try various headers for real IP (useful behind proxies)
    potential_ips = [
        request.headers.get("x-forwarded-for", "").split(",")[0].strip(),
        request.headers.get("x-real-ip", ""),
        getattr(request.client, "host", "unknown") if request.client else "unknown",
    ]

    # Return first non-empty IP, sanitized
    for ip in potential_ips:
        if ip and ip != "unknown":
            return sanitize_log_input(ip, max_length=45)  # IPv6 max length

    return "unknown"


@router.get("/log-level")
def get_log_level(request: Request) -> Dict[str, Any]:
    """
    Get current logging configuration for frontend integration.

    Returns current LOG_LEVEL and available configuration options.
    Rate limited to 60 requests per minute per IP address.

    Returns:
        Dict containing:
        - current_level: Current LOG_LEVEL setting
        - available_levels: List of valid log levels
        - default_level: Default level when not specified
        - categories: Available log categories
        - file_mapping: Description of log files
        - timestamp: Current timestamp
        - rate_limit_info: Rate limiting information
    """
    client_ip = get_client_ip(request)

    try:
        # Apply rate limiting
        if not rate_limiter.is_allowed(client_ip):
            remaining_requests = rate_limiter.get_remaining_requests(client_ip)
            reset_time = rate_limiter.get_reset_time(client_ip)
            reset_datetime = datetime.fromtimestamp(reset_time)

            # Log rate limit violation for security monitoring
            log_security_event(
                security_logger,
                "rate_limit_exceeded",
                request,
                f"Rate limit exceeded for log level endpoint from {client_ip}",
                endpoint="/api/v1/system/log-level",
                remaining_requests=remaining_requests,
                reset_time=reset_datetime.isoformat()
            )

            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Maximum 60 requests per minute.",
                headers={
                    "X-RateLimit-Limit": "60",
                    "X-RateLimit-Remaining": str(remaining_requests),
                    "X-RateLimit-Reset": str(int(reset_time)),
                    "Retry-After": str(int(reset_time - time.time())),
                },
            )

        # Log successful access attempt for app monitoring
        app_logger.info(
            f"Log level endpoint accessed from {client_ip}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "log_level_endpoint_access",
                LogFields.IP: client_ip,
                "user_agent": sanitize_log_input(
                    request.headers.get("user-agent", "unknown")
                ),
            },
        )

        # Get current log level with validation using shared constants
        current_level = os.getenv("LOG_LEVEL", DEFAULT_LOG_LEVEL).upper().strip()

        # Validate and fallback if needed
        if not validate_log_level(current_level):
            app_logger.warning(
                f"Invalid LOG_LEVEL '{current_level}' detected, falling back to {DEFAULT_LOG_LEVEL}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "invalid_log_level_fallback",
                    "invalid_level": current_level,
                    "fallback_level": DEFAULT_LOG_LEVEL,
                },
            )
            current_level = DEFAULT_LOG_LEVEL

        # Get rate limit info for response
        remaining_requests = rate_limiter.get_remaining_requests(client_ip)
        reset_time = rate_limiter.get_reset_time(client_ip)

        # Build comprehensive response
        response_data = {
            "current_level": current_level,
            "available_levels": VALID_LOG_LEVELS,
            "default_level": DEFAULT_LOG_LEVEL,
            "categories": CATEGORIES,
            "file_mapping": {
                "app": "logs/app.log - Patient access, API calls, frontend errors, performance events",
                "security": "logs/security.log - Authentication failures, security threats, suspicious activity",
            },
            "configuration": {
                "log_level_numeric": get_log_level_numeric(current_level),
                "simplified_structure": True,
                "file_count": len(CATEGORIES),
                "max_file_size_mb": 50,
                "backup_count": 10,
            },
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "rate_limit_info": {
                "requests_remaining": remaining_requests,
                "requests_limit": 60,
                "window_seconds": 60,
                "reset_time": datetime.fromtimestamp(reset_time).isoformat() + "Z",
            },
        }

        app_logger.debug(
            f"Log level configuration returned to {client_ip}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "log_level_config_returned",
                LogFields.IP: client_ip,
                "current_level": current_level,
                "requests_remaining": remaining_requests,
            },
        )

        return response_data

    except HTTPException:
        # Re-raise HTTP exceptions (like rate limiting)
        raise
    except Exception as e:
        # Log unexpected errors for debugging
        app_logger.error(
            f"Log level endpoint error for {client_ip}: {e}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "log_level_endpoint_error",
                LogFields.IP: client_ip,
                LogFields.ERROR: sanitize_log_input(str(e)),
                "error_type": type(e).__name__,
            },
        )

        # Don't expose internal error details to clients
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error. Please try again later.",
        )


@router.get("/version")
def get_version() -> Dict[str, Any]:
    """
    Get application version information.

    Returns:
        Dict containing app name, version, and timestamp
    """
    return {
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/health")
def system_health() -> Dict[str, Any]:
    """
    Basic system health check endpoint.

    Returns:
        System health status and logging system status
    """
    try:
        # Basic health check
        current_level = os.getenv("LOG_LEVEL", DEFAULT_LOG_LEVEL)
        is_valid_level = validate_log_level(current_level)

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "logging_system": {
                "current_level": current_level,
                "level_valid": is_valid_level,
                "categories_configured": len(CATEGORIES),
            },
        }
    except Exception as e:
        app_logger.error(
            f"System health check failed: {e}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "health_check_failed",
                LogFields.ERROR: sanitize_log_input(str(e)),
            },
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="System health check failed",
        )
