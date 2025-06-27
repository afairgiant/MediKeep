from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.core.logging_config import get_logger
from app.crud.patient import patient
from app.crud.user import user
from app.models.models import User
from app.schemas.patient import PatientCreate
from app.schemas.user import UserCreate

logger = get_logger(__name__, "auth_service")


class AuthService:
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        """Authenticate user with username and password"""
        return user.authenticate(db, username=username, password=password)

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Get user by username"""
        return user.get_by_username(db, username=username)

    @staticmethod
    def create_user(
        db: Session, username: str, password: str, is_superuser: bool = False
    ) -> User:
        """Create a new user with an associated patient record"""
        # Create the user first
        user_create = UserCreate(
            username=username,
            email=f"{username}@example.com",  # Default email
            full_name=username.title(),  # Default full name
            role="admin" if is_superuser else "user",
            password=password,
        )
        new_user = user.create(db, obj_in=user_create)

        # Create a patient record for the user
        try:
            patient_data = PatientCreate(
                first_name=username.title(),  # Use username as first name
                last_name="User",  # Default last name
                birthDate=date(1990, 1, 1),  # Default birth date
                gender="OTHER",  # Neutral default
                address="Please update your address",  # Placeholder
            )

            # Get the user ID
            user_id = getattr(new_user, "id", None)
            if user_id:
                patient.create_for_user(db, user_id=user_id, patient_data=patient_data)
                logger.info(f"Patient record created for user {username}")
            else:
                logger.warning(
                    f"Could not create patient record for {username} - no user ID"
                )

        except Exception as e:
            logger.warning(f"Failed to create patient record for {username}: {e}")
            # Don't fail user creation if patient creation fails

        return new_user
