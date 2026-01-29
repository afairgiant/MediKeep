from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import BusinessLogicException, ConflictException, UnauthorizedException
from app.core.config import settings
from app.core.events import get_event_bus
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_security_event,
)
from app.core.utils.security import create_access_token, verify_password
from app.crud.patient import patient
from app.crud.user import user
from app.events.security_events import PasswordChangedEvent
from app.models.models import Patient, User as DBUser
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
        log_security_event(
            logger,
            "registration_blocked",
            request,
            f"Registration attempt blocked - registration disabled. Username: {user_in.username}",
            username=user_in.username,
        )
        raise UnauthorizedException(
            message="New user registration is currently disabled. Please contact an administrator.",
            request=request
        )
    
    user_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Log registration attempt using security audit system
    log_security_event(
        logger,
        "user_registration_attempt",
        request,
        f"User registration attempt for username: {user_in.username}",
        username=user_in.username,
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
        
        # Create self-record for the new user and set as active
        # Note: PatientManagementService.create_patient() handles its own transaction
        created_patient = patient_service.create_patient(
            user=new_user,
            patient_data=patient_data,
            is_self_record=True
        )

        # Try to set the newly created patient as the user's active patient
        try:
            new_user.active_patient_id = created_patient.id
            db.commit()
            db.refresh(new_user)

            # Log successful patient creation and activation
            log_endpoint_access(
                logger,
                request,
                user_id,
                "patient_creation_success",
                message="Patient record created and set as active for new user",
                username=user_in.username,
                patient_id=created_patient.id,
            )
        except Exception as active_patient_error:
            # Patient was created successfully, but setting as active failed
            # This is not critical - user can set active patient later
            log_endpoint_error(
                logger,
                request,
                "Patient created but failed to set as active during registration",
                active_patient_error,
                user_id=user_id,
                username=user_in.username,
                patient_id=created_patient.id,
            )
            # Continue - patient exists, just not set as active

    except Exception as e:
        # If patient creation fails, we should still return the user
        # but log the error for debugging
        log_endpoint_error(
            logger,
            request,
            f"Failed to create patient record for user {user_id}: {e}",
            e,
            user_id=user_id,
            username=user_in.username,
        )
        # For new user registration failures, we may want to consider rolling back
        # the user creation as well, but for now we'll just continue without a patient

    return new_user


def log_successful_login(user_id: int, username: str, request: Request):
    """
    Logs a successful login event.
    """
    log_endpoint_access(
        logger,
        request,
        user_id,
        "login_success",
        message=f"Login successful for username: {username}",
        username=username,
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
    log_security_event(
        logger,
        "login_attempt",
        request,
        f"Login attempt for username: {form_data.username}",
        username=form_data.username,
    )

    # Authenticate user
    db_user = user.authenticate(
        db, username=form_data.username, password=form_data.password
    )

    if not db_user:
        # Log failed login attempt
        log_security_event(
            logger,
            "login_failed",
            request,
            f"Failed login attempt for username: {form_data.username}",
            username=form_data.username,
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
            try:
                db_user.active_patient_id = available_patient.id
                db.commit()
                db.refresh(db_user)

                log_endpoint_access(
                    logger,
                    request,
                    db_user.id,
                    "active_patient_auto_set",
                    message="Auto-setting active patient during login",
                    patient_id=available_patient.id,
                    is_self_record=available_patient.is_self_record,
                )
            except Exception as e:
                db.rollback()
                log_endpoint_error(
                    logger,
                    request,
                    "Failed to set active patient during login",
                    e,
                    user_id=db_user.id,
                    patient_id=available_patient.id,
                )
                # Continue login without active patient - user can set it later

    # Get full name, use username as fallback if not set
    full_name = getattr(db_user, "full_name", None) or db_user.username

    # Get user's timeout preference BEFORE creating the token
    from app.crud.user_preferences import user_preferences
    preferences = user_preferences.get_or_create_by_user_id(db, user_id=db_user.id)
    session_timeout_minutes = preferences.session_timeout_minutes if preferences else settings.ACCESS_TOKEN_EXPIRE_MINUTES

    # Create access token with user role and additional info
    # Use user's session timeout preference for token expiration
    access_token_expires = timedelta(minutes=session_timeout_minutes)
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

    # Log successful login with token expiration details
    log_successful_login(getattr(db_user, "id", 0), form_data.username, request)
    log_endpoint_access(
        logger,
        request,
        db_user.id,
        "token_created",
        message=f"JWT token created with {session_timeout_minutes} minute expiration",
        username=form_data.username,
        session_timeout_minutes=session_timeout_minutes,
        used_user_preference=bool(preferences and preferences.session_timeout_minutes),
    )

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "session_timeout_minutes": session_timeout_minutes
    }


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: DBUser = Depends(deps.get_current_user),
):
    """
    Change user password.

    Requires the current password to be provided for security.
    """
    log_security_event(
        logger,
        "password_change_attempt",
        request,
        f"Password change attempt for user: {current_user.username}",
        user_id=current_user.id,
        username=current_user.username,
    )

    # Verify current password
    if not verify_password(
        password_data.currentPassword, str(current_user.password_hash)
    ):
        log_security_event(
            logger,
            "password_change_failed_verification",
            request,
            f"Failed password change attempt - incorrect current password for user: {current_user.username}",
            user_id=current_user.id,
            username=current_user.username,
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

    log_security_event(
        logger,
        "password_change_success",
        request,
        f"Password changed successfully for user: {current_user.username}",
        user_id=current_user.id,
        username=current_user.username,
    )

    # Publish password changed event
    event = PasswordChangedEvent(
        user_id=current_user.id,
        change_time=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    )
    await get_event_bus().publish(event)

    return {"message": "Password changed successfully"}
