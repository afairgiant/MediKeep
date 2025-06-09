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
    client_ip = request.client.host if request.client else "unknown"

    # Log registration attempt
    logger.info(
        f"User registration attempt for username: {user_in.username}",
        extra={
            "category": "security",
            "event": "user_registration_attempt",
            "username": user_in.username,
            "ip": client_ip,
        },
    )

    # Check if username already exists
    existing_user = user.get_by_username(db, username=user_in.username)
    if existing_user:
        # Log failed registration attempt
        log_security_event(
            security_logger,
            event="registration_failed_username_exists",
            ip_address=client_ip,
            message=f"Registration failed: username {user_in.username} already exists",
            username=user_in.username,
        )
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

    try:
        # Get the actual user ID value from the SQLAlchemy model
        user_id = getattr(new_user, "id", None)
        if user_id is None:
            raise ValueError("User ID not found after creation")

        patient.create_for_user(db, user_id=user_id, patient_data=default_patient_data)

        # Log successful registration
        logger.info(
            f"User registration successful for username: {user_in.username}",
            extra={
                "category": "security",
                "event": "user_registration_success",
                "user_id": user_id,
                "username": user_in.username,
                "ip": client_ip,
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
    client_ip = request.client.host if request.client else "unknown"

    # Log login attempt
    logger.info(
        f"Login attempt for username: {form_data.username}",
        extra={
            "category": "security",
            "event": "login_attempt",
            "username": form_data.username,
            "ip": client_ip,
        },
    )

    # Authenticate user
    db_user = user.authenticate(
        db, username=form_data.username, password=form_data.password
    )

    if not db_user:
        # Log failed login attempt
        log_security_event(
            security_logger,
            event="login_failed",
            ip_address=client_ip,
            message=f"Failed login attempt for username: {form_data.username}",
            username=form_data.username,
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username}, expires_delta=access_token_expires
    )

    # Log successful login
    user_id = getattr(db_user, "id", None)
    logger.info(
        f"Login successful for username: {form_data.username}",
        extra={
            "category": "security",
            "event": "login_success",
            "user_id": user_id,
            "username": form_data.username,
            "ip": client_ip,
        },
    )

    return {"access_token": access_token, "token_type": "bearer"}
