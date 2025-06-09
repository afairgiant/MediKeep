"""
Frontend Logs API Endpoints

Handles logging requests from the React frontend, providing centralized
error tracking and user interaction logging.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.api import deps
from app.core.logging_config import get_logger
from app.core.security_audit import security_audit

router = APIRouter()

# Initialize loggers
frontend_logger = get_logger("frontend", "app")
security_logger = get_logger("frontend", "security")


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
    client_ip = (
        getattr(request.client, "host", "unknown") if request.client else "unknown"
    )

    # Prepare log data with additional context
    log_context = {
        "category": "frontend",
        "frontend_category": log_data.category,
        "ip": client_ip,
        "frontend_timestamp": log_data.timestamp,
        "user_agent": log_data.user_agent
        or request.headers.get("user-agent", "unknown"),
        "url": log_data.url,
        "component": log_data.component,
        "action": log_data.action,
        "user_id": log_data.user_id,
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
        log_context["stack_trace"] = log_data.stack_trace

    # Log based on level and category
    if log_data.level.lower() == "error":
        frontend_logger.error(f"Frontend Error: {log_data.message}", extra=log_context)

        # Also log security events if applicable
        if log_data.category in ["security", "auth", "access"]:
            security_audit.log_security_threat(
                threat_type="frontend_security_event",
                ip_address=client_ip,
                details={
                    "message": log_data.message,
                    "category": log_data.category,
                    "component": log_data.component,
                    "url": log_data.url,
                },
                user_id=log_data.user_id,
            )

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
    client_ip = (
        getattr(request.client, "host", "unknown") if request.client else "unknown"
    )

    error_context = {
        "category": "frontend",
        "frontend_category": "error",
        "event": "frontend_error",
        "error_type": error_data.error_type,
        "component_name": error_data.component_name,
        "ip": client_ip,
        "url": error_data.url,
        "frontend_timestamp": error_data.timestamp,
        "user_agent": error_data.user_agent
        or request.headers.get("user-agent", "unknown"),
        "user_id": error_data.user_id,
    }

    # Add stack trace if available
    if error_data.stack_trace:
        error_context["stack_trace"] = error_data.stack_trace

    # Add component props if available
    if error_data.props:
        error_context["component_props"] = error_data.props

    # Add browser info if available
    if error_data.browser_info:
        error_context["browser_info"] = error_data.browser_info

    # Log the error
    frontend_logger.error(
        f"Frontend Error: {error_data.error_message} in {error_data.component_name or 'Unknown Component'}",
        extra=error_context,
    )

    # Log as security event if it seems suspicious
    if any(
        keyword in error_data.error_message.lower()
        for keyword in [
            "unauthorized",
            "forbidden",
            "token",
            "authentication",
            "permission",
        ]
    ):
        security_audit.log_security_threat(
            threat_type="frontend_security_error",
            ip_address=client_ip,
            details={
                "error_message": error_data.error_message,
                "error_type": error_data.error_type,
                "component": error_data.component_name,
                "url": error_data.url,
            },
            user_id=error_data.user_id,
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
    client_ip = (
        getattr(request.client, "host", "unknown") if request.client else "unknown"
    )

    action_context = {
        "category": "frontend",
        "frontend_category": "user_action",
        "event": "user_action",
        "action": action_data.action,
        "component": action_data.component,
        "ip": client_ip,
        "url": action_data.url,
        "frontend_timestamp": action_data.timestamp,
        "user_agent": request.headers.get("user-agent", "unknown"),
        "user_id": current_user_id,  # Use authenticated user ID
    }

    # Add additional details if provided
    if action_data.details:
        action_context["action_details"] = action_data.details

    # Log the user action
    frontend_logger.info(
        f"User Action: {action_data.action} in {action_data.component}",
        extra=action_context,
    )

    # Log sensitive actions to security audit
    sensitive_actions = [
        "view_patient_data",
        "update_patient_data",
        "delete_patient_data",
        "view_medication",
        "create_medication",
        "update_medication",
        "delete_medication",
        "view_lab_results",
        "upload_file",
        "download_file",
        "login",
        "logout",
        "change_password",
    ]

    if action_data.action in sensitive_actions:
        security_audit.log_data_access(
            user_id=current_user_id,
            username="frontend_user",  # Could be enhanced with actual username
            ip_address=client_ip,
            resource_type="frontend_action",
            resource_id=None,
            action=action_data.action,
            success=True,
            details={
                "component": action_data.component,
                "url": action_data.url,
                "action_details": action_data.details,
            },
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
