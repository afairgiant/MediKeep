from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.crud.user import user
from app.crud.patient import patient
from app.schemas.user import User, UserCreate, Token
from app.schemas.patient import PatientCreate
from app.core.security import create_access_token
from datetime import date

router = APIRouter()


@router.post("/register", response_model=User)
def register(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
):
    """
    Register a new user.

    Creates a new user account with username and password.
    The password will be automatically hashed for security.
    A basic patient record is automatically created for the user.
    """
    # Check if username already exists
    existing_user = user.get_by_username(db, username=user_in.username)
    if existing_user:
        raise HTTPException(
            status_code=400, detail="Username already registered"
        )  # Create new user
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
    except Exception as e:
        # If patient creation fails, we should still return the user
        # but log the error for debugging
        print(f"Warning: Failed to create patient record for user {user_id}: {e}")

    return new_user


@router.post("/login", response_model=Token)
def login(
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    Login with username and password to get an access token.

    Returns a JWT token that can be used for authenticated requests.
    """
    # Authenticate user
    db_user = user.authenticate(
        db, username=form_data.username, password=form_data.password
    )

    if not db_user:
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

    return {"access_token": access_token, "token_type": "bearer"}
