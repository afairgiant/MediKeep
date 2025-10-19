"""
Frontend Logs API Endpoints

Handles logging requests from the React frontend, providing centralized
error tracking and user interaction logging.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.api import deps
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

router = APIRouter()

# Initialize logger
frontend_logger = get_logger("frontend", "app")


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


@router.post("/log")
def log_frontend_event(
    *,
    request: Request,
    log_data: FrontendLogRequest,
    db: Session = Depends(deps.get_db),
) -> Dict[str, str]:
    """
    Log frontend events and errors.

    Accepts log entries from the React frontend and processes them
    through the appropriate logging channels.
    """
    user_ip = (
        getattr(request.client, "host", "unknown") if request.client else "unknown"
    )

    # Prepare log data with additional context
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
        LogFields.USER_ID: log_data.user_id,
        "session_id": log_data.session_id,
    }

    # Add details if provided, but filter out conflicting fields
    if log_data.details:
        # Filter out fields that conflict with Python's logging system
        reserved_fields = {
            "message",
            "level",
            "category",
            "timestamp",
            "name",
            "msg",
            "args",
            "pathname",
            "filename",
            "module",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
            "exc_info",
            "exc_text",
            "stack_info",
        }
        filtered_details = {
            k: v for k, v in log_data.details.items() if k not in reserved_fields
        }
        log_context.update(filtered_details)

    # Add stack trace for errors
    if log_data.stack_trace:
        log_context["stack_trace"] = (
            log_data.stack_trace
        )  # Log based on level and category
    if log_data.level.lower() == "error":
        frontend_logger.error(f"Frontend Error: {log_data.message}", extra=log_context)

    elif log_data.level.lower() == "warn":
        frontend_logger.warning(
            f"Frontend Warning: {log_data.message}", extra=log_context
        )

    else:  # info, debug
        frontend_logger.info(
            f"Frontend {log_data.level.title()}: {log_data.message}", extra=log_context
        )

    return {"status": "logged", "timestamp": datetime.utcnow().isoformat()}


@router.post("/error")
def log_frontend_error(
    *,
    request: Request,
    error_data: FrontendErrorRequest,
    db: Session = Depends(deps.get_db),
) -> Dict[str, str]:
    """
    Log frontend errors with detailed context.

    Specifically designed for React error boundaries and unhandled errors.
    """
    user_ip = (
        getattr(request.client, "host", "unknown") if request.client else "unknown"
    )

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
        LogFields.USER_ID: error_data.user_id,
    }

    # Add stack trace if available
    if error_data.stack_trace:
        error_context["stack_trace"] = error_data.stack_trace

    # Add component props if available
    if error_data.props:
        error_context["component_props"] = error_data.props

    # Add browser info if available
    if error_data.browser_info:
        error_context["browser_info"] = error_data.browser_info  # Log the error
    frontend_logger.error(
        f"Frontend Error: {error_data.error_message} in {error_data.component_name or 'Unknown Component'}",
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
    user_ip = (
        getattr(request.client, "host", "unknown") if request.client else "unknown"
    )

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
