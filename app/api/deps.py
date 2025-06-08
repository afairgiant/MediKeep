from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.config import settings
from app.core.database import SessionLocal
from app.crud.user import user
from app.models.models import User

# Security scheme for JWT tokens
security = HTTPBearer()


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
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Get user from database
    db_user = user.get_by_username(db, username=username)
    if db_user is None:
        raise credentials_exception

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
