from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.core.logging_config import get_logger, log_security_event
from app.core.security import create_access_token, verify_password
from app.crud.patient import patient
from app.crud.user import user
from app.models.models import User as DBUser
from app.schemas.patient import PatientCreate
from app.schemas.user import Token, User, UserCreate

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
        raise HTTPException(
            status_code=400, 
            detail=f"An account with the username '{user_in.username}' already exists. Please choose a different username."
        )
    
    # Check if email already exists
    existing_email = user.get_by_email(db, email=user_in.email)
    if existing_email:
        raise HTTPException(
            status_code=400, 
            detail=f"An account with the email address '{user_in.email}' already exists. Please use a different email or try logging in."
        )

    # Create new user
    try:
        new_user = user.create(db, obj_in=user_in)
    except Exception as e:
        # Handle any database constraint violations or other creation errors
        error_msg = str(e).lower()
        if "duplicate" in error_msg or "unique" in error_msg:
            if "username" in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"An account with the username '{user_in.username}' already exists. Please choose a different username."
                )
            elif "email" in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"An account with the email address '{user_in.email}' already exists. Please use a different email or try logging in."
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail="An account with this information already exists. Please check your username and email."
                )
        else:
            # For other database errors, provide a generic message
            logger.error(f"Database error during user creation: {e}")
            raise HTTPException(
                status_code=500,
                detail="Unable to create account at this time. Please try again later."
            )

    # Create a basic patient record for the new user using Phase 1 approach
    # Extract first/last names from available user data
    first_name = getattr(user_in, 'first_name', None)
    last_name = getattr(user_in, 'last_name', None)
    
    # If first/last names aren't provided, try to parse from full_name
    if not first_name or not last_name:
        full_name = getattr(user_in, 'full_name', '')
        if full_name:
            name_parts = full_name.strip().split()
            if len(name_parts) >= 2:
                first_name = first_name or name_parts[0]
                last_name = last_name or ' '.join(name_parts[1:])
            elif len(name_parts) == 1:
                first_name = first_name or name_parts[0]
                last_name = last_name or name_parts[0]  # Use same name for both
    
    # Final fallbacks
    first_name = first_name or "Update"
    last_name = last_name or "Your Name"
    
    try:  # Get the actual user ID value from the SQLAlchemy model
        user_id = getattr(new_user, "id", None)
        if user_id is None:
            raise ValueError("User ID not found after creation")

        # Use Phase 1 patient management service to create self-record
        from app.services.patient_management import PatientManagementService
        patient_service = PatientManagementService(db)
        
        patient_data = {
            "first_name": first_name,
            "last_name": last_name,
            "birth_date": date.today().replace(year=date.today().year - 25),  # 25 years ago as reasonable default
            "gender": "OTHER",  # Neutral default
            "address": "Please update your address in your profile",  # Placeholder address
        }
        
        # Create self-record for the new user
        patient_service.create_patient(
            user=new_user,
            patient_data=patient_data,
            is_self_record=True
        )
        
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

    # Get full name, use username as fallback if not set
    full_name = getattr(db_user, "full_name", None) or db_user.username

    # Create access token with user role and additional info
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": db_user.username,
            "role": (
                db_user.role if db_user.role in ["admin", "user", "guest"] else "user"
            ),
            "user_id": db_user.id,
            "full_name": full_name,
        },
        expires_delta=access_token_expires,
    )

    # Log successful login
    log_successful_login(getattr(db_user, "id", 0), form_data.username, user_ip)

    return {"access_token": access_token, "token_type": "bearer"}


from pydantic import BaseModel


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


@router.post("/change-password")
def change_password(
    password_data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: DBUser = Depends(deps.get_current_user),
):
    """
    Change user password.

    Requires the current password to be provided for security.
    """
    user_ip = request.client.host if request.client else "unknown"

    logger.info(
        f"Password change attempt for user: {current_user.username}",
        extra={
            "category": "security",
            "event": "password_change_attempt",
            "user_id": current_user.id,
            "username": current_user.username,
            "ip": user_ip,
        },
    )

    # Verify current password
    if not verify_password(
        password_data.currentPassword, str(current_user.password_hash)
    ):
        logger.warning(
            f"Failed password change attempt - incorrect current password for user: {current_user.username}",
            extra={
                "category": "security",
                "event": "password_change_failed_verification",
                "user_id": current_user.id,
                "username": current_user.username,
                "ip": user_ip,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Validate new password
    if len(password_data.newPassword) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long",
        )

    # Update password
    user.update_password_by_user(
        db, user_obj=current_user, new_password=password_data.newPassword
    )

    logger.info(
        f"Password changed successfully for user: {current_user.username}",
        extra={
            "category": "security",
            "event": "password_change_success",
            "user_id": current_user.id,
            "username": current_user.username,
            "ip": user_ip,
        },
    )

    return {"message": "Password changed successfully"}
