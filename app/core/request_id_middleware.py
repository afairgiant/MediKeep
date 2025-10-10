"""
Request ID Middleware for tracing requests across the application.

This middleware adds a unique request ID to each incoming request, making it
easier to trace a single request through all logs and debug production issues.

Features:
- Generates a short 8-character UUID for each request
- Adds request ID to request.state for access in endpoints
- Includes X-Request-ID header in all responses
- Logs request start and completion with request ID
"""

import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Add unique request ID to each request for tracing and debugging.

    The request ID is:
    - Generated as a short 8-character UUID
    - Stored in request.state.request_id for access in endpoints
    - Added to response headers as X-Request-ID
    - Included in request start/complete logs

    Usage in Endpoints:
        @router.get("/patients/{id}")
        def get_patient(id: int, request: Request):
            request_id = request.state.request_id
            logger.info(f"Fetching patient {id}", extra={"request_id": request_id})

    Benefits:
        - Trace a single request through all logs
        - Debug production issues easily
        - Match frontend errors to backend logs
        - Monitor request flow and timing
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request with unique request ID.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware or endpoint handler

        Returns:
            Response with X-Request-ID header
        """
        # Generate short request ID (first 8 chars of UUID)
        request_id = str(uuid.uuid4())[:8]

        # Store in request state for access in endpoints
        request.state.request_id = request_id

        # Log request start
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "category": "app",
                "event": "request_start",
                "request_id": request_id,
                "method": request.method,
                "path": str(request.url.path),
                "client_ip": request.client.host if request.client else "unknown"
            }
        )

        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            # Log request error
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                extra={
                    "category": "app",
                    "event": "request_error",
                    "request_id": request_id,
                    "method": request.method,
                    "path": str(request.url.path),
                    "error": str(e)
                }
            )
            raise

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        # Log request completion
        logger.info(
            f"Request completed: {request.method} {request.url.path}",
            extra={
                "category": "app",
                "event": "request_complete",
                "request_id": request_id,
                "method": request.method,
                "path": str(request.url.path),
                "status_code": response.status_code
            }
        )

        return response
