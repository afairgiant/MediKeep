"""
Request ID Middleware for tracing requests across the application.

This middleware adds a unique request ID to each incoming request, making it
easier to trace a single request through all logs and debug production issues.

Features:
- Generates a short 8-character UUID for each request
- Adds request ID to request.state for access in endpoints
- Includes X-Request-ID header in all responses
"""

import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Add unique request ID to each request for tracing and debugging.

    The request ID is:
    - Generated as a short 8-character UUID
    - Stored in request.state.request_id for access in endpoints
    - Added to response headers as X-Request-ID

    Usage in Endpoints:
        @router.get("/patients/{id}")
        def get_patient(id: int, request: Request):
            request_id = request.state.request_id
            logger.info(f"Fetching patient {id}", extra={"request_id": request_id})
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Generate short request ID (first 8 chars of UUID)
        request_id = str(uuid.uuid4())[:8]

        # Store in request state for access in endpoints
        request.state.request_id = request_id

        # Process request
        response = await call_next(request)

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        return response
