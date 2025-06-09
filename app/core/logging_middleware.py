"""
Request logging middleware for the Medical Records Management System.

This middleware logs all API requests with timing, user context, and security information.
"""

import time
import uuid
from typing import Callable, Optional
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

from app.core.logging_config import (
    get_logger,
    set_correlation_id,
    log_security_event,
    log_performance_event,
)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all HTTP requests and responses with timing and context information.
    """

    def __init__(self, app: Callable, logger_name: str = "request_middleware"):
        super().__init__(app)
        self.logger = get_logger(logger_name, "app")
        self.security_logger = get_logger(logger_name, "security")
        self.performance_logger = get_logger(logger_name, "performance")

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> StarletteResponse:
        # Generate correlation ID for this request
        correlation_id = str(uuid.uuid4())
        set_correlation_id(correlation_id)
        # Extract request information
        start_time = time.time()
        method = request.method
        path = request.url.path
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "Unknown")

        # Extract user information if available
        user_id = None
        auth_header = request.headers.get("authorization")
        if auth_header:
            try:
                # Try to extract user ID from the request state if it's been set by auth
                user_id = getattr(request.state, "user_id", None)
            except AttributeError:
                pass

        # Log the incoming request
        self._log_request_start(
            method=method,
            path=path,
            client_ip=client_ip,
            user_agent=user_agent,
            user_id=user_id,
            correlation_id=correlation_id,
        )

        # Check for suspicious patterns
        self._check_security_patterns(request, client_ip, user_id)

        # Process the request
        try:
            response = await call_next(request)

            # Calculate request duration
            duration_ms = int((time.time() - start_time) * 1000)

            # Log the response
            self._log_request_complete(
                method=method,
                path=path,
                status_code=response.status_code,
                client_ip=client_ip,
                user_id=user_id,
                duration_ms=duration_ms,
                correlation_id=correlation_id,
            )

            # Log performance issues if request took too long
            if duration_ms > 1000:  # More than 1 second
                log_performance_event(
                    self.performance_logger,
                    event="slow_request",
                    duration_ms=duration_ms,
                    threshold_ms=1000,
                    message=f"Slow request: {method} {path}",
                    method=method,
                    path=path,
                    user_id=user_id,
                    ip=client_ip,
                )

            return response

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)

            # Log the error
            self._log_request_error(
                method=method,
                path=path,
                error=str(e),
                client_ip=client_ip,
                user_id=user_id,
                duration_ms=duration_ms,
                correlation_id=correlation_id,
            )
            # Re-raise the exception
            raise

    def _get_client_ip(self, request: Request) -> str:
        """Extract the real client IP address from the request."""
        # Check for forwarded headers (common in production behind proxies)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP in case of multiple proxies
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fallback to client IP
        if request.client:
            return request.client.host

        return "unknown"

    def _log_request_start(
        self,
        method: str,
        path: str,
        client_ip: str,
        user_agent: str,
        user_id: Optional[int] = None,
        correlation_id: Optional[str] = None,
    ):
        """Log the start of a request."""
        extra_data = {
            "category": "app",
            "event": "request_start",
            "method": method,
            "path": path,
            "ip": client_ip,
            "user_agent": user_agent,
            "user_id": user_id,
            "correlation_id": correlation_id,
        }

        self.logger.info(f"Request started: {method} {path}", extra=extra_data)

    def _log_request_complete(
        self,
        method: str,
        path: str,
        status_code: int,
        client_ip: str,
        user_id: Optional[int] = None,
        duration_ms: Optional[int] = None,
        correlation_id: Optional[str] = None,
    ):
        """Log the completion of a request."""
        extra_data = {
            "category": "app",
            "event": "request_complete",
            "method": method,
            "path": path,
            "status_code": status_code,
            "ip": client_ip,
            "user_id": user_id,
            "duration": duration_ms,
            "correlation_id": correlation_id,
        }

        # Use different log levels based on status code
        if status_code >= 500:
            self.logger.error(
                f"Request completed with server error: {method} {path} - {status_code}",
                extra=extra_data,
            )
        elif status_code >= 400:
            self.logger.warning(
                f"Request completed with client error: {method} {path} - {status_code}",
                extra=extra_data,
            )
        else:
            self.logger.info(
                f"Request completed: {method} {path} - {status_code}", extra=extra_data
            )

    def _log_request_error(
        self,
        method: str,
        path: str,
        error: str,
        client_ip: str,
        user_id: Optional[int] = None,
        duration_ms: Optional[int] = None,
        correlation_id: Optional[str] = None,
    ):
        """Log request errors."""
        extra_data = {
            "category": "app",
            "event": "request_error",
            "method": method,
            "path": path,
            "error": error,
            "ip": client_ip,
            "user_id": user_id,
            "duration": duration_ms,
            "correlation_id": correlation_id,
        }

        self.logger.error(
            f"Request failed: {method} {path} - {error}", extra=extra_data
        )

    def _check_security_patterns(
        self, request: Request, client_ip: str, user_id: Optional[int] = None
    ):
        """Check for suspicious security patterns in requests."""
        path = request.url.path.lower()
        query = str(request.url.query).lower()

        # Check for common attack patterns
        suspicious_patterns = {
            "sql_injection": [
                "union",
                "select",
                "drop",
                "insert",
                "delete",
                "update",
                "--",
                ";",
            ],
            "xss": ["<script", "javascript:", "onclick=", "onerror="],
            "path_traversal": ["../", "..\\", "%2e%2e", "etc/passwd"],
            "command_injection": ["|", "&&", ";", "`", "$(", "cmd.exe", "/bin/sh"],
        }

        for attack_type, patterns in suspicious_patterns.items():
            for pattern in patterns:
                if pattern in path or pattern in query:
                    log_security_event(
                        self.security_logger,
                        event=f"suspicious_{attack_type}_pattern",
                        user_id=user_id,
                        ip_address=client_ip,
                        message=f"Suspicious {attack_type.replace('_', ' ')} pattern detected: {pattern}",
                        path=path,
                        query=query,
                        pattern=pattern,
                    )
                    break

        # Check for excessive request rate (simple rate limiting detection)
        # This is a basic implementation - in production you might use Redis or similar
        user_agent = request.headers.get("user-agent", "")
        if not user_agent or len(user_agent) < 10:
            log_security_event(
                self.security_logger,
                event="suspicious_user_agent",
                user_id=user_id,
                ip_address=client_ip,
                message="Request with suspicious or missing User-Agent",
                user_agent=user_agent,
            )


def create_request_logging_middleware():
    """Factory function to create the request logging middleware."""
    return RequestLoggingMiddleware
