from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging_config import get_logger, log_security_event
from app.crud.user import user
from app.models.models import User

# Security scheme for JWT tokens
security = HTTPBearer()

# Initialize security logger
security_logger = get_logger(__name__, "security")


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
            security_logger.info("🔍 AUTH: Token missing subject claim")
            log_security_event(
                security_logger,
                event="token_invalid_no_subject",
                ip_address="middleware",  # IP will be captured by middleware
                message="JWT token missing subject claim",
            )
            raise credentials_exception

        security_logger.info(
            f"🔍 AUTH: Token decoded successfully for user: {username}"
        )

    except JWTError as e:
        security_logger.info(f"🔍 AUTH: Token decode failed: {str(e)}")
        log_security_event(
            security_logger,
            event="token_decode_failed",
            ip_address="middleware",  # IP will be captured by middleware
            message=f"JWT token decode failed: {str(e)}",
        )
        raise credentials_exception

    # Get user from database (caching disabled to avoid session issues)
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


def get_current_user_patient_id(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> int:
    """
    Get the current user's patient ID.

    This is a convenience dependency that handles getting the user's patient record
    and returns the patient_id for use in medical record endpoints.

    Args:
        db: Database session
        current_user_id: Current authenticated user ID

    Returns:
        Patient ID for the current user

    Raises:
        HTTPException 404: If patient record not found
    """
    from app.crud.patient import patient

    patient_record = patient.get_by_user_id(db, user_id=current_user_id)
    if not patient_record:
        raise HTTPException(status_code=404, detail="Patient record not found")

    return getattr(patient_record, "id")


def verify_patient_record_access(
    record_patient_id: int,
    current_user_patient_id: int,
    record_type: str = "record",
) -> None:
    """
    Verify that a medical record belongs to the current user.

    Args:
        record_patient_id: Patient ID from the medical record
        current_user_patient_id: Patient ID of the current user
        record_type: Type of record for error message (e.g., "medication", "allergy")

    Raises:
        HTTPException 404: If record doesn't belong to current user
    """
    if record_patient_id != current_user_patient_id:
        raise HTTPException(status_code=404, detail=f"{record_type.title()} not found")


def verify_patient_access(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> int:
    """
    Dependency that verifies the current user can access the specified patient's records.

    This dependency automatically:
    1. Gets the current user's patient ID
    2. Verifies they have access to the requested patient_id
    3. Returns the verified patient_id for use in the endpoint

    Args:
        patient_id: The patient ID from the URL path
        db: Database session
        current_user_id: Current authenticated user ID

    Returns:
        The verified patient_id

    Raises:
        HTTPException 404: If patient not found or access denied
    """
    # Get current user's patient ID
    current_user_patient_id = get_current_user_patient_id(db, current_user_id)

    # Verify access to this patient's records
    verify_patient_record_access(
        record_patient_id=patient_id,
        current_user_patient_id=current_user_patient_id,
        record_type="patient records",
    )

    return patient_id
