from typing import Generator, Optional

from fastapi import Depends, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging_config import get_logger, log_security_event
from app.core.error_handling import UnauthorizedException, ForbiddenException, NotFoundException, MedicalRecordsAPIException
from app.api.v1.endpoints.system import get_client_ip
from app.core.logging_constants import sanitize_log_input
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
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """
    Get current authenticated user from JWT token.

    Args:
        request: FastAPI request object for extracting client info
        db: Database session
        credentials: JWT token from Authorization header

    Returns:
        Current user object

    Raises:
        UnauthorizedException: If token is invalid or user not found
    """
    # Extract client information for security logging
    client_ip = get_client_ip(request)
    user_agent = sanitize_log_input(request.headers.get("user-agent", "unknown"))

    # Standardized authentication error

    try:
        # Validate token format before attempting to decode
        token_str = credentials.credentials.strip()
        if not token_str:
            security_logger.info("🔍 AUTH: Empty token provided")
            log_security_event(
                security_logger,
                event="token_empty",
                ip_address=client_ip,
                user_agent=user_agent,
                message="Empty JWT token provided",
            )
            raise UnauthorizedException(
                message="Authentication failed",
                request=request,
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        # Basic JWT format validation (should have 3 parts separated by dots)
        token_parts = token_str.split('.')
        if len(token_parts) != 3:
            security_logger.info(f"🔍 AUTH: Invalid token format - expected 3 parts, got {len(token_parts)}")
            log_security_event(
                security_logger,
                event="token_invalid_format",
                ip_address=client_ip,
                user_agent=user_agent,
                message=f"Invalid JWT token format - expected 3 parts, got {len(token_parts)}",
            )
            raise UnauthorizedException(
                message="Authentication failed",
                request=request,
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Decode JWT token
        payload = jwt.decode(
            token_str,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        username = payload.get("sub")
        if username is None:
            security_logger.info("🔍 AUTH: Token missing subject claim")
            log_security_event(
                security_logger,
                event="token_invalid_no_subject",
                ip_address=client_ip,
                user_agent=user_agent,
                message="JWT token missing subject claim",
            )
            raise UnauthorizedException(
                message="Authentication failed",
                request=request,
                headers={"WWW-Authenticate": "Bearer"}
            )

        security_logger.info(
            f"🔍 AUTH: Token decoded successfully for user: {username}"
        )

    except JWTError as e:
        security_logger.info(f"🔍 AUTH: Token decode failed: {str(e)}")
        log_security_event(
            security_logger,
            event="token_decode_failed",
            ip_address=client_ip,
            user_agent=user_agent,
            message=f"JWT token decode failed: {str(e)}",
        )
        raise UnauthorizedException(
            message="Token validation failed",
            request=request,
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Get user from database (caching disabled to avoid session issues)
    try:
        db_user = user.get_by_username(db, username=username)
        if db_user is None:
            log_security_event(
                security_logger,
                event="token_user_not_found",
                ip_address=client_ip,
                user_agent=user_agent,
                message=f"Token valid but user not found: {username}",
                username=username,
            )
            raise UnauthorizedException(
                message="Authentication failed",
                request=request,
                headers={"WWW-Authenticate": "Bearer"}
            )

    except Exception as e:
        log_security_event(
            security_logger,
            event="token_user_lookup_error",
            ip_address=client_ip,
            user_agent=user_agent,
            message=f"Database error during user lookup for {username}: {str(e)}",
            username=username,
        )
        raise UnauthorizedException(
            message="Token validation failed",
            request=request,
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Log successful token validation
    user_id = getattr(db_user, "id", None)
    log_security_event(
        security_logger,
        event="token_validated_success",
        user_id=user_id,
        ip_address=client_ip,
        user_agent=user_agent,
        message=f"Token successfully validated for user: {username}",
        username=username,
    )

    return db_user


def get_current_user_flexible_auth(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    token: Optional[str] = Query(None, description="JWT token for query parameter authentication")
) -> User:
    """
    Get current authenticated user with flexible authentication.
    
    Supports both Authorization header and query parameter token authentication.
    This is primarily intended for file viewing endpoints where Authorization headers
    may not be available (e.g., when opening files in new browser tabs).
    
    SECURITY CONSIDERATIONS:
    - Query parameter tokens may be logged in server access logs
    - Query parameter tokens appear in browser history
    - Authorization header is preferred when available
    - This method should only be used for endpoints that require browser-native access
    
    Args:
        request: FastAPI request object
        db: Database session
        credentials: JWT token from Authorization header (optional)
        token: JWT token from query parameter (optional)
        
    Returns:
        Current user object
        
    Raises:
        UnauthorizedException: If no valid token is provided or token is invalid
    """
    # Extract client information for security logging
    client_ip = get_client_ip(request)
    user_agent = sanitize_log_input(request.headers.get("user-agent", "unknown"))
    # Standardized authentication error
    
    # Try to get token from Authorization header first, then query parameter
    jwt_token = None
    auth_method = None
    
    if credentials and credentials.credentials:
        jwt_token = credentials.credentials
        auth_method = "header"
    elif token:
        jwt_token = token
        auth_method = "query_param"
        # Log query parameter usage for security monitoring
        security_logger.info("Authentication via query parameter token (for file viewing)")
    else:
        security_logger.warning("No authentication token provided (header or query param)")
        log_security_event(
            security_logger,
            event="auth_no_token_provided",
            ip_address=client_ip,
            user_agent=user_agent,
            message="No JWT token provided in header or query parameter",
        )
        raise UnauthorizedException(
            message="Token validation failed",
            request=request,
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    try:
        # Validate token format before attempting to decode
        token_str = jwt_token.strip()
        if not token_str:
            security_logger.info(f"AUTH ({auth_method}): Empty token provided")
            log_security_event(
                security_logger,
                event="token_empty",
                ip_address=client_ip,
                user_agent=user_agent,
                message=f"Empty JWT token provided (auth method: {auth_method})",
            )
            raise UnauthorizedException(
                message="Authentication failed",
                request=request,
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        # Basic JWT format validation (should have 3 parts separated by dots)
        token_parts = token_str.split('.')
        if len(token_parts) != 3:
            security_logger.info(f"AUTH ({auth_method}): Invalid token format - expected 3 parts, got {len(token_parts)}")
            log_security_event(
                security_logger,
                event="token_invalid_format",
                ip_address=client_ip,
                user_agent=user_agent,
                message=f"Invalid JWT token format - expected 3 parts, got {len(token_parts)} (auth method: {auth_method})",
            )
            raise UnauthorizedException(
                message="Authentication failed",
                request=request,
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Decode JWT token using the same validation as get_current_user
        payload = jwt.decode(
            token_str,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        username = payload.get("sub")
        if username is None:
            security_logger.info(f"AUTH ({auth_method}): Token missing subject claim")
            log_security_event(
                security_logger,
                event="token_invalid_no_subject",
                ip_address=client_ip,
                user_agent=user_agent,
                message=f"JWT token missing subject claim (auth method: {auth_method})",
            )
            raise UnauthorizedException(
                message="Authentication failed",
                request=request,
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        security_logger.info(
            f"AUTH ({auth_method}): Token decoded successfully for user: {username}"
        )
        
    except JWTError as e:
        security_logger.info(f"AUTH ({auth_method}): Token decode failed: {str(e)}")
        log_security_event(
            security_logger,
            event="token_decode_failed",
            ip_address=client_ip,
            user_agent=user_agent,
            message=f"JWT token decode failed (auth method: {auth_method}): {str(e)}",
        )
        raise UnauthorizedException(
            message="Token validation failed",
            request=request,
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Get user from database (same logic as get_current_user)
    try:
        db_user = user.get_by_username(db, username=username)
        if db_user is None:
            log_security_event(
                security_logger,
                event="token_user_not_found",
                ip_address=client_ip,
                user_agent=user_agent,
                message=f"Token valid but user not found: {username} (auth method: {auth_method})",
                username=username,
            )
            raise UnauthorizedException(
                message="Authentication failed",
                request=request,
                headers={"WWW-Authenticate": "Bearer"}
            )
            
    except Exception as e:
        log_security_event(
            security_logger,
            event="token_user_lookup_error",
            ip_address=client_ip,
            user_agent=user_agent,
            message=f"Database error during user lookup for {username} (auth method: {auth_method}): {str(e)}",
            username=username,
        )
        raise UnauthorizedException(
            message="Token validation failed",
            request=request,
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Log successful token validation with auth method
    user_id = getattr(db_user, "id", None)
    log_security_event(
        security_logger,
        event="token_validated_success",
        user_id=user_id,
        ip_address=client_ip,
        user_agent=user_agent,
        message=f"Token successfully validated for user: {username} (auth method: {auth_method})",
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
        raise MedicalRecordsAPIException(
            status_code=500,
            message="User ID not found",
            request=None
        )
    return user_id


def get_current_user_id_flexible_auth(current_user: User = Depends(get_current_user_flexible_auth)) -> int:
    """
    Get the current user's ID as an integer using flexible authentication.
    
    This helper function works with the flexible authentication dependency
    that supports both header and query parameter authentication.
    
    Args:
        current_user: The current authenticated user from flexible auth
        
    Returns:
        User ID as integer
    """
    # Use getattr to safely access the id value from the SQLAlchemy model
    user_id = getattr(current_user, "id", None)
    if user_id is None:
        raise MedicalRecordsAPIException(
            status_code=500,
            message="User ID not found",
            request=None
        )
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
        ForbiddenException: If user is not an admin
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
        raise ForbiddenException(
            message="Admin privileges required",
            request=None
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
        NotFoundException: If patient record not found
    """
    from app.crud.patient import patient

    patient_record = patient.get_by_user_id(db, user_id=current_user_id)
    if not patient_record:
        raise NotFoundException(
            message="Patient record not found",
            request=None
        )

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
        NotFoundException: If record doesn't belong to current user
    """
    if record_patient_id != current_user_patient_id:
        raise NotFoundException(
            message=f"{record_type.title()} not found",
            request=None
        )


def verify_patient_access(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    required_permission: str = "view"
) -> int:
    """
    Dependency that verifies the current user can access the specified patient's records.
    
    This function supports Phase 1 patient access including:
    - Own patients (always accessible)
    - Shared patients (with proper permission levels)

    Args:
        patient_id: The patient ID from the URL path
        db: Database session
        current_user: Current authenticated user
        required_permission: Required permission level ('view', 'edit', 'full')

    Returns:
        The verified patient_id

    Raises:
        NotFoundException: If patient not found
        ForbiddenException: If access denied
    """
    from app.models.models import Patient
    from app.services.patient_access import PatientAccessService
    
    # Get the patient record
    patient_record = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient_record:
        raise NotFoundException(
            message="Patient not found",
            request=None
        )
    
    # Check access using the PatientAccessService
    access_service = PatientAccessService(db)
    if not access_service.can_access_patient(current_user, patient_record, required_permission):
        raise ForbiddenException(
            message=f"Access denied to patient {patient_id}",
            request=None
        )
    
    return patient_id


def get_accessible_patient_id(
    patient_id: Optional[int] = Query(None, description="Patient ID for Phase 1 patient switching"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> int:
    """
    Get an accessible patient ID for Phase 1 patient switching.
    
    If patient_id is provided, verifies access and returns it.
    If patient_id is None, returns the current user's own patient ID.
    
    Args:
        patient_id: Optional patient ID from query parameter
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Patient ID that the user can access
        
    Raises:
        NotFoundException: If patient not found
        ForbiddenException: If access denied
    """
    if patient_id is not None:
        # Verify user has access to this patient
        from app.models.models import Patient
        from app.services.patient_access import PatientAccessService
        
        patient_record = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient_record:
            raise NotFoundException(
                message="Patient not found",
                request=None
            )
        
        access_service = PatientAccessService(db)
        if not access_service.can_access_patient(current_user, patient_record, "view"):
            raise ForbiddenException(
                message="Access denied to patient",
                request=None
            )
            
        return patient_id
    else:
        # Fall back to user's own patient ID
        return get_current_user_patient_id(db, current_user.id)
