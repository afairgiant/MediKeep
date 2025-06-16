from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.crud.user import user
from app.crud.patient import patient
from app.schemas.user import User, UserCreate, Token
from app.schemas.patient import PatientCreate
from app.core.security import create_access_token
from app.core.logging_config import get_logger, log_security_event
from datetime import date


router = APIRouter()

# Initialize loggers
logger = get_logger(__name__, "app")
security_logger = get_logger(__name__, "security")


@router.post("/register", response_model=User)
def register(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    request: Request,
):
    """
    Register a new user.

    Creates a new user account with username and password.
    The password will be automatically hashed for security.
    A basic patient record is automatically created for the user.
    """
    user_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Log registration attempt using security audit system
    logger.info(
        f"User registration attempt for username: {user_in.username}",
        extra={
            "category": "security",
            "event": "user_registration_attempt",
            "username": user_in.username,
            "ip": user_ip,
        },
    )

    # Check if username already exists
    existing_user = user.get_by_username(db, username=user_in.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Create new user
    new_user = user.create(db, obj_in=user_in)

    # Create a basic patient record for the new user
    # Use placeholder values that can be updated later by the user
    default_patient_data = PatientCreate(
        first_name="First Name",
        last_name="Last Name",
        birthDate=date(1990, 1, 1),  # Default birth date
        gender="OTHER",  # Neutral default
        address="Please update your address",  # Placeholder address
    )

    try:  # Get the actual user ID value from the SQLAlchemy model
        user_id = getattr(new_user, "id", None)
        if user_id is None:
            raise ValueError("User ID not found after creation")

        patient.create_for_user(db, user_id=user_id, patient_data=default_patient_data)
        # Log successful patient creation
        logger.info(
            f"Patient record created for user {user_id} ({user_in.username})",
            extra={
                "category": "app",
                "event": "patient_creation_success",
                "user_id": user_id,
                "username": user_in.username,
            },
        )

    except Exception as e:
        # If patient creation fails, we should still return the user
        # but log the error for debugging
        logger.error(
            f"Failed to create patient record for user {user_id}: {e}",
            extra={
                "category": "app",
                "event": "patient_creation_failed",
                "user_id": user_id,
                "username": user_in.username,
                "error": str(e),
            },
        )

    return new_user


def log_successful_login(user_id: int, username: str, ip: str):
    """
    Logs a successful login event.
    """
    logger.info(
        f"Login successful for username: {username}",
        extra={
            "category": "app",
            "event": "login_success",
            "user_id": user_id,
            "username": username,
            "ip": ip,
        },
    )


@router.post("/login", response_model=Token)
def login(
    request: Request,
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """
    Login with username and password to get an access token.

    Returns a JWT token that can be used for authenticated requests.
    """
    user_ip = (
        getattr(request.client, "host", "unknown") if request.client else "unknown"
    )

    # Log login attempt
    logger.info(
        f"Login attempt for username: {form_data.username}",
        extra={
            "category": "app",
            "event": "login_attempt",
            "username": form_data.username,
            "ip": user_ip,
        },
    )

    # Authenticate user
    db_user = user.authenticate(
        db, username=form_data.username, password=form_data.password
    )

    if not db_user:
        # Log failed login attempt
        logger.info(
            f"Failed login attempt for username: {form_data.username}",
            extra={
                "category": "app",
                "event": "login_failed",
                "username": form_data.username,
                "ip": user_ip,
            },
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate required fields
    if db_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID is missing in the database record",
        )

    full_name = getattr(db_user, "full_name", None)
    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required for login",
        )

    # Create access token with user role and additional info
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": db_user.username,
            "role": db_user.role
            if db_user.role in ["admin", "user", "guest"]
            else "user",
            "user_id": db_user.id,
            "full_name": full_name,
        },
        expires_delta=access_token_expires,
    )

    # Log successful login
    log_successful_login(getattr(db_user, "id", 0), form_data.username, user_ip)

    return {"access_token": access_token, "token_type": "bearer"}
