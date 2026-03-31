"""Cookie authentication utilities for HttpOnly session cookies.

Centralises cookie creation and deletion so every endpoint
(login, SSO, logout) behaves identically.
"""

from fastapi import Request
from fastapi.responses import Response

from app.core.config import settings


def set_auth_cookie(response: Response, token: str, max_age_minutes: int | None = None) -> None:
    """Set the HttpOnly authentication cookie on *response*.

    *max_age_minutes* should match the JWT lifetime so the cookie and token
    expire at the same time.  Falls back to ACCESS_TOKEN_EXPIRE_MINUTES.
    """
    minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES if max_age_minutes is None else max_age_minutes
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=settings.AUTH_COOKIE_HTTPONLY,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        max_age=minutes * 60,
    )


def clear_auth_cookie(response: Response) -> None:
    """Delete the authentication cookie from the client."""
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        httponly=settings.AUTH_COOKIE_HTTPONLY,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def get_token_from_cookie(request: Request) -> str | None:
    """Extract the JWT from the session cookie, if present."""
    return request.cookies.get(settings.AUTH_COOKIE_NAME)
