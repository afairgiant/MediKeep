from datetime import date, timedelta

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.core.logging_config import get_logger, log_security_event
from app.core.security import create_access_token, verify_password
from app.core.error_handling import (
    UnauthorizedException,
    ConflictException,
    BusinessLogicException,
    handle_database_errors
)
from app.crud.patient import patient
from app.crud.user import user
from app.models.models import User as DBUser, Patient
from app.schemas.patient import PatientCreate
from app.schemas.user import Token, User, UserCreate

router = APIRouter()

# Initialize loggers
logger = get_logger(__name__, "app")
security_logger = get_logger(__name__, "security")


@router.get("/registration-status")
def get_registration_status():
    """Check if new user registration is enabled."""
    return {
        "registration_enabled": settings.ALLOW_USER_REGISTRATION,
        "message": "Registration is currently disabled. Please contact an administrator." 
                   if not settings.ALLOW_USER_REGISTRATION else None
    }


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
    # Check if registration is enabled
    if not settings.ALLOW_USER_REGISTRATION:
        logger.warning(
            f"Registration attempt blocked - registration disabled. Username: {user_in.username}",
            extra={
                "category": "security",
                "event": "registration_blocked",
                "username": user_in.username,
                "ip": request.client.host if request.client else "unknown",
            },
        )
        raise UnauthorizedException(
            message="New user registration is currently disabled. Please contact an administrator.",
            request=request
        )
    
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
        raise ConflictException(
            message=f"An account with the username '{user_in.username}' already exists. Please choose a different username.",
            request=request
        )
    
    # Check if email already exists
    existing_email = user.get_by_email(db, email=user_in.email)
    if existing_email:
        raise ConflictException(
            message=f"An account with the email address '{user_in.email}' already exists. Please use a different email or try logging in.",
            request=request
        )

    # Create new user with database error handling
    with handle_database_errors(request=request):
        new_user = user.create(db, obj_in=user_in)

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
        
        # Create self-record for the new user and set as active in a single transaction
        try:
            created_patient = patient_service.create_patient(
                user=new_user,
                patient_data=patient_data,
                is_self_record=True
            )

            # Set the newly created patient as the user's active patient
            new_user.active_patient_id = created_patient.id
            db.commit()
            db.refresh(new_user)

            # Log successful patient creation
            logger.info(
                "Patient record created and set as active for new user",
                extra={
                    "category": "app",
                    "event": "patient_creation_success",
                    "user_id": user_id,
                    "username": user_in.username,
                    "patient_id": created_patient.id,
                },
            )
        except Exception as active_patient_error:
            # If setting active patient fails, rollback and continue without active patient
            db.rollback()
            logger.error(
                "Failed to set active patient during registration",
                extra={
                    "category": "app",
                    "event": "active_patient_set_failed",
                    "user_id": user_id,
                    "username": user_in.username,
                    "error": str(active_patient_error),
                },
            )
            # Continue without active patient - user can set it later

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
        # For new user registration failures, we may want to consider rolling back
        # the user creation as well, but for now we'll just continue without a patient

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

        raise UnauthorizedException(
            message="Incorrect username or password",
            request=request,
        )

    # Validate required fields
    if db_user.id is None:
        raise BusinessLogicException(
            message="User account is incomplete. Please contact support.",
            request=request
        )

    # Check if user has an active patient, if not try to set one
    if not db_user.active_patient_id:
        # Single query with priority ordering: self-records first, then by ID
        available_patient = db.query(Patient).filter(
            Patient.owner_user_id == db_user.id
        ).order_by(
            Patient.is_self_record.desc(),
            Patient.id.asc()
        ).first()

        if available_patient:
            db_user.active_patient_id = available_patient.id
            db.commit()
            db.refresh(db_user)

            logger.info(
                "Auto-setting active patient during login",
                extra={
                    "category": "app",
                    "event": "active_patient_auto_set",
                    "user_id": db_user.id,
                    "patient_id": available_patient.id,
                    "is_self_record": available_patient.is_self_record,
                },
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

    # Get user's timeout preference
    from app.crud.user_preferences import user_preferences
    preferences = user_preferences.get_or_create_by_user_id(db, user_id=db_user.id)
    session_timeout_minutes = preferences.session_timeout_minutes if preferences else 30

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "session_timeout_minutes": session_timeout_minutes
    }


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
        raise UnauthorizedException(
            message="Current password is incorrect",
            request=request
        )

    # Validate new password
    if len(password_data.newPassword) < 6:
        raise BusinessLogicException(
            message="New password must be at least 6 characters long",
            request=request
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
