from typing import Callable

import jwt
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging.config import get_logger
from app.core.utils.client_ip import get_client_ip
from app.core.utils.activity_tracker import (
    clear_current_user_context,
    set_current_user_context,
)
from app.core.utils.security import decode_access_token

logger = get_logger(__name__, "app")


class ActivityTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to set activity tracking context variables for each request.
    This enables the activity tracker to automatically log activities with
    proper user, IP, and user agent context.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Extract IP address
        ip_address = get_client_ip(request) if request.client else None

        # Extract user agent
        user_agent = request.headers.get("user-agent")

        # Get current user (if authenticated)
        user_id = None
        try:
            # Try to get current user from token
            token = request.headers.get("authorization")
            if token and token.startswith("Bearer "):
                token = token.split(" ")[1]
                try:
                    payload = decode_access_token(token)
                    user_id = payload.get("sub")
                    if user_id:
                        user_id = int(user_id)
                except (jwt.PyJWTError, ValueError):
                    user_id = None
        except Exception as e:
            logger.debug(f"Could not get user context for activity tracking: {e}")
            user_id = None

        # Set activity tracking context
        set_current_user_context(
            user_id=user_id,
            patient_id=None,  # Will be set individually by endpoints if needed
            ip_address=ip_address,
            user_agent=user_agent,
        )

        try:
            # Process the request
            response = await call_next(request)
            return response
        finally:
            # Clear context after request
            clear_current_user_context()
