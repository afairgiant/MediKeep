from typing import Generator, Dict, Tuple
import time
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.config import settings
from app.core.database import SessionLocal
from app.crud.user import user
from app.models.models import User
from app.core.logging_config import get_logger, log_security_event

# Security scheme for JWT tokens
security = HTTPBearer()

# Initialize security logger
security_logger = get_logger(__name__, "security")

# Simple token cache to reduce concurrent request conflicts
_token_cache: Dict[str, Tuple[User, float]] = {}
_cache_ttl = 30  # Cache tokens for 30 seconds


def get_db() -> Generator:
    """
    Get database session.

    Creates a database session for each request and closes it when done.
    This is the standard FastAPI database dependency pattern.
    """
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """
    Get current authenticated user from JWT token.

    Args:
        db: Database session
        credentials: JWT token from Authorization header

    Returns:
        Current user object

    Raises:
        HTTPException 401: If token is invalid or user not found
    """
    # Note: IP address logging is handled by middleware for request-level context

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode JWT token
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        username = payload.get("sub")
        if username is None:
            log_security_event(
                security_logger,
                event="token_invalid_no_subject",
                ip_address="middleware",  # IP will be captured by middleware
                message="JWT token missing subject claim",
            )
            raise credentials_exception

    except JWTError as e:
        log_security_event(
            security_logger,
            event="token_decode_failed",
            ip_address="middleware",  # IP will be captured by middleware            message=f"JWT token decode failed: {str(e)}",
        )
        raise credentials_exception

    # Check token cache first to reduce database load during concurrent requests
    current_time = time.time()
    token_key = credentials.credentials[:50]  # Use first 50 chars as cache key

    if token_key in _token_cache:
        cached_user, cached_time = _token_cache[token_key]
        if current_time - cached_time < _cache_ttl:
            # Return cached user if cache is still valid
            return cached_user
        else:
            # Remove expired cache entry
            del _token_cache[token_key]

    # Get user from database
    try:
        db_user = user.get_by_username(db, username=username)
        if db_user is None:
            log_security_event(
                security_logger,
                event="token_user_not_found",
                ip_address="middleware",  # IP will be captured by middleware
                message=f"Token valid but user not found: {username}",
                username=username,
            )
            raise credentials_exception

        # Cache the user for future requests
        _token_cache[token_key] = (db_user, current_time)

    except Exception as e:
        log_security_event(
            security_logger,
            event="token_user_lookup_error",
            ip_address="middleware",
            message=f"Database error during user lookup for {username}: {str(e)}",
            username=username,
        )
        raise credentials_exception

    # Log successful token validation
    user_id = getattr(db_user, "id", None)
    log_security_event(
        security_logger,
        event="token_validated_success",
        user_id=user_id,
        ip_address="middleware",  # IP will be captured by middleware
        message=f"Token successfully validated for user: {username}",
        username=username,
    )

    return db_user


def get_current_user_id(current_user: User = Depends(get_current_user)) -> int:
    """
    Get the current user's ID as an integer.

    This helper function ensures we get the actual integer value
    instead of the SQLAlchemy Column descriptor for type safety.

    Args:
        current_user: The current authenticated user

    Returns:
        User ID as integer
    """
    # Use getattr to safely access the id value from the SQLAlchemy model
    user_id = getattr(current_user, "id", None)
    if user_id is None:
        raise HTTPException(status_code=500, detail="User ID not found")
    return user_id


def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Get current authenticated admin user.

    Checks that the current user has admin role privileges.

    Args:
        current_user: Current authenticated user

    Returns:
        Current user object if they are an admin

    Raises:
        HTTPException 403: If user is not an admin
    """
    user_role = getattr(current_user, "role", None)
    if not user_role or user_role.lower() not in ["admin", "administrator"]:
        log_security_event(
            security_logger,
            event="admin_access_denied",
            user_id=getattr(current_user, "id", None),
            ip_address="middleware",
            message=f"Non-admin user attempted admin access: {current_user.username}",
            username=current_user.username,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required"
        )

    log_security_event(
        security_logger,
        event="admin_access_granted",
        user_id=getattr(current_user, "id", None),
        ip_address="middleware",
        message=f"Admin access granted to: {current_user.username}",
        username=current_user.username,
    )

    return current_user
