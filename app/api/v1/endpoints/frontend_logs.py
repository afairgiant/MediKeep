"""
Frontend Logs API Endpoints

Handles logging requests from the React frontend, providing centralized
error tracking and user interaction logging.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.api import deps
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields, sanitize_log_input
from app.core.utils.client_ip import get_client_ip
from app.core.utils.rate_limit import SlidingWindowRateLimiter

router = APIRouter()

# Initialize logger
frontend_logger = get_logger("frontend", "app")

# Shared by /log and /error, which accept requests from signed-out pages
_anonymous_limiter = SlidingWindowRateLimiter(max_requests=600, window_seconds=60)

MAX_MESSAGE_LENGTH = 2000

# Client level, lower-cased -> (label, logger method); the frontend sends both cases
_LEVELS = {
    "debug": ("Debug", "debug"),
    "info": ("Info", "info"),
    "warn": ("Warning", "warning"),
    "warning": ("Warning", "warning"),
    "error": ("Error", "error"),
    "critical": ("Critical", "critical"),
}


class FrontendLogRequest(BaseModel):
    """Schema for frontend log requests."""

    level: str  # error, warn, info, debug
    message: str
    category: str  # error, user_action, performance, security
    timestamp: str
    url: Optional[str] = None
    user_agent: Optional[str] = None
    stack_trace: Optional[str] = None
    user_id: Optional[int] = None
    session_id: Optional[str] = None
    component: Optional[str] = None
    action: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class FrontendErrorRequest(BaseModel):
    """Schema for frontend error reports."""

    error_message: str
    error_type: str
    stack_trace: Optional[str] = None
    component_name: Optional[str] = None
    props: Optional[Dict[str, Any]] = None
    user_id: Optional[int] = None
    url: str
    timestamp: str
    user_agent: Optional[str] = None
    browser_info: Optional[Dict[str, Any]] = None


class UserActionRequest(BaseModel):
    """Schema for user action logging."""

    action: str
    component: str
    details: Optional[Dict[str, Any]] = None
    user_id: Optional[int] = None
    timestamp: str
    url: str


def _enforce_anonymous_limit(request: Request) -> str:
    """Return the client IP, raising 429 once it exceeds the shared limit."""
    client_ip = get_client_ip(request)
    if not _anonymous_limiter.is_allowed(client_ip):
        raise _anonymous_limiter.too_many_requests(
            client_ip, "Too many log entries.", "frontend_log_rate_limited"
        )
    return client_ip


@router.post("/log")
def log_frontend_event(
    *,
    request: Request,
    log_data: FrontendLogRequest,
    user_ip: str = Depends(_enforce_anonymous_limit),
) -> Dict[str, str]:
    """
    Log frontend events and errors.

    No authentication: the client's user_id is unverified and never logged as the
    user. Rate limited per IP.
    """
    # Client fields stay in their own keys so they cannot overwrite server-set log fields
    log_context = {
        LogFields.CATEGORY: "frontend",
        "frontend_category": log_data.category,
        LogFields.IP: user_ip,
        "frontend_timestamp": log_data.timestamp,
        "user_agent": log_data.user_agent
        or request.headers.get("user-agent", "unknown"),
        "url": log_data.url,
        "component": log_data.component,
        "action": log_data.action,
        "client_user_id": log_data.user_id,
        "session_id": log_data.session_id,
        "details": log_data.details,
        "stack_trace": log_data.stack_trace,
    }
    label, method = _LEVELS.get(
        log_data.level.lower(), (sanitize_log_input(log_data.level.title(), 20), "info")
    )
    log = getattr(frontend_logger, method)
    message = sanitize_log_input(log_data.message, MAX_MESSAGE_LENGTH)
    log(f"Frontend {label}: {message}", extra=log_context)

    return {"status": "logged", "timestamp": datetime.utcnow().isoformat()}


@router.post("/error")
def log_frontend_error(
    *,
    request: Request,
    error_data: FrontendErrorRequest,
    user_ip: str = Depends(_enforce_anonymous_limit),
) -> Dict[str, str]:
    """
    Log frontend errors with detailed context.

    Same trust rules and rate limit as /log.
    """
    error_context = {
        LogFields.CATEGORY: "frontend",
        "frontend_category": "error",
        LogFields.EVENT: "frontend_error",
        "error_type": error_data.error_type,
        "component_name": error_data.component_name,
        LogFields.IP: user_ip,
        "url": error_data.url,
        "frontend_timestamp": error_data.timestamp,
        "user_agent": error_data.user_agent
        or request.headers.get("user-agent", "unknown"),
        "client_user_id": error_data.user_id,
        "stack_trace": error_data.stack_trace,
        "component_props": error_data.props,
        "browser_info": error_data.browser_info,
    }

    message = sanitize_log_input(error_data.error_message, MAX_MESSAGE_LENGTH)
    component = sanitize_log_input(
        error_data.component_name or "Unknown Component", 200
    )
    frontend_logger.error(
        f"Frontend Error: {message} in {component}",
        extra=error_context,
    )

    return {"status": "error_logged", "timestamp": datetime.utcnow().isoformat()}


@router.post("/user-action")
def log_user_action(
    *,
    request: Request,
    action_data: UserActionRequest,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Dict[str, str]:
    """
    Log user actions for analytics and audit purposes.

    Tracks user interactions with the medical records system.
    """
    user_ip = get_client_ip(request)

    action_context = {
        LogFields.CATEGORY: "frontend",
        "frontend_category": "user_action",
        LogFields.EVENT: "user_action",
        "action": action_data.action,
        "component": action_data.component,
        LogFields.IP: user_ip,
        "url": action_data.url,
        "frontend_timestamp": action_data.timestamp,
        "user_agent": request.headers.get("user-agent", "unknown"),
        LogFields.USER_ID: current_user_id,  # Use authenticated user ID
    }

    # Add additional details if provided
    if action_data.details:
        action_context["action_details"] = action_data.details  # Log the user action
    frontend_logger.info(
        f"User Action: {action_data.action} in {action_data.component}",
        extra=action_context,
    )

    return {"status": "action_logged", "timestamp": datetime.utcnow().isoformat()}


@router.get("/health")
def frontend_logging_health() -> Dict[str, str]:
    """
    Health check endpoint for frontend logging service.
    """
    return {
        "status": "healthy",
        "service": "frontend_logging",
        "timestamp": datetime.utcnow().isoformat(),
    }
